import axios from "axios";
import { env } from "../config/env.js";

// Thin HTTP client for project-portal-backend (Go). Agent tools call
// through here rather than hitting axios directly, so auth/base-URL/retry
// logic lives in one place.
//
// TODO: add the actual endpoints agent tools need, e.g.:
//   - getMethodologies()
//   - getProject(projectId)
//   - getMonitoringAlerts(projectId, since)
//   - getSatelliteTimeseries(projectId, metric: "ndvi" | "biomass")
const http = axios.create({
  baseURL: env.projectPortalBaseUrl,
  headers: env.internalServiceToken
    ? { "x-internal-token": env.internalServiceToken }
    : undefined,
});

export const projectPortalClient = {
  http,
};
