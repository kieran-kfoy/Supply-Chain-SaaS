import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { Truck, Package, CheckCircle2, AlertCircle, Search, Filter, Plus, Trash2, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import LogShipmentModal from '../components/LogShipmentModal';

export default function FinishedGoodsLog() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');

  const { data: shipments } = useQuery({
    queryKey: ['shipments'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/shipments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.data;
    }
  });

  const receiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.patch(`/api/v1/shipments/${id}/receive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/v1/shipments/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setDeletingId(null);
    }
  });

  const filtered = shipments?.filter((s: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.sku?.skuCode?.toLowerCase().includes(q) ||
      s.asnNumber?.toLowerCase().includes(q) ||
      s.trackingNumber?.toLowerCase().includes(q) ||
      s.po?.poNumber?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8 space-y-7 max-w-7xl mx-auto page-enter">
      <header className="page-header">
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: [0.16,1,0.3,1] }}>
          <h2 className="page-title">Shipping Log</h2>
          <p className="page-subtitle">Track production completion and warehouse transit</p>
        </motion.div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary">
          <Plus size={15} />
          Log Shipment
        </button>
      </header>

      <LogShipmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Delete confirm */}
      {deletingId && (
        <div className="modal-overlay">
          <div className="modal-card p-6 space-y-4 max-w-sm">
            <h3 className="text-[16px] font-bold">Delete Shipment?</h3>
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

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'In Transit', value: shipments?.filter((s: any) => !s.received).length ?? 0, color: '#60A5FA', Icon: Truck },
          { label: 'Received', value: shipments?.filter((s: any) => s.received).length ?? 0, color: '#34D399', Icon: CheckCircle2 },
          { label: 'Discrepancies', value: shipments?.filter((s: any) => s.discrepancyFlag).length ?? 0, color: '#F87171', Icon: AlertCircle },
        ].map(({ label, value, color, Icon }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="stat-card"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${color}50, transparent)` }} />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
                <p className="text-[22px] font-bold font-mono tracking-tight" style={{ color }}>{value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="section-card overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between gap-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.25)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search shipments, tracking..."
              className="input-field pl-9 py-2 text-[13px]"
            />
          </div>
          <button className="btn-secondary text-[12px] py-2">
            <Filter className="w-3.5 h-3.5" />
            Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                <th className="data-table-header">Ship Date</th>
                <th className="data-table-header">ASN / Tracking</th>
                <th className="data-table-header">PO #</th>
                <th className="data-table-header">SKU</th>
                <th className="data-table-header">Units</th>
                <th className="data-table-header">Status</th>
                <th className="data-table-header">Received?</th>
              </tr>
            </thead>
            <tbody>
              {filtered?.map((shipment: any, i: number) => (
                <tr
                  key={shipment.id}
                  className="group transition-colors duration-100"
                  style={{ background: i % 2 !== 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 !== 0 ? 'rgba(255,255,255,0.01)' : 'transparent')}
                >
                  <td className="data-table-cell font-mono text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {format(new Date(shipment.shipDate), 'MMM d, yyyy')}
                  </td>
                  <td className="data-table-cell">
                    <p className="font-mono font-bold text-[12px]">{shipment.asnNumber ?? '—'}</p>
                    <p className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.28)' }}>{shipment.trackingNumber ?? 'No Tracking'}</p>
                  </td>
                  <td className="data-table-cell font-mono text-[13px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{shipment.po?.poNumber ?? '—'}</td>
                  <td className="data-table-cell">
                    <p className="font-mono text-[12px] font-bold">{shipment.sku.skuCode}</p>
                    <p className="text-[10px] truncate max-w-[120px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{shipment.sku.productDescription}</p>
                  </td>
                  <td className="data-table-cell font-mono font-bold text-[13px]">{shipment.unitsShipped.toLocaleString()}</td>
                  <td className="data-table-cell">
                    <span
                      className="status-badge"
                      style={shipment.received
                        ? { background: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.25)' }
                        : { background: 'rgba(96,165,250,0.1)', color: '#60A5FA', border: '1px solid rgba(96,165,250,0.25)' }
                      }
                    >
                      {shipment.received ? 'Received' : 'In Transit'}
                    </span>
                  </td>
                  <td className="data-table-cell">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        {receiveMutation.isPending && receiveMutation.variables === shipment.id ? (
                          <Loader2 size={16} className="animate-spin text-white/40" />
                        ) : (
                          <input
                            type="checkbox"
                            checked={shipment.received}
                            disabled={shipment.received}
                            onChange={() => !shipment.received && receiveMutation.mutate(shipment.id)}
                            className="w-4 h-4 rounded border-border-subtle bg-white/5 accent-emerald-500 cursor-pointer disabled:cursor-default"
                          />
                        )}
                      </label>
                      <button
                        onClick={() => setDeletingId(shipment.id)}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-critical/20 text-white/40 hover:text-critical transition-all"
                        title="Delete shipment"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!filtered || filtered.length === 0) && (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <Truck className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <p className="text-white/50 font-medium">No inbound shipments tracked</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
