/**
 * Lightweight, zero-dependency YAML 1.2 serializer.
 * Converts JavaScript objects/primitives into cleanly formatted YAML strings.
 */

function isPlainSafeString(str: string): boolean {
  if (str === "") return false;
  if (
    str === "true" ||
    str === "false" ||
    str === "null" ||
    str === "~" ||
    str === "y" ||
    str === "n" ||
    str === "yes" ||
    str === "no"
  ) {
    return false;
  }
  // Check if it's purely a number
  if (/^[0-9]+(\.[0-9]+)?$/.test(str)) {
    return false;
  }
  // Disallow starting with YAML indicators
  if (/^[&*?[\]{}|:>!%@`#,-]/.test(str)) {
    return false;
  }
  // Disallow containing ': ' or ' #' or trailing/leading whitespace or quotes
  if (
    str.includes(": ") ||
    str.includes(" #") ||
    str.startsWith(" ") ||
    str.endsWith(" ") ||
    str.includes('"') ||
    str.includes("'") ||
    str.includes("\t")
  ) {
    return false;
  }
  return true;
}

function formatKey(key: string): string {
  if (/^[a-zA-Z0-9_$/.-]+$/.test(key)) {
    return key;
  }
  return `"${key.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function serializeValue(value: unknown, indentLevel: number): string {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "null";
  }

  if (typeof value === "string") {
    if (value.includes("\n")) {
      const indent = "  ".repeat(indentLevel);
      const lines = value.split("\n");
      return (
        "|\n" +
        lines.map((line) => (line.length > 0 ? indent + line : "")).join("\n")
      );
    }

    if (isPlainSafeString(value)) {
      return value;
    }

    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    const indent = "  ".repeat(indentLevel);
    return value
      .map((item) => {
        if (item === null || typeof item !== "object") {
          return `${indent}- ${serializeValue(item, indentLevel + 1)}`;
        }
        if (Array.isArray(item)) {
          return `${indent}-\n${serializeValue(item, indentLevel + 1)}`;
        }
        // Object item in array
        const keys = Object.keys(item);
        if (keys.length === 0) {
          return `${indent}- {}`;
        }
        const firstKey = keys[0]!;
        const firstVal = (item as Record<string, unknown>)[firstKey];
        const restKeys = keys.slice(1);

        let itemStr = `${indent}- ${formatKey(firstKey)}:`;
        if (
          firstVal !== null &&
          typeof firstVal === "object" &&
          Object.keys(firstVal).length > 0
        ) {
          itemStr += `\n${serializeValue(firstVal, indentLevel + 2)}`;
        } else {
          itemStr += ` ${serializeValue(firstVal, indentLevel + 2)}`;
        }

        for (const k of restKeys) {
          const v = (item as Record<string, unknown>)[k];
          const subIndent = "  ".repeat(indentLevel + 1);
          itemStr += `\n${subIndent}${formatKey(k)}:`;
          if (
            v !== null &&
            typeof v === "object" &&
            Object.keys(v).length > 0
          ) {
            itemStr += `\n${serializeValue(v, indentLevel + 2)}`;
          } else {
            itemStr += ` ${serializeValue(v, indentLevel + 2)}`;
          }
        }
        return itemStr;
      })
      .join("\n");
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([_, v]) => v !== undefined,
    );

    if (entries.length === 0) {
      return "{}";
    }

    const indent = "  ".repeat(indentLevel);
    return entries
      .map(([key, val]) => {
        const k = formatKey(key);
        if (val !== null && typeof val === "object") {
          if (Array.isArray(val)) {
            if (val.length === 0) {
              return `${indent}${k}: []`;
            }
            return `${indent}${k}:\n${serializeValue(val, indentLevel + 1)}`;
          }
          if (Object.keys(val).length === 0) {
            return `${indent}${k}: {}`;
          }
          return `${indent}${k}:\n${serializeValue(val, indentLevel + 1)}`;
        }
        return `${indent}${k}: ${serializeValue(val, indentLevel + 1)}`;
      })
      .join("\n");
  }

  return String(value);
}

/**
 * Converts a JavaScript object into a formatted YAML string.
 */
export function toYaml(obj: unknown): string {
  return serializeValue(obj, 0) + "\n";
}
