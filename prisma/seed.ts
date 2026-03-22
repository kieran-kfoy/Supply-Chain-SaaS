import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create a tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo CPG Brand',
      planTier: 'pro',
    },
  });

  // Create a user
  await prisma.user.create({
    data: {
      email: 'demo@inventoryos.com',
      password: bcrypt.hashSync('password123', 10),
      name: 'Demo Operator',
      role: 'admin',
      tenantId: tenant.id,
    },
  });

  // Create a supplier
  const supplier = await prisma.supplier.create({
    data: {
      name: 'Global Manufacturing Co.',
      contactName: 'John Smith',
      contactEmail: 'john@globalmfg.com',
      leadTimeAvgDays: 45,
      productionType: 'import',
      tenantId: tenant.id,
    },
  });

  // Create some SKUs
  const skus = [
    {
      skuCode: 'SKU-001',
      productDescription: 'Premium Leather Backpack',
      unitCost: 45.0,
      sellingPrice: 129.0,
      orderTriggerDays: 90,
      daysToOrderTarget: 250,
      moq: 100,
      supplierId: supplier.id,
      tenantId: tenant.id,
    },
    {
      skuCode: 'SKU-002',
      productDescription: 'Canvas Weekender Bag',
      unitCost: 25.0,
      sellingPrice: 89.0,
      orderTriggerDays: 60,
      daysToOrderTarget: 180,
      moq: 50,
      supplierId: supplier.id,
      tenantId: tenant.id,
    },
    {
      skuCode: 'SKU-003',
      productDescription: 'Minimalist Card Holder',
      unitCost: 8.0,
      sellingPrice: 35.0,
      orderTriggerDays: 30,
      daysToOrderTarget: 365,
      moq: 500,
      supplierId: supplier.id,
      tenantId: tenant.id,
    },
  ];

  for (const skuData of skus) {
    const sku = await prisma.sku.create({ data: skuData });

    // Create a snapshot for each SKU
    const velocity30d = Math.random() * 10 + 2;
    const availableQuantity = Math.floor(Math.random() * 500) + 50;
    const daysInStock = availableQuantity / velocity30d;
    const totalDaysOutstanding = daysInStock; // No POs in flight for seed
    const daysUntilReorder = totalDaysOutstanding - sku.orderTriggerDays;

    let reorderStatus = 'HEALTHY';
    if (daysUntilReorder <= 0) reorderStatus = 'CRITICAL';
    else if (daysUntilReorder <= 15) reorderStatus = 'REORDER_SOON';
    else if (daysUntilReorder <= 45) reorderStatus = 'MONITOR';

    await prisma.inventorySnapshot.create({
      data: {
        tenantId: tenant.id,
        skuId: sku.id,
        onHandQuantity: availableQuantity,
        availableQuantity,
        velocity30d,
        velocity7d: velocity30d * (0.8 + Math.random() * 0.4),
        velocity90d: velocity30d * (0.9 + Math.random() * 0.2),
        daysInStock,
        daysOnOrder: 0,
        totalDaysOutstanding,
        oosDate: new Date(Date.now() + daysInStock * 24 * 60 * 60 * 1000),
        daysUntilReorder,
        reorderStatus,
        snapshotDate: new Date(),
      },
    });
  }

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
