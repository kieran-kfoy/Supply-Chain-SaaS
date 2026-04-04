import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';

interface LineItem {
  poId: string;
  skuId: string;
  unitsShipped: string;
}

interface LogShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LogShipmentModal({ isOpen, onClose }: LogShipmentModalProps) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [shipDate, setShipDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [trackingNumber, setTrackingNumber] = React.useState('');
  const [freightCarrier, setFreightCarrier] = React.useState('');
  const [lineItems, setLineItems] = React.useState<LineItem[]>([{ poId: '', skuId: '', unitsShipped: '' }]);

  const { data: pos } = useQuery({
    queryKey: ['open-purchase-orders'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/purchase-orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.data.filter((po: any) => po.status === 'OPEN' || po.status === 'IN PRODUCTION');
    }
  });

  const addLine = () => {
    setLineItems([...lineItems, { poId: '', skuId: '', unitsShipped: '' }]);
  };

  const removeLine = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof LineItem, value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-fill skuId and units when PO is selected
    if (field === 'poId' && value) {
      const selectedPo = pos?.find((po: any) => po.id === value);
      if (selectedPo) {
        updated[index].skuId = selectedPo.skuId;
        updated[index].unitsShipped = selectedPo.orderQuantity.toString();
      }
    }

    setLineItems(updated);
  };

  const resetForm = () => {
    setShipDate(new Date().toISOString().split('T')[0]);
    setTrackingNumber('');
    setFreightCarrier('');
    setLineItems([{ poId: '', skuId: '', unitsShipped: '' }]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post('/api/v1/shipments/bulk', {
        shipDate,
        trackingNumber,
        freightCarrier,
        lineItems: lineItems.map(li => ({
          poId: li.poId,
          skuId: li.skuId,
          unitsShipped: li.unitsShipped,
        })),
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      onClose();
      resetForm();
    }
  });

  const canSubmit = shipDate && lineItems.every(li => li.poId && li.unitsShipped && parseInt(li.unitsShipped) > 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-bg-card border border-border-subtle w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-border-subtle flex items-center justify-between flex-shrink-0">
          <h3 className="text-xl font-bold tracking-tight">Log Finished Goods Shipment</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); if (canSubmit) mutation.mutate(); }} className="p-6 space-y-6 overflow-y-auto">
          {mutation.isError && (
            <div className="bg-critical/10 border border-critical/20 p-4 rounded-xl text-critical text-sm font-medium">
              Failed to log shipment. Please check your inputs and try again.
            </div>
          )}

          {/* Ship Date, Tracking, Carrier */}
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Ship Date</label>
              <input
                required
                type="date"
                value={shipDate}
                onChange={e => setShipDate(e.target.value)}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Tracking Number</label>
              <input
                value={trackingNumber}
                onChange={e => setTrackingNumber(e.target.value)}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Freight Carrier</label>
              <input
                value={freightCarrier}
                onChange={e => setFreightCarrier(e.target.value)}
                placeholder="e.g. FedEx, Maersk"
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
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
                Add PO
              </button>
            </div>

            <div className="space-y-2">
              {lineItems.map((line, index) => (
                <div key={index} className="flex items-center gap-3 bg-white/[0.02] border border-border-subtle rounded-xl p-3">
                  <div className="flex-1">
                    <select
                      required
                      value={line.poId}
                      onChange={e => updateLine(index, 'poId', e.target.value)}
                      className="w-full bg-white/5 border border-border-subtle rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all appearance-none"
                    >
                      <option value="" disabled className="bg-bg-card">Select PO</option>
                      {pos?.map((po: any) => (
                        <option key={po.id} value={po.id} className="bg-bg-card">{po.poNumber} ({po.sku.skuCode})</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <input
                      required
                      type="number"
                      min="1"
                      placeholder="Units"
                      value={line.unitsShipped}
                      onChange={e => updateLine(index, 'unitsShipped', e.target.value)}
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

          <div className="pt-4">
            <button
              disabled={mutation.isPending || !canSubmit}
              className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="animate-spin" /> : `Log Shipment (${lineItems.length} item${lineItems.length > 1 ? 's' : ''})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
