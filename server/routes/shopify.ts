import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY!;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET!;
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES!;
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || 'http://localhost:3000';

// Temporary in-memory store for OAuth state nonces (prevents CSRF attacks)
// In production this would use Redis or the database
const pendingOAuthStates = new Map<string, { tenantId: string; shop: string; createdAt: number }>();

// Clean up expired states every 10 minutes
setInterval(() => {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [key, value] of pendingOAuthStates.entries()) {
    if (value.createdAt < tenMinutesAgo) pendingOAuthStates.delete(key);
  }
}, 10 * 60 * 1000);

// ─── Step 1: Initiate OAuth ───────────────────────────────────────────────────
// User clicks "Connect Shopify" → we redirect them to Shopify's auth page
router.get('/install', (req: any, res) => {
  const { shop, token } = req.query;

  if (!shop || typeof shop !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing shop parameter (e.g. ?shop=yourstore.myshopify.com)' });
  }

  // Accept token from query param (browser navigation strips auth headers)
  let tenantId = req.user?.tenantId;
  if (!tenantId && token) {
    try {
      const decoded = jwt.verify(token as string, process.env.JWT_SECRET!) as any;
      tenantId = decoded.tenantId;
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
  }

  if (!tenantId) {
    return res.status(401).json({ success: false, error: 'Must be logged in to connect Shopify' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  pendingOAuthStates.set(state, { tenantId, shop, createdAt: Date.now() });

  const redirectUri = encodeURIComponent(`${SHOPIFY_APP_URL}/api/v1/shopify/callback`);
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SHOPIFY_SCOPES}&redirect_uri=${redirectUri}&state=${state}`;

  res.redirect(authUrl);
});

// ─── Step 2: OAuth Callback ───────────────────────────────────────────────────
// Shopify redirects here after the merchant approves the app
router.get('/callback', async (req, res) => {
  const { code, hmac, shop, state } = req.query as Record<string, string>;

  // Verify state to prevent CSRF
  const pendingState = pendingOAuthStates.get(state);
  if (!pendingState) {
    return res.status(400).send('Invalid or expired OAuth state. Please try connecting again.');
  }
  pendingOAuthStates.delete(state);

  // Verify HMAC signature — confirms the request actually came from Shopify
  const params = Object.entries(req.query)
    .filter(([key]) => key !== 'hmac')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const generatedHmac = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(params)
    .digest('hex');

  if (generatedHmac !== hmac) {
    return res.status(401).send('HMAC validation failed. Request may be tampered.');
  }

  // Exchange temporary code for permanent access token
  const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code,
    }),
  });

  const tokenData = await tokenResponse.json() as { access_token?: string; scope?: string; error?: string };

  if (!tokenData.access_token) {
    return res.status(400).send(`Failed to get access token: ${tokenData.error || 'Unknown error'}`);
  }

  // Save or update the integration record
  const tenantId = pendingState.tenantId;
  const existing = await prisma.integration.findFirst({
    where: { tenantId, integrationType: 'shopify' },
  });

  const credentials = JSON.stringify({
    accessToken: tokenData.access_token,
    shop,
    scope: tokenData.scope,
  });

  if (existing) {
    await prisma.integration.update({
      where: { id: existing.id },
      data: {
        credentialsEncrypted: credentials,
        syncStatus: 'connected',
        lastSyncAt: new Date(),
        errorLog: null,
      },
    });
  } else {
    await prisma.integration.create({
      data: {
        tenantId,
        integrationType: 'shopify',
        credentialsEncrypted: credentials,
        syncStatus: 'connected',
        lastSyncAt: new Date(),
      },
    });
  }

  // Save the shop URL on the tenant record
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { shopifyStoreUrl: shop },
  });

  // Redirect back to the settings page with success flag
  res.redirect(`${SHOPIFY_APP_URL}/settings?shopify=connected`);
});

// ─── Update Sync Cadence ──────────────────────────────────────────────────────
router.post('/cadence', async (req: any, res) => {
  const tenantId = req.user.tenantId;
  const { cadenceHours } = req.body;

  if (![1, 6, 24].includes(Number(cadenceHours))) {
    return res.status(400).json({ success: false, error: 'Invalid cadence. Must be 1, 6, or 24.' });
  }

  const integration = await prisma.integration.findFirst({
    where: { tenantId, integrationType: 'shopify' },
  });

  if (!integration) {
    return res.status(400).json({ success: false, error: 'Shopify not connected' });
  }

  const credentials = JSON.parse(integration.credentialsEncrypted);
  credentials.syncCadenceHours = Number(cadenceHours);

  await prisma.integration.update({
    where: { id: integration.id },
    data: { credentialsEncrypted: JSON.stringify(credentials) },
  });

  res.json({ success: true, data: { cadenceHours: Number(cadenceHours) } });
});

// ─── Get Connection Status ────────────────────────────────────────────────────
router.get('/status', async (req: any, res) => {
  const tenantId = req.user.tenantId;

  const integration = await prisma.integration.findFirst({
    where: { tenantId, integrationType: 'shopify' },
  });

  const creds = integration ? JSON.parse(integration.credentialsEncrypted) : null;
  res.json({
    success: true,
    data: {
      connected: !!integration,
      shop: creds?.shop || null,
      syncStatus: integration?.syncStatus || null,
      lastSyncAt: integration?.lastSyncAt || null,
      cadenceHours: creds?.syncCadenceHours || 24,
    },
  });
});

// ─── Trigger Manual Sync ──────────────────────────────────────────────────────
// Pulls products + inventory from Shopify and creates SKUs + ChannelListings
router.post('/sync', async (req: any, res) => {
  const tenantId = req.user.tenantId;

  const integration = await prisma.integration.findFirst({
    where: { tenantId, integrationType: 'shopify' },
  });

  if (!integration) {
    return res.status(400).json({ success: false, error: 'Shopify not connected' });
  }

  const { accessToken, shop } = JSON.parse(integration.credentialsEncrypted);

  try {
    // Fetch all products from Shopify
    const productsRes = await fetch(`https://${shop}/admin/api/2024-01/products.json?limit=250`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    });

    if (!productsRes.ok) {
      throw new Error(`Shopify API error: ${productsRes.status}`);
    }

    const { products } = await productsRes.json() as { products: any[] };

    let created = 0;
    let skipped = 0;

    // Get or create a default supplier for Shopify-sourced SKUs
    let shopifySupplier = await prisma.supplier.findFirst({
      where: { tenantId, name: 'Shopify' },
    });
    if (!shopifySupplier) {
      shopifySupplier = await prisma.supplier.create({
        data: { tenantId, name: 'Shopify', productionType: 'domestic' },
      });
    }

    let updated = 0;

    // Build maps of inventoryItemId → sellingPrice and barcode so we can update SKUs in Step 4
    const invItemPriceMap = new Map<string, number>();
    const variantBarcodeMap = new Map<string, string>(); // variantId → barcode
    for (const product of products) {
      for (const variant of product.variants) {
        if (variant.inventory_item_id) {
          invItemPriceMap.set(String(variant.inventory_item_id), parseFloat(variant.price || '0'));
        }
        if (variant.barcode?.trim()) {
          variantBarcodeMap.set(String(variant.id), variant.barcode.trim());
        }
      }
    }

    for (const product of products) {
      for (const variant of product.variants) {
        const description = product.variants.length > 1
          ? `${product.title} - ${variant.title}`
          : product.title;

        const variantIdStr = String(variant.id);
        const realSku = variant.sku?.trim() || null;

        // Check if we already have a channel listing for this variant
        const existingListing = await prisma.channelListing.findFirst({
          where: { tenantId, platform: 'shopify', platformVariantId: variantIdStr },
          include: { sku: true },
        });

        if (existingListing) {
          // If Shopify now has a real SKU and the stored one is auto-generated or different, update it
          if (realSku && existingListing.sku.skuCode !== realSku) {
            // Check if a SKU with the new code already exists
            const existingSkuWithCode = await prisma.sku.findFirst({
              where: { tenantId, skuCode: realSku },
            });

            if (existingSkuWithCode) {
              // Point the listing to the existing SKU
              await prisma.channelListing.update({
                where: { id: existingListing.id },
                data: { skuId: existingSkuWithCode.id, platformSku: realSku },
              });
              // Delete the old auto-generated SKU if nothing else uses it
              const otherListings = await prisma.channelListing.count({
                where: { skuId: existingListing.skuId, NOT: { id: existingListing.id } },
              });
              if (otherListings === 0) {
                await prisma.sku.delete({ where: { id: existingListing.skuId } });
              }
            } else {
              // Update the SKU code on the existing SKU record
              await prisma.sku.update({
                where: { id: existingListing.skuId },
                data: {
                  skuCode: realSku,
                  productDescription: description,
                  sellingPrice: parseFloat(variant.price || '0'),
                },
              });
              await prisma.channelListing.update({
                where: { id: existingListing.id },
                data: { platformSku: realSku },
              });
            }
            updated++;
          } else {
            skipped++;
          }
          continue;
        }

        // No existing listing — skip if no real SKU in Shopify
        if (!realSku) {
          skipped++;
          continue;
        }

        // Find existing SKU by code, or create a new one
        const existingSku = await prisma.sku.findFirst({
          where: { tenantId, skuCode: realSku },
        });

        const variantBarcode = variant.barcode?.trim() || null;
        const sku = existingSku || await prisma.sku.create({
          data: {
            tenantId,
            skuCode: realSku,
            productDescription: description,
            unitCost: 0, // Will be updated in Step 4 with real Shopify "Cost per item"
            sellingPrice: parseFloat(variant.price || '0'),
            barcodeUpc: variantBarcode,
            supplierId: shopifySupplier.id,
          },
        });

        await prisma.channelListing.create({
          data: {
            tenantId,
            skuId: sku.id,
            platform: 'shopify',
            platformProductId: String(product.id),
            platformVariantId: variantIdStr,
            platformSku: realSku,
          },
        });

        created++;
      }
    }

    // ── Step 2: Pull inventory levels for all synced variants ──────────────────
    // Collect inventory_item_ids for variants we track
    const trackedListings = await prisma.channelListing.findMany({
      where: { tenantId, platform: 'shopify' },
      include: { sku: true },
    });

    // Build a map: inventoryItemId → skuId
    const invItemToSku = new Map<string, string>();
    const variantToInvItem = new Map<string, string>();

    for (const product of products) {
      for (const variant of product.variants) {
        const listing = trackedListings.find(l => l.platformVariantId === String(variant.id));
        if (listing) {
          variantToInvItem.set(String(variant.id), String(variant.inventory_item_id));
          invItemToSku.set(String(variant.inventory_item_id), listing.skuId);
        }
      }
    }

    // Fetch inventory levels (Shopify returns available qty per location)
    const invItemIds = Array.from(invItemToSku.keys());
    const stockMap = new Map<string, number>(); // skuId → total available
    const costMap = new Map<string, number>();  // skuId → unit cost from Shopify

    if (invItemIds.length > 0) {
      const chunkSize = 50; // Shopify allows up to 50 IDs per request
      for (let i = 0; i < invItemIds.length; i += chunkSize) {
        const chunk = invItemIds.slice(i, i + chunkSize);

        // Fetch stock levels
        const invRes = await fetch(
          `https://${shop}/admin/api/2024-01/inventory_levels.json?inventory_item_ids=${chunk.join(',')}&limit=250`,
          { headers: { 'X-Shopify-Access-Token': accessToken } }
        );
        if (invRes.ok) {
          const { inventory_levels } = await invRes.json() as { inventory_levels: any[] };
          for (const level of inventory_levels) {
            const skuId = invItemToSku.get(String(level.inventory_item_id));
            if (skuId) {
              const current = stockMap.get(skuId) || 0;
              stockMap.set(skuId, current + Math.max(0, level.available || 0));
            }
          }
        }

        // Fetch inventory items to get the real "Cost per item" field
        const itemsRes = await fetch(
          `https://${shop}/admin/api/2024-01/inventory_items.json?ids=${chunk.join(',')}&fields=id,cost`,
          { headers: { 'X-Shopify-Access-Token': accessToken } }
        );
        if (itemsRes.ok) {
          const { inventory_items } = await itemsRes.json() as { inventory_items: any[] };
          for (const item of inventory_items) {
            const skuId = invItemToSku.get(String(item.id));
            if (skuId && item.cost != null) {
              costMap.set(skuId, parseFloat(item.cost));
            }
          }
        }
      }
    }

    // ── Step 3: Pull orders for sales velocity (last 90 days) ─────────────────
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Load bundles for order decomposition
    // Maps: bundle skuId → array of { componentSkuId, quantity }
    const bundlesForDecomp = await prisma.bundle.findMany({
      where: { tenantId },
      include: {
        sku: true,
        components: {
          include: {
            sku: {
              include: {
                channelListings: { where: { platform: 'shopify' } }
              }
            }
          }
        }
      }
    });

    // Build a map: bundle variantId → component entries with their variantIds and quantities
    const bundleVariantMap = new Map<string, Array<{ variantId: string; quantity: number }>>();
    for (const bundle of bundlesForDecomp) {
      // Find the bundle SKU's Shopify variant ID
      const bundleListing = trackedListings.find(l => l.skuId === bundle.skuId);
      if (!bundleListing?.platformVariantId) continue;

      const componentEntries: Array<{ variantId: string; quantity: number }> = [];
      for (const comp of bundle.components) {
        const compListing = comp.sku.channelListings[0];
        if (compListing?.platformVariantId) {
          componentEntries.push({
            variantId: compListing.platformVariantId,
            quantity: comp.quantity,
          });
        }
      }
      if (componentEntries.length > 0) {
        bundleVariantMap.set(bundleListing.platformVariantId, componentEntries);
      }
    }

    const ordersRes = await fetch(
      `https://${shop}/admin/api/2024-01/orders.json?status=any&created_at_min=${ninetyDaysAgo.toISOString()}&limit=250&fields=id,created_at,line_items`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );

    // variantId → { sold7d, sold30d, sold90d }
    const salesMap = new Map<string, { sold7d: number; sold30d: number; sold90d: number }>();

    const addSales = (vid: string, qty: number, orderDate: Date) => {
      const existing = salesMap.get(vid) || { sold7d: 0, sold30d: 0, sold90d: 0 };
      existing.sold90d += qty;
      if (orderDate >= thirtyDaysAgo) existing.sold30d += qty;
      if (orderDate >= sevenDaysAgo) existing.sold7d += qty;
      salesMap.set(vid, existing);
    };

    if (ordersRes.ok) {
      const { orders } = await ordersRes.json() as { orders: any[] };
      for (const order of orders) {
        const orderDate = new Date(order.created_at);
        for (const item of order.line_items || []) {
          const vid = String(item.variant_id);
          const qty = item.quantity || 0;

          // Check if this variant is a bundle — decompose into components
          const bundleComponents = bundleVariantMap.get(vid);
          if (bundleComponents) {
            for (const comp of bundleComponents) {
              addSales(comp.variantId, qty * comp.quantity, orderDate);
            }
          } else {
            addSales(vid, qty, orderDate);
          }
        }
      }
    }

    // ── Step 4: Build units-on-order map from open POs ─────────────────────────
    const openPoStatuses = ['OPEN', 'IN PRODUCTION', 'SHIPPED'];
    const openPOs = await prisma.purchaseOrder.findMany({
      where: { tenantId, status: { in: openPoStatuses } },
    });
    const unitsOnOrderMap = new Map<string, number>(); // skuId → total units on order
    for (const po of openPOs) {
      const current = unitsOnOrderMap.get(po.skuId) || 0;
      unitsOnOrderMap.set(po.skuId, current + po.orderQuantity);
    }

    // ── Step 5: Create inventory snapshots for each tracked SKU ───────────────
    let snapshotsCreated = 0;

    for (const listing of trackedListings) {
      const sku = listing.sku;
      const onHand = stockMap.get(sku.id) ?? 0;
      const sales = salesMap.get(listing.platformVariantId || '') || { sold7d: 0, sold30d: 0, sold90d: 0 };

      const velocity7d  = sales.sold7d / 7;
      const velocity30d = sales.sold30d / 30;
      const velocity90d = sales.sold90d / 90;

      // Use 30d velocity as primary, fall back to 90d
      const primaryVelocity = velocity30d > 0 ? velocity30d : velocity90d > 0 ? velocity90d : 0;
      const daysInStock = primaryVelocity > 0 ? onHand / primaryVelocity : 0;

      // Factor in open POs
      const unitsOnOrder = unitsOnOrderMap.get(sku.id) || 0;
      const daysOnOrder = primaryVelocity > 0 ? unitsOnOrder / primaryVelocity : 0;
      const totalDaysOutstanding = daysInStock + daysOnOrder;

      // OOS date accounts for both on-hand AND on-order stock
      const oosDate = primaryVelocity > 0
        ? new Date(Date.now() + totalDaysOutstanding * 24 * 60 * 60 * 1000)
        : null;

      // Reorder trigger uses totalDaysOutstanding (on-hand + on-order)
      const daysUntilReorder = totalDaysOutstanding - (sku.orderTriggerDays || 90);

      let reorderStatus = 'HEALTHY';
      if (primaryVelocity === 0) {
        reorderStatus = 'MONITOR'; // No sales data yet
      } else if (totalDaysOutstanding <= 30) {
        reorderStatus = 'CRITICAL';
      } else if (totalDaysOutstanding <= 60) {
        reorderStatus = 'REORDER_SOON';
      } else if (totalDaysOutstanding <= 90) {
        reorderStatus = 'MONITOR';
      }

      // Sync real unit cost, selling price, and barcode from Shopify onto the SKU
      const invItemId = variantToInvItem.get(listing.platformVariantId || '');
      const freshCost = invItemId ? costMap.get(sku.id) : undefined;
      const freshPrice = invItemId ? invItemPriceMap.get(invItemId) : undefined;
      const freshBarcode = variantBarcodeMap.get(listing.platformVariantId || '') || null;
      if (freshCost != null || freshPrice != null || freshBarcode !== (sku.barcodeUpc || null)) {
        await prisma.sku.update({
          where: { id: sku.id },
          data: {
            ...(freshCost != null && { unitCost: freshCost }),
            ...(freshPrice != null && { sellingPrice: freshPrice }),
            barcodeUpc: freshBarcode,
          },
        });
      }

      await prisma.inventorySnapshot.create({
        data: {
          tenantId,
          skuId: sku.id,
          snapshotDate: new Date(),
          onHandQuantity: onHand,
          availableQuantity: onHand,
          shipped7Days: sales.sold7d,
          shipped30Days: sales.sold30d,
          shipped90Days: sales.sold90d,
          velocity7d,
          velocity30d,
          velocity90d,
          daysInStock,
          daysOnOrder,
          totalDaysOutstanding,
          oosDate,
          daysUntilReorder,
          reorderStatus,
          provider: 'shopify',
        },
      });
      snapshotsCreated++;
    }

    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date(), syncStatus: 'synced', errorLog: null },
    });

    res.json({
      success: true,
      data: {
        totalProducts: products.length,
        skusCreated: created,
        skusUpdated: updated,
        skusSkipped: skipped,
        snapshotsCreated,
        message: `Sync complete. ${created} new SKUs, ${updated} updated, ${snapshotsCreated} inventory snapshots created.`,
      },
    });

  } catch (err: any) {
    await prisma.integration.update({
      where: { id: integration.id },
      data: { syncStatus: 'error', errorLog: err.message },
    });
    res.status(500).json({ success: false, error: 'Sync failed: ' + err.message });
  }
});

export default router;
