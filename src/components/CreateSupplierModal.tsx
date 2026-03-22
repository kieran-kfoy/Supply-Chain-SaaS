import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { X, Loader2 } from 'lucide-react';

interface CreateSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateSupplierModal({ isOpen, onClose }: CreateSupplierModalProps) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({
    name: '',
    supplierType: 'MANUFACTURER',
    contactName: '',
    contactEmail: '',
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await axios.post('/api/v1/suppliers', data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      onClose();
      setFormData({
        name: '',
        supplierType: 'MANUFACTURER',
        contactName: '',
        contactEmail: '',
      });
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-bg-card border border-border-subtle w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-border-subtle flex items-center justify-between">
          <h3 className="text-xl font-bold tracking-tight">Onboard New Supplier</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="p-6 space-y-6">
          {mutation.isError && (
            <div className="bg-critical/10 border border-critical/20 p-4 rounded-xl text-critical text-sm font-medium">
              Failed to onboard supplier. Please check your inputs and try again.
            </div>
          )}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Supplier Name</label>
              <input
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Global Manufacturing Ltd"
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Supplier Type</label>
              <select
                required
                value={formData.supplierType}
                onChange={e => setFormData({ ...formData, supplierType: e.target.value })}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all appearance-none"
              >
                <option value="MANUFACTURER" className="bg-bg-card">Manufacturer</option>
                <option value="PACKAGING" className="bg-bg-card">Packaging</option>
                <option value="INGREDIENTS" className="bg-bg-card">Ingredients</option>
                <option value="OTHER" className="bg-bg-card">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
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

          <div className="pt-4">
            <button
              disabled={mutation.isPending}
              className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="animate-spin" /> : 'Onboard Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
