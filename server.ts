import express from "express";
import path from "path";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import shopifyRoutes from "./server/routes/shopify";

dotenv.config();

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("[Server] FATAL: JWT_SECRET environment variable is not set");
  process.exit(1);
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000");

  app.use(express.json());

  // --- Auth Middleware ---
  const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: "No token provided" });

    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ success: false, error: "Invalid token" });
    }
  };

  // --- Health Check ---
  app.get("/api/v1/health", (_req, res) => res.json({ status: "ok" }));

  // --- API Routes ---

  // Shopify routes — install + callback are public; internal auto-sync bypasses JWT
  app.use("/api/v1/shopify", (req: any, res: any, next: any) => {
    if (req.path === "/install" || req.path === "/callback") return next();
    // Internal auto-sync calls inject tenant directly (localhost only)
    if (req.headers["x-internal-sync"] === "true" && req.headers["x-tenant-id"]) {
      const ip = req.ip || req.connection?.remoteAddress;
      if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") {
        req.user = { tenantId: req.headers["x-tenant-id"] };
        return next();
      }
      return res.status(403).json({ success: false, error: "Internal sync not allowed from external sources" });
    }
    return authenticate(req, res, next);
  }, shopifyRoutes);

  // Auth
  app.post("/api/v1/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, tenantId: user.tenantId, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
    res.json({ success: true, data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } } });
  });

  // Dashboard Summary
  app.get("/api/v1/dashboard/summary", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    
    const totalSkus = await prisma.sku.count({ where: { tenantId, isActive: true } });
    const criticalSkus = await prisma.inventorySnapshot.count({
      where: { tenantId, reorderStatus: "CRITICAL" }
    });
    const openPos = await prisma.purchaseOrder.count({
      where: { tenantId, status: "OPEN" }
    });

    res.json({
      success: true,
      data: {
        totalSkus,
        criticalSkus,
        openPos,
        nextOosDate: null // TODO: Calculate from snapshots
      }
    });
  });

  // Inventory SKUs
  app.get("/api/v1/inventory/skus", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const includeAll = req.query.includeAll === 'true';
    const skus = await prisma.sku.findMany({
      where: { tenantId, isActive: true, ...(includeAll ? {} : { isBundle: false }) },
      include: {
        supplier: true,
        snapshots: {
          orderBy: { snapshotDate: 'desc' },
          take: 1
        }
      }
    });

    // Get units on order from open POs
    const openPoStatuses = ['OPEN', 'IN PRODUCTION', 'SHIPPED'];
    const openPOs = await prisma.purchaseOrder.findMany({
      where: { tenantId, status: { in: openPoStatuses } },
    });
    const unitsOnOrderMap = new Map<string, number>();
    for (const po of openPOs) {
      const current = unitsOnOrderMap.get(po.skuId) || 0;
      unitsOnOrderMap.set(po.skuId, current + po.orderQuantity);
    }

    res.json({
      success: true,
      data: skus.map(sku => ({
        ...sku,
        latestSnapshot: sku.snapshots[0] || null,
        unitsOnOrder: unitsOnOrderMap.get(sku.id) || 0,
      }))
    });
  });

  app.post("/api/v1/inventory/skus", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const { skuCode, productDescription, unitCost, sellingPrice, supplierId, moq, orderTriggerDays, daysToOrderTarget } = req.body;

    try {
      const sku = await prisma.sku.create({
        data: {
          tenantId,
          skuCode,
          productDescription,
          unitCost: parseFloat(unitCost),
          sellingPrice: parseFloat(sellingPrice),
          supplierId,
          moq: parseInt(moq) || 1,
          orderTriggerDays: parseInt(orderTriggerDays) || 90,
          daysToOrderTarget: parseInt(daysToOrderTarget) || 250,
        }
      });
      res.json({ success: true, data: sku });
    } catch (err) {
      res.status(500).json({ success: false, error: "Failed to create SKU" });
    }
  });

  // Suppliers
  app.get("/api/v1/suppliers", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { skus: true, purchaseOrders: true }
        }
      }
    });
    res.json({ success: true, data: suppliers });
  });

  app.post("/api/v1/suppliers", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const { name, supplierType, contactName, contactEmail } = req.body;

    try {
      const supplier = await prisma.supplier.create({
        data: {
          tenantId,
          name,
          productionType: supplierType.toLowerCase(),
          contactName,
          contactEmail,
        }
      });
      res.json({ success: true, data: supplier });
    } catch (err) {
      console.error("Supplier creation error:", err);
      res.status(500).json({ success: false, error: "Failed to create supplier" });
    }
  });

  // Shipments (Finished Goods Log)
  app.get("/api/v1/shipments", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const shipments = await prisma.shipment.findMany({
      where: { tenantId },
      include: {
        sku: true,
        po: true
      },
      orderBy: { shipDate: 'desc' }
    });
    res.json({ success: true, data: shipments });
  });

  app.post("/api/v1/shipments", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const { poId, skuId, unitsShipped, shipDate, asnNumber, trackingNumber, freightCarrier } = req.body;

    try {
      const shipment = await prisma.shipment.create({
        data: {
          tenantId,
          poId,
          skuId,
          unitsShipped: parseInt(unitsShipped),
          shipDate: new Date(shipDate),
          asnNumber,
          trackingNumber,
          freightCarrier,
        }
      });

      // Update PO status if linked
      if (poId) {
        await prisma.purchaseOrder.update({
          where: { id: poId },
          data: { status: "SHIPPED", dateShipped: new Date(shipDate) }
        });
      }

      res.json({ success: true, data: shipment });
    } catch (err) {
      res.status(500).json({ success: false, error: "Failed to log shipment" });
    }
  });

  // Bulk Shipments (multi-line)
  app.post("/api/v1/shipments/bulk", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const { shipDate, trackingNumber, freightCarrier, lineItems } = req.body;

    try {
      const shipments = [];
      for (const item of lineItems) {
        const shipment = await prisma.shipment.create({
          data: {
            tenantId,
            poId: item.poId,
            skuId: item.skuId,
            unitsShipped: parseInt(item.unitsShipped),
            shipDate: new Date(shipDate),
            trackingNumber,
            freightCarrier,
          }
        });
        shipments.push(shipment);

        // Update PO status if linked
        if (item.poId) {
          await prisma.purchaseOrder.update({
            where: { id: item.poId },
            data: { status: "SHIPPED", dateShipped: new Date(shipDate) }
          });
        }
      }

      res.json({ success: true, data: shipments });
    } catch (err) {
      res.status(500).json({ success: false, error: "Failed to log shipments" });
    }
  });

  // ─── Bundles ──────────────────────────────────────────────────────────────────

  // List all bundles
  app.get("/api/v1/bundles", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    try {
      const bundles = await prisma.bundle.findMany({
        where: { tenantId },
        include: {
          sku: {
            include: {
              snapshots: { orderBy: { snapshotDate: 'desc' }, take: 1 }
            }
          },
          components: {
            include: { sku: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json({
        success: true,
        data: bundles.map(b => ({
          ...b,
          shopifyInventory: b.sku.snapshots[0]?.onHandQuantity ?? 0
        }))
      });
    } catch (err) {
      res.status(500).json({ success: false, error: "Failed to fetch bundles" });
    }
  });

  // Create a bundle
  app.post("/api/v1/bundles", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const { skuId, notes, components } = req.body;

    try {
      // Mark the SKU as a bundle
      await prisma.sku.update({
        where: { id: skuId },
        data: { isBundle: true }
      });

      const bundle = await prisma.bundle.create({
        data: {
          tenantId,
          skuId,
          notes,
          components: {
            create: components.map((c: { skuId: string; quantity: number }) => ({
              skuId: c.skuId,
              quantity: c.quantity,
            }))
          }
        },
        include: {
          sku: true,
          components: { include: { sku: true } }
        }
      });

      res.json({ success: true, data: bundle });
    } catch (err) {
      res.status(500).json({ success: false, error: "Failed to create bundle" });
    }
  });

  // Update a bundle (replace components)
  app.put("/api/v1/bundles/:id", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const { notes, components } = req.body;

    try {
      // Delete existing components and recreate
      await prisma.bundleComponent.deleteMany({ where: { bundleId: req.params.id } });

      const bundle = await prisma.bundle.update({
        where: { id: req.params.id },
        data: {
          notes,
          components: {
            create: components.map((c: { skuId: string; quantity: number }) => ({
              skuId: c.skuId,
              quantity: c.quantity,
            }))
          }
        },
        include: {
          sku: true,
          components: { include: { sku: true } }
        }
      });

      res.json({ success: true, data: bundle });
    } catch (err) {
      res.status(500).json({ success: false, error: "Failed to update bundle" });
    }
  });

  // Delete a bundle (unflag SKU so it returns to inventory)
  app.delete("/api/v1/bundles/:id", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;

    try {
      const bundle = await prisma.bundle.findFirst({
        where: { id: req.params.id, tenantId }
      });

      if (!bundle) {
        return res.status(404).json({ success: false, error: "Bundle not found" });
      }

      // Unflag the SKU
      await prisma.sku.update({
        where: { id: bundle.skuId },
        data: { isBundle: false }
      });

      // Delete bundle (cascades to components)
      await prisma.bundle.delete({ where: { id: bundle.id } });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: "Failed to delete bundle" });
    }
  });

  // Purchase Orders (List)
  app.get("/api/v1/purchase-orders", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const pos = await prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: {
        sku: true,
        supplier: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: pos });
  });

  // Update SKU settings
  app.patch("/api/v1/inventory/skus/:id", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    try {
    const { orderTriggerDays, daysToOrderTarget, moq, unitCost, sellingPrice, supplierId } = req.body;
      const sku = await prisma.sku.update({
        where: { id: req.params.id, tenantId },
        data: {
          ...(orderTriggerDays != null && { orderTriggerDays: parseInt(orderTriggerDays) }),
          ...(daysToOrderTarget != null && { daysToOrderTarget: parseInt(daysToOrderTarget) }),
          ...(moq != null && { moq: parseInt(moq) }),
          ...(unitCost != null && { unitCost: parseFloat(unitCost) }),
          ...(sellingPrice != null && { sellingPrice: parseFloat(sellingPrice) }),
          ...(supplierId && { supplierId }),
        }
      });
      res.json({ success: true, data: sku });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to update SKU' });
    }
  });

  // SKU Detail
  app.get("/api/v1/inventory/skus/:id", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const sku = await prisma.sku.findFirst({
      where: { id: req.params.id, tenantId, isActive: true },
      include: {
        supplier: true,
        snapshots: { orderBy: { snapshotDate: 'desc' }, take: 10 },
        purchaseOrders: {
          include: { supplier: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!sku) return res.status(404).json({ success: false, error: 'SKU not found' });
    res.json({ success: true, data: sku });
  });

  // Reorder Queue
  app.get("/api/v1/inventory/reorder-queue", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    // Get latest snapshot per SKU — include any that are CRITICAL, REORDER_SOON,
    // or within 15 days of their order trigger threshold
    const allSnapshots = await prisma.inventorySnapshot.findMany({
      where: { tenantId },
      include: { sku: true },
      orderBy: { snapshotDate: 'desc' }
    });

    // Deduplicate: keep only the latest snapshot per SKU
    const seen = new Set<string>();
    const latestSnapshots = allSnapshots.filter(snap => {
      if (seen.has(snap.skuId)) return false;
      seen.add(snap.skuId);
      return true;
    });

    // Get units on order from open POs
    const openPoStatuses = ['OPEN', 'IN PRODUCTION', 'SHIPPED'];
    const openPOs = await prisma.purchaseOrder.findMany({
      where: { tenantId, status: { in: openPoStatuses } },
    });
    const unitsOnOrderMap = new Map<string, number>();
    for (const po of openPOs) {
      const current = unitsOnOrderMap.get(po.skuId) || 0;
      unitsOnOrderMap.set(po.skuId, current + po.orderQuantity);
    }

    // Filter: show if CRITICAL/REORDER_SOON, or within 15 days of order trigger
    // Uses totalDaysOutstanding (daysInStock + daysOnOrder) for PO-aware calculations
    const UPCOMING_WINDOW = 15;
    const filtered = latestSnapshots.filter(snap => {
      if (snap.reorderStatus === 'CRITICAL' || snap.reorderStatus === 'REORDER_SOON') return true;
      const daysToOrder = snap.totalDaysOutstanding - snap.sku.orderTriggerDays;
      return daysToOrder <= UPCOMING_WINDOW && snap.velocity30d > 0;
    });

    // Sort by urgency (most urgent first)
    filtered.sort((a, b) => a.daysUntilReorder - b.daysUntilReorder);

    const data = filtered.map(snap => {
      const velocity = snap.velocity30d > 0 ? snap.velocity30d : snap.velocity90d;
      const unitsOnOrder = unitsOnOrderMap.get(snap.skuId) || 0;
      const suggestedOrderQty = velocity > 0
        ? Math.max(0, Math.ceil((snap.sku.daysToOrderTarget * velocity) - snap.availableQuantity - unitsOnOrder))
        : 0;
      const json = JSON.parse(JSON.stringify(snap));
      json.suggestedOrderQty = suggestedOrderQty;
      json.unitsOnOrder = unitsOnOrder;
      return json;
    });

    res.json({ success: true, data });
  });

  // Purchase Orders — single line (legacy)
  app.post("/api/v1/purchase-orders", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const { poNumber, skuId, supplierId, orderQuantity, notes, packagingOrdered } = req.body;

    try {
      const po = await prisma.purchaseOrder.create({
        data: {
          tenantId,
          poNumber,
          skuId,
          supplierId,
          orderQuantity: parseInt(orderQuantity),
          notes,
          packagingOrdered: !!packagingOrdered,
          dateSubmitted: new Date(),
          status: "OPEN",
          createdBy: req.user.id
        }
      });
      res.json({ success: true, data: po });
    } catch (err) {
      res.status(500).json({ success: false, error: "Failed to create PO" });
    }
  });

  // Purchase Orders — multi-line (bulk)
  app.post("/api/v1/purchase-orders/bulk", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const { poNumber, supplierId, notes, packagingOrdered, lineItems } = req.body;

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ success: false, error: "At least one line item is required" });
    }

    try {
      const created = [];
      for (const line of lineItems) {
        const po = await prisma.purchaseOrder.create({
          data: {
            tenantId,
            poNumber,
            skuId: line.skuId,
            supplierId,
            orderQuantity: parseInt(line.orderQuantity),
            notes,
            packagingOrdered: !!packagingOrdered,
            dateSubmitted: new Date(),
            status: "OPEN",
            createdBy: req.user.id,
          },
          include: { sku: true, supplier: true },
        });
        created.push(po);
      }
      res.json({ success: true, data: created });
    } catch (err) {
      res.status(500).json({ success: false, error: "Failed to create PO" });
    }
  });

  // Update all PO lines by PO number (grouped status/notes/expected arrival)
  // IMPORTANT: Must be registered BEFORE :id routes so Express doesn't match "by-number" as an ID
  app.patch("/api/v1/purchase-orders/by-number/:poNumber", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const poNumber = decodeURIComponent(req.params.poNumber);
    const { status, notes, expectedArrival } = req.body;
    try {
      await prisma.purchaseOrder.updateMany({
        where: { tenantId, poNumber },
        data: {
          ...(status && { status }),
          ...(notes !== undefined && { notes }),
          ...(expectedArrival && { expectedArrival: new Date(expectedArrival) }),
        },
      });
      const updated = await prisma.purchaseOrder.findMany({
        where: { tenantId, poNumber },
        include: { sku: true, supplier: true },
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to update PO group' });
    }
  });

  // Delete all PO lines by PO number
  app.delete("/api/v1/purchase-orders/by-number/:poNumber", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const poNumber = decodeURIComponent(req.params.poNumber);
    try {
      await prisma.purchaseOrder.deleteMany({ where: { tenantId, poNumber } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to delete PO group' });
    }
  });

  // Edit PO (single line)
  app.patch("/api/v1/purchase-orders/:id", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const { status, notes, expectedArrival, orderQuantity } = req.body;
    try {
      const po = await prisma.purchaseOrder.update({
        where: { id: req.params.id, tenantId },
        data: {
          ...(status && { status }),
          ...(notes !== undefined && { notes }),
          ...(expectedArrival && { expectedArrival: new Date(expectedArrival) }),
          ...(orderQuantity && { orderQuantity: parseInt(orderQuantity) }),
        },
        include: { sku: true, supplier: true }
      });
      res.json({ success: true, data: po });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to update PO' });
    }
  });

  // Delete PO (single line)
  app.delete("/api/v1/purchase-orders/:id", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    try {
      await prisma.purchaseOrder.delete({ where: { id: req.params.id, tenantId } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to delete PO' });
    }
  });

  // Mark shipment received
  app.patch("/api/v1/shipments/:id/receive", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    try {
      const shipment = await prisma.shipment.update({
        where: { id: req.params.id, tenantId },
        data: { received: true, receivedDate: new Date() }
      });
      if (shipment.poId) {
        await prisma.purchaseOrder.update({
          where: { id: shipment.poId },
          data: { status: 'RECEIVED' }
        });
      }
      res.json({ success: true, data: shipment });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to mark shipment received' });
    }
  });

  // Unreceive shipment (revert received status)
  app.patch("/api/v1/shipments/:id/unreceive", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    try {
      const shipment = await prisma.shipment.update({
        where: { id: req.params.id, tenantId },
        data: { received: false, receivedDate: null }
      });
      if (shipment.poId) {
        await prisma.purchaseOrder.update({
          where: { id: shipment.poId },
          data: { status: 'OPEN' }
        });
      }
      res.json({ success: true, data: shipment });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to unreceive shipment' });
    }
  });

  // Delete shipment
  app.delete("/api/v1/shipments/:id", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    try {
      await prisma.shipment.delete({ where: { id: req.params.id, tenantId } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to delete shipment' });
    }
  });

  // Edit supplier
  app.patch("/api/v1/suppliers/:id", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const { name, contactName, contactEmail, supplierType } = req.body;
    try {
      const supplier = await prisma.supplier.update({
        where: { id: req.params.id, tenantId },
        data: {
          ...(name && { name }),
          ...(contactName !== undefined && { contactName }),
          ...(contactEmail !== undefined && { contactEmail }),
          ...(supplierType && { productionType: supplierType.toLowerCase() }),
        }
      });
      res.json({ success: true, data: supplier });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to update supplier' });
    }
  });

  // Delete supplier
  app.delete("/api/v1/suppliers/:id", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    try {
      await prisma.supplier.delete({ where: { id: req.params.id, tenantId } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to delete supplier' });
    }
  });

  // ── Background Auto-Sync ────────────────────────────────────────────────────
  // Runs every 30 minutes and syncs any tenant whose cadence interval has elapsed
  async function runAutoSync() {
    try {
      const integrations = await prisma.integration.findMany({
        where: { integrationType: 'shopify', syncStatus: { not: 'error' } },
      });

      for (const integration of integrations) {
        const creds = JSON.parse(integration.credentialsEncrypted);
        const cadenceHours = creds.syncCadenceHours || 24;
        const lastSync = integration.lastSyncAt ? new Date(integration.lastSyncAt) : new Date(0);
        const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);

        if (hoursSinceSync >= cadenceHours) {
          console.log(`[AutoSync] Syncing tenant ${integration.tenantId} (cadence: ${cadenceHours}h, last sync: ${Math.round(hoursSinceSync)}h ago)`);
          try {
            const { accessToken, shop } = creds;

            // Fetch products
            const productsRes = await fetch(`https://${shop}/admin/api/2024-01/products.json?limit=250`, {
              headers: { 'X-Shopify-Access-Token': accessToken },
            });
            if (!productsRes.ok) throw new Error(`Shopify products API error: ${productsRes.status}`);
            const { products } = await productsRes.json() as { products: any[] };

            // Get tracked listings
            const trackedListings = await prisma.channelListing.findMany({
              where: { tenantId: integration.tenantId, platform: 'shopify' },
              include: { sku: true },
            });

            // Build inventory item map and barcode map
            const invItemToSku = new Map<string, string>();
            const variantBarcodeMap = new Map<string, string>(); // variantId → barcode
            for (const product of products) {
              for (const variant of product.variants) {
                const listing = trackedListings.find(l => l.platformVariantId === String(variant.id));
                if (listing) invItemToSku.set(String(variant.inventory_item_id), listing.skuId);
                if (variant.barcode?.trim()) {
                  variantBarcodeMap.set(String(variant.id), variant.barcode.trim());
                }
              }
            }

            // Fetch inventory levels
            const stockMap = new Map<string, number>();
            const invItemIds = Array.from(invItemToSku.keys());
            for (let i = 0; i < invItemIds.length; i += 50) {
              const chunk = invItemIds.slice(i, i + 50);
              const invRes = await fetch(
                `https://${shop}/admin/api/2024-01/inventory_levels.json?inventory_item_ids=${chunk.join(',')}&limit=250`,
                { headers: { 'X-Shopify-Access-Token': accessToken } }
              );
              if (invRes.ok) {
                const { inventory_levels } = await invRes.json() as { inventory_levels: any[] };
                for (const level of inventory_levels) {
                  const skuId = invItemToSku.get(String(level.inventory_item_id));
                  if (skuId) stockMap.set(skuId, (stockMap.get(skuId) || 0) + Math.max(0, level.available || 0));
                }
              }
            }

            // Fetch orders for velocity
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const ordersRes = await fetch(
              `https://${shop}/admin/api/2024-01/orders.json?status=any&created_at_min=${ninetyDaysAgo.toISOString()}&limit=250&fields=id,created_at,line_items`,
              { headers: { 'X-Shopify-Access-Token': accessToken } }
            );

            const salesMap = new Map<string, { sold7d: number; sold30d: number; sold90d: number }>();
            if (ordersRes.ok) {
              const { orders } = await ordersRes.json() as { orders: any[] };
              for (const order of orders) {
                const orderDate = new Date(order.created_at);
                for (const item of order.line_items || []) {
                  const vid = String(item.variant_id);
                  const qty = item.quantity || 0;
                  const s = salesMap.get(vid) || { sold7d: 0, sold30d: 0, sold90d: 0 };
                  s.sold90d += qty;
                  if (orderDate >= thirtyDaysAgo) s.sold30d += qty;
                  if (orderDate >= sevenDaysAgo) s.sold7d += qty;
                  salesMap.set(vid, s);
                }
              }
            }

            // Create snapshots and sync barcode
            for (const listing of trackedListings) {
              const sku = listing.sku;
              const onHand = stockMap.get(sku.id) ?? 0;

              // Sync barcode from Shopify
              const freshBarcode = variantBarcodeMap.get(listing.platformVariantId || '') || null;
              if (freshBarcode !== (sku.barcodeUpc || null)) {
                await prisma.sku.update({
                  where: { id: sku.id },
                  data: { barcodeUpc: freshBarcode },
                });
              }
              const sales = salesMap.get(listing.platformVariantId || '') || { sold7d: 0, sold30d: 0, sold90d: 0 };
              const v30 = sales.sold30d / 30;
              const v90 = sales.sold90d / 90;
              const v7 = sales.sold7d / 7;
              const primary = v30 > 0 ? v30 : v90 > 0 ? v90 : 0;
              const daysInStock = primary > 0 ? onHand / primary : 0;
              const oosDate = primary > 0 ? new Date(Date.now() + daysInStock * 86400000) : null;
              const daysUntilReorder = daysInStock - (sku.orderTriggerDays || 90);
              let reorderStatus = 'HEALTHY';
              if (primary === 0) reorderStatus = 'MONITOR';
              else if (daysInStock <= 30) reorderStatus = 'CRITICAL';
              else if (daysInStock <= 60) reorderStatus = 'REORDER_SOON';
              else if (daysInStock <= 90) reorderStatus = 'MONITOR';

              await prisma.inventorySnapshot.create({
                data: {
                  tenantId: integration.tenantId,
                  skuId: sku.id,
                  onHandQuantity: onHand,
                  availableQuantity: onHand,
                  shipped7Days: sales.sold7d,
                  shipped30Days: sales.sold30d,
                  shipped90Days: sales.sold90d,
                  velocity7d: v7,
                  velocity30d: v30,
                  velocity90d: v90,
                  daysInStock,
                  daysOnOrder: 0,
                  totalDaysOutstanding: daysInStock,
                  oosDate,
                  daysUntilReorder,
                  reorderStatus,
                  provider: 'shopify',
                },
              });
            }

            await prisma.integration.update({
              where: { id: integration.id },
              data: { lastSyncAt: new Date(), syncStatus: 'synced' },
            });

            console.log(`[AutoSync] Tenant ${integration.tenantId} synced — ${trackedListings.length} snapshots created`);
          } catch (err: any) {
            console.error(`[AutoSync] Failed for tenant ${integration.tenantId}:`, err.message);
            await prisma.integration.update({
              where: { id: integration.id },
              data: { syncStatus: 'error', errorLog: err.message },
            });
          }
        }
      }
    } catch (err: any) {
      console.error('[AutoSync] Scheduler error:', err.message);
    }
  }

  // Check every 30 minutes if any tenant is due for a sync
  setInterval(runAutoSync, 30 * 60 * 1000);
  console.log('[AutoSync] Background scheduler started (checks every 30 minutes)');

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    console.log(`[Server] Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"), (err) => {
        if (err) {
          console.error("[Server] Failed to serve index.html:", err);
          res.status(500).send("Server error");
        }
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

}


startServer().catch((err) => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});
