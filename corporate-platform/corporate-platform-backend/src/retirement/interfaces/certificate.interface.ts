export interface CertificateData {
  certificateNumber: string;
  companyName: string;
  retirementDate: Date;
  creditProject: string;
  creditAmount: number;
  creditPurpose: string;
  transactionHash?: string;
  pdfUrl: string;
  ipfsHash?: string;
}
