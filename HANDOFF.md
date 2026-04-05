# Supply Chain SaaS — Handoff Document
**Date:** April 4, 2026
**Last commit:** `092a664` — "Remove debug logging from Shopify order sync"

---

## Project Overview

Supply Chain SaaS platform for managing inventory, purchasing, suppliers, and Shopify integration. Built by Kieran (beginner developer) working exclusively with Claude — no external developers.

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS v4
- **Backend:** Node.js + Express + TypeScript (single `server.ts` file for routes + `server/routes/shopify.ts` for Shopify OAuth/sync)
- **Database:** PostgreSQL via Prisma ORM, hosted on Supabase
- **Deployment:** Railway (auto-deploys from `main` branch)
- **Auth:** JWT + bcrypt password hashing
- **Shopify:** OAuth integration, product/inventory/order sync, auto-sync every 30 minutes

## Important URLs & Paths

- **Live app:** https://supply-chain-saas-production.up.railway.app
- **GitHub:** https://github.com/kieran-kfoy/Supply-Chain-SaaS
- **Kieran's local path:** `C:\Users\kiera\OneDrive\Fractional Operator\saas\Supply-Chain-SaaS`
- **Shopify dev store:** inventoryos-dev.myshopify.com

## Deployment Process

Kieran deploys via PowerShell from his local machine:
```
git add <files>
git commit -m "message"
git push origin main
```
Railway auto-detects the push and deploys in ~2 minutes. **Note:** Vite build to `dist` can fail with EPERM error when OneDrive locks the folder — test builds locally with `npx vite build --outDir /tmp/test-dist`.

## Key Architecture Decisions

- **PO model:** Each line item is its own `PurchaseOrder` record. Multi-line POs share a `poNumber`. Each line ships independently.
- **Shipment ↔ PO sync:** Logging a shipment linked to a PO auto-sets PO status to "SHIPPED". Checking received → PO status "RECEIVED". Unchecking received → PO reverts to "OPEN".
- **Dashboard inventory value:** Uses `unitCost` (COGS), not selling price.
- **Capital on order:** Includes POs with status OPEN, IN PRODUCTION, and SHIPPED.
- **Sales velocity:** Calculated from Shopify orders — 7d, 30d, 90d windows. 30d velocity is primary, falls back to 90d. Drives reorder status, stockout projections, and demand flags.
- **No automated PO creation.** No supplier emails. Manual PO workflow only. Reorder queue lists what needs ordering, user creates POs manually.
- **No Python rewrite.** Staying with Node/Express/TypeScript.

## Key Files

| File | Purpose |
|------|---------|
| `server.ts` | All API routes, auth middleware, auto-sync scheduler |
| `server/routes/shopify.ts` | Shopify OAuth, manual sync endpoint, product/inventory/order sync |
| `server/lib/calculations.ts` | SKU health calculations (velocity, reorder status, demand flags) |
| `prisma/schema.prisma` | Database schema (Sku, InventorySnapshot, PurchaseOrder, Shipment, Supplier, ChannelListing, etc.) |
| `src/pages/Dashboard.tsx` | Main dashboard with stat cards, action items, portfolio health, pipeline |
| `src/pages/Inventory.tsx` | Inventory management with SkuHealthTable, CSV export |
| `src/pages/Purchasing.tsx` | PO management — open/closed toggle, sorting, search, CSV export, edit modal |
| `src/pages/FinishedGoodsLog.tsx` | Shipping log — open/closed toggle, receive/unreceive checkbox, sorting, search, CSV export |
| `src/pages/Suppliers.tsx` | Supplier management |
| `src/pages/Settings.tsx` | Shopify connection, sync button, auto-sync frequency |
| `src/pages/SkuDetail.tsx` | Individual SKU detail page |
| `src/components/CreatePoModal.tsx` | Multi-line PO creation modal |
| `src/components/LogShipmentModal.tsx` | Log new shipment modal |
| `src/components/SkuHealthTable.tsx` | TanStack React Table with sorting for inventory |
| `src/pages/Bundles.tsx` | Bundle management — create, delete, expand/collapse components |
| `src/components/CreateBundleModal.tsx` | Create bundle modal — select bundle SKU + component products |
| `src/pages/Reports.tsx` | Reports tab — COGS, top sellers, margins, velocity sub-reports |
| `src/pages/CogsBreakdown.tsx` | Legacy COGS page (still routed at /inventory/cogs) |

## What Was Completed (Sessions April 3-4, 2026)

### April 3 (Previous Session)
1. Barcode/UPC sync from Shopify variants
2. Removed ASN column from shipping log
3. Fixed inventory value calculation (was using unitCost, corrected)
4. Fixed capital on order to include SHIPPED status POs
5. Fixed widespread file corruption from OneDrive mount (null bytes, truncated files — 9 files fixed)
6. Auth security hardening (removed JWT fallback secret, locked internal sync to localhost)
7. Multi-line purchase order creation (bulk endpoint, CreatePoModal rewrite)
8. Rewrote Purchasing page to flat rows (user rejected grouped/expandable PO display)

### April 4 (Earlier Session)
1. Split PO and Shipment tables into Open/Closed with toggle buttons
2. Added unreceive endpoint (`PATCH /api/v1/shipments/:id/unreceive`) — reverts shipment and PO status
3. Changed toggle from two separate tables to button-switched single table (per user feedback)
4. Added PO submission date column (`createdAt`)
5. Changed dashboard inventory value to COGS (`unitCost` instead of `sellingPrice`), renamed label to "Inventory Cost (COGS)"
6. Removed search bar from shipping log, moved toggle buttons to match PO layout
7. Added column sorting (clickable headers with ArrowUpDown icons) to both PO and Shipment tables
8. Changed all date formats to MM/DD/YY
9. Reordered PO columns: PO #, Date Submitted, SKU, Quantity, Supplier, Status, Expected
10. Reordered Shipment columns: Ship Date, PO #, SKU, Units, Tracking, Status, Received?
11. Made SKU names clickable (navigates to `/inventory/{skuId}`) on PO and Shipment tables
12. Added search bars below toggle buttons on both PO and Shipment tabs
13. Added working Export CSV to Purchasing and Shipping Log tabs
14. Fixed broken Export CSV on Inventory tab (had no onClick handler)
15. Diagnosed and fixed Shopify orders 403 error — required Protected Customer Data access approval in Shopify Partner Dashboard
16. Sales velocity now working with real Shopify order data
17. Removed debug logging from sync code

### April 4 (This Session — Cowork)
1. Multi-line shipment logging modal — rewritten to match PO modal pattern (shared ship date/tracking/carrier + multiple PO line items)
2. Added bulk shipment endpoint (`POST /api/v1/shipments/bulk`)
3. **Bundle SKU management** — full feature:
   - New `Bundle` and `BundleComponent` database models, `isBundle` flag on Sku
   - New Bundles tab in sidebar with create/delete/expand-collapse UI
   - Create Bundle modal: select bundle SKU + add component products with quantities
   - Bundle SKUs auto-hidden from Inventory dashboard (`isBundle: false` filter)
   - Shopify order sync decomposes bundle orders into component SKU sales (affects velocity, reorder, stockout projections)
   - Shopify inventory shown as reference on bundle cards
   - Individual SKUs can belong to multiple bundles; bundles can contain multiples of same SKU
   - Deleting a bundle unflags SKU so it returns to Inventory
   - Database updated via `prisma db push` (not migrate, due to drift)
4. **Reorder queue improvements:**
   - Added suggested order quantity: `(daysToOrderTarget × velocity) - availableQuantity`
   - Added "Days to Order" metric: `daysInStock - orderTriggerDays` (red when negative)
   - Added 30D velocity display
   - Fixed suggestedOrderQty not appearing (Prisma object serialization issue)
   - Deduplicated snapshots to latest per SKU
   - SKUs now appear in reorder queue 15 days before their order trigger threshold (not just CRITICAL/REORDER_SOON)
5. Made PO edit/delete and Shipment delete buttons always visible (removed hover-only opacity)
6. **Reports tab** — new sidebar item with 4 sub-reports, all with Export CSV:
   - Inventory Cost (COGS): SKU breakdown by cost value with % bars and totals
   - Top Sellers: ranked by 30D revenue, showing units sold, revenue, gross profit, % of total
   - Margin Analysis: unit cost vs selling price, margin %, profit/unit, 30D profit contribution
   - Sales Velocity: 7D/30D/90D velocity, days left, 7D trend arrows, inventory turnover rate
7. Dashboard COGS card now clickable → navigates to Reports page

## Shopify Integration Notes

- **Protected Customer Data Access:** Was approved on 2026-04-04. Required selecting "Store management" + "Other (Process orders for inventory management)" in Partner Dashboard, completing 9 data protection questions, and setting Custom distribution model to `inventoryos-dev.myshopify.com`. Without this, the Orders API returns 403.
- **Read All Orders scope:** Also requested and approved — grants full order history instead of last 60 days.
- **API version:** Using `2024-01` — works fine but could be updated to a newer version eventually.
- **Order pagination:** Current limit is 250 orders per sync. No pagination implemented. Will need it when order volume exceeds 250 in 90 days.

## Remaining Work (Shopify-Only Launch)

1. **PO download as PDF** — User wants to be able to download individual POs as PDF documents
2. **UI redesign** — Cosmetic improvements, deferred. User rejected a previous dark navy redesign. **Must get user input on design direction before attempting again.**
3. **Additional reports** — Reports tab is built with 4 sub-reports. More report types can be added as needed.

## Post-Launch (Amazon Phase)

4. Amazon SP-API integration
5. Three inventory views (combined / Shopify-only / Amazon-only)
6. Cross-platform SKU mapping

## Important User Preferences

- **Kieran is a beginner developer.** Give exact commands, explain technical concepts in plain language.
- **No automated PO creation or supplier emails.** Manual workflow only.
- **No UI redesign without user input.** Previous attempt was rejected.
- **Each PO line item needs its own row** — user rejected grouped/expandable display because individual SKUs ship independently.
- **Deploy instructions must be explicit** — exact git commands for PowerShell.

## Environment Variables (Railway)

- `DATABASE_URL` — Supabase PostgreSQL connection string
- `JWT_SECRET` — JWT signing secret (no fallback allowed)
- `SHOPIFY_CLIENT_ID` — Shopify app client ID
- `SHOPIFY_CLIENT_SECRET` — Shopify app client secret
