import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "inventory-os-secret-key";

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  // --- API Routes ---

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
    const skus = await prisma.sku.findMany({
      where: { tenantId, isActive: true },
      include: {
        supplier: true,
        snapshots: {
          orderBy: { snapshotDate: 'desc' },
          take: 1
        }
      }
    });

    res.json({
      success: true,
      data: skus.map(sku => ({
        ...sku,
        latestSnapshot: sku.snapshots[0] || null
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

  // Reorder Queue
  app.get("/api/v1/inventory/reorder-queue", authenticate, async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const snapshots = await prisma.inventorySnapshot.findMany({
      where: { 
        tenantId,
        reorderStatus: { in: ["CRITICAL", "REORDER_SOON"] }
      },
      include: { sku: true },
      orderBy: { daysUntilReorder: 'asc' }
    });

    res.json({ success: true, data: snapshots });
  });

  // Purchase Orders
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
