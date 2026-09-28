import type {
  ConfirmAlertPayload,
  ConfirmAlertResponse,
  Methodology,
} from "./project-portal.client.js";

// Sample fixture data for exercising projectPortalClient.getMethodologies()
// without a live project-portal-backend instance — used by this client's
// own tests and available to any agent-tool test that needs a stand-in
// methodology catalog. Covers the six documented methodology types; all
// are globally applicable (empty `countries`) except mangroveRestoration,
// which is given a jurisdiction restriction so country-filtering logic has
// a real case to exercise.

export const mockMethodologies: Methodology[] = [
  {
    id: "agroforestry",
    name: "Agroforestry",
    activityTypes: ["agroforestry"],
    countries: [],
    requiredDocuments: [
      "Land tenure documentation",
      "Baseline biomass survey",
      "Tree planting / species plan",
    ],
  },
  {
    id: "improved-forest-management",
    name: "Improved Forest Management",
    activityTypes: ["improved forest management", "ifm"],
    countries: [],
    requiredDocuments: [
      "Forest management plan",
      "Historical harvest records",
      "Baseline carbon stock assessment",
    ],
  },
  {
    id: "biochar",
    name: "Biochar",
    activityTypes: ["biochar"],
    countries: [],
    requiredDocuments: [
      "Feedstock sourcing documentation",
      "Pyrolysis process specification",
      "Application / soil incorporation records",
    ],
  },
  {
    id: "mangrove-restoration",
    name: "Mangrove Restoration",
    activityTypes: ["mangrove restoration", "mangrove"],
    countries: ["ID", "PH", "KE", "BR"],
    requiredDocuments: [
      "Coastal ecosystem baseline survey",
      "Hydrology assessment",
      "Community / stakeholder consent documentation",
    ],
  },
  {
    id: "soil-carbon",
    name: "Soil Carbon",
    activityTypes: ["soil carbon", "soil carbon sequestration"],
    countries: [],
    requiredDocuments: [
      "Soil sampling and testing protocol",
      "Baseline soil organic carbon measurement",
      "Land management practice change plan",
    ],
  },
  {
    id: "renewable-energy",
    name: "Renewable Energy",
    activityTypes: ["renewable energy", "solar", "wind", "biomass energy"],
    countries: [],
    requiredDocuments: [
      "Grid connection agreement or displacement analysis",
      "Technology specification sheet",
      "Baseline emissions factor documentation",
    ],
  },
];

/** The raw wire-shape response body project-portal-backend would send. */
export const mockMethodologiesResponseBody = {
  methodologies: mockMethodologies,
};

// ---------------------------------------------------------------------------
// confirmAlert fixtures
// ---------------------------------------------------------------------------
//
// A confirmed alert-triage escalation, as the approval workflow would push it
// into project-portal's notification pipeline. Shared by the client tests and
// the escalate → approve → notify approval-workflow tests so both assert
// against one contract.

export const mockConfirmAlertPayload: ConfirmAlertPayload = {
  category: "monitoring.alert",
  subject: "Confirmed alert for project proj-fixture-1",
  content:
    "NDVI drop corroborated by IoT sensor readings and no weather anomaly.",
  channels: ["IN_APP"],
  idempotencyKey: "req-fixture-1",
  metadata: {
    verdict: "escalate",
    reasoning:
      "NDVI drop corroborated by IoT sensor readings and no weather anomaly.",
    requestId: "req-fixture-1",
    requestedBy: "user-fixture-1",
    citations: [{ source: "iot-sensor-7", reference: "reading-4821" }],
  },
};

/** The validated, typed notification project-portal returns on success. */
export const mockConfirmAlertResponse: ConfirmAlertResponse = {
  id: "notif-fixture-1",
  project_id: "proj-fixture-1",
  category: "monitoring.alert",
  subject: "Confirmed alert for project proj-fixture-1",
  status: "PENDING",
  created_at: new Date("2026-09-27T12:00:00.000Z"),
};

/** The raw wire-shape response body project-portal-backend would send. */
export const mockConfirmAlertResponseBody = {
  id: "notif-fixture-1",
  project_id: "proj-fixture-1",
  category: "monitoring.alert",
  subject: "Confirmed alert for project proj-fixture-1",
  status: "PENDING",
  created_at: "2026-09-27T12:00:00.000Z",
};
