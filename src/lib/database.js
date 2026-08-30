import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

let setupPromise;
let setupComplete = false;

const REQUIRED_TABLES = [
  "Customer",
  "KpayAlias",
  "Ledger",
  "UnverifiedKpay",
  "AuditLog",
  "AutoReportRun",
  "CashSale",
  "DailySalesSummary",
  "DailySalesOpening",
  "Order",
  "OrderLine",
  "OrderCap",
  "OrderDelivery",
  "OrderAutomationSetting",
  "OrderBatchRun",
  "AiExplanationCache",
];
const REQUIRED_AUTO_REPORT_COLUMNS = ["manualNoticeClaimedAt", "manualNoticeSentAt"];

async function hasExpectedSchema() {
  const result = await prisma.$queryRaw`
    SELECT
      (
        SELECT COUNT(*)::int
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (${Prisma.join(REQUIRED_TABLES)})
      ) AS table_count,
      (
        SELECT COUNT(*)::int
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'AutoReportRun'
          AND column_name IN (${Prisma.join(REQUIRED_AUTO_REPORT_COLUMNS)})
      ) AS auto_report_column_count
  `;
  return Number(result[0]?.table_count || 0) === REQUIRED_TABLES.length
    && Number(result[0]?.auto_report_column_count || 0) === REQUIRED_AUTO_REPORT_COLUMNS.length;
}

function isBenignSetupRace(error) {
  const code = error?.code || error?.meta?.code;
  const message = `${error?.message || ""} ${error?.meta?.message || ""}`;

  return (
    code === "23505" ||
    code === "42P07" ||
    code === "42701" ||
    code === "42710" ||
    message.includes("already exists") ||
    message.includes("duplicate key value violates unique constraint")
  );
}

async function setupQuery(sql) {
  try {
    return await prisma.$executeRawUnsafe(sql);
  } catch (error) {
    if (isBenignSetupRace(error)) {
      console.warn("Ignoring concurrent database setup race:", error.message);
      return null;
    }

    throw error;
  }
}

export function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not configured. Add a Postgres database URL in Vercel Project Settings > Environment Variables.",
    );
  }
}

export async function ensureDatabase() {
  requireDatabaseUrl();

  // Return immediately if setup is already complete
  if (setupComplete) {
    return;
  }

  // If setup is in progress, wait for it to complete
  if (setupPromise) {
    return setupPromise;
  }

  // Start setup and cache the promise
  setupPromise = (async () => {
    try {
      // Production requests normally arrive after migrations have already
      // created the complete schema. Avoid repeating many CREATE/ALTER/index
      // statements on every cold serverless function. If the readiness probe
      // fails, fall back to the existing additive setup path below.
      if (await hasExpectedSchema().catch(() => false)) {
        setupComplete = true;
        return;
      }

      const tableCheck = await prisma.$queryRaw`
        SELECT count(*)
        FROM information_schema.tables
        WHERE table_name = 'Customer'
      `.catch(() => [{ count: 0 }]);

      if (Number(tableCheck[0]?.count || 0) > 0) {
        await setupQuery(`
          CREATE TABLE IF NOT EXISTS "AuditLog" (
            "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "actorName" TEXT NOT NULL,
            "action" TEXT NOT NULL,
            "entityType" TEXT NOT NULL,
            "entityId" TEXT,
            "entityLabel" TEXT,
            "summary" TEXT NOT NULL,
            "metadata" JSONB,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await setupQuery(`CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt")`);
        await setupQuery(`CREATE INDEX IF NOT EXISTS "AuditLog_actorName_idx" ON "AuditLog"("actorName")`);
        await setupQuery(`CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action")`);
        await setupQuery(`CREATE INDEX IF NOT EXISTS "AuditLog_entityType_idx" ON "AuditLog"("entityType")`);
        await setupQuery(`ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3)`);
        await setupQuery(`ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "hiddenBy" TEXT`);
        await setupQuery(`CREATE INDEX IF NOT EXISTS "AuditLog_hiddenAt_idx" ON "AuditLog"("hiddenAt")`);
        await setupQuery(`
          CREATE TABLE IF NOT EXISTS "AutoReportRun" (
            "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "status" TEXT NOT NULL,
            "trigger" TEXT NOT NULL DEFAULT 'schedule',
            "reportDate" TEXT,
            "periodLabel" TEXT,
            "recipientCount" INTEGER NOT NULL DEFAULT 0,
            "counts" JSONB,
            "elapsedMs" INTEGER,
            "errorMessage" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await setupQuery(`CREATE INDEX IF NOT EXISTS "AutoReportRun_createdAt_idx" ON "AutoReportRun"("createdAt")`);
        await setupQuery(`CREATE INDEX IF NOT EXISTS "AutoReportRun_reportDate_idx" ON "AutoReportRun"("reportDate")`);
        await setupQuery(`CREATE INDEX IF NOT EXISTS "AutoReportRun_status_idx" ON "AutoReportRun"("status")`);
        await setupQuery(`ALTER TABLE "AutoReportRun" ADD COLUMN IF NOT EXISTS "manualNoticeClaimedAt" TIMESTAMP(3)`);
        await setupQuery(`ALTER TABLE "AutoReportRun" ADD COLUMN IF NOT EXISTS "manualNoticeSentAt" TIMESTAMP(3)`);
        await setupQuery(`
          CREATE TABLE IF NOT EXISTS "CashSale" (
            "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "customerId" UUID NOT NULL,
            "saleType" TEXT NOT NULL DEFAULT 'RETAIL',
            "itemSize" TEXT,
            "cartons" INTEGER,
            "rate" INTEGER,
            "deductions" INTEGER NOT NULL DEFAULT 0,
            "amount" INTEGER NOT NULL,
            "note" TEXT,
            "paymentType" TEXT,
            "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "CashSale_customerId_fkey"
              FOREIGN KEY ("customerId") REFERENCES "Customer" ("id")
              ON DELETE CASCADE ON UPDATE CASCADE
          )
        `);
        await setupQuery(`CREATE INDEX IF NOT EXISTS "CashSale_customerId_idx" ON "CashSale"("customerId")`);
        await setupQuery(`CREATE INDEX IF NOT EXISTS "CashSale_date_idx" ON "CashSale"("date")`);
        await setupQuery(`
          CREATE TABLE IF NOT EXISTS "DailySalesSummary" (
            "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "date" TEXT NOT NULL UNIQUE,
            "retailTotal" INTEGER NOT NULL DEFAULT 0,
            "wholesaleTotal" INTEGER NOT NULL DEFAULT 0,
            "retailCash" INTEGER NOT NULL DEFAULT 0,
            "wholesaleCash" INTEGER NOT NULL DEFAULT 0,
            "source" TEXT NOT NULL DEFAULT 'DAILY_INPUT',
            "note" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await setupQuery(`CREATE INDEX IF NOT EXISTS "DailySalesSummary_date_idx" ON "DailySalesSummary"("date")`);
        await setupQuery(`ALTER TABLE "DailySalesSummary" ADD COLUMN IF NOT EXISTS "enteredAt" TIMESTAMP(3)`);
        await setupQuery(`ALTER TABLE "DailySalesSummary" ADD COLUMN IF NOT EXISTS "enteredBy" TEXT`);
        await setupQuery(`
          CREATE TABLE IF NOT EXISTS "DailySalesSummarySource" (
            "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "summaryId" UUID NOT NULL,
            "sourceType" TEXT NOT NULL,
            "sourceId" UUID NOT NULL,
            "contributionType" TEXT NOT NULL,
            "amount" INTEGER NOT NULL DEFAULT 0,
            "paymentType" TEXT,
            "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "DailySalesSummarySource_summaryId_fkey"
              FOREIGN KEY ("summaryId") REFERENCES "DailySalesSummary" ("id")
              ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "DailySalesSummarySource_unique"
              UNIQUE ("summaryId", "sourceType", "sourceId", "contributionType")
          )
        `);
        await setupQuery(`CREATE INDEX IF NOT EXISTS "DailySalesSummarySource_summaryId_idx" ON "DailySalesSummarySource"("summaryId")`);
        await setupQuery(`CREATE INDEX IF NOT EXISTS "DailySalesSummarySource_source_idx" ON "DailySalesSummarySource"("sourceType", "sourceId")`);
        await setupQuery(`
          CREATE TABLE IF NOT EXISTS "DailySalesOpening" (
            "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "month" TEXT NOT NULL UNIQUE,
            "amount" INTEGER NOT NULL DEFAULT 0,
            "asOfDate" TEXT NOT NULL,
            "note" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await setupQuery(`CREATE INDEX IF NOT EXISTS "DailySalesOpening_month_idx" ON "DailySalesOpening"("month")`);
        const orderTableCheck = await prisma.$queryRaw`
          SELECT count(*)
          FROM information_schema.tables
          WHERE table_name = 'Order'
        `.catch(() => [{ count: 0 }]);
        if (orderTableCheck[0]?.count > 0) {
          await setupQuery(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "factoryOrderDate" TEXT`);
          await setupQuery(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "factoryOrderNumber" INTEGER`);
          await setupQuery(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "historyTrashedAt" TIMESTAMP(3)`);
          await setupQuery(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "historyTrashedBy" TEXT`);
          await setupQuery(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentType" TEXT`);
          await setupQuery(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentNote" TEXT`);
          await setupQuery(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "receiptNote" TEXT`);
          const orderLineTableCheck = await prisma.$queryRaw`
            SELECT count(*)
            FROM information_schema.tables
            WHERE table_name = 'OrderLine'
          `.catch(() => [{ count: 0 }]);
          if (orderLineTableCheck[0]?.count > 0) {
            await setupQuery(`ALTER TABLE "OrderLine" ADD COLUMN IF NOT EXISTS "quotedRate" INTEGER`);
            await setupQuery(`ALTER TABLE "OrderLine" ADD COLUMN IF NOT EXISTS "quotedAmount" INTEGER`);
          }
          await setupQuery(`CREATE INDEX IF NOT EXISTS "Order_historyTrashedAt_idx" ON "Order"("historyTrashedAt")`);
          await setupQuery(`CREATE INDEX IF NOT EXISTS "Order_factoryOrderDate_idx" ON "Order"("factoryOrderDate")`);
          await setupQuery(`CREATE UNIQUE INDEX IF NOT EXISTS "Order_factoryOrderDate_factoryOrderNumber_key" ON "Order"("factoryOrderDate", "factoryOrderNumber")`);
        }
        setupComplete = true;
        return;
      }

      await setupQuery(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

      const legacyCustomerId = await prisma.$queryRaw`
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'Customer'
          AND column_name = 'id'
          AND udt_name <> 'uuid'
        LIMIT 1
      `.catch(() => []);

      if (legacyCustomerId.length) {
        throw new Error(
          "Legacy database schema detected. Automatic table deletion is disabled; take a backup and run a reviewed migration before continuing.",
        );
      }

      await setupQuery(`
        CREATE TABLE IF NOT EXISTS "Customer" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "name" TEXT NOT NULL,
          "phone" TEXT,
          "routeTag" TEXT,
          "current_balance" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "deletedAt" TIMESTAMP(3)
        )
      `);
      await setupQuery(`
        CREATE TABLE IF NOT EXISTS "KpayAlias" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "kpayName" TEXT NOT NULL UNIQUE,
          "customerId" UUID NOT NULL,
          CONSTRAINT "KpayAlias_customerId_fkey"
            FOREIGN KEY ("customerId") REFERENCES "Customer" ("id")
            ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await setupQuery(`
        CREATE TABLE IF NOT EXISTS "Ledger" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "customerId" UUID NOT NULL,
          "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "type" TEXT NOT NULL,
          "saleType" TEXT NOT NULL,
          "itemSize" TEXT,
          "cartons" INTEGER,
          "rate" INTEGER,
          "deductions" INTEGER NOT NULL DEFAULT 0,
          "amount" INTEGER NOT NULL,
          "note" TEXT,
          "paymentType" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Ledger_customerId_fkey"
            FOREIGN KEY ("customerId") REFERENCES "Customer" ("id")
            ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await setupQuery(`
        CREATE TABLE IF NOT EXISTS "CashSale" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "customerId" UUID NOT NULL,
          "saleType" TEXT NOT NULL DEFAULT 'RETAIL',
          "itemSize" TEXT,
          "cartons" INTEGER,
          "rate" INTEGER,
          "deductions" INTEGER NOT NULL DEFAULT 0,
          "amount" INTEGER NOT NULL,
          "note" TEXT,
          "paymentType" TEXT,
          "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CashSale_customerId_fkey"
            FOREIGN KEY ("customerId") REFERENCES "Customer" ("id")
            ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await setupQuery(`CREATE INDEX IF NOT EXISTS "CashSale_customerId_idx" ON "CashSale"("customerId")`);
      await setupQuery(`CREATE INDEX IF NOT EXISTS "CashSale_date_idx" ON "CashSale"("date")`);
      await setupQuery(`
        CREATE TABLE IF NOT EXISTS "DailySalesSummary" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "date" TEXT NOT NULL UNIQUE,
          "retailTotal" INTEGER NOT NULL DEFAULT 0,
          "wholesaleTotal" INTEGER NOT NULL DEFAULT 0,
          "retailCash" INTEGER NOT NULL DEFAULT 0,
          "wholesaleCash" INTEGER NOT NULL DEFAULT 0,
          "source" TEXT NOT NULL DEFAULT 'DAILY_INPUT',
          "note" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await setupQuery(`CREATE INDEX IF NOT EXISTS "DailySalesSummary_date_idx" ON "DailySalesSummary"("date")`);
      await setupQuery(`ALTER TABLE "DailySalesSummary" ADD COLUMN IF NOT EXISTS "enteredAt" TIMESTAMP(3)`);
      await setupQuery(`ALTER TABLE "DailySalesSummary" ADD COLUMN IF NOT EXISTS "enteredBy" TEXT`);
      await setupQuery(`
        CREATE TABLE IF NOT EXISTS "DailySalesSummarySource" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "summaryId" UUID NOT NULL,
          "sourceType" TEXT NOT NULL,
          "sourceId" UUID NOT NULL,
          "contributionType" TEXT NOT NULL,
          "amount" INTEGER NOT NULL DEFAULT 0,
          "paymentType" TEXT,
          "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "DailySalesSummarySource_summaryId_fkey"
            FOREIGN KEY ("summaryId") REFERENCES "DailySalesSummary" ("id")
            ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "DailySalesSummarySource_unique"
            UNIQUE ("summaryId", "sourceType", "sourceId", "contributionType")
        )
      `);
      await setupQuery(`CREATE INDEX IF NOT EXISTS "DailySalesSummarySource_summaryId_idx" ON "DailySalesSummarySource"("summaryId")`);
      await setupQuery(`CREATE INDEX IF NOT EXISTS "DailySalesSummarySource_source_idx" ON "DailySalesSummarySource"("sourceType", "sourceId")`);
      await setupQuery(`
        CREATE TABLE IF NOT EXISTS "DailySalesOpening" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "month" TEXT NOT NULL UNIQUE,
          "amount" INTEGER NOT NULL DEFAULT 0,
          "asOfDate" TEXT NOT NULL,
          "note" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await setupQuery(`CREATE INDEX IF NOT EXISTS "DailySalesOpening_month_idx" ON "DailySalesOpening"("month")`);
      await setupQuery(`
        CREATE TABLE IF NOT EXISTS "UnverifiedKpay" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "raw_text" TEXT NOT NULL,
          "kpayName" TEXT,
          "amount" INTEGER NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'PENDING',
          "suggestedCustomerId" UUID,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "UnverifiedKpay_suggestedCustomerId_fkey"
            FOREIGN KEY ("suggestedCustomerId") REFERENCES "Customer" ("id")
            ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);

      // Ensure all columns exist (for migrations)
      await setupQuery(`ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "routeTag" TEXT`);
      await setupQuery(
        `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "current_balance" INTEGER NOT NULL DEFAULT 0`,
      );
      await setupQuery(`ALTER TABLE "UnverifiedKpay" ADD COLUMN IF NOT EXISTS "kpayName" TEXT`);
      await setupQuery(
        `ALTER TABLE "UnverifiedKpay" ADD COLUMN IF NOT EXISTS "suggestedCustomerId" UUID`,
      );
      await setupQuery(`ALTER TABLE "Ledger" ADD COLUMN IF NOT EXISTS "paymentType" TEXT`);
      await setupQuery(`ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`);

      // Create indexes for faster queries
      await setupQuery(`CREATE INDEX IF NOT EXISTS "Ledger_customerId_idx" ON "Ledger"("customerId")`);
      await setupQuery(`CREATE INDEX IF NOT EXISTS "Ledger_date_idx" ON "Ledger"("date")`);
      await setupQuery(`CREATE INDEX IF NOT EXISTS "UnverifiedKpay_status_idx" ON "UnverifiedKpay"("status")`);
      await setupQuery(`CREATE INDEX IF NOT EXISTS "UnverifiedKpay_kpayName_idx" ON "UnverifiedKpay"("kpayName")`);
      await setupQuery(`
        CREATE TABLE IF NOT EXISTS "AuditLog" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "actorName" TEXT NOT NULL,
          "action" TEXT NOT NULL,
          "entityType" TEXT NOT NULL,
          "entityId" TEXT,
          "entityLabel" TEXT,
          "summary" TEXT NOT NULL,
          "metadata" JSONB,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await setupQuery(`CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt")`);
      await setupQuery(`CREATE INDEX IF NOT EXISTS "AuditLog_actorName_idx" ON "AuditLog"("actorName")`);
      await setupQuery(`CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action")`);
      await setupQuery(`CREATE INDEX IF NOT EXISTS "AuditLog_entityType_idx" ON "AuditLog"("entityType")`);
      await setupQuery(`ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3)`);
      await setupQuery(`ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "hiddenBy" TEXT`);
      await setupQuery(`CREATE INDEX IF NOT EXISTS "AuditLog_hiddenAt_idx" ON "AuditLog"("hiddenAt")`);
      await setupQuery(`
        CREATE TABLE IF NOT EXISTS "AutoReportRun" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "status" TEXT NOT NULL,
          "trigger" TEXT NOT NULL DEFAULT 'schedule',
          "reportDate" TEXT,
          "periodLabel" TEXT,
          "recipientCount" INTEGER NOT NULL DEFAULT 0,
          "counts" JSONB,
          "elapsedMs" INTEGER,
          "errorMessage" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await setupQuery(`CREATE INDEX IF NOT EXISTS "AutoReportRun_createdAt_idx" ON "AutoReportRun"("createdAt")`);
      await setupQuery(`CREATE INDEX IF NOT EXISTS "AutoReportRun_reportDate_idx" ON "AutoReportRun"("reportDate")`);
      await setupQuery(`CREATE INDEX IF NOT EXISTS "AutoReportRun_status_idx" ON "AutoReportRun"("status")`);
      await setupQuery(`ALTER TABLE "AutoReportRun" ADD COLUMN IF NOT EXISTS "manualNoticeClaimedAt" TIMESTAMP(3)`);
      await setupQuery(`ALTER TABLE "AutoReportRun" ADD COLUMN IF NOT EXISTS "manualNoticeSentAt" TIMESTAMP(3)`);
      const orderTableCheck = await prisma.$queryRaw`
        SELECT count(*)
        FROM information_schema.tables
        WHERE table_name = 'Order'
      `.catch(() => [{ count: 0 }]);
      if (orderTableCheck[0]?.count > 0) {
        await setupQuery(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "factoryOrderDate" TEXT`);
        await setupQuery(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "factoryOrderNumber" INTEGER`);
        await setupQuery(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "historyTrashedAt" TIMESTAMP(3)`);
        await setupQuery(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "historyTrashedBy" TEXT`);
        await setupQuery(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentType" TEXT`);
        await setupQuery(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentNote" TEXT`);
        await setupQuery(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "receiptNote" TEXT`);
        const orderLineTableCheck = await prisma.$queryRaw`
          SELECT count(*)
          FROM information_schema.tables
          WHERE table_name = 'OrderLine'
        `.catch(() => [{ count: 0 }]);
        if (orderLineTableCheck[0]?.count > 0) {
          await setupQuery(`ALTER TABLE "OrderLine" ADD COLUMN IF NOT EXISTS "quotedRate" INTEGER`);
          await setupQuery(`ALTER TABLE "OrderLine" ADD COLUMN IF NOT EXISTS "quotedAmount" INTEGER`);
        }
        await setupQuery(`CREATE INDEX IF NOT EXISTS "Order_historyTrashedAt_idx" ON "Order"("historyTrashedAt")`);
        await setupQuery(`CREATE INDEX IF NOT EXISTS "Order_factoryOrderDate_idx" ON "Order"("factoryOrderDate")`);
        await setupQuery(`CREATE UNIQUE INDEX IF NOT EXISTS "Order_factoryOrderDate_factoryOrderNumber_key" ON "Order"("factoryOrderDate", "factoryOrderNumber")`);
      }
      
      // Mark setup as complete
      setupComplete = true;
    } catch (error) {
      console.error("Database setup failed:", error);
      // Reset promises on error to allow retry
      setupPromise = null;
      throw error;
    }
  })();

  return setupPromise;
}

export function databaseErrorResponse(error) {
  console.error(error);
  return {
    error: error.message || "Database request failed",
  };
}
