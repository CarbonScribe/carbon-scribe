import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { projectPortalClient } from "../../clients/project-portal.client.js";

// PDD (Project Design Document) drafting agent tools — walks a farmer's raw
// project submission, matches it to a methodology, and drafts PDD sections.
// Bridges to project-portal's internal/project/methodology package.
//
// TODO: replace with the real methodology-matching endpoint once it exists.
export const matchMethodology = betaZodTool({
  name: "match_methodology",
  description:
    "Given a project's activity type and land details, return the eligible methodology (agroforestry, improved forest management, biochar, mangrove restoration, soil carbon, renewable energy) and its documentation requirements.",
  inputSchema: z.object({
    activityType: z.string(),
    country: z.string(),
    hectares: z.number().optional(),
  }),
  run: async (input) => {
    void projectPortalClient; // TODO: wire real call, remove this line
    void input;
    throw new Error("not implemented");
  },
});

export const pddDraftTools = [matchMethodology];
