import type { SystemMetric } from '@/lib/store/health/health.types';

export function serializeMetricsToCsv(metrics: SystemMetric[]) {
  const headers = ['id', 'name', 'value', 'unit', 'timestamp'];
  const rows = metrics.map((metric) => {
    const values = [
      metric.id ?? '',
      metric.name ?? '',
      metric.value ?? '',
      metric.unit ?? '',
      metric.timestamp ?? '',
    ];

    return values.map((value) => escapeCsvCell(String(value))).join(',');
  });

  return [headers.join(','), ...rows].join('\n') + '\n';
}

function escapeCsvCell(value: string) {
  if (!value.includes(',') && !value.includes('"') && !value.includes('\n')) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}
