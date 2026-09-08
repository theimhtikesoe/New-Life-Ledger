import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

function serverlessDatabaseUrl() {
  const url = process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";
  if (!url || /[?&]connection_limit=/i.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=1`;
}

export const prisma = globalForPrisma.prisma || new PrismaClient({
  datasources: { db: { url: serverlessDatabaseUrl() } },
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

// Reuse the client in both development and warm production runtimes. Creating
// a new PrismaClient for every server module instance can exhaust small
// serverless connection pools (production is limited to five connections).
globalForPrisma.prisma = prisma;
