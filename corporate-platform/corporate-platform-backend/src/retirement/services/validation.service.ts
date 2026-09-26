import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { AvailabilityService } from '../../credit/services/availability.service';
import {
  AvailabilityChangeType,
  PrismaTxClient,
} from '../../credit/interfaces/availability.interface';

@Injectable()
export class ValidationService {
  constructor(
    private prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  /**
   * Non-transactional pre-flight check, used for the `GET /retirements/validate`
   * preview endpoint and for fast feedback before the retirement transaction
   * starts.
   *
   * This read is advisory only: it is *not* the guard that protects inventory.
   * The authoritative check is {@link validateRetirementWithin}, which runs
   * inside the retirement transaction while holding the credit's row lock (#516).
   */
  async validateRetirement(
    companyId: string,
    creditId: string,
    amount: number,
  ) {
    const credit = await this.prisma.credit.findUnique({
      where: { id: creditId },
    });

    if (!credit) {
      throw new NotFoundException(`Credit with ID ${creditId} not found`);
    }

    // Mirror the effective-availability semantics of the transactional check so
    // the preview does not promise units that an active cart hold has claimed.
    const reserved = await (this.prisma as any).creditReservation.aggregate({
      where: { creditId, expiresAt: { gt: new Date() } },
      _sum: { quantity: true },
    });

    const availableAmount = credit.availableAmount ?? 0;
    const reservedAmount = reserved?._sum?.quantity ?? 0;
    const effectivelyAvailable = availableAmount - reservedAmount;

    if (effectivelyAvailable < amount) {
      throw new BadRequestException(
        `Insufficient credits available. Requested: ${amount}, Available: ${effectivelyAvailable}`,
      );
    }

    return {
      valid: true,
      available: effectivelyAvailable,
      maxAllowed: effectivelyAvailable,
      reserved: reservedAmount,
      rawAvailable: availableAmount,
    };
  }

  /**
   * Authoritative retirement check, run inside the retirement transaction.
   *
   * Delegates to the shared lock-safe availability path so the credit row is
   * locked (`SELECT ... FOR UPDATE`) for the remainder of the transaction that
   * performs the decrement — the check and the write are no longer separated by
   * a TOCTOU window, and units held by an active cart reservation are treated
   * as unavailable.
   */
  async validateRetirementWithin(
    tx: PrismaTxClient,
    companyId: string,
    creditId: string,
    amount: number,
  ) {
    const headroom = await this.availability.assertAvailableWithin(tx, {
      creditId,
      amount,
      changeType: AvailabilityChangeType.RETIRE,
      // Retirement does not create a cart reservation of its own, but it must
      // respect existing ones so a concurrent checkout and a direct retirement
      // cannot both succeed against the same units.
      respectReservations: true,
    });

    return {
      valid: true,
      available: headroom.effectivelyAvailable,
      maxAllowed: headroom.effectivelyAvailable,
      reserved: headroom.reservedAmount,
      rawAvailable: headroom.availableAmount,
    };
  }
}
