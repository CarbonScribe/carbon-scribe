import { Injectable, Logger } from '@nestjs/common';

export type TrackStatus = 'ahead' | 'on_track' | 'behind' | 'unknown';

export interface TargetLike {
  id: string;
  scope?: string | null;
  status?: string | null;
  baseYear: number;
  baseYearEmissions: number | string;
  targetYear: number;
  reductionPercentage: number | string;
}

export interface ProgressRowLike {
  targetId: string;
  reportingYear: number;
  emissions: number | string;
  targetEmissions?: number | string | null;
}

export interface TargetSeriesPoint {
  year: number;
  actualEmissions: number;
  targetEmissions: number;
}

export interface TargetDashboardEntry {
  targetId: string;
  scope: string;
  status: string;
  completionPercentage: number;
  trackStatus: TrackStatus;
  series: TargetSeriesPoint[];
  latestEmissions: number | null;
  baseYearEmissions: number;
  targetYear: number;
}

export interface ScopeRollup {
  scope: string;
  targetCount: number;
  avgCompletionPercentage: number;
  behindCount: number;
  onTrackCount: number;
  aheadCount: number;
}

export interface DashboardAggregation {
  summary: {
    totalTargets: number;
    byStatus: Record<string, number>;
  };
  targets: TargetDashboardEntry[];
  scopeRollups: ScopeRollup[];
  dataQuality: 'ok' | 'partial';
}

@Injectable()
export class ProgressTrackingService {
  private readonly logger = new Logger(ProgressTrackingService.name);

  /** Linear trajectory target emissions for a reporting year. */
  expectedEmissionsAtYear(target: TargetLike, year: number): number {
    const base = Number(target.baseYearEmissions);
    const reduction = Number(target.reductionPercentage) / 100;
    const span = Math.max(1, target.targetYear - target.baseYear);
    const progress = Math.min(
      1,
      Math.max(0, (year - target.baseYear) / span),
    );
    const targetAtEnd = base * (1 - reduction);
    return base + (targetAtEnd - base) * progress;
  }

  /**
   * Completion toward the reduction goal based on latest actual vs base.
   * 0 = no reduction from base, 100 = full reductionPercentage achieved.
   */
  completionPercentage(
    target: TargetLike,
    latestActual: number | null,
  ): number {
    const base = Number(target.baseYearEmissions);
    const reduction = Number(target.reductionPercentage) / 100;
    if (!base || reduction <= 0 || latestActual == null) return 0;
    const requiredCut = base * reduction;
    if (requiredCut <= 0) return 0;
    const actualCut = base - latestActual;
    return Math.max(
      0,
      Math.min(100, (actualCut / requiredCut) * 100),
    );
  }

  classifyTrackStatus(
    target: TargetLike,
    reportingYear: number,
    actualEmissions: number | null,
  ): TrackStatus {
    if (actualEmissions == null || Number.isNaN(actualEmissions)) {
      return 'unknown';
    }
    const expected = this.expectedEmissionsAtYear(target, reportingYear);
    const tolerance = Math.max(1, expected * 0.02); // 2% band = on track
    if (actualEmissions < expected - tolerance) return 'ahead';
    if (actualEmissions > expected + tolerance) return 'behind';
    return 'on_track';
  }

  buildSeries(
    target: TargetLike,
    rows: ProgressRowLike[],
  ): TargetSeriesPoint[] {
    const byYear = new Map<number, number>();
    for (const r of rows) {
      if (r.targetId !== target.id) continue;
      byYear.set(r.reportingYear, Number(r.emissions));
    }
    const years = [...byYear.keys()].sort((a, b) => a - b);
    if (!years.includes(target.baseYear)) {
      years.unshift(target.baseYear);
      byYear.set(target.baseYear, Number(target.baseYearEmissions));
    }
    return years.map((year) => ({
      year,
      actualEmissions:
        byYear.get(year) ?? Number(target.baseYearEmissions),
      targetEmissions: this.expectedEmissionsAtYear(target, year),
    }));
  }

  aggregate(
    targets: TargetLike[],
    progressRows: ProgressRowLike[],
    options?: { dataQuality?: 'ok' | 'partial' },
  ): DashboardAggregation {
    const byStatus: Record<string, number> = {};
    for (const t of targets) {
      const s = t.status || 'UNKNOWN';
      byStatus[s] = (byStatus[s] || 0) + 1;
    }

    const targetEntries: TargetDashboardEntry[] = targets.map((t) => {
      const rows = progressRows.filter((p) => p.targetId === t.id);
      const series = this.buildSeries(t, rows);
      const latest = series.length
        ? series[series.length - 1]
        : null;
      const latestEmissions = latest ? latest.actualEmissions : null;
      const latestYear = latest ? latest.year : t.baseYear;
      return {
        targetId: t.id,
        scope: String(t.scope ?? 'unknown'),
        status: String(t.status ?? 'UNKNOWN'),
        completionPercentage: this.completionPercentage(t, latestEmissions),
        trackStatus: this.classifyTrackStatus(t, latestYear, latestEmissions),
        series,
        latestEmissions,
        baseYearEmissions: Number(t.baseYearEmissions),
        targetYear: t.targetYear,
      };
    });

    const scopeMap = new Map<string, TargetDashboardEntry[]>();
    for (const e of targetEntries) {
      const list = scopeMap.get(e.scope) || [];
      list.push(e);
      scopeMap.set(e.scope, list);
    }
    const scopeRollups: ScopeRollup[] = [...scopeMap.entries()].map(
      ([scope, list]) => {
        const avg =
          list.reduce((s, x) => s + x.completionPercentage, 0) /
          Math.max(1, list.length);
        return {
          scope,
          targetCount: list.length,
          avgCompletionPercentage: Math.round(avg * 100) / 100,
          behindCount: list.filter((x) => x.trackStatus === 'behind').length,
          onTrackCount: list.filter((x) => x.trackStatus === 'on_track').length,
          aheadCount: list.filter((x) => x.trackStatus === 'ahead').length,
        };
      },
    );

    return {
      summary: {
        totalTargets: targets.length,
        byStatus,
      },
      targets: targetEntries,
      scopeRollups,
      dataQuality: options?.dataQuality || 'ok',
    };
  }
}
