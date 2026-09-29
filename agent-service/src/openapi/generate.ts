import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openApiSpec } from "./openapi.document.js";
import { toYaml } from "./yaml.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

export function generateOpenApiArtifacts(targetDir: string = projectRoot): {
  jsonPath: string;
  yamlPath: string;
} {
  const jsonContent = JSON.stringify(openApiSpec, null, 2) + "\n";
  const yamlContent = toYaml(openApiSpec);

  const jsonPath = path.join(targetDir, "openapi.json");
  const yamlPath = path.join(targetDir, "openapi.yaml");

  fs.writeFileSync(jsonPath, jsonContent, "utf-8");
  fs.writeFileSync(yamlPath, yamlContent, "utf-8");

  return { jsonPath, yamlPath };
}

// When run directly as a script
if (process.argv[1] === __filename) {
  const { jsonPath, yamlPath } = generateOpenApiArtifacts();
  console.log(
    `Generated OpenAPI spec files:\n  - ${jsonPath}\n  - ${yamlPath}`,
  );
}
