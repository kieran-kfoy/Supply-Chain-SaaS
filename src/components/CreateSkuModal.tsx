import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { X, Loader2 } from 'lucide-react';

interface CreateSkuModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateSkuModal({ isOpen, onClose }: CreateSkuModalProps) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({
    skuCode: '',
    productDescription: '',
    unitCost: '',
    sellingPrice: '',
    supplierId: '',
    moq: '1',
    orderTriggerDays: '90',
    daysToOrderTarget: '250',
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/suppliers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.data;
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await axios.post('/api/v1/inventory/skus', data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-skus'] });
      onClose();
      setFormData({
        skuCode: '',
        productDescription: '',
        unitCost: '',
        sellingPrice: '',
        supplierId: '',
        moq: '1',
        orderTriggerDays: '90',
        daysToOrderTarget: '250',
      });
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-bg-card border border-border-subtle w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-border-subtle flex items-center justify-between">
          <h3 className="text-xl font-bold tracking-tight">Add New SKU</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="p-6 space-y-6">
          {mutation.isError && (
            <div className="bg-critical/10 border border-critical/20 p-4 rounded-xl text-critical text-sm font-medium">
              Failed to create SKU. Please check your inputs and try again.
            </div>
          )}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">SKU Code</label>
              <input
                required
                value={formData.skuCode}
                onChange={e => setFormData({ ...formData, skuCode: e.target.value })}
                placeholder="e.g. SKU-123"
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Supplier</label>
              <select
                required
                value={formData.supplierId}
                onChange={e => setFormData({ ...formData, supplierId: e.target.value })}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all appearance-none"
              >
                <option value="" disabled className="bg-bg-card">Select Supplier</option>
                {suppliers?.map((s: any) => (
                  <option key={s.id} value={s.id} className="bg-bg-card">{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Product Description</label>
            <textarea
              required
              value={formData.productDescription}
              onChange={e => setFormData({ ...formData, productDescription: e.target.value })}
              placeholder="Enter product details..."
              className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Unit Cost ($)</label>
              <input
                required
                type="number"
                step="0.01"
                value={formData.unitCost}
                onChange={e => setFormData({ ...formData, unitCost: e.target.value })}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Selling Price ($)</label>
              <input
                required
                type="number"
                step="0.01"
                value={formData.sellingPrice}
                onChange={e => setFormData({ ...formData, sellingPrice: e.target.value })}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 ml-1">MOQ</label>
              <input
                type="number"
                value={formData.moq}
                onChange={e => setFormData({ ...formData, moq: e.target.value })}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 ml-1">Trigger Days</label>
              <input
                type="number"
                value={formData.orderTriggerDays}
                onChange={e => setFormData({ ...formData, orderTriggerDays: e.target.value })}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 ml-1">Target Days</label>
              <input
                type="number"
                value={formData.daysToOrderTarget}
                onChange={e => setFormData({ ...formData, daysToOrderTarget: e.target.value })}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              disabled={mutation.isPending}
              className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="animate-spin" /> : 'Create SKU'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
