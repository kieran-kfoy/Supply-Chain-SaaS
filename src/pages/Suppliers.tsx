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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-bg-card border border-border-subtle w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-border-subtle flex items-center justify-between">
          <h3 className="text-xl font-bold tracking-tight">Edit Supplier</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><X size={24} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Supplier Name</label>
            <input
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Type</label>
            <select
              value={formData.supplierType}
              onChange={e => setFormData({ ...formData, supplierType: e.target.value })}
              className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all appearance-none"
            >
              {SUPPLIER_TYPES.map(t => (
                <option key={t} value={t} className="bg-bg-card capitalize">{t}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Contact Name</label>
              <input
                value={formData.contactName}
                onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Contact Email</label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
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
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 className="text-3xl font-bold tracking-tight">Supplier Network</h2>
          <p className="text-white/50 mt-1">Manage global production partners and performance</p>
        </motion.div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-white text-black px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-white/90 transition-all flex items-center gap-2"
        >
          <Plus size={18} />
          Onboard Supplier
        </button>
      </header>

      <CreateSupplierModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      {editingSupplier && <EditSupplierModal supplier={editingSupplier} onClose={() => setEditingSupplier(null)} />}

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-bg-card border border-border-subtle w-full max-w-sm rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold">Delete Supplier?</h3>
            <p className="text-white/50 text-sm">This will remove the supplier. SKUs linked to them must be reassigned first.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers?.map((supplier: any, i: number) => (
          <motion.div
            key={supplier.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-bg-card border border-border-subtle p-6 rounded-2xl space-y-6 hover:border-white/20 transition-all group relative"
          >
            {/* Edit / Delete controls */}
            <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setEditingSupplier(supplier)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all"
                title="Edit supplier"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => setDeletingId(supplier.id)}
                className="p-1.5 rounded-lg hover:bg-critical/20 text-white/40 hover:text-critical transition-all"
                title="Delete supplier"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="text-xl font-bold tracking-tight group-hover:text-white transition-colors">{supplier.name}</h3>
                <div className="flex items-center gap-2 text-xs text-white/40 font-medium">
                  <span className={clsx(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight",
                    supplier.productionType === 'manufacturer' ? 'bg-blue-500/10 text-blue-500' :
                    supplier.productionType === 'packaging' ? 'bg-amber-500/10 text-amber-500' :
                    supplier.productionType === 'ingredients' ? 'bg-emerald-500/10 text-emerald-500' :
                    'bg-white/10 text-white/50'
                  )}>
                    {supplier.productionType}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-white/10 transition-colors">
                <Users className="text-white/40 group-hover:text-white w-5 h-5 transition-colors" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-white/60">
                <Mail size={14} className="text-white/20" />
                <span>{supplier.contactEmail ?? 'No email on file'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-white/60">
                <Users size={14} className="text-white/20" />
                <span className="truncate">{supplier.contactName ?? 'No contact person'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase font-bold tracking-widest">
                  <Package size={10} />
                  SKUs
                </div>
                <p className="text-lg font-bold font-mono">{supplier._count.skus}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase font-bold tracking-widest">
                  <ShoppingCart size={10} />
                  Active POs
                </div>
                <p className="text-lg font-bold font-mono">{supplier._count.purchaseOrders}</p>
              </div>
            </div>
          </motion.div>
        ))}
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
