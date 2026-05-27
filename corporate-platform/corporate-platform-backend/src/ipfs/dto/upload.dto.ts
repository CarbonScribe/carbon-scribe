export class UploadDto {
  fileName?: string;
  mimeType?: string;
  metadata?: any;
  idempotencyKey?: string;
}
