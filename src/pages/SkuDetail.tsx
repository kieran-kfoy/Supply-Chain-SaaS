import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { ArrowLeft, Package, TrendingUp, ShoppingCart, Pencil, Check, X, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { clsx } from 'clsx';

const statusColors: Record<string, string> = {
  CRITICAL: 'bg-critical text-white',
  REORDER_SOON: 'bg-reorder text-white',
  MONITOR: 'bg-monitor text-white',
  HEALTHY: 'bg-healthy text-white',
};

const poStatusColors: Record<string, string> = {
  'OPEN': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'IN PRODUCTION': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'SHIPPED': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'RECEIVED': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'COMPLETE': 'bg-white/10 text-white/50 border-white/20',
};

// Inline editable number field
function EditableNumber({
  label, value, field, skuId, suffix = '', description
}: {
  label: string; value: number; field: string; skuId: string; suffix?: string; description?: string;
}) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(String(value));
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const mutation = useMutation({
    mutationFn: async (val: string) => {
      await axios.patch(`/api/v1/inventory/skus/${skuId}`, { [field]: val }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sku-detail', skuId] });
      setEditing(false);
    }
  });

  const handleSave = () => {
    if (draft !== String(value)) mutation.mutate(draft);
    else setEditing(false);
  };

  const handleCancel = () => {
    setDraft(String(value));
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <div>
        <p className="text-xs text-white/40 uppercase font-bold tracking-widest">{label}</p>
        {description && <p className="text-[10px] text-white/25 mt-0.5">{description}</p>}
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="number"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
            className="w-24 bg-white/10 border border-white/20 rounded-lg py-1 px-2 text-sm font-mono text-right focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          {suffix && <span className="text-xs text-white/40">{suffix}</span>}
          <button onClick={handleSave} disabled={mutation.isPending} className="p-1 rounded-md hover:bg-emerald-500/20 text-emerald-400 transition-all">
            <Check size={14} />
          </button>
          <button onClick={handleCancel} className="p-1 rounded-md hover:bg-white/10 text-white/40 transition-all">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 group/edit">
          <span className="text-sm font-medium font-mono">{value?.toLocaleString()}{suffix ? ` ${suffix}` : ''}</span>
          <button
            onClick={() => { setDraft(String(value)); setEditing(true); }}
            className="p-1 rounded-md opacity-0 group-hover/edit:opacity-100 hover:bg-white/10 text-white/40 hover:text-white transition-all"
          >
            <Pencil size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// Inline editable dropdown field
function EditableDropdown({
  label, value, displayValue, field, skuId, options
}: {
  label: string; value: string; displayValue: string; field: string; skuId: string;
  options: { id: string; label: string }[];
}) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);

  const mutation = useMutation({
    mutationFn: async (val: string) => {
      await axios.patch(`/api/v1/inventory/skus/${skuId}`, { [field]: val }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sku-detail', skuId] });
      setEditing(false);
    }
  });

  const handleSave = (val: string) => {
    setDraft(val);
    if (val !== value) mutation.mutate(val);
    else setEditing(false);
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <p className="text-xs text-white/40 uppercase font-bold tracking-widest">{label}</p>
      {editing ? (
        <div className="flex items-center gap-2">
          <select
            autoFocus
            value={draft}
            onChange={e => handleSave(e.target.value)}
            onBlur={() => setEditing(false)}
            className="bg-white/10 border border-white/20 rounded-lg py-1 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none"
          >
            {options.map(o => (
              <option key={o.id} value={o.id} className="bg-[#111]">{o.label}</option>
            ))}
          </select>
          <button onClick={() => setEditing(false)} className="p-1 rounded-md hover:bg-white/10 text-white/40 transition-all">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 group/edit">
          <span className="text-sm font-medium">{displayValue}</span>
          <button
            onClick={() => { setDraft(value); setEditing(true); }}
            className="p-1 rounded-md opacity-0 group-hover/edit:opacity-100 hover:bg-white/10 text-white/40 hover:text-white transition-all"
          >
            <Pencil size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function SkuDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);

  const { data: sku, isLoading } = useQuery({
    queryKey: ['sku-detail', id],
    queryFn: async () => {
      const res = await axios.get(`/api/v1/inventory/skus/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.data;
    },
    enabled: !!id
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/suppliers', { headers: { Authorization: `Bearer ${token}` } });
      return res.data.data;
    }
  });

  const snap = sku?.snapshots?.[0];

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!sku) {
    return (
      <div className="p-8 text-center text-white/40">
        <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p>SKU not found</p>
      </div>
    );
  }

  const totalPOUnits = sku.purchaseOrders?.reduce((sum: number, po: any) => sum + po.orderQuantity, 0) ?? 0;
  const openPOs = sku.purchaseOrders?.filter((po: any) => po.status === 'OPEN' || po.status === 'IN PRODUCTION').length ?? 0;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate('/inventory')}
          className="mt-1 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight font-mono">{sku.skuCode}</h2>
            {snap?.reorderStatus && (
              <span className={clsx("status-badge text-xs", statusColors[snap.reorderStatus])}>
                {snap.reorderStatus.replace('_', ' ')}
              </span>
            )}
          </div>
          <p className="text-white/50 mt-1">{sku.productDescription}</p>
          <p className="text-white/30 text-sm mt-0.5">Supplier: {sku.supplier?.name}</p>
        </motion.div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-bg-card border border-border-subtle p-5 rounded-2xl space-y-1">
          <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">On Hand</p>
          <p className="text-3xl font-bold font-mono tracking-tight">{snap?.availableQuantity?.toLocaleString() ?? '—'}</p>
          <p className="text-xs text-white/30">units available</p>
        </div>
        <div className="bg-bg-card border border-border-subtle p-5 rounded-2xl space-y-1">
          <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Days of Stock</p>
          <p className={clsx("text-3xl font-bold font-mono tracking-tight",
            snap?.daysInStock < 30 ? 'text-critical' : snap?.daysInStock < 60 ? 'text-reorder' : 'text-white'
          )}>
            {snap ? Math.round(snap.daysInStock) : '—'}
          </p>
          <p className="text-xs text-white/30">at current velocity</p>
        </div>
        <div className="bg-bg-card border border-border-subtle p-5 rounded-2xl space-y-1">
          <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">30d Velocity</p>
          <p className="text-3xl font-bold font-mono tracking-tight">{snap ? snap.velocity30d.toFixed(1) : '—'}</p>
          <p className="text-xs text-white/30">units / day</p>
        </div>
        <div className="bg-bg-card border border-border-subtle p-5 rounded-2xl space-y-1">
          <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">OOS Date</p>
          <p className={clsx("text-xl font-bold font-mono tracking-tight",
            snap?.oosDate && new Date(snap.oosDate) < new Date(Date.now() + 60 * 86400000) ? 'text-critical' : 'text-white'
          )}>
            {snap?.oosDate ? format(new Date(snap.oosDate), 'MMM d, yy') : '—'}
          </p>
          <p className="text-xs text-white/30">estimated sell-out</p>
        </div>
      </div>

      {/* Sales Velocity Breakdown + SKU Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Velocity */}
        <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl space-y-5">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-white/40 w-5 h-5" />
            <h3 className="text-lg font-bold tracking-tight">Sales Velocity</h3>
          </div>
          <div className="space-y-4">
            {[
              { label: '7-Day Velocity', value: snap?.velocity7d, sold: snap?.shipped7Days, days: 7 },
              { label: '30-Day Velocity', value: snap?.velocity30d, sold: snap?.shipped30Days, days: 30 },
              { label: '90-Day Velocity', value: snap?.velocity90d, sold: snap?.shipped90Days, days: 90 },
            ].map(({ label, value, sold, days }) => (
              <div key={days} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-sm font-medium text-white/70">{label}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{sold ?? 0} units sold in {days}d</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold font-mono">{value != null ? value.toFixed(2) : '—'}</p>
                  <p className="text-[10px] text-white/30">units/day</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SKU Info */}
        <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl space-y-5">
          <div className="flex items-center gap-3">
            <Package className="text-white/40 w-5 h-5" />
            <h3 className="text-lg font-bold tracking-tight">Product Details</h3>
          </div>
          <div className="space-y-0">
            {/* Static fields */}
            {[
              { label: 'SKU Code', value: sku.skuCode },
              { label: 'Description', value: sku.productDescription },
              { label: 'Barcode / UPC', value: sku.barcodeUpc ?? 'N/A' },
              { label: 'Unit Cost', value: sku.unitCost != null ? `$${sku.unitCost.toFixed(2)}` : '—' },
              { label: 'Selling Price', value: sku.sellingPrice != null ? `$${sku.sellingPrice.toFixed(2)}` : '—' },
              { label: 'MOQ', value: sku.moq?.toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-white/5">
                <p className="text-xs text-white/40 uppercase font-bold tracking-widest">{label}</p>
                <p className="text-sm font-medium font-mono">{value ?? '—'}</p>
              </div>
            ))}

            {/* Editable supplier dropdown */}
            <EditableDropdown
              label="Supplier"
              value={sku.supplierId}
              displayValue={sku.supplier?.name ?? '—'}
              field="supplierId"
              skuId={sku.id}
              options={suppliers.map((s: any) => ({ id: s.id, label: s.name }))}
            />

            {/* Editable fields */}
            <EditableNumber
              label="Order Trigger"
              value={sku.orderTriggerDays}
              field="orderTriggerDays"
              skuId={sku.id}
              suffix="days"
              description="Reorder alert fires when days of stock drops below this"
            />
            <EditableNumber
              label="Days to Order Target"
              value={sku.daysToOrderTarget}
              field="daysToOrderTarget"
              skuId={sku.id}
              suffix="days"
              description="How many days of stock each PO should cover"
            />
          </div>
        </div>
      </div>

      {/* PO History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart className="text-white/40 w-5 h-5" />
            <h3 className="text-xl font-bold tracking-tight">Purchase Order History</h3>
          </div>
          <div className="flex items-center gap-4 text-sm text-white/40">
            <span><span className="text-white font-bold font-mono">{sku.purchaseOrders?.length ?? 0}</span> total POs</span>
            <span><span className="text-white font-bold font-mono">{openPOs}</span> open</span>
            <span><span className="text-white font-bold font-mono">{totalPOUnits.toLocaleString()}</span> units ordered</span>
          </div>
        </div>

        <div className="bg-bg-card border border-border-subtle rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="data-table-header">PO #</th>
                <th className="data-table-header">Supplier</th>
                <th className="data-table-header">Quantity</th>
                <th className="data-table-header">Status</th>
                <th className="data-table-header">Submitted</th>
                <th className="data-table-header">Expected</th>
                <th className="data-table-header">Notes</th>
              </tr>
            </thead>
            <tbody>
              {sku.purchaseOrders?.map((po: any) => (
                <tr key={po.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="data-table-cell font-mono font-bold">{po.poNumber}</td>
                  <td className="data-table-cell text-white/70">{po.supplier?.name}</td>
                  <td className="data-table-cell font-mono">{po.orderQuantity.toLocaleString()}</td>
                  <td className="data-table-cell">
                    <span className={clsx(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight border",
                      poStatusColors[po.status] ?? 'bg-white/10 text-white/50 border-white/20'
                    )}>
                      {po.status}
                    </span>
                  </td>
                  <td className="data-table-cell font-mono text-white/50 text-xs">
                    {format(new Date(po.dateSubmitted), 'MMM d, yyyy')}
                  </td>
                  <td className="data-table-cell font-mono text-white/50 text-xs">
                    {po.expectedArrival ? format(new Date(po.expectedArrival), 'MMM d, yyyy') : 'TBD'}
                  </td>
                  <td className="data-table-cell text-white/40 text-xs max-w-[160px] truncate">
                    {po.notes ?? '—'}
                  </td>
                </tr>
              ))}
              {(!sku.purchaseOrders || sku.purchaseOrders.length === 0) && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-white/30 italic">No purchase orders for this SKU</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
