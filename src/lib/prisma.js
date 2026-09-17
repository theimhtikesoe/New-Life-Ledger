import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

function serverlessDatabaseUrl() {
  const url = process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";
  if (!url) return url;
  const params = [];
  if (!/[?&]connection_limit=/i.test(url)) {
    // Keep the safe single-connection default for serverless instances. A
    // pooled provider can opt into a larger value through the URL itself.
    params.push(`connection_limit=${process.env.PRISMA_CONNECTION_LIMIT || "1"}`);
  }
  if (!/[?&]connect_timeout=/i.test(url)) params.push(`connect_timeout=${process.env.PRISMA_CONNECT_TIMEOUT || "10"}`);
  if (!/[?&]pool_timeout=/i.test(url)) params.push(`pool_timeout=${process.env.PRISMA_POOL_TIMEOUT || "20"}`);
  return params.length ? `${url}${url.includes("?") ? "&" : "?"}${params.join("&")}` : url;
}

export const prisma = globalForPrisma.prisma || new PrismaClient({
  datasources: { db: { url: serverlessDatabaseUrl() } },
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

// Reuse the client in both development and warm production runtimes. Creating
// a new PrismaClient for every server module instance can exhaust small
// serverless connection pools (production is limited to five connections).
globalForPrisma.prisma = prisma;
