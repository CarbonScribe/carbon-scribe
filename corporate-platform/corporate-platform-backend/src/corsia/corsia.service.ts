import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../shared/database/prisma.service';
import { SecurityService } from '../security/security.service';
import { RetirementVerificationService } from '../compliance/services/retirement-verification.service';
import { RecordFlightDto } from './dto/record-flight.dto';
import { FlightEmissionsService } from './services/flight-emissions.service';
import { OffsetRequirementService } from './services/offset-requirement.service';
import { EmissionsReportService } from './services/emissions-report.service';
import { EligibleFuelsService } from './services/eligible-fuels.service';
import { VerifierService } from './services/verifier.service';
import {
  ComplianceFramework,
  OffsetClaimStatus,
} from '../compliance/dto/retirement-verification.dto';

@Injectable()
export class CorsiaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
    private readonly emissionsService: FlightEmissionsService,
    private readonly offsetRequirementService: OffsetRequirementService,
    private readonly emissionsReportService: EmissionsReportService,
    private readonly eligibleFuelsService: EligibleFuelsService,
    private readonly verifierService: VerifierService,
    private readonly retirementVerificationService: RetirementVerificationService,
  ) {}

  async recordFlight(companyId: string, dto: RecordFlightDto) {
    this.assertCompanyId(companyId);
    const departureDate = new Date(dto.departureDate);

    const co2Emissions = this.emissionsService.calculateCo2Emissions({
      companyId,
      flightNumber: dto.flightNumber,
      departureICAO: dto.departureICAO,
      arrivalICAO: dto.arrivalICAO,
      departureDate,
      aircraftType: dto.aircraftType,
      fuelBurn: dto.fuelBurn,
      fuelType: dto.fuelType,
      distance: dto.distance,
      passengerLoad: dto.passengerLoad,
      cargoLoad: dto.cargoLoad,
      metadata: dto.metadata,
    });

    const record = await this.prisma.flightRecord.create({
      data: {
        companyId,
        flightNumber: dto.flightNumber,
        departureICAO: dto.departureICAO,
        arrivalICAO: dto.arrivalICAO,
        departureDate,
        aircraftType: dto.aircraftType,
        fuelBurn: dto.fuelBurn,
        fuelType: dto.fuelType,
        distance: dto.distance,
        passengerLoad: dto.passengerLoad,
        cargoLoad: dto.cargoLoad,
        co2Emissions,
        metadata: dto.metadata as Prisma.InputJsonValue,
      },
    });

    await this.securityService.logEvent({
      eventType: 'corsia.flight.recorded' as any,
      companyId,
      details: { flightRecordId: record.id, departureDate: dto.departureDate },
      status: 'success',
    });

    return record;
  }

  async recordFlightsBatch(companyId: string, flights: RecordFlightDto[]) {
    this.assertCompanyId(companyId);

    if (!Array.isArray(flights) || flights.length === 0) {
      throw new BadRequestException('flights must contain at least one record');
    }

    const created = await Promise.all(
      flights.map((flight) => this.recordFlight(companyId, flight)),
    );

    return {
      count: created.length,
      records: created,
    };
  }

  async listFlights(companyId: string, year?: number) {
    this.assertCompanyId(companyId);

    const where: any = { companyId };

    if (year) {
      where.departureDate = {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      };
    }

    return this.prisma.flightRecord.findMany({
      where,
      orderBy: { departureDate: 'desc' },
    });
  }

  async getAnnualEmissions(companyId: string, year: number) {
    this.assertCompanyId(companyId);

    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));

    const flights = await this.prisma.flightRecord.findMany({
      where: {
        companyId,
        departureDate: {
          gte: start,
          lt: end,
        },
      },
    });

    const totalEmissions = flights.reduce(
      (sum, flight) => sum + flight.co2Emissions,
      0,
    );

    const totalFuelBurn = flights.reduce(
      (sum, flight) => sum + flight.fuelBurn,
      0,
    );

    const safFuelBurn = flights
      .filter((flight) => this.isSafFuel(flight.fuelType))
      .reduce((sum, flight) => sum + flight.fuelBurn, 0);

    const annual = await this.prisma.corsiaComplianceYear.upsert({
      where: {
        companyId_year: {
          companyId,
          year,
        },
      },
      update: {
        totalEmissions: Number(totalEmissions.toFixed(6)),
        metadata: {
          totalFuelBurn,
          safFuelBurn,
          totalFlights: flights.length,
          updatedAt: new Date().toISOString(),
        },
      },
      create: {
        companyId,
        year,
        totalEmissions: Number(totalEmissions.toFixed(6)),
        complianceStatus: 'PENDING',
        metadata: {
          totalFuelBurn,
          safFuelBurn,
          totalFlights: flights.length,
          createdAt: new Date().toISOString(),
        },
      },
    });

    return {
      companyId,
      year,
      totalFlights: flights.length,
      totalFuelBurn: Number(totalFuelBurn.toFixed(6)),
      safFuelBurn: Number(safFuelBurn.toFixed(6)),
      totalEmissions: Number(totalEmissions.toFixed(6)),
      annual,
    };
  }

  async calculateOffsetRequirement(companyId: string, year: number) {
    this.assertCompanyId(companyId);

    const annual = await this.getAnnualEmissions(companyId, year);

    const baselineEmissions = await this.resolveBaselineEmissions(companyId);

    const calculated = this.offsetRequirementService.calculateOffsetRequirement(
      {
        year,
        totalEmissions: annual.totalEmissions,
        baselineEmissions,
        sectoralGrowthFactor: 1,
        individualGrowthFactor: 1,
      },
    );

    const updated = await this.prisma.corsiaComplianceYear.update({
      where: {
        companyId_year: {
          companyId,
          year,
        },
      },
      data: {
        baselineEmissions,
        offsetRequirement: calculated.offsetRequirement,
      },
    });

    return {
      ...calculated,
      complianceYearId: updated.id,
    };
  }

  async validateCredits(companyId: string, retirementIds: string[]) {
    this.assertCompanyId(companyId);

    if (!retirementIds.length) {
      throw new BadRequestException(
        'retirementIds must contain at least one item',
      );
    }

    const retirements = await this.prisma.retirement.findMany({
      where: {
        companyId,
        id: { in: retirementIds },
      },
      include: {
        credit: true,
      },
    });

    const verificationResults =
      await this.retirementVerificationService.verifyRetirements(companyId, {
        tokens: retirements.map((r) => ({
          tokenId: r.creditId,
          retirementTxHash: r.id,
        })),
        framework: ComplianceFramework.CORSIA,
      });

    const invalidTokens = verificationResults.results
      .filter((r) => r.status !== OffsetClaimStatus.VERIFIED)
      .map((r) => r.tokenId);

    if (invalidTokens.length > 0) {
      throw new BadRequestException(
        `The following credits cannot be used for CORSIA compliance due to retirement verification failure: ${invalidTokens.join(', ')}`,
      );
    }

    const results = await Promise.all(
      retirements.map(async (retirement) => {
        const validation = this.verifierService.validateCredit({
          retirementId: retirement.id,
          program: retirement.credit.verificationStandard,
          creditType: retirement.credit.methodology,
          vintageYear: retirement.credit.vintage,
        });

        const saved = await this.prisma.corsiaEligibleCredit.upsert({
          where: { retirementId: retirement.id },
          update: {
            program: validation.program,
            creditType: validation.creditType,
            vintageYear: validation.vintageYear,
            eligible: validation.eligible,
            eligibilityMemo: validation.eligibilityMemo,
            metadata: {
              reasons: validation.reasons,
              updatedAt: new Date().toISOString(),
            },
          },
          create: {
            companyId,
            retirementId: retirement.id,
            program: validation.program,
            creditType: validation.creditType,
            vintageYear: validation.vintageYear,
            eligible: validation.eligible,
            eligibilityMemo: validation.eligibilityMemo,
            metadata: {
              reasons: validation.reasons,
              createdAt: new Date().toISOString(),
            },
          },
        });

        return {
          retirementId: retirement.id,
          amount: retirement.amount,
          eligible: saved.eligible,
          eligibilityMemo: saved.eligibilityMemo,
          program: saved.program,
          creditType: saved.creditType,
          vintageYear: saved.vintageYear,
        };
      }),
    );

    await this.securityService.logEvent({
      eventType: 'corsia.credits.validated' as any,
      companyId,
      details: {
        requested: retirementIds.length,
        processed: results.length,
        eligible: results.filter((entry) => entry.eligible).length,
      },
      status: 'success',
    });

    return {
      count: results.length,
      results,
    };
  }

  async listEligibleCredits(companyId: string, year?: number) {
    this.assertCompanyId(companyId);

    const where: any = {
      companyId,
      eligible: true,
    };

    if (year) {
      where.retirement = {
        retiredAt: {
          gte: new Date(Date.UTC(year, 0, 1)),
          lt: new Date(Date.UTC(year + 1, 0, 1)),
        },
      };
    }

    return this.prisma.corsiaEligibleCredit.findMany({
      where,
      include: {
        retirement: {
          select: {
            id: true,
            amount: true,
            retiredAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getComplianceStatus(companyId: string, year: number) {
    this.assertCompanyId(companyId);

    const offsetData = await this.calculateOffsetRequirement(companyId, year);
    const eligibleCredits = await this.listEligibleCredits(companyId, year);

    const offsetsRetired = eligibleCredits.reduce(
      (sum, credit) => sum + (credit.retirement?.amount || 0),
      0,
    );

    const complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' =
      offsetData.offsetRequirement === 0
        ? 'COMPLIANT'
        : offsetsRetired >= offsetData.offsetRequirement
          ? 'COMPLIANT'
          : 'NON_COMPLIANT';

    const updated = await this.prisma.corsiaComplianceYear.update({
      where: {
        companyId_year: {
          companyId,
          year,
        },
      },
      data: {
        offsetsRetired: Number(offsetsRetired.toFixed(6)),
        complianceStatus,
      },
    });

    return {
      companyId,
      year,
      baselineEmissions: offsetData.baselineEmissions,
      totalEmissions: offsetData.totalEmissions,
      offsetRequirement: offsetData.offsetRequirement,
      offsetsRetired: Number(offsetsRetired.toFixed(6)),
      complianceStatus,
      complianceYearId: updated.id,
    };
  }

  async generateReport(companyId: string, year: number) {
    this.assertCompanyId(companyId);

    const [annual, offsetRequirement, compliance, flights] = await Promise.all([
      this.getAnnualEmissions(companyId, year),
      this.calculateOffsetRequirement(companyId, year),
      this.getComplianceStatus(companyId, year),
      this.listFlights(companyId, year),
    ]);

    const fuelBreakdown = flights.reduce<Record<string, number>>(
      (acc, flight) => {
        const key = flight.fuelType.toUpperCase();
        acc[key] = (acc[key] || 0) + flight.fuelBurn;
        return acc;
      },
      {},
    );

    const routeMap = flights.reduce<Record<string, number>>((acc, flight) => {
      const route = `${flight.departureICAO}-${flight.arrivalICAO}`;
      acc[route] = (acc[route] || 0) + flight.co2Emissions;
      return acc;
    }, {});

    const routeBreakdown = Object.entries(routeMap)
      .map(([route, emissions]) => ({
        route,
        emissions: Number((emissions as number).toFixed(6)),
      }))
      .sort((a, b) => b.emissions - a.emissions)
      .slice(0, 10);

    const report = this.emissionsReportService.generateReport({
      summary: {
        companyId,
        year,
        totalFlights: annual.totalFlights,
        totalFuelBurnTonnes: annual.totalFuelBurn,
        totalEmissionsTonnes: annual.totalEmissions,
        baselineEmissionsTonnes: offsetRequirement.baselineEmissions,
        offsetRequirementTonnes: offsetRequirement.offsetRequirement,
        offsetsRetiredTonnes: compliance.offsetsRetired,
        complianceStatus: compliance.complianceStatus,
      },
      fuelBreakdown,
      routeBreakdown,
      notes: [
        'Methodology aligned to configured CORSIA calculation factors in the service layer.',
        'Final submission formatting can be transformed from this payload to ICAO templates.',
      ],
    });

    await this.prisma.corsiaComplianceYear.update({
      where: {
        companyId_year: {
          companyId,
          year,
        },
      },
      data: {
        reportSubmitted: new Date(),
        metadata: {
          reportId: report.id,
          generatedAt: report.generatedAt,
          format: report.format,
        },
      },
    });

    await this.securityService.logEvent({
      eventType: 'corsia.report.generated' as any,
      companyId,
      details: { year, reportId: report.id },
      status: 'success',
    });

    return report;
  }

  listEligibleFuels() {
    return this.eligibleFuelsService.listEligibleFuels();
  }

  private async resolveBaselineEmissions(companyId: string): Promise<number> {
    const baselineYear = 2019;

    const baselineAggregate = await this.prisma.flightRecord.aggregate({
      where: {
        companyId,
        departureDate: {
          gte: new Date(Date.UTC(baselineYear, 0, 1)),
          lt: new Date(Date.UTC(baselineYear + 1, 0, 1)),
        },
      },
      _sum: {
        co2Emissions: true,
      },
    });

    const baselineEmissions = baselineAggregate._sum.co2Emissions;

    if (typeof baselineEmissions === 'number' && baselineEmissions > 0) {
      return Number(baselineEmissions.toFixed(6));
    }

    const firstAvailableYear = await this.prisma.corsiaComplianceYear.findFirst(
      {
        where: { companyId },
        orderBy: { year: 'asc' },
        select: { totalEmissions: true },
      },
    );

    return Number((firstAvailableYear?.totalEmissions || 0).toFixed(6));
  }

  private isSafFuel(fuelType: string) {
    return fuelType.toUpperCase().includes('SAF');
  }

  private assertCompanyId(
    companyId: string | undefined,
  ): asserts companyId is string {
    if (!companyId) {
      throw new NotFoundException('Company context is required');
    }
  }
}
