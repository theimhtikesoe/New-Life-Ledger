CREATE TABLE "UserPermission" (
    "id" SERIAL NOT NULL,
    "actorName" TEXT NOT NULL,
    "allowedPaths" JSONB NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPermission_actorName_key" ON "UserPermission"("actorName");
CREATE INDEX "UserPermission_updatedAt_idx" ON "UserPermission"("updatedAt");
