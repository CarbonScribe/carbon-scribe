export class SorobanEventDto {
  type: string;
  ledger: number;
  ledgerClosedAt: string;
  id: string;
  contractId: string;
  topic: string[];
  value: {
    xdr: string;
  };
  inSuccessfulContractCall: boolean;
}
