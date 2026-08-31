import type { Methodology } from "./project-portal.client.js";

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
