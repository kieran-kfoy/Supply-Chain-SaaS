import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { ShoppingCart, AlertTriangle, Calendar, CheckCircle2, Clock, Plus, Pencil, Trash2, X, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import CreatePoModal from '../components/CreatePoModal';

const PO_STATUSES = ['OPEN', 'IN PRODUCTION', 'SHIPPED', 'RECEIVED', 'COMPLETE'];

interface POGroup {
  poNumber: string;
  supplier: any;
  status: string;
  dateSubmitted: string;
  expectedArrival: string | null;
  notes: string | null;
  packagingOrdered: boolean;
  lines: any[];
  totalQuantity: number;
}

function groupPOs(pos: any[]): POGroup[] {
  const map = new Map<string, POGroup>();
  for (const po of pos) {
    const existing = map.get(po.poNumber);
    if (existing) {
      existing.lines.push(po);
      existing.totalQuantity += po.orderQuantity;
    } else {
      map.set(po.poNumber, {
        poNumber: po.poNumber,
        supplier: po.supplier,
        status: po.status,
        dateSubmitted: po.dateSubmitted,
        expectedArrival: po.expectedArrival,
        notes: po.notes,
        packagingOrdered: po.packagingOrdered,
        lines: [po],
        totalQuantity: po.orderQuantity,
      });
    }
  }
  return Array.from(map.values());
}

function EditPoModal({ group, onClose }: { group: POGroup; onClose: () => void }) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({
    status: group.status,
    expectedArrival: group.expectedArrival ? format(new Date(group.expectedArrival), 'yyyy-MM-dd') : '',
    notes: group.notes ?? '',
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      await axios.patch(`/api/v1/purchase-orders/by-number/${encodeURIComponent(group.poNumber)}`, data, {
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
            <h3 className="text-xl font-bold tracking-tight">Edit Purchase Order</h3>
            <p className="text-white/40 text-sm mt-0.5 font-mono">{group.poNumber} · {group.lines.length} line item{group.lines.length > 1 ? 's' : ''}</p>
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
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Expected Arrival</label>
            <input
              type="date"
              value={formData.expectedArrival}
              onChange={e => setFormData({ ...formData, expectedArrival: e.target.value })}
              className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all min-h-[80px]"
            />
          </div>

          {/* Show line items as read-only summary */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Line Items</label>
            <div className="bg-white/[0.02] border border-border-subtle rounded-xl p-3 space-y-2">
              {group.lines.map((line: any) => (
                <div key={line.id} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-white/70">{line.sku.skuCode}</span>
                  <span className="font-mono font-bold">{line.orderQuantity.toLocaleString()} units</span>
                </div>
              ))}
            </div>
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
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingGroup, setEditingGroup] = React.useState<POGroup | null>(null);
  const [deletingPoNumber, setDeletingPoNumber] = React.useState<string | null>(null);
  const [expandedPOs, setExpandedPOs] = React.useState<Set<string>>(new Set());

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
    mutationFn: async (poNumber: string) => {
      await axios.delete(`/api/v1/purchase-orders/by-number/${encodeURIComponent(poNumber)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setDeletingPoNumber(null);
    }
  });

  const toggleExpanded = (poNumber: string) => {
    const next = new Set(expandedPOs);
    if (next.has(poNumber)) next.delete(poNumber);
    else next.add(poNumber);
    setExpandedPOs(next);
  };

  const grouped = pos ? groupPOs(pos) : [];

  const statusColors: Record<string, string> = {
    'OPEN': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'IN PRODUCTION': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'SHIPPED': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'RECEIVED': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    'COMPLETE': 'bg-white/10 text-white/50 border-white/20',
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 className="text-3xl font-bold tracking-tight">Purchasing & Procurement</h2>
          <p className="text-white/50 mt-1">Manage purchase orders and reorder triggers</p>
        </motion.div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-white text-black px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-white/90 transition-all flex items-center gap-2"
        >
          <Plus size={18} />
          Create New PO
        </button>
      </header>

      <CreatePoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      {editingGroup && <EditPoModal group={editingGroup} onClose={() => setEditingGroup(null)} />}

      {/* Delete confirm dialog */}
      {deletingPoNumber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-bg-card border border-border-subtle w-full max-w-sm rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold">Delete Purchase Order?</h3>
            <p className="text-white/50 text-sm">This will delete <span className="text-white font-mono font-bold">{deletingPoNumber}</span> and all its line items. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingPoNumber(null)} className="flex-1 py-2.5 rounded-xl border border-border-subtle text-sm font-medium hover:bg-white/5 transition-all">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deletingPoNumber)}
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
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold tracking-tight">Active Purchase Orders</h3>
            <div className="flex items-center gap-2 text-xs text-white/30 font-bold uppercase tracking-widest">
              <Clock size={12} />
              {grouped.length} PO{grouped.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="bg-bg-card border border-border-subtle rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="data-table-header w-8"></th>
                  <th className="data-table-header">PO #</th>
                  <th className="data-table-header">Supplier</th>
                  <th className="data-table-header">Items</th>
                  <th className="data-table-header">Total Qty</th>
                  <th className="data-table-header">Status</th>
                  <th className="data-table-header">Expected</th>
                  <th className="data-table-header"></th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((group) => {
                  const isExpanded = expandedPOs.has(group.poNumber);
                  const hasMultipleLines = group.lines.length > 1;
                  return (
                    <React.Fragment key={group.poNumber}>
                      <tr className="hover:bg-white/[0.02] transition-colors group/row cursor-pointer" onClick={() => hasMultipleLines && toggleExpanded(group.poNumber)}>
                        <td className="data-table-cell w-8">
                          {hasMultipleLines ? (
                            isExpanded ? <ChevronDown size={14} className="text-white/30" /> : <ChevronRight size={14} className="text-white/30" />
                          ) : <span className="w-3.5" />}
                        </td>
                        <td className="data-table-cell font-mono font-bold">{group.poNumber}</td>
                        <td className="data-table-cell text-white/80">{group.supplier?.name}</td>
                        <td className="data-table-cell">
                          {hasMultipleLines ? (
                            <span className="text-xs text-white/50">{group.lines.length} SKUs</span>
                          ) : (
                            <div className="flex flex-col">
                              <span className="font-mono text-xs">{group.lines[0]?.sku?.skuCode}</span>
                              <span className="text-[10px] text-white/40 truncate max-w-[120px]">{group.lines[0]?.sku?.productDescription}</span>
                            </div>
                          )}
                        </td>
                        <td className="data-table-cell font-mono">{group.totalQuantity.toLocaleString()}</td>
                        <td className="data-table-cell">
                          <span className={clsx(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight border",
                            statusColors[group.status] ?? 'bg-white/10 text-white/50 border-white/20'
                          )}>
                            {group.status}
                          </span>
                        </td>
                        <td className="data-table-cell font-mono text-white/50">
                          {group.expectedArrival ? format(new Date(group.expectedArrival), 'MMM d') : 'TBD'}
                        </td>
                        <td className="data-table-cell">
                          <div className="flex items-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setEditingGroup(group)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all"
                              title="Edit PO"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeletingPoNumber(group.poNumber)}
                              className="p-1.5 rounded-lg hover:bg-critical/20 text-white/40 hover:text-critical transition-all"
                              title="Delete PO"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded line items */}
                      {isExpanded && group.lines.map((line: any) => (
                        <tr key={line.id} className="bg-white/[0.01]">
                          <td className="data-table-cell"></td>
                          <td className="data-table-cell"></td>
                          <td className="data-table-cell"></td>
                          <td className="data-table-cell">
                            <div className="flex flex-col pl-2 border-l-2 border-white/10">
                              <span className="font-mono text-xs">{line.sku?.skuCode}</span>
                              <span className="text-[10px] text-white/40 truncate max-w-[120px]">{line.sku?.productDescription}</span>
                            </div>
                          </td>
                          <td className="data-table-cell font-mono text-white/60">{line.orderQuantity.toLocaleString()}</td>
                          <td className="data-table-cell" colSpan={3}></td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
                {grouped.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-white/30 italic">No active purchase orders</td>
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
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                  <div>
                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Available</p>
                    <p className="text-sm font-bold font-mono">{item.availableQuantity}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Days Left</p>
                    <p className="text-sm font-bold font-mono">{Math.round(item.daysInStock)}</p>
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
