import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function calculateSkuHealth(tenantId: string, skuId: string) {
  const sku = await prisma.sku.findUnique({
    where: { id: skuId },
    include: {
      purchaseOrders: {
        where: { status: 'OPEN' }
      }
    }
  });

  if (!sku) throw new Error('SKU not found');

  // In a real app, these would come from Shopify/3PL sync
  // For MVP, we'll fetch the latest snapshot or use defaults
  const latestSnapshot = await prisma.inventorySnapshot.findFirst({
    where: { skuId },
    orderBy: { snapshotDate: 'desc' }
  });

  if (!latestSnapshot) return;

  const velocity30d = latestSnapshot.shipped30Days / 30;
  const velocity7d = latestSnapshot.shipped7Days / 7;
  const velocity90d = latestSnapshot.shipped90Days / 90;

  const availableQuantity = latestSnapshot.onHandQuantity + latestSnapshot.qtyOnDock - latestSnapshot.qtyAllocated - latestSnapshot.nonsaleableQuantity;
  
  const daysInStock = velocity30d > 0 ? availableQuantity / velocity30d : 999;
  
  const unitsInProduction = sku.purchaseOrders.reduce((sum, po) => sum + po.orderQuantity, 0);
  const daysOnOrder = velocity30d > 0 ? unitsInProduction / velocity30d : 0;
  
  const totalDaysOutstanding = daysInStock + daysOnOrder;
  const oosDate = new Date(Date.now() + daysInStock * 24 * 60 * 60 * 1000);
  const daysUntilReorder = totalDaysOutstanding - sku.orderTriggerDays;

  let reorderStatus = 'HEALTHY';
  if (daysUntilReorder <= 0) reorderStatus = 'CRITICAL';
  else if (daysUntilReorder <= 15) reorderStatus = 'REORDER_SOON';
  else if (daysUntilReorder <= 45) reorderStatus = 'MONITOR';

  let demandFlag = null;
  if (velocity7d > velocity30d * 1.3) demandFlag = 'SPIKE';
  else if (velocity7d < velocity30d * 0.7) demandFlag = 'SOFTENING';

  return await prisma.inventorySnapshot.create({
    data: {
      tenantId,
      skuId,
      onHandQuantity: latestSnapshot.onHandQuantity,
      qtyOnDock: latestSnapshot.qtyOnDock,
      qtyAllocated: latestSnapshot.qtyAllocated,
      nonsaleableQuantity: latestSnapshot.nonsaleableQuantity,
      inboundQuantity: latestSnapshot.inboundQuantity,
      shipped7Days: latestSnapshot.shipped7Days,
      shipped30Days: latestSnapshot.shipped30Days,
      shipped90Days: latestSnapshot.shipped90Days,
      availableQuantity,
      velocity7d,
      velocity30d,
      velocity90d,
      daysInStock,
      daysOnOrder,
      totalDaysOutstanding,
      oosDate,
      daysUntilReorder,
      reorderStatus,
      demandFlag,
      snapshotDate: new Date(),
    }
  });
}
