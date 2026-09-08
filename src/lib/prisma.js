import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

// Reuse the client in both development and warm production runtimes. Creating
// a new PrismaClient for every server module instance can exhaust small
// serverless connection pools (production is limited to five connections).
globalForPrisma.prisma = prisma;
