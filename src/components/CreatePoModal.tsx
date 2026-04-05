import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';

interface LineItem {
  skuId: string;
  orderQuantity: string;
}

export interface PrefillItem {
  skuId: string;
  skuCode: string;
  suggestedQty: number;
}

interface CreatePoModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillItems?: PrefillItem[];
}

export default function CreatePoModal({ isOpen, onClose, prefillItems }: CreatePoModalProps) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [poNumber, setPoNumber] = React.useState('');
  const [supplierId, setSupplierId] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [lineItems, setLineItems] = React.useState<LineItem[]>([{ skuId: '', orderQuantity: '' }]);
  const [hasAppliedPrefill, setHasAppliedPrefill] = React.useState(false);

  // Auto-populate line items from reorder queue selections
  React.useEffect(() => {
    if (isOpen && prefillItems && prefillItems.length > 0 && !hasAppliedPrefill) {
      setLineItems(
        prefillItems.map(item => ({
          skuId: item.skuId,
          orderQuantity: String(item.suggestedQty),
        }))
      );
      setHasAppliedPrefill(true);
    }
    if (!isOpen) {
      setHasAppliedPrefill(false);
    }
  }, [isOpen, prefillItems, hasAppliedPrefill]);

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

  const addLine = () => {
    setLineItems([...lineItems, { skuId: '', orderQuantity: '' }]);
  };

  const removeLine = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof LineItem, value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const resetForm = () => {
    setPoNumber('');
    setSupplierId('');
    setNotes('');
    setLineItems([{ skuId: '', orderQuantity: '' }]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post('/api/v1/purchase-orders/bulk', {
        poNumber,
        supplierId,
        notes,
        lineItems: lineItems.map(li => ({
          skuId: li.skuId,
          orderQuantity: parseInt(li.orderQuantity),
        })),
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      onClose();
      resetForm();
    }
  });

  const canSubmit = poNumber && supplierId && lineItems.every(li => li.skuId && li.orderQuantity && parseInt(li.orderQuantity) > 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-bg-card border border-border-subtle w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-border-subtle flex items-center justify-between flex-shrink-0">
          <h3 className="text-xl font-bold tracking-tight">Create Purchase Order</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); if (canSubmit) mutation.mutate(); }} className="p-6 space-y-6 overflow-y-auto">
          {mutation.isError && (
            <div className="bg-critical/10 border border-critical/20 p-4 rounded-xl text-critical text-sm font-medium">
              Failed to submit PO. Please check your inputs and try again.
            </div>
          )}

          {/* PO Header */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">PO Number</label>
              <input
                required
                value={poNumber}
                onChange={e => setPoNumber(e.target.value)}
                placeholder="e.g. PO-2024-001"
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Supplier</label>
              <select
                required
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all appearance-none"
              >
                <option value="" disabled className="bg-bg-card">Select Supplier</option>
                {suppliers?.map((s: any) => (
                  <option key={s.id} value={s.id} className="bg-bg-card">{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Line Items</label>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1.5 text-xs font-bold text-white/50 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-border-subtle transition-all"
              >
                <Plus size={14} />
                Add SKU
              </button>
            </div>

            <div className="space-y-2">
              {lineItems.map((line, index) => (
                <div key={index} className="flex items-center gap-3 bg-white/[0.02] border border-border-subtle rounded-xl p-3">
                  <div className="flex-1">
                    <select
                      required
                      value={line.skuId}
                      onChange={e => updateLine(index, 'skuId', e.target.value)}
                      className="w-full bg-white/5 border border-border-subtle rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all appearance-none"
                    >
                      <option value="" disabled className="bg-bg-card">Select SKU</option>
                      {skus?.map((s: any) => (
                        <option key={s.id} value={s.id} className="bg-bg-card">{s.skuCode} - {s.productDescription}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <input
                      required
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={line.orderQuantity}
                      onChange={e => updateLine(index, 'orderQuantity', e.target.value)}
                      className="w-full bg-white/5 border border-border-subtle rounded-lg py-2.5 px-3 text-sm text-white text-right font-mono focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    disabled={lineItems.length <= 1}
                    className="p-2 rounded-lg hover:bg-critical/20 text-white/20 hover:text-critical transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* PO Notes */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">PO Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes to this purchase order (will appear on the PO document)..."
              className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all min-h-[80px]"
            />
          </div>

          <div className="pt-4">
            <button
              disabled={mutation.isPending || !canSubmit}
              className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="animate-spin" /> : `Submit Purchase Order (${lineItems.length} item${lineItems.length > 1 ? 's' : ''})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
