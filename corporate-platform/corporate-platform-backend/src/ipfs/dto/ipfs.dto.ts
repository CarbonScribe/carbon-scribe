export class PinataResponseDto {
  IpfsHash?: string;
  PinSize?: number;
  Timestamp?: string;
}

export class UploadResponseDto {
  cid: string;
  gateway?: string;
  record?: any;
}
