export interface PurposeBreakdownItem {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface PurposeBreakdownResponse {
  purposes: PurposeBreakdownItem[];
  totalRetired: number;
  periodStart: string;
  periodEnd: string;
}
