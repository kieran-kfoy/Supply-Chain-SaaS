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

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/suppliers', {
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
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 560 }}>
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 className="text-[16px] font-bold tracking-tight">Create Purchase Order</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="p-6 space-y-4">
          {mutation.isError && (
            <div className="p-3.5 rounded-xl text-[13px] font-medium" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171' }}>
              Failed to submit PO. Please check your inputs and try again.
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">PO Number</label>
              <input required value={formData.poNumber} onChange={e => setFormData({ ...formData, poNumber: e.target.value })} placeholder="PO-2024-001" className="input-field" />
            </div>
            <div>
              <label className="field-label">SKU</label>
              <select required value={formData.skuId} onChange={e => setFormData({ ...formData, skuId: e.target.value })} className="input-field">
                <option value="" disabled className="bg-[#0F1521]">Select SKU</option>
                {skus?.map((s: any) => <option key={s.id} value={s.id} className="bg-[#0F1521]">{s.skuCode} — {s.productDescription}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label">Supplier</label>
            <select required value={formData.supplierId} onChange={e => setFormData({ ...formData, supplierId: e.target.value })} className="input-field">
              <option value="" disabled className="bg-[#0F1521]">Select Supplier</option>
              {suppliers?.map((s: any) => <option key={s.id} value={s.id} className="bg-[#0F1521]">{s.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Order Quantity</label>
              <input required type="number" value={formData.orderQuantity} onChange={e => setFormData({ ...formData, orderQuantity: e.target.value })} className="input-field" />
            </div>
            <div className="flex items-center gap-2.5 pt-6">
              <input type="checkbox" id="packaging" checked={formData.packagingOrdered} onChange={e => setFormData({ ...formData, packagingOrdered: e.target.checked })} className="w-4 h-4 accent-indigo-500 cursor-pointer" />
              <label htmlFor="packaging" className="text-[13px] font-medium cursor-pointer" style={{ color: 'rgba(255,255,255,0.6)' }}>Packaging Ordered</label>
            </div>
          </div>

          <div>
            <label className="field-label">Notes</label>
            <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Internal notes or instructions..." className="input-field min-h-[80px] resize-none" />
          </div>

          <button type="submit" disabled={mutation.isPending} className="btn-primary w-full justify-center py-3 rounded-xl mt-2 disabled:opacity-50">
            {mutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : 'Submit Purchase Order'}
          </button>
        </form>
      </div>
    </div>
  );
}
