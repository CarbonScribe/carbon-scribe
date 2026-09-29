import { describe, expect, it } from "vitest";
import { toYaml } from "./yaml.js";

describe("toYaml serializer", () => {
  it("serializes primitives, strings, numbers, booleans, and nulls", () => {
    const obj = {
      name: "agent-service",
      version: "1.0.0",
      port: 4500,
      enabled: true,
      disabled: false,
      extra: null,
    };
    const yaml = toYaml(obj);
    expect(yaml).toContain("name: agent-service\n");
    expect(yaml).toContain("version: 1.0.0\n");
    expect(yaml).toContain("port: 4500\n");
    expect(yaml).toContain("enabled: true\n");
    expect(yaml).toContain("disabled: false\n");
    expect(yaml).toContain("extra: null\n");
  });

  it("handles quotes for strings with special characters or reserved keywords", () => {
    const obj = {
      empty: "",
      flagTrue: "true",
      flagFalse: "false",
      withColon: "foo: bar",
      withQuotes: 'say "hello"',
      withHash: "value #comment",
    };
    const yaml = toYaml(obj);
    expect(yaml).toContain('empty: ""\n');
    expect(yaml).toContain('flagTrue: "true"\n');
    expect(yaml).toContain('flagFalse: "false"\n');
    expect(yaml).toContain('withColon: "foo: bar"\n');
    expect(yaml).toContain('withQuotes: "say \\"hello\\""\n');
  });

  it("serializes multiline strings with literal block indicator", () => {
    const obj = {
      multiline: "line 1\nline 2\nline 3",
    };
    const yaml = toYaml(obj);
    expect(yaml).toContain("multiline: |\n  line 1\n  line 2\n  line 3\n");
  });

  it("serializes nested objects and arrays correctly", () => {
    const obj = {
      info: {
        title: "Test API",
        version: "0.0.1",
      },
      tags: ["Health", "Agents"],
      servers: [
        {
          url: "http://localhost:4500",
          description: "Local",
        },
      ],
      emptyArray: [],
      emptyObject: {},
    };
    const yaml = toYaml(obj);
    expect(yaml).toContain("info:\n  title: Test API\n  version: 0.0.1\n");
    expect(yaml).toContain("tags:\n  - Health\n  - Agents\n");
    expect(yaml).toContain(
      "servers:\n  - url: http://localhost:4500\n    description: Local\n",
    );
    expect(yaml).toContain("emptyArray: []\n");
    expect(yaml).toContain("emptyObject: {}\n");
  });
});
