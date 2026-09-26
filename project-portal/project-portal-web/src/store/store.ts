/**
 * @deprecated Import from '@/lib/store/store' instead.
 * This file is kept for backward compatibility only.
 * Integration state is now composed into the unified useStore hook.
 */
export { useStore } from '@/lib/store/store';
export type { IntegrationSlice } from '@/lib/store/integrations/integration.types';
export * from '@/lib/store/integrations/integration.selectors';
export * from '@/lib/store/integrations/integration.types';

export type {
  Notification,
  NotificationType,
  NotificationsSlice,
} from "./notification.types";
