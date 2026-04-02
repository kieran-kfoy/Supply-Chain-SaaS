-- Supply Chain SaaS - Full Schema
-- Paste this into Supabase SQL Editor and click "Run"

CREATE TABLE IF NOT EXISTS "Tenant" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "planTier" TEXT NOT NULL DEFAULT 'free',
  "shopifyStoreUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'operator',
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Supplier" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactName" TEXT,
  "contactEmail" TEXT,
  "leadTimeAvgDays" INTEGER NOT NULL DEFAULT 30,
  "productionType" TEXT NOT NULL DEFAULT 'domestic',
  "shipToAddress" TEXT,
  "paymentTerms" TEXT,
  "notes" TEXT,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Product" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "shopifyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Sku" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT,
  "skuCode" TEXT NOT NULL,
  "productDescription" TEXT NOT NULL,
  "barcodeUpc" TEXT,
  "unitCost" DOUBLE PRECISION NOT NULL,
  "sellingPrice" DOUBLE PRECISION NOT NULL,
  "orderTriggerDays" INTEGER NOT NULL DEFAULT 90,
  "daysToOrderTarget" INTEGER NOT NULL DEFAULT 250,
  "moq" INTEGER NOT NULL DEFAULT 1,
  "supplierId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isBundle" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Sku_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BundleComponent" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "bundleId" TEXT NOT NULL,
  "componentId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "BundleComponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventorySnapshot" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "skuId" TEXT NOT NULL,
  "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "onHandQuantity" INTEGER NOT NULL,
  "qtyOnDock" INTEGER NOT NULL DEFAULT 0,
  "qtyAllocated" INTEGER NOT NULL DEFAULT 0,
  "nonsaleableQuantity" INTEGER NOT NULL DEFAULT 0,
  "inboundQuantity" INTEGER NOT NULL DEFAULT 0,
  "shipped7Days" INTEGER NOT NULL DEFAULT 0,
  "shipped30Days" INTEGER NOT NULL DEFAULT 0,
  "shipped90Days" INTEGER NOT NULL DEFAULT 0,
  "availableQuantity" INTEGER NOT NULL,
  "velocity7d" DOUBLE PRECISION NOT NULL,
  "velocity30d" DOUBLE PRECISION NOT NULL,
  "velocity90d" DOUBLE PRECISION NOT NULL,
  "daysInStock" DOUBLE PRECISION NOT NULL,
  "daysOnOrder" DOUBLE PRECISION NOT NULL,
  "totalDaysOutstanding" DOUBLE PRECISION NOT NULL,
  "oosDate" TIMESTAMP(3),
  "daysUntilReorder" DOUBLE PRECISION NOT NULL,
  "reorderStatus" TEXT NOT NULL,
  "demandFlag" TEXT,
  CONSTRAINT "InventorySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "poNumber" TEXT NOT NULL,
  "skuId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "orderQuantity" INTEGER NOT NULL,
  "dateSubmitted" TIMESTAMP(3) NOT NULL,
  "dateShipped" TIMESTAMP(3),
  "expectedArrival" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "category" TEXT NOT NULL DEFAULT 'MANUFACTURING',
  "packagingOrdered" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Shipment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "poId" TEXT NOT NULL,
  "skuId" TEXT NOT NULL,
  "unitsShipped" INTEGER NOT NULL,
  "shipDate" TIMESTAMP(3) NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'MANUFACTURING',
  "asnNumber" TEXT,
  "freightCarrier" TEXT,
  "trackingNumber" TEXT,
  "inboundCreated" BOOLEAN NOT NULL DEFAULT false,
  "received" BOOLEAN NOT NULL DEFAULT false,
  "receivedDate" TIMESTAMP(3),
  "discrepancyFlag" BOOLEAN NOT NULL DEFAULT false,
  "discrepancyNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Integration" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "integrationType" TEXT NOT NULL,
  "credentialsEncrypted" TEXT NOT NULL,
  "lastSyncAt" TIMESTAMP(3),
  "syncStatus" TEXT,
  "errorLog" TEXT,
  CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Alert" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "alertType" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "referenceType" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
ALTER TABLE "User" ADD CONSTRAINT "User_email_key" UNIQUE ("email");
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopifyId_key" UNIQUE ("shopifyId");
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_tenantId_skuCode_key" UNIQUE ("tenantId", "skuCode");
ALTER TABLE "BundleComponent" ADD CONSTRAINT "BundleComponent_bundleId_componentId_key" UNIQUE ("bundleId", "componentId");

-- Foreign keys
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BundleComponent" ADD CONSTRAINT "BundleComponent_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BundleComponent" ADD CONSTRAINT "BundleComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventorySnapshot" ADD CONSTRAINT "InventorySnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventorySnapshot" ADD CONSTRAINT "InventorySnapshot_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma migrations tracking table
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);
