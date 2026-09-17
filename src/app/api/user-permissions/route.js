import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActorName } from "@/lib/audit";
import { ACTORS, MANAGER_ACTORS, defaultAllowedPaths, defaultUserRole, normalizeAllowedPaths } from "@/lib/user-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isManager(request) {
  return MANAGER_ACTORS.includes(getActorName(request));
}

async function ensureUserPermissionTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserPermission" (
      "id" SERIAL NOT NULL,
      "actorName" TEXT NOT NULL,
      "allowedPaths" JSONB NOT NULL,
      "updatedBy" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE "UserPermission" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'Viewer'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "UserPermission" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT TRUE`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "UserPermission" ADD COLUMN IF NOT EXISTS "note" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "UserPermission" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "UserPermission_actorName_key" ON "UserPermission"("actorName")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "UserPermission_updatedAt_idx" ON "UserPermission"("updatedAt")`);
}

async function getRows() {
  await ensureUserPermissionTable();
  const rows = await prisma.userPermission.findMany({ orderBy: { actorName: "asc" } });
  const byActor = new Map(rows.map((row) => [row.actorName, row]));
  const result = [];
  for (const actorName of ACTORS) {
    const existing = byActor.get(actorName);
    if (existing) {
      result.push({ actorName, allowedPaths: normalizeAllowedPaths(existing.allowedPaths, actorName), role: existing.role, active: existing.active, note: existing.note, lastSeenAt: existing.lastSeenAt, updatedAt: existing.updatedAt });
      continue;
    }
    const created = await prisma.userPermission.create({ data: { actorName, allowedPaths: defaultAllowedPaths(actorName), role: defaultUserRole(actorName) } });
    result.push({ actorName, allowedPaths: created.allowedPaths, role: created.role, active: created.active, note: created.note, lastSeenAt: created.lastSeenAt, updatedAt: created.updatedAt });
  }
  return result;
}

export async function GET(request) {
  const actorName = getActorName(request);
  if (!ACTORS.includes(actorName)) return NextResponse.json({ error: "User session မတွေ့ပါ။" }, { status: 401 });
  const rows = await getRows();
  await prisma.userPermission.updateMany({ where: { actorName }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ data: rows, actorName, canManage: MANAGER_ACTORS.includes(actorName) });
}

export async function PUT(request) {
  if (!isManager(request)) return NextResponse.json({ error: "User permission ပြင်ရန် ခွင့်မရှိပါ။" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const updates = Array.isArray(body?.permissions) ? body.permissions : [];
  if (!updates.length) return NextResponse.json({ error: "Permission data မပါပါ။" }, { status: 400 });
  await ensureUserPermissionTable();
  const results = [];
  for (const update of updates) {
    const actorName = String(update?.actorName || "").trim();
    if (!ACTORS.includes(actorName)) continue;
    const hasAllowedPaths = Array.isArray(update.allowedPaths);
    const allowedPaths = hasAllowedPaths ? normalizeAllowedPaths(update.allowedPaths, actorName) : null;
    const role = String(update?.role || "Viewer").trim().slice(0, 40) || "Viewer";
    const active = update?.active !== false;
    const note = String(update?.note || "").trim().slice(0, 500) || null;
    const updateData = { role, active, note, updatedBy: getActorName(request) };
    if (hasAllowedPaths) updateData.allowedPaths = allowedPaths;
    const saved = await prisma.userPermission.upsert({
      where: { actorName },
      update: updateData,
      create: { actorName, allowedPaths: allowedPaths || defaultAllowedPaths(actorName), role, active, note, updatedBy: getActorName(request) },
    });
    results.push({ actorName, allowedPaths: saved.allowedPaths, role: saved.role, active: saved.active, note: saved.note, lastSeenAt: saved.lastSeenAt, updatedAt: saved.updatedAt });
  }
  return NextResponse.json({ data: results });
}
