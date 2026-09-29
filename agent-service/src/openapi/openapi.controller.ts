import { Router } from "express";
import { openApiSpec } from "./openapi.document.js";
import { toYaml } from "./yaml.js";

export const openapiRouter = Router();

const openApiYamlString = toYaml(openApiSpec);

/**
 * GET /openapi.json
 * Returns the OpenAPI 3.0.3 specification in JSON format.
 */
openapiRouter.get("/openapi.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.status(200).json(openApiSpec);
});

/**
 * GET /openapi.yaml
 * Returns the OpenAPI 3.0.3 specification in YAML format.
 */
openapiRouter.get("/openapi.yaml", (_req, res) => {
  res.setHeader("Content-Type", "text/yaml; charset=utf-8");
  res.status(200).send(openApiYamlString);
});
