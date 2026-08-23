import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { projectPortalClient } from "../../clients/project-portal.client.js";

// Alert-triage agent tools — correlates satellite NDVI drops, IoT sensor
// readings, and weather context before deciding whether a monitoring alert
// is a genuine event, seasonal variation, or a sensor fault. Bridges to
// project-portal's internal/monitoring package.
//
// TODO: replace with the real monitoring/ingestion endpoints.
export const getMonitoringSignals = betaZodTool({
  name: "get_monitoring_signals",
  description:
    "Fetch recent satellite NDVI readings, IoT sensor data, and weather context for a project, for correlation before an alert is raised.",
  inputSchema: z.object({
    projectId: z.string(),
    sinceIso: z.string(),
  }),
  run: async (input) => {
    void projectPortalClient; // TODO: wire real call, remove this line
    void input;
    throw new Error("not implemented");
  },
});

export const alertTriageTools = [getMonitoringSignals];
