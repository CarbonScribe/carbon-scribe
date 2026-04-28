import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { RetirementTrackerService } from '../contracts/retirement-tracker.service';
import { SorobanService } from '../soroban.service';
import { ProofGeneratorService } from './proof-generator.service';

@Injectable()
export class RetirementVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trackerService: RetirementTrackerService,
    private readonly sorobanService: SorobanService,
    private readonly proofGenerator: ProofGeneratorService,
  ) {}

  async verifyRetirementOnChain(txHash: string, companyId: string) {
    const retirement = await this.prisma.retirement.findFirst({
      where: {
        transactionHash: txHash,
        companyId,
      },
      include: {
        credit: true,
      },
    });

    if (!retirement) {
      throw new NotFoundException('Retirement record not found');
    }

    const existing = await this.prisma.retirementVerification.findUnique({
      where: {
        transactionHash: txHash,
      },
    });

    if (existing) {
      return {
        verified: true,
        source: 'cache',
        ...existing,
      };
    }

    let txDetails: any = null;
    if (!txHash.startsWith('sim_')) {
      txDetails = await this.sorobanService
        .getTransaction(txHash)
        .catch(() => null);
      const txStatus = String(txDetails?.status || '').toUpperCase();
      if (txStatus && txStatus !== 'SUCCESS') {
        throw new UnauthorizedException('Retirement transaction not confirmed');
      }
    }

    const onChainRecord = await this.trackerService.getRetirementRecord(txHash);

    const tokenIds = this.extractTokenIds(onChainRecord, retirement);
    const amount = this.extractAmount(onChainRecord, retirement.amount);
    const blockNumber = Number(
      txDetails?.latestLedger || txDetails?.ledger || 0,
    );

    const leaf = this.proofGenerator.generateRetirementLeaf({
      txHash,
      tokenIds,
      amount,
      blockNumber,
    });

    const baseline = await this.prisma.retirementVerification.findMany({
      orderBy: {
        verifiedAt: 'desc',
      },
      take: 255,
    });

    const leaves = baseline.map((entry) =>
      this.proofGenerator.generateRetirementLeaf({
        txHash: entry.transactionHash,
        tokenIds: entry.tokenIds,
        amount: entry.amount,
        blockNumber: entry.blockNumber,
      }),
    );
    leaves.push(leaf);

    const proof = this.proofGenerator.generateProof(leaves, leaf);

    const verification = await this.prisma.retirementVerification.create({
      data: {
        retirementId: retirement.id,
        tokenIds,
        amount,
        transactionHash: txHash,
        blockNumber,
        proof: this.toJson({
          leaf,
          root: proof.root,
          path: proof.proof,
          leafCount: leaves.length,
        }),
      },
    });

    return {
      verified: true,
      source: 'onchain',
      onChainRecord,
      txDetails,
      ...verification,
    };
  }

  async getProof(txHash: string, companyId: string) {
    const retirement = await this.prisma.retirement.findFirst({
      where: {
        transactionHash: txHash,
        companyId,
      },
    });

    if (!retirement) {
      throw new NotFoundException('Retirement record not found');
    }

    const verification = await this.prisma.retirementVerification.findUnique({
      where: {
        transactionHash: txHash,
      },
    });

    if (!verification) {
      throw new NotFoundException('Proof not found for this retirement');
    }

    return {
      txHash,
      retirementId: verification.retirementId,
      amount: verification.amount,
      tokenIds: verification.tokenIds,
      blockNumber: verification.blockNumber,
      proof: verification.proof,
      verifiedAt: verification.verifiedAt,
    };
  }

  async generateCertificate(txHash: string, companyId: string) {
    const verification = await this.getProof(txHash, companyId);

    const retirement = await this.prisma.retirement.findFirst({
      where: {
        transactionHash: txHash,
        companyId,
      },
      include: {
        company: true,
        credit: true,
      },
    });

    if (!retirement) {
      throw new NotFoundException('Retirement record not found');
    }

    return {
      certificateId: retirement.certificateId || `RET-${retirement.id}`,
      txHash,
      companyName: retirement.company.name,
      projectName: retirement.credit.projectName,
      retiredAmount: retirement.amount,
      purpose: retirement.purpose,
      retiredAt: retirement.retiredAt,
      verification,
    };
  }

  private extractTokenIds(onChainRecord: any, retirement: any): number[] {
    const fromRecord =
      onChainRecord?.tokenIds ||
      onChainRecord?.token_ids ||
      onChainRecord?.tokens ||
      onChainRecord?.ids;

    if (Array.isArray(fromRecord)) {
      return fromRecord
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value));
    }

    const candidate = retirement.creditId
      ? Number.parseInt(
          String(retirement.creditId).replace(/\D/g, '').slice(-9),
          10,
        )
      : NaN;

    return Number.isInteger(candidate) ? [candidate] : [];
  }

  private extractAmount(onChainRecord: any, fallbackAmount: number): number {
    const raw =
      onChainRecord?.amount ||
      onChainRecord?.retiredAmount ||
      onChainRecord?.value;
    const amount = Number(raw);
    if (Number.isFinite(amount) && amount > 0) {
      return Math.floor(amount);
    }

    return Math.max(0, Math.floor(fallbackAmount || 0));
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  }
}
