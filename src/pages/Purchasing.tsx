import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { ShoppingCart, AlertTriangle, CheckCircle2, Clock, Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import CreatePoModal from '../components/CreatePoModal';

const PO_STATUSES = ['OPEN', 'IN PRODUCTION', 'SHIPPED', 'RECEIVED', 'COMPLETE'];

const statusStyle: Record<string, { bg: string; color: string; border: string }> = {
  'OPEN':          { bg: 'rgba(96,165,250,0.1)',  color: '#60A5FA', border: 'rgba(96,165,250,0.25)' },
  'IN PRODUCTION': { bg: 'rgba(251,191,36,0.1)',  color: '#FBB724', border: 'rgba(251,191,36,0.25)' },
  'SHIPPED':       { bg: 'rgba(52,211,153,0.1)',  color: '#34D399', border: 'rgba(52,211,153,0.25)' },
  'RECEIVED':      { bg: 'rgba(167,139,250,0.1)', color: '#A78BFA', border: 'rgba(167,139,250,0.25)' },
  'COMPLETE':      { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: 'rgba(255,255,255,0.12)' },
};

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
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <h3 className="text-[16px] font-bold tracking-tight">Edit Purchase Order</h3>
            <p className="text-[12px] font-mono mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{po.poNumber}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 transition-colors" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="p-6 space-y-4">
          <div>
            <label className="field-label">Status</label>
            <select
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value })}
              className="input-field"
            >
              {PO_STATUSES.map(s => (
                <option key={s} value={s} className="bg-[#0F1521]">{s}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Order Quantity</label>
              <input
                type="number"
                value={formData.orderQuantity}
                onChange={e => setFormData({ ...formData, orderQuantity: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="field-label">Expected Arrival</label>
              <input
                type="date"
                value={formData.expectedArrival}
                onChange={e => setFormData({ ...formData, expectedArrival: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
          <div>
            <label className="field-label">Notes</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="input-field min-h-[80px] resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary w-full justify-center py-3 rounded-xl disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : 'Save Changes'}
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
  const [editingPo, setEditingPo] = React.useState<any>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const { data: pos } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/purchase-orders', { headers: { Authorization: `Bearer ${token}` } });
      return res.data.data;
    }
  });

  const { data: reorderQueue } = useQuery({
    queryKey: ['reorder-queue'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/inventory/reorder-queue', { headers: { Authorization: `Bearer ${token}` } });
      return res.data.data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/v1/purchase-orders/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setDeletingId(null);
    }
  });

  return (
    <div className="p-8 space-y-7 max-w-7xl mx-auto page-enter">

      <header className="page-header">
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: [0.16,1,0.3,1] }}>
          <h2 className="page-title">Purchasing</h2>
          <p className="page-subtitle">Manage purchase orders and reorder triggers</p>
        </motion.div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary">
          <Plus size={15} />
          Create PO
        </button>
      </header>

      <CreatePoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      {editingPo && <EditPoModal po={editingPo} onClose={() => setEditingPo(null)} />}

      {/* Delete confirm */}
      {deletingId && (
        <div className="modal-overlay">
          <div className="modal-card p-6 space-y-4 max-w-sm">
            <h3 className="text-[16px] font-bold">Delete Purchase Order?</h3>
            <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.4)' }}>This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingId(null)} className="btn-secondary flex-1 justify-center py-2.5">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
                className="btn-danger flex-1 justify-center py-2.5 disabled:opacity-50"
              >
                {deleteMutation.isPending ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* PO Table */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold tracking-tight" style={{ color: '#F1F5F9' }}>Active Purchase Orders</h3>
            <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>
              <Clock size={11} />
              Live
            </div>
          </div>

          <div className="section-card overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {['PO #', 'SKU', 'Supplier', 'Qty', 'Status', 'Expected', ''].map(h => (
                    <th key={h} className="data-table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pos?.map((po: any, i: number) => {
                  const ss = statusStyle[po.status] ?? statusStyle['COMPLETE'];
                  return (
                    <tr
                      key={po.id}
                      className="group transition-colors duration-100"
                      style={{ background: i % 2 !== 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 !== 0 ? 'rgba(255,255,255,0.01)' : 'transparent')}
                    >
                      <td className="data-table-cell font-mono font-bold text-[13px]">{po.poNumber}</td>
                      <td className="data-table-cell">
                        <p className="font-mono text-[12px] font-bold">{po.sku.skuCode}</p>
                        <p className="text-[10px] truncate max-w-[110px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{po.sku.productDescription}</p>
                      </td>
                      <td className="data-table-cell text-[13px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{po.supplier.name}</td>
                      <td className="data-table-cell font-mono text-[13px]">{po.orderQuantity.toLocaleString()}</td>
                      <td className="data-table-cell">
                        <span
                          className="status-badge"
                          style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td className="data-table-cell font-mono text-[12px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {po.expectedArrival ? format(new Date(po.expectedArrival), 'MMM d') : '—'}
                      </td>
                      <td className="data-table-cell">
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingPo(po)}
                            className="p-1.5 rounded-lg transition-all hover:bg-white/8"
                            style={{ color: 'rgba(255,255,255,0.35)' }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeletingId(po.id)}
                            className="p-1.5 rounded-lg transition-all hover:bg-red-500/15"
                            style={{ color: 'rgba(255,255,255,0.35)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {(!pos || pos.length === 0) && (
                  <tr>
                    <td colSpan={7} className="py-14 text-center">
                      <ShoppingCart className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.07)' }} />
                      <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.3)' }}>No active purchase orders</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reorder Queue */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold tracking-tight" style={{ color: '#F1F5F9' }}>Reorder Queue</h3>
            {(reorderQueue?.length ?? 0) > 0 && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171', border: '1px solid rgba(248,113,113,0.2)' }}
              >
                {reorderQueue.length}
              </span>
            )}
          </div>

          <div className="space-y-3">
            {reorderQueue?.map((item: any, i: number) => {
              const isCritical = item.reorderStatus === 'CRITICAL';
              const accent = isCritical ? '#F87171' : '#FB923C';
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07, ease: [0.16,1,0.3,1] }}
                  className="section-card p-4 space-y-3"
                  style={{ border: `1px solid ${accent}25` }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-[13px] font-bold">{item.sku.skuCode}</p>
                      <p className="text-[10px] mt-0.5 truncate max-w-[160px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.sku.productDescription}</p>
                    </div>
                    <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: accent }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.1em] mb-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>Available</p>
                      <p className="text-[15px] font-bold font-mono">{item.availableQuantity}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.1em] mb-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>Days Left</p>
                      <p className="text-[15px] font-bold font-mono" style={{ color: accent }}>{Math.round(item.daysInStock)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full py-2 rounded-xl text-[11px] font-bold uppercase tracking-[0.06em] transition-all duration-150 hover:bg-white hover:text-black"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
                  >
                    Generate PO Draft
                  </button>
                </motion.div>
              );
            })}
            {(!reorderQueue || reorderQueue.length === 0) && (
              <div
                className="p-8 rounded-2xl text-center"
                style={{ background: 'rgba(52,211,153,0.04)', border: '1px dashed rgba(52,211,153,0.18)' }}
              >
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: '#34D399', opacity: 0.4 }} />
                <p className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Reorder queue is clear</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
