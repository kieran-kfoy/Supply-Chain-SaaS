import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';

interface ComponentLine {
  skuId: string;
  quantity: string;
}

interface CreateBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateBundleModal({ isOpen, onClose }: CreateBundleModalProps) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [bundleSkuId, setBundleSkuId] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [components, setComponents] = React.useState<ComponentLine[]>([{ skuId: '', quantity: '1' }]);

  // Fetch ALL active SKUs (including bundles) so user can pick which one to designate as a bundle
  const { data: allSkus } = useQuery({
    queryKey: ['all-skus-for-bundles'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/inventory/skus?includeAll=true', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.data;
    },
    enabled: isOpen,
  });

  // For the bundle SKU dropdown: show SKUs that aren't already bundles
  // For component dropdowns: show SKUs that aren't the selected bundle SKU
  const bundleSkuOptions = allSkus?.filter((s: any) => !s.isBundle) || [];
  const componentSkuOptions = allSkus?.filter((s: any) => s.id !== bundleSkuId && !s.isBundle) || [];

  const addComponent = () => {
    setComponents([...components, { skuId: '', quantity: '1' }]);
  };

  const removeComponent = (index: number) => {
    if (components.length <= 1) return;
    setComponents(components.filter((_, i) => i !== index));
  };

  const updateComponent = (index: number, field: keyof ComponentLine, value: string) => {
    const updated = [...components];
    updated[index] = { ...updated[index], [field]: value };
    setComponents(updated);
  };

  const resetForm = () => {
    setBundleSkuId('');
    setNotes('');
    setComponents([{ skuId: '', quantity: '1' }]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post('/api/v1/bundles', {
        skuId: bundleSkuId,
        notes,
        components: components.map(c => ({
          skuId: c.skuId,
          quantity: parseInt(c.quantity),
        })),
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-skus'] });
      queryClient.invalidateQueries({ queryKey: ['all-skus-for-bundles'] });
      onClose();
      resetForm();
    }
  });

  const canSubmit = bundleSkuId && components.every(c => c.skuId && c.quantity && parseInt(c.quantity) > 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-bg-card border border-border-subtle w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-border-subtle flex items-center justify-between flex-shrink-0">
          <h3 className="text-xl font-bold tracking-tight">Create Bundle</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); if (canSubmit) mutation.mutate(); }} className="p-6 space-y-6 overflow-y-auto">
          {mutation.isError && (
            <div className="bg-critical/10 border border-critical/20 p-4 rounded-xl text-critical text-sm font-medium">
              Failed to create bundle. Please check your inputs and try again.
            </div>
          )}

          {/* Bundle SKU Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Bundle SKU</label>
            <select
              required
              value={bundleSkuId}
              onChange={e => setBundleSkuId(e.target.value)}
              className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all appearance-none"
            >
              <option value="" disabled className="bg-bg-card">Select the bundle SKU</option>
              {bundleSkuOptions.map((s: any) => (
                <option key={s.id} value={s.id} className="bg-bg-card">{s.skuCode} — {s.productDescription}</option>
              ))}
            </select>
            <p className="text-xs text-white/30 ml-1">This SKU will be removed from the Inventory tab and tracked as a bundle.</p>
          </div>

          {/* Component Products */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Component Products</label>
              <button
                type="button"
                onClick={addComponent}
                className="flex items-center gap-1.5 text-xs font-bold text-white/50 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-border-subtle transition-all"
              >
                <Plus size={14} />
                Add Product
              </button>
            </div>
            <p className="text-xs text-white/30 ml-1">Select the individual products contained in this bundle and specify the quantity of each.</p>

            <div className="space-y-2">
              {components.map((comp, index) => (
                <div key={index} className="flex items-center gap-3 bg-white/[0.02] border border-border-subtle rounded-xl p-3">
                  <div className="flex-1">
                    <select
                      required
                      value={comp.skuId}
                      onChange={e => updateComponent(index, 'skuId', e.target.value)}
                      className="w-full bg-white/5 border border-border-subtle rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all appearance-none"
                    >
                      <option value="" disabled className="bg-bg-card">Select Product</option>
                      {componentSkuOptions.map((s: any) => (
                        <option key={s.id} value={s.id} className="bg-bg-card">{s.skuCode} — {s.productDescription}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <input
                      required
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={comp.quantity}
                      onChange={e => updateComponent(index, 'quantity', e.target.value)}
                      className="w-full bg-white/5 border border-border-subtle rounded-lg py-2.5 px-3 text-sm text-white text-right font-mono focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeComponent(index)}
                    disabled={components.length <= 1}
                    className="p-2 rounded-lg hover:bg-critical/20 text-white/20 hover:text-critical transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes about this bundle..."
              className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all min-h-[80px]"
            />
          </div>

          <div className="pt-4">
            <button
              disabled={mutation.isPending || !canSubmit}
              className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="animate-spin" /> : `Create Bundle (${components.length} product${components.length > 1 ? 's' : ''})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
