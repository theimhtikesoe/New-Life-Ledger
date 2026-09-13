import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const layoutSource = fs.readFileSync(path.join(process.cwd(), "src/app/layout-client.jsx"), "utf8");

describe("Actor route switching", () => {
  it("chooses the next user's route before permission loading completes", () => {
    expect(layoutSource).toContain("const routeForActor = useCallback");
    expect(layoutSource).toContain("if (nextPath !== pathname) router.replace(nextPath);");
    expect(layoutSource).toContain("setAllowedPaths(defaultAllowedPaths(nextActorName));");
  });
});
