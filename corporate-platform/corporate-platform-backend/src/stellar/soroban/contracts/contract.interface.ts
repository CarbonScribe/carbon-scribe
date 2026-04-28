export const CARBON_ASSET_CONTRACT_ID =
  'CAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM';

export const RETIREMENT_TRACKER_CONTRACT_ID =
  'CCDCE6N7Q27TZW6Z6W3DPDCNOGHWFSOQUQPSRRZIY7AEHNOYZMNFDFVU';

export type ContractAlias = 'carbonAsset' | 'retirementTracker';

export interface ContractInvocation {
  companyId: string;
  contractId: string;
  methodName: string;
  args?: unknown[];
}

export interface ContractSimulation {
  contractId: string;
  methodName: string;
  args?: unknown[];
}

export interface ContractExecutionResult {
  contractId: string;
  methodName: string;
  transactionHash: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  result?: unknown;
  submittedAt: string;
  confirmedAt?: string;
  source: 'onchain' | 'simulated';
}
