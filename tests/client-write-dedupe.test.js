import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "src/lib/client-write-dedupe.js"), "utf8");
const layout = fs.readFileSync(path.join(root, "src/app/layout-client.jsx"), "utf8");

describe("global client write deduplication", () => {
  it("covers every mutating HTTP method", () => {
    expect(source).toContain('new Set(["POST", "PUT", "PATCH", "DELETE"])');
  });

  it("keys concurrent writes by method, URL, actor, and body", () => {
    expect(source).toContain("const key = `${method} ${url} ${actor} ${body}`;");
    expect(source).toContain("return existing.then((response) => response.clone());");
  });

  it("installs once from the app-wide client layout", () => {
    expect(layout).toContain("installClientWriteDeduplication");
  });
});

export {};
