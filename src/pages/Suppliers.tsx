import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { Users, Mail, Package, ShoppingCart, Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx } from 'clsx';
import CreateSupplierModal from '../components/CreateSupplierModal';

const SUPPLIER_TYPES = ['manufacturer', 'packaging', 'ingredients', 'domestic', 'import', 'other'];

function EditSupplierModal({ supplier, onClose }: { supplier: any; onClose: () => void }) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({
    name: supplier.name ?? '',
    contactName: supplier.contactName ?? '',
    contactEmail: supplier.contactEmail ?? '',
    supplierType: supplier.productionType ?? 'manufacturer',
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      await axios.patch(`/api/v1/suppliers/${supplier.id}`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      onClose();
    }
  });

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 className="text-[16px] font-bold tracking-tight">Edit Supplier</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="p-6 space-y-4">
          <div>
            <label className="field-label">Supplier Name</label>
            <input
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">Type</label>
            <select
              value={formData.supplierType}
              onChange={e => setFormData({ ...formData, supplierType: e.target.value })}
              className="input-field"
            >
              {SUPPLIER_TYPES.map(t => (
                <option key={t} value={t} className="bg-[#0F1521] capitalize">{t}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Contact Name</label>
              <input
                value={formData.contactName}
                onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="field-label">Contact Email</label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                className="input-field"
              />
            </div>
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

export default function Suppliers() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingSupplier, setEditingSupplier] = React.useState<any>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/suppliers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/v1/suppliers/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setDeletingId(null);
    }
  });

  return (
    <div className="p-8 space-y-7 max-w-7xl mx-auto page-enter">
      <header className="page-header">
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: [0.16,1,0.3,1] }}>
          <h2 className="page-title">Suppliers</h2>
          <p className="page-subtitle">Manage production partners and relationships</p>
        </motion.div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary">
          <Plus size={15} />
          Add Supplier
        </button>
      </header>

      <CreateSupplierModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      {editingSupplier && <EditSupplierModal supplier={editingSupplier} onClose={() => setEditingSupplier(null)} />}

      {deletingId && (
        <div className="modal-overlay">
          <div className="modal-card p-6 space-y-4 max-w-sm">
            <h3 className="text-[16px] font-bold">Delete Supplier?</h3>
            <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.4)' }}>This will remove the supplier. Linked SKUs must be reassigned first.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {suppliers?.map((supplier: any, i: number) => {
          const typeStyle: Record<string, { bg: string; color: string }> = {
            manufacturer: { bg: 'rgba(96,165,250,0.1)', color: '#60A5FA' },
            packaging:    { bg: 'rgba(251,146,60,0.1)', color: '#FB923C' },
            ingredients:  { bg: 'rgba(52,211,153,0.1)', color: '#34D399' },
          };
          const ts = typeStyle[supplier.productionType] ?? { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' };
          return (
            <motion.div
              key={supplier.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.35, ease: [0.16,1,0.3,1] }}
              className="section-card p-5 space-y-5 group relative transition-all duration-200"
              style={{ cursor: 'default' }}
            >
              {/* Edit / Delete */}
              <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditingSupplier(supplier)}
                  className="p-1.5 rounded-lg transition-all"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.color = '#fff'; (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; (e.target as HTMLElement).style.background = 'transparent'; }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => setDeletingId(supplier.id)}
                  className="p-1.5 rounded-lg transition-all"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.color = '#F87171'; (e.target as HTMLElement).style.background = 'rgba(248,113,113,0.1)'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; (e.target as HTMLElement).style.background = 'transparent'; }}
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="flex items-start gap-3 pr-14">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(99,102,241,0.1)' }}
                >
                  <Users className="w-[18px] h-[18px]" style={{ color: '#818CF8' }} />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold tracking-tight" style={{ color: '#F1F5F9' }}>{supplier.name}</h3>
                  <span
                    className="status-badge mt-1"
                    style={{ background: ts.bg, color: ts.color, border: `1px solid ${ts.color}30` }}
                  >
                    {supplier.productionType ?? 'other'}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <Mail size={13} style={{ color: 'rgba(255,255,255,0.2)' }} />
                  <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {supplier.contactEmail ?? 'No email on file'}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Users size={13} style={{ color: 'rgba(255,255,255,0.2)' }} />
                  <span className="text-[13px] truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {supplier.contactName ?? 'No contact person'}
                  </span>
                </div>
              </div>

              <div
                className="grid grid-cols-2 gap-3 pt-4"
                style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] mb-1 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    <Package size={9} /> SKUs
                  </p>
                  <p className="text-[18px] font-bold font-mono" style={{ color: '#F1F5F9' }}>{supplier._count.skus}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] mb-1 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    <ShoppingCart size={9} /> POs
                  </p>
                  <p className="text-[18px] font-bold font-mono" style={{ color: '#F1F5F9' }}>{supplier._count.purchaseOrders}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
        {(!suppliers || suppliers.length === 0) && (
          <div className="col-span-full py-20 text-center bg-bg-card border border-border-subtle border-dashed rounded-2xl">
            <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/50 font-medium">No suppliers onboarded</p>
          </div>
        )}
      </div>
    </div>
  );
}
