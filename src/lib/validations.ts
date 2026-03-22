import { z } from 'zod';

export const SkuSchema = z.object({
  skuCode: z.string().min(1, "SKU code is required"),
  productDescription: z.string().min(1, "Description is required"),
  unitCost: z.number().positive(),
  sellingPrice: z.number().positive(),
  orderTriggerDays: z.number().int().nonnegative(),
  daysToOrderTarget: z.number().int().nonnegative(),
  moq: z.number().int().positive(),
  supplierId: z.string().cuid(),
});

export const PurchaseOrderSchema = z.object({
  poNumber: z.string().min(1),
  skuId: z.string().cuid(),
  supplierId: z.string().cuid(),
  orderQuantity: z.number().int().positive(),
  dateSubmitted: z.string().datetime(),
  packagingOrdered: z.boolean(),
  notes: z.string().optional(),
});

export const ShipmentSchema = z.object({
  poId: z.string().cuid(),
  skuId: z.string().cuid(),
  unitsShipped: z.number().int().positive(),
  shipDate: z.string().datetime(),
  asnNumber: z.string().optional(),
  freightCarrier: z.string().optional(),
  trackingNumber: z.string().optional(),
});
