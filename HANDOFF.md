# Supply-Chain-SaaS — Session Handoff

## Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS v4
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL via Prisma ORM, hosted on Supabase
- **Deployment**: Railway (watches `main` branch, auto-deploys on push)
- **Live URL**: `https://supply-chain-saas-production.up.railway.app`
- **GitHub**: `https://github.com/kieran-kfoy/Supply-Chain-SaaS`
- **Local project path**: `C:\Users\kiera\OneDrive\Fractional Operator\saas\Supply-Chain-SaaS`

---

## Current Git State (as of this handoff)

| Branch | Commit | Description |
|--------|--------|-------------|
| `main` | `4d46486` | Revert of redesign — this is the live deployed version |
| `design-redesign-backup` | `2be3eba` | The rejected redesign, kept as a safety backup |

### Recent commit history (main):
```
4d46486  Revert "Full UI redesign..." ← CURRENT LIVE
2be3eba  Full UI redesign (reverted)
915097e  Fix unit cost sync from Shopify; add margin to product details
09d6d9b  UI: supplier in PO, remove ASN, barcode, editable supplier, received checkbox
b419768  Rebuild dashboard as supply chain command center
```

---

## What's Been Built

### Pages
- **Dashboard** (`src/pages/Dashboard.tsx`) — Supply chain command center with stat cards: Total SKUs, Low Stock Items, Pending POs, Reorder Alerts. Links through to Inventory and Purchasing.
- **Inventory** (`src/pages/Inventory.tsx`) — Full SKU table with search, stock levels, reorder alerts, links to SKU detail.
- **SKU Detail** (`src/pages/SkuDetail.tsx`) — Per-SKU page with:
  - Product details: Name, SKU, Category, Unit Cost, Selling Price, **Margin %** (calculated: `(price - cost) / price * 100`)
  - Inline editable fields: Order Trigger (reorder point) and Days to Order Target
  - Stock & supplier info
  - Purchase order history for that SKU
- **Purchasing** (`src/pages/Purchasing.tsx`) — Create/edit/delete POs. Reorder queue card shows SKUs that need ordering.
- **Finished Goods Log** (`src/pages/FinishedGoodsLog.tsx`) — Log of finished goods with:
  - "Received?" column (renamed from "Actions") with a **checkbox** replacing the old button
  - Stat cards for total items, received, pending
- **Suppliers** (`src/pages/Suppliers.tsx`) — Supplier management: create/edit/delete suppliers, assign to SKUs.
- **Settings** (`src/pages/Settings.tsx`) — Shopify connection management.

### Backend Routes (`server/routes/`)
- `shopify.ts` — Full Shopify OAuth flow + **inventory sync**:
  - Syncs stock quantities from `inventory_levels` API
  - Syncs **real unit cost** from `inventory_items.json` API (the `cost` field — NOT `compare_at_price`)
  - Syncs selling price from `variants` API
  - Auto-sync runs every 1 hour per tenant
- `skus.ts`, `purchaseOrders.ts`, `suppliers.ts`, `finishedGoods.ts`, `auth.ts`, `tenants.ts`

### Components
- `Sidebar.tsx` — Navigation sidebar
- `SkuHealthTable.tsx` — Reusable SKU health status table (used on Dashboard)
- `CreatePoModal.tsx` — Modal for creating purchase orders
- `LogShipmentModal.tsx` — Modal for logging shipments against POs

---

## Key Business Logic

### Shopify Unit Cost Sync
The sync hits two Shopify APIs:
1. `GET /admin/api/2023-10/products.json` — gets variants with `compare_at_price` and `price`
2. `GET /admin/api/2023-10/inventory_items.json?ids=...` — gets real **cost** field

The `cost` field from `inventory_items` is used as `unitCost` in the database. The `price` from variants is used as `sellingPrice`.

### Margin % Formula
```
((sellingPrice - unitCost) / sellingPrice * 100).toFixed(1)%
```
Shown on SKU Detail page. Displays "N/A" if either value is missing.

---

## Environment Variables (on Railway)
- `DATABASE_URL` — Supabase PostgreSQL connection string
- `JWT_SECRET` — for auth tokens
- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_SCOPES`, `SHOPIFY_APP_URL`

---

## Things That Were Tried and Rejected
- **Full UI redesign** (dark navy theme, Sequence.io-inspired) — user rejected it, reverted. The backup lives on `design-redesign-backup` branch if ever wanted.

---

## Pending / Next Steps (user to decide)
- UI redesign is still wanted — user wants something that looks different/better but the previous attempt didn't land. A fresh approach with more user input on direction first would help.
- No other known bugs or pending tasks at end of last session.

---

## How to Deploy a Change
1. Make code changes locally
2. In PowerShell at `C:\Users\kiera\OneDrive\Fractional Operator\saas\Supply-Chain-SaaS`:
   ```
   git add <files>
   git commit -m "your message"
   git push
   ```
3. Railway auto-deploys within ~2 minutes.
