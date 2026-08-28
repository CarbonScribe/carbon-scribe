import { Injectable, Logger } from '@nestjs/common';
import { ValidationService } from './validation.service';
import { RetireCreditsDto } from '../dto/retire-credits.dto';
import { AvailabilityService } from '../../credit/services/availability.service';
import {
  AvailabilityChangeType,
  PrismaTxClient,
} from '../../credit/interfaces/availability.interface';

@Injectable()
export class InstantRetirementService {
  private readonly logger = new Logger(InstantRetirementService.name);

  constructor(
    private validationService: ValidationService,
    private readonly availability: AvailabilityService,
  ) {}

  /**
   * Retire credits immediately.
   *
   * Inventory handling (#516):
   *  - The advisory pre-check gives fast user-facing feedback, but the binding
   *    check happens *inside* the transaction below, while the credit row is
   *    locked, so the check and the decrement are no longer separated by a
   *    TOCTOU window.
   *  - The decrement goes through the shared {@link AvailabilityService}
   *    path — the same one used by cart reservation and order checkout — which
   *    previously was bypassed here by a hand-rolled
   *    `{ available: { decrement } }` update. `available` is not a field on the
   *    Prisma `Credit` model (the field is `availableAmount`), so that update
   *    threw at runtime and retired credits were never actually decremented.
   *  - Retirement deliberately does not take a CreditReservation of its own —
   *    it is a single atomic act with no user "hold" phase — but it *does*
   *    respect existing cart reservations, so a concurrent checkout and a
   *    direct retirement cannot both consume the same units.
   */
  async retire(companyId: string, userId: string, dto: RetireCreditsDto) {
    // 1. Advisory pre-check — fails fast with a friendly message before we
    //    open a transaction. Not the authoritative guard.
    await this.validationService.validateRetirement(
      companyId,
      dto.creditId,
      dto.amount,
    );

    return this.availability.runSerializable(async (txClient: unknown) => {
      const tx = txClient as any;

      // 2. Authoritative check, taking the credit's row lock for the rest of
      //    this transaction.
      await this.validationService.validateRetirementWithin(
        tx as PrismaTxClient,
        companyId,
        dto.creditId,
        dto.amount,
      );

      // 3. Decrement through the shared path, still under the same lock.
      const result = await this.availability.decrementWithin(
        tx as PrismaTxClient,
        {
          creditId: dto.creditId,
          amount: dto.amount,
          changedBy: userId,
          changeType: AvailabilityChangeType.RETIRE,
          reason: `retirement:${dto.purpose}`,
          respectReservations: true,
        },
      );

      this.logger.log(
        `Retiring ${dto.amount} units of credit ${dto.creditId} for company ${companyId} ` +
          `(availableAmount ${result.availableAmount} -> ${result.newAmount})`,
      );

      // 4. Create retirement record
      const retirement = await tx.retirement.create({
        data: {
          companyId,
          userId,
          creditId: dto.creditId,
          amount: dto.amount,
          purpose: dto.purpose,
          purposeDetails: dto.purposeDetails,
          priceAtRetirement: 10.0, // Mock price for now
          transactionHash: `tx_${Math.random().toString(36).substring(7)}`,
          transactionUrl: 'https://stellar.expert/explorer/testnet/tx/...',
          verifiedAt: new Date(),
        },
        include: {
          company: true,
          credit: true,
        },
      });

      // 5. Update retirement with serial number/certificate placeholder
      const serialNumber = `RET-${new Date().getFullYear()}-${retirement.id
        .slice(-6)
        .toUpperCase()}`;

      const updatedRetirement = await tx.retirement.update({
        where: { id: retirement.id },
        data: {
          certificateId: serialNumber,
        },
        include: {
          company: true,
          credit: true,
        },
      });

      return updatedRetirement;
    });
  }
}
