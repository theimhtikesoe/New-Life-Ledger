import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(resolve(process.cwd(), "src/components/UserManagementPage.jsx"), "utf8");
const route = readFileSync(resolve(process.cwd(), "src/app/api/user-permissions/route.js"), "utf8");
const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

describe("User Management role and activity design", () => {
  it("uses role and active profile fields instead of page permission controls", () => {
    expect(page).toContain("User & Activity Management");
    expect(page).toContain("USER_ROLES");
    expect(page).toContain("User Profile သိမ်းမည်");
    expect(page).toContain("active");
    expect(page).not.toContain("Permission သိမ်းမည်");
    expect(page).not.toContain("အားလုံးဖွင့်");
    expect(page).not.toContain("အားလုံးပိတ်");
  });

  it("loads actor-specific Activity History", () => {
    expect(page).toContain("/api/audit-logs?actor=");
    expect(page).toContain("Activity History");
    expect(page).toContain("ACTION_LABELS");
  });

  it("persists role, active status, notes, and last-seen metadata", () => {
    expect(route).toContain('ADD COLUMN IF NOT EXISTS "role"');
    expect(route).toContain('ADD COLUMN IF NOT EXISTS "active"');
    expect(route).toContain('ADD COLUMN IF NOT EXISTS "lastSeenAt"');
    expect(route).toContain("lastSeenAt: new Date()");
    expect(route).toContain("updateData");
    expect(schema).toContain("model UserPermission");
    expect(schema).toContain("role        String");
    expect(schema).toContain("active      Boolean");
    expect(schema).toContain("lastSeenAt  DateTime?");
  });
});
