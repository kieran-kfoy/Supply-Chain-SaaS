import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { X, Loader2, Calendar } from 'lucide-react';

interface LogShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LogShipmentModal({ isOpen, onClose }: LogShipmentModalProps) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({
    poId: '',
    skuId: '',
    unitsShipped: '',
    shipDate: new Date().toISOString().split('T')[0],
    asnNumber: '',
    trackingNumber: '',
    freightCarrier: '',
  });

  const { data: pos } = useQuery({
    queryKey: ['open-purchase-orders'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/purchase-orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.data.filter((po: any) => po.status === 'OPEN' || po.status === 'IN PRODUCTION');
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await axios.post('/api/v1/shipments', data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      onClose();
      setFormData({
        poId: '',
        skuId: '',
        unitsShipped: '',
        shipDate: new Date().toISOString().split('T')[0],
        asnNumber: '',
        trackingNumber: '',
        freightCarrier: '',
      });
    }
  });

  const selectedPo = pos?.find((po: any) => po.id === formData.poId);

  React.useEffect(() => {
    if (selectedPo) {
      setFormData(prev => ({ ...prev, skuId: selectedPo.skuId, unitsShipped: selectedPo.orderQuantity.toString() }));
    }
  }, [selectedPo]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-bg-card border border-border-subtle w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-border-subtle flex items-center justify-between">
          <h3 className="text-xl font-bold tracking-tight">Log Finished Goods Shipment</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Purchase Order</label>
              <select
                required
                value={formData.poId}
                onChange={e => setFormData({ ...formData, poId: e.target.value })}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all appearance-none"
              >
                <option value="" disabled className="bg-bg-card">Select PO</option>
                {pos?.map((po: any) => (
                  <option key={po.id} value={po.id} className="bg-bg-card">{po.poNumber} ({po.sku.skuCode})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Ship Date</label>
              <div className="relative">
                <input
                  required
                  type="date"
                  value={formData.shipDate}
                  onChange={e => setFormData({ ...formData, shipDate: e.target.value })}
                  className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Units Shipped</label>
              <input
                required
                type="number"
                value={formData.unitsShipped}
                onChange={e => setFormData({ ...formData, unitsShipped: e.target.value })}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">ASN Number</label>
              <input
                required
                value={formData.asnNumber}
                onChange={e => setFormData({ ...formData, asnNumber: e.target.value })}
                placeholder="e.g. ASN-9988"
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Tracking Number</label>
              <input
                value={formData.trackingNumber}
                onChange={e => setFormData({ ...formData, trackingNumber: e.target.value })}
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Freight Carrier</label>
              <input
                value={formData.freightCarrier}
                onChange={e => setFormData({ ...formData, freightCarrier: e.target.value })}
                placeholder="e.g. FedEx, Maersk"
                className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              disabled={mutation.isPending}
              className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="animate-spin" /> : 'Log Shipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
