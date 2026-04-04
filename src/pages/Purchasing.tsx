import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { AlertTriangle, CheckCircle2, Clock, Plus, Pencil, Trash2, X, Loader2, ArrowUpDown, Search, Download, FileDown } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import CreatePoModal from '../components/CreatePoModal';
import { generatePoPdf } from '../utils/generatePoPdf';

const PO_STATUSES = ['OPEN', 'IN PRODUCTION', 'SHIPPED', 'RECEIVED', 'COMPLETE'];
const OPEN_STATUSES = ['OPEN', 'IN PRODUCTION', 'SHIPPED'];
const CLOSED_STATUSES = ['RECEIVED', 'COMPLETE'];

type PoSortKey = 'poNumber' | 'createdAt' | 'skuCode' | 'orderQuantity' | 'supplier' | 'status' | 'expectedArrival';
type SortDir = 'asc' | 'desc';

function sortPos(list: any[], key: PoSortKey, dir: SortDir) {
  return [...list].sort((a, b) => {
    let va: any, vb: any;
    switch (key) {
      case 'poNumber': va = a.poNumber ?? ''; vb = b.poNumber ?? ''; break;
      case 'createdAt': va = new Date(a.createdAt).getTime(); vb = new Date(b.createdAt).getTime(); break;
      case 'skuCode': va = a.sku?.skuCode ?? ''; vb = b.sku?.skuCode ?? ''; break;
      case 'orderQuantity': va = a.orderQuantity; vb = b.orderQuantity; break;
      case 'supplier': va = a.supplier?.name ?? ''; vb = b.supplier?.name ?? ''; break;
      case 'status': va = a.status; vb = b.status; break;
      case 'expectedArrival':
        va = a.expectedArrival ? new Date(a.expectedArrival).getTime() : Infinity;
        vb = b.expectedArrival ? new Date(b.expectedArrival).getTime() : Infinity;
        break;
    }
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SortHeader({ label, sortKey, currentKey, currentDir, onSort }: {
  label: string; sortKey: PoSortKey; currentKey: PoSortKey | null; currentDir: SortDir; onSort: (k: PoSortKey) => void;
}) {
  return (
    <th className="data-table-header">
      <div
        className="cursor-pointer select-none flex items-center gap-2 hover:text-white transition-colors"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <ArrowUpDown className={clsx("w-3 h-3", currentKey === sortKey ? 'text-white' : 'text-white/20')} />
      </div>
    </th>
  );
}

function EditPoModal({ po, onClose }: { po: any; onClose: () => void }) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({
    status: po.status,
    orderQuantity: String(po.orderQuantity),
    expectedArrival: po.expectedArrival ? format(new Date(po.expectedArrival), 'yyyy-MM-dd') : '',
    notes: po.notes ?? '',
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      await axios.patch(`/api/v1/purchase-orders/${po.id}`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      onClose();
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-bg-card border border-border-subtle w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-border-subtle flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold tracking-tight">Edit Line Item</h3>
            <p className="text-white/40 text-sm mt-0.5 font-mono">{po.poNumber} · {po.sku?.skuCode}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><X size={24} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Status</label>
            <select
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value })}
              className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all appearance-none"
            >
              {PO_STATUSES.map(s => (
                <option key={s} value={s} className="bg-bg-card">{s}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Order Quantity</label>
              <input
                type="number"
                value={formData.orderQuantity}
                onChange={e => setFormData({ ...formData, orderQuantity: e.target.value })}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Expected Arrival</label>
              <input
                type="date"
                value={formData.expectedArrival}
                onChange={e => setFormData({ ...formData, expectedArrival: e.target.value })}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all min-h-[80px]"
            />
          </div>
          <button
            disabled={mutation.isPending}
            className="w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="animate-spin" size={16} /> : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Purchasing() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingPo, setEditingPo] = React.useState<any>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [view, setView] = React.useState<'open' | 'closed'>('open');
  const [sortKey, setSortKey] = React.useState<PoSortKey | null>(null);
  const [sortDir, setSortDir] = React.useState<SortDir>('asc');
  const [search, setSearch] = React.useState('');

  const handleSort = (key: PoSortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const { data: pos } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/purchase-orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.data;
    }
  });

  const { data: reorderQueue } = useQuery({
    queryKey: ['reorder-queue'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/inventory/reorder-queue', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/v1/purchase-orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setDeletingId(null);
    }
  });

  const statusColors: Record<string, string> = {
    'OPEN': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'IN PRODUCTION': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'SHIPPED': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'RECEIVED': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    'COMPLETE': 'bg-white/10 text-white/50 border-white/20',
  };

  const openPos = pos?.filter((p: any) => OPEN_STATUSES.includes(p.status)) ?? [];
  const closedPos = pos?.filter((p: any) => CLOSED_STATUSES.includes(p.status)) ?? [];
  const viewPos = view === 'open' ? openPos : closedPos;

  const filtered = viewPos.filter((p: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.poNumber?.toLowerCase().includes(q) ||
      p.sku?.skuCode?.toLowerCase().includes(q) ||
      p.sku?.productDescription?.toLowerCase().includes(q) ||
      p.supplier?.name?.toLowerCase().includes(q) ||
      p.status?.toLowerCase().includes(q)
    );
  });

  const sorted = sortKey ? sortPos(filtered, sortKey, sortDir) : filtered;

  const handleDownloadPo = (poNumber: string) => {
    if (!pos?.length) return;
    const lineItems = pos.filter((p: any) => p.poNumber === poNumber);
    if (lineItems.length === 0) return;
    generatePoPdf(poNumber, lineItems);
  };

  const handleExport = () => {
    if (!pos?.length) return;
    const headers = ['PO #', 'Date Submitted', 'SKU', 'Description', 'Quantity', 'Supplier', 'Status', 'Expected Arrival'];
    const rows = pos.map((p: any) => [
      p.poNumber,
      p.createdAt ? format(new Date(p.createdAt), 'MM/dd/yy') : 'N/A',
      p.sku?.skuCode ?? '',
      p.sku?.productDescription ?? '',
      p.orderQuantity,
      p.supplier?.name ?? '',
      p.status,
      p.expectedArrival ? format(new Date(p.expectedArrival), 'MM/dd/yy') : 'TBD',
    ]);
    downloadCsv('purchase-orders-export.csv', headers, rows);
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 className="text-3xl font-bold tracking-tight">Purchasing & Procurement</h2>
          <p className="text-white/50 mt-1">Manage purchase orders and reorder triggers</p>
        </motion.div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-white/5 border border-border-subtle px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/10 transition-all"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-white text-black px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-white/90 transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            Create New PO
          </button>
        </div>
      </header>

      <CreatePoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      {editingPo && <EditPoModal po={editingPo} onClose={() => setEditingPo(null)} />}

      {/* Delete confirm dialog */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-bg-card border border-border-subtle w-full max-w-sm rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold">Delete Line Item?</h3>
            <p className="text-white/50 text-sm">This will remove this line item from the purchase order. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingId(null)} className="flex-1 py-2.5 rounded-xl border border-border-subtle text-sm font-medium hover:bg-white/5 transition-all">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-critical text-white text-sm font-bold hover:bg-critical/80 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleteMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Toggle buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setView('open')}
              className={clsx(
                "px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
                view === 'open'
                  ? 'bg-white text-black'
                  : 'bg-white/5 border border-border-subtle text-white/50 hover:bg-white/10'
              )}
            >
              Open POs ({openPos.length})
            </button>
            <button
              onClick={() => setView('closed')}
              className={clsx(
                "px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
                view === 'closed'
                  ? 'bg-white text-black'
                  : 'bg-white/5 border border-border-subtle text-white/50 hover:bg-white/10'
              )}
            >
              Closed POs ({closedPos.length})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search POs, SKUs, suppliers..."
              className="w-full bg-white/5 border border-border-subtle rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
            />
          </div>

          {/* PO Table — Column order: PO #, Date Submitted, SKU, Quantity, Supplier, Status, Expected */}
          <div className="bg-bg-card border border-border-subtle rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle">
                  <SortHeader label="PO #" sortKey="poNumber" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Date Submitted" sortKey="createdAt" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortHeader label="SKU" sortKey="skuCode" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Quantity" sortKey="orderQuantity" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Supplier" sortKey="supplier" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Expected" sortKey="expectedArrival" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <th className="data-table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((po: any) => (
                  <tr key={po.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="data-table-cell font-mono font-bold">{po.poNumber}</td>
                    <td className="data-table-cell font-mono text-white/50">
                      {po.createdAt ? format(new Date(po.createdAt), 'MM/dd/yy') : 'N/A'}
                    </td>
                    <td className="data-table-cell">
                      <div
                        className="flex flex-col cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => navigate(`/inventory/${po.skuId}`)}
                      >
                        <span className="font-mono text-xs">{po.sku?.skuCode}</span>
                        <span className="text-[10px] text-white/40 truncate max-w-[120px]">{po.sku?.productDescription}</span>
                      </div>
                    </td>
                    <td className="data-table-cell font-mono">{po.orderQuantity.toLocaleString()}</td>
                    <td className="data-table-cell text-white/80">{po.supplier?.name}</td>
                    <td className="data-table-cell">
                      <span className={clsx(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight border",
                        statusColors[po.status] ?? 'bg-white/10 text-white/50 border-white/20'
                      )}>
                        {po.status}
                      </span>
                    </td>
                    <td className="data-table-cell font-mono text-white/50">
                      {po.expectedArrival ? format(new Date(po.expectedArrival), 'MM/dd/yy') : 'TBD'}
                    </td>
                    <td className="data-table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDownloadPo(po.poNumber)}
                          className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all"
                          title="Download PO as PDF"
                        >
                          <FileDown size={15} />
                        </button>
                        <button
                          onClick={() => setEditingPo(po)}
                          className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeletingId(po.id)}
                          className="p-2 rounded-lg bg-critical/10 text-critical/70 hover:bg-critical/20 hover:text-critical transition-all"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-white/30 italic">
                      No {view} purchase orders
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold tracking-tight">Reorder Queue</h3>
            <span className="bg-critical text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {reorderQueue?.length ?? 0}
            </span>
          </div>

          <div className="space-y-4">
            {reorderQueue?.map((item: any, i: number) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-bg-card border border-border-subtle p-4 rounded-xl space-y-3 hover:border-white/20 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-sm font-bold">{item.sku.skuCode}</p>
                    <p className="text-[10px] text-white/40">{item.sku.productDescription}</p>
                  </div>
                  <AlertTriangle className={clsx(
                    "w-4 h-4",
                    item.reorderStatus === 'CRITICAL' ? 'text-critical' : 'text-reorder'
                  )} />
                </div>
                <div className="grid grid-cols-4 gap-4 pt-2 border-t border-white/5">
                  <div>
                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Suggested Order</p>
                    <p className="text-sm font-bold font-mono">{item.suggestedOrderQty?.toLocaleString() ?? '—'} <span className="text-[10px] text-white/30 font-normal">units</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">On Order</p>
                    <p className={clsx("text-sm font-bold font-mono", item.unitsOnOrder > 0 ? "text-blue-400" : "text-white/30")}>
                      {item.unitsOnOrder > 0 ? item.unitsOnOrder.toLocaleString() : '—'} {item.unitsOnOrder > 0 && <span className="text-[10px] text-white/30 font-normal">units</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Days to Order</p>
                    {(() => {
                      const daysToOrder = Math.round(item.totalDaysOutstanding - (item.sku?.orderTriggerDays ?? 90));
                      return (
                        <p className={clsx(
                          "text-sm font-bold font-mono",
                          daysToOrder <= 0 ? "text-critical" : "text-white"
                        )}>
                          {daysToOrder} <span className="text-[10px] text-white/30 font-normal">days</span>
                        </p>
                      );
                    })()}
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">30D Velocity</p>
                    <p className="text-sm font-bold font-mono">{item.velocity30d?.toFixed(1) ?? '0'} <span className="text-[10px] text-white/30 font-normal">/day</span></p>
                  </div>
                </div>
              </motion.div>
            ))}
            {(!reorderQueue || reorderQueue.length === 0) && (
              <div className="bg-bg-card border border-border-subtle border-dashed p-8 rounded-xl text-center">
                <CheckCircle2 className="w-8 h-8 text-healthy mx-auto mb-2 opacity-50" />
                <p className="text-xs text-white/30 font-medium">Reorder queue is clear</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
