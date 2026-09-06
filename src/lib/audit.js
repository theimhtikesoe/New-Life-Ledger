import { prisma } from "@/lib/prisma";

import { decodeActorHeader } from "./actor-header";

export const ACTORS = ["ဖေဖေ/မေမေ", "ပုံ့ပုံ့", "ဆောင်းဦး", "ဇွဲဇွဲ", "Rhyzoe"];

export function getActorName(request, fallback = "Rhyzoe") {
  const rawActor = request?.headers?.get?.("x-actor-name") || "";
  const actor = decodeActorHeader(rawActor).trim();
  return ACTORS.includes(actor) ? actor : fallback;
}

export async function writeAuditLog({
  db = prisma,
  actorName = "Rhyzoe",
  action,
  entityType,
  entityId,
  entityLabel,
  summary,
  metadata,
}) {
  if (!action || !entityType || !summary) return null;

  return db.auditLog.create({
    data: {
      actorName: ACTORS.includes(actorName) ? actorName : "Rhyzoe",
      action,
      entityType,
      entityId: entityId ? String(entityId) : null,
      entityLabel: entityLabel || null,
      summary,
      metadata: metadata || undefined,
    },
  });
}
