import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  getActorName: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  ensureDatabase: mocks.ensureDatabase,
  databaseErrorResponse: vi.fn((error) => ({ error: error?.message || "Database error" })),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { auditLog: { findUnique: mocks.findUnique, update: mocks.update } } }));
vi.mock("@/lib/audit", () => ({ getActorName: mocks.getActorName }));

import { DELETE } from "@/app/api/audit-logs/[id]/route";

function request() {
  return new Request("http://localhost/api/audit-logs/activity-1", {
    method: "DELETE",
    headers: { "x-actor-name": "Rhyzoe" },
  });
}

describe("Activity audit-log hide route", () => {
  beforeEach(() => {
    mocks.ensureDatabase.mockReset().mockResolvedValue(undefined);
    mocks.findUnique.mockReset().mockResolvedValue({ id: "activity-1", hiddenAt: null });
    mocks.update.mockReset().mockResolvedValue({ id: "activity-1", hiddenAt: new Date("2026-08-26T12:00:00.000Z"), hiddenBy: "Rhyzoe" });
    mocks.getActorName.mockReset().mockReturnValue("Rhyzoe");
  });

  it("hides one Activity row without deleting the audit record or touching Ledger", async () => {
    const response = await DELETE(request(), { params: { id: "activity-1" } });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ id: "activity-1", hidden: true, hiddenBy: "Rhyzoe" });
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: "activity-1" },
      select: { id: true, hiddenAt: true },
    });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "activity-1" },
      data: expect.objectContaining({ hiddenBy: "Rhyzoe" }),
    }));
  });

  it("is idempotent when the row is already hidden", async () => {
    mocks.findUnique.mockResolvedValue({ id: "activity-1", hiddenAt: new Date("2026-08-26T12:00:00.000Z") });
    const response = await DELETE(request(), { params: { id: "activity-1" } });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ id: "activity-1", hidden: true, alreadyHidden: true });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
