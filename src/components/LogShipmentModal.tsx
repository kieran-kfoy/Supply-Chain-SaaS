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
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 520 }}>
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 className="text-[16px] font-bold tracking-tight">Log Shipment</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Purchase Order</label>
              <select required value={formData.poId} onChange={e => setFormData({ ...formData, poId: e.target.value })} className="input-field">
                <option value="" disabled className="bg-[#0F1521]">Select PO</option>
                {pos?.map((po: any) => <option key={po.id} value={po.id} className="bg-[#0F1521]">{po.poNumber} ({po.sku.skuCode})</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Ship Date</label>
              <input required type="date" value={formData.shipDate} onChange={e => setFormData({ ...formData, shipDate: e.target.value })} className="input-field" />
            </div>
          </div>

          <div>
            <label className="field-label">Units Shipped</label>
            <input required type="number" value={formData.unitsShipped} onChange={e => setFormData({ ...formData, unitsShipped: e.target.value })} className="input-field" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Tracking Number</label>
              <input value={formData.trackingNumber} onChange={e => setFormData({ ...formData, trackingNumber: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="field-label">Freight Carrier</label>
              <input value={formData.freightCarrier} onChange={e => setFormData({ ...formData, freightCarrier: e.target.value })} placeholder="FedEx, Maersk…" className="input-field" />
            </div>
          </div>

          <button type="submit" disabled={mutation.isPending} className="btn-primary w-full justify-center py-3 rounded-xl mt-2 disabled:opacity-50">
            {mutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : 'Log Shipment'}
          </button>
        </form>
      </div>
    </div>
  );
}
