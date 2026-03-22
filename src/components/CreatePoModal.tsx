import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { X, Loader2 } from 'lucide-react';

interface CreatePoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreatePoModal({ isOpen, onClose }: CreatePoModalProps) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({
    poNumber: '',
    skuId: '',
    supplierId: '',
    orderQuantity: '',
    notes: '',
    packagingOrdered: false,
  });

  const { data: skus } = useQuery({
    queryKey: ['inventory-skus'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/inventory/skus', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.data;
    }
  });

  const selectedSku = skus?.find((s: any) => s.id === formData.skuId);

  React.useEffect(() => {
    if (selectedSku) {
      setFormData(prev => ({ ...prev, supplierId: selectedSku.supplierId }));
    }
  }, [selectedSku]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await axios.post('/api/v1/purchase-orders', {
        ...data,
        orderQuantity: parseInt(data.orderQuantity)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      onClose();
      setFormData({
        poNumber: '',
        skuId: '',
        supplierId: '',
        orderQuantity: '',
        notes: '',
        packagingOrdered: false,
      });
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-bg-card border border-border-subtle w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-border-subtle flex items-center justify-between">
          <h3 className="text-xl font-bold tracking-tight">Create Purchase Order</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="p-6 space-y-6">
          {mutation.isError && (
            <div className="bg-critical/10 border border-critical/20 p-4 rounded-xl text-critical text-sm font-medium">
              Failed to submit PO. Please check your inputs and try again.
            </div>
          )}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">PO Number</label>
              <input
                required
                value={formData.poNumber}
                onChange={e => setFormData({ ...formData, poNumber: e.target.value })}
                placeholder="e.g. PO-2024-001"
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">SKU</label>
              <select
                required
                value={formData.skuId}
                onChange={e => setFormData({ ...formData, skuId: e.target.value })}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all appearance-none"
              >
                <option value="" disabled className="bg-bg-card">Select SKU</option>
                {skus?.map((s: any) => (
                  <option key={s.id} value={s.id} className="bg-bg-card">{s.skuCode} - {s.productDescription}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Order Quantity</label>
              <input
                required
                type="number"
                value={formData.orderQuantity}
                onChange={e => setFormData({ ...formData, orderQuantity: e.target.value })}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
            <div className="flex items-center gap-3 pt-8">
              <input
                type="checkbox"
                id="packaging"
                checked={formData.packagingOrdered}
                onChange={e => setFormData({ ...formData, packagingOrdered: e.target.checked })}
                className="w-5 h-5 rounded border-border-subtle bg-white/5 text-white focus:ring-white/10"
              />
              <label htmlFor="packaging" className="text-sm font-medium text-white/70">Packaging Ordered</label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Internal notes or instructions..."
              className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all min-h-[100px]"
            />
          </div>

          <div className="pt-4">
            <button
              disabled={mutation.isPending}
              className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="animate-spin" /> : 'Submit Purchase Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
