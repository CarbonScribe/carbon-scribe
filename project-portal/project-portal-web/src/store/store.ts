/**
 * Unified store entry. Integrations and notifications slices are registered here.
 * Extend with auth, projects, collaboration, search as needed.
 */

export { useIntegrationStore } from "./integrationSlice";
export type { IntegrationSlice } from "./integrationSlice";
export * from "./integration.selectors";
export * from "./integration.types";

export type {
  Notification,
  NotificationType,
  NotificationsSlice,
} from "./notification.types";
