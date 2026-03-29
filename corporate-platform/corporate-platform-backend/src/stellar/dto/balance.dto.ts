export class XlmBalanceDto {
  balance: string;
  assetType: 'native';
}

export class CarbonCreditBalanceDto {
  tokenId: number;
  balance: number;
  assetCode?: string;
  issuer?: string;
}

export class BalanceResponseDto {
  xlm: XlmBalanceDto;
  carbonCredits: CarbonCreditBalanceDto[];
}

export class BalanceQueryDto {
  companyId: string;
}
