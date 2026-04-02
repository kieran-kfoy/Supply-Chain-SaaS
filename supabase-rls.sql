-- Row Level Security (RLS) for Supply Chain SaaS
-- Paste this into Supabase SQL Editor and click "Run"
-- This ensures each tenant can only see their own data.

-- Enable RLS on all tables
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sku" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventorySnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Shipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Integration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Alert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChannelListing" ENABLE ROW LEVEL SECURITY;

-- Create a bypass role for the server (service role bypasses RLS by default in Supabase)
-- Our Express server uses the service role key, so it has full access.
-- RLS protects against direct database access with the anon key.

-- Policy: Users can only read their own tenant's data
-- We use current_setting to pass tenantId from the app via SET LOCAL

-- Tenant: only accessible by matching tenantId
CREATE POLICY "tenant_isolation" ON "Tenant"
  USING (id = current_setting('app.current_tenant_id', true));

-- User: only accessible within same tenant
CREATE POLICY "tenant_isolation" ON "User"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Sku
CREATE POLICY "tenant_isolation" ON "Sku"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- InventorySnapshot
CREATE POLICY "tenant_isolation" ON "InventorySnapshot"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- PurchaseOrder
CREATE POLICY "tenant_isolation" ON "PurchaseOrder"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Shipment
CREATE POLICY "tenant_isolation" ON "Shipment"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Supplier
CREATE POLICY "tenant_isolation" ON "Supplier"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Integration
CREATE POLICY "tenant_isolation" ON "Integration"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Alert
CREATE POLICY "tenant_isolation" ON "Alert"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- ChannelListing
CREATE POLICY "tenant_isolation" ON "ChannelListing"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));
