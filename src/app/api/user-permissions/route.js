import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActorName } from "@/lib/audit";
import { ACTORS, MANAGER_ACTORS, defaultAllowedPaths, normalizeAllowedPaths } from "@/lib/user-permissions";

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
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "UserPermission_actorName_key" ON "UserPermission"("actorName")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "UserPermission_updatedAt_idx" ON "UserPermission"("updatedAt")`);
}

async function getRows() {
  await ensureUserPermissionTable();
  const rows = await prisma.userPermission.findMany({ orderBy: { actorName: "asc" } });
  const byActor = new Map(rows.map((row) => [row.actorName, row]));
  return Promise.all(ACTORS.map(async (actorName) => {
    const existing = byActor.get(actorName);
    if (existing) return { actorName, allowedPaths: normalizeAllowedPaths(existing.allowedPaths, actorName), updatedAt: existing.updatedAt };
    const created = await prisma.userPermission.create({ data: { actorName, allowedPaths: defaultAllowedPaths(actorName) } });
    return { actorName, allowedPaths: created.allowedPaths, updatedAt: created.updatedAt };
  }));
}

export async function GET(request) {
  const actorName = getActorName(request);
  if (!ACTORS.includes(actorName)) return NextResponse.json({ error: "User session မတွေ့ပါ။" }, { status: 401 });
  const rows = await getRows();
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
    const allowedPaths = normalizeAllowedPaths(update.allowedPaths, actorName);
    const saved = await prisma.userPermission.upsert({
      where: { actorName },
      update: { allowedPaths, updatedBy: getActorName(request) },
      create: { actorName, allowedPaths, updatedBy: getActorName(request) },
    });
    results.push({ actorName, allowedPaths: saved.allowedPaths, updatedAt: saved.updatedAt });
  }
  return NextResponse.json({ data: results });
}
