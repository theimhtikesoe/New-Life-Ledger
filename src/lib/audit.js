import { prisma } from "@/lib/prisma";

import { decodeActorHeader } from "./actor-header";

export const ACTORS = ["ဖေဖေ", "ပုံ့ပုံ့", "ဆောင်းဦး", "Staff"];

export function getActorName(request, fallback = "Staff") {
  const rawActor = request?.headers?.get?.("x-actor-name") || "";
  const actor = decodeActorHeader(rawActor).trim();
  return ACTORS.includes(actor) ? actor : fallback;
}

export async function writeAuditLog({
  db = prisma,
  actorName = "Staff",
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
      actorName: ACTORS.includes(actorName) ? actorName : "Staff",
      action,
      entityType,
      entityId: entityId ? String(entityId) : null,
      entityLabel: entityLabel || null,
      summary,
      metadata: metadata || undefined,
    },
  });
}
