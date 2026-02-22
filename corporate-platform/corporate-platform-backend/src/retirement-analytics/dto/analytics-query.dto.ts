export class AnalyticsQueryDto {
  startDate?: string;
  endDate?: string;
  companyId?: string;
  aggregation?: 'monthly' | 'quarterly';
}
