import { ApiProperty } from '@nestjs/swagger';

export class XlmBalanceDto {
  @ApiProperty({ description: 'XLM balance as string' })
  balance: string;

  @ApiProperty({ description: 'Asset type', example: 'native' })
  assetType: 'native';
}

export class CarbonCreditBalanceDto {
  @ApiProperty({ description: 'Token ID' })
  tokenId: number;

  @ApiProperty({ description: 'Balance amount' })
  balance: number;

  @ApiProperty({ description: 'Asset code', required: false })
  assetCode?: string;

  @ApiProperty({ description: 'Asset issuer public key', required: false })
  issuer?: string;
}

export class BalanceResponseDto {
  @ApiProperty({ description: 'XLM balance information' })
  xlm: XlmBalanceDto;

  @ApiProperty({ description: 'Carbon credit token balances', type: [CarbonCreditBalanceDto] })
  carbonCredits: CarbonCreditBalanceDto[];
}

export class BalanceQueryDto {
  @ApiProperty({ description: 'Company ID to query balance for' })
  companyId: string;
}
