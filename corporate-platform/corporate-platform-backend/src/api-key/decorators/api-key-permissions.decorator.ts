import { SetMetadata } from '@nestjs/common';

export const API_KEY_PERMISSIONS_METADATA = 'api_key_permissions';

export const ApiKeyPermissions = (...permissions: string[]) =>
  SetMetadata(API_KEY_PERMISSIONS_METADATA, permissions);
