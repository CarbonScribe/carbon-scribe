import { Injectable } from '@nestjs/common';
import {
  EmissionsReport,
  EmissionsReportSection,
  EmissionsReportSummary,
} from '../interfaces/emissions-report.interface';

@Injectable()
export class EmissionsReportService {
  generateReport(input: {
    summary: EmissionsReportSummary;
    fuelBreakdown: Record<string, number>;
    routeBreakdown: Array<{ route: string; emissions: number }>;
    notes?: string[];
  }): EmissionsReport {
    const sections: EmissionsReportSection[] = [
      {
        title: 'Operational Summary',
        description:
          'Annual operations and emissions metrics for CORSIA reporting.',
        data: {
          totalFlights: input.summary.totalFlights,
          totalFuelBurnTonnes: input.summary.totalFuelBurnTonnes,
          totalEmissionsTonnes: input.summary.totalEmissionsTonnes,
        },
      },
      {
        title: 'Fuel Analysis',
        description:
          'Fuel usage profile and SAF coverage for annual operations.',
        data: {
          fuelBreakdown: input.fuelBreakdown,
        },
      },
      {
        title: 'Offset And Compliance Position',
        description:
          'Baseline, growth emissions, offset requirement, retired credits, and compliance status.',
        data: {
          baselineEmissionsTonnes: input.summary.baselineEmissionsTonnes,
          offsetRequirementTonnes: input.summary.offsetRequirementTonnes,
          offsetsRetiredTonnes: input.summary.offsetsRetiredTonnes,
          complianceStatus: input.summary.complianceStatus,
        },
      },
      {
        title: 'Top Emitting Routes',
        description:
          'Highest contributing routes by emissions in the reporting period.',
        data: {
          routes: input.routeBreakdown,
        },
      },
    ];

    if (input.notes && input.notes.length) {
      sections.push({
        title: 'Verifier Notes',
        description:
          'Validation and methodology notes accompanying the report.',
        data: {
          notes: input.notes,
        },
      });
    }

    return {
      id: `corsia-${input.summary.companyId}-${input.summary.year}-${Date.now()}`,
      format: 'ICAO_CORSIA_JSON',
      generatedAt: new Date().toISOString(),
      summary: input.summary,
      sections,
    };
  }
}
