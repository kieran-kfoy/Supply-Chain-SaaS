import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { Truck, Package, ShoppingCart, Calendar, CheckCircle2, AlertCircle, Search, Filter, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import LogShipmentModal from '../components/LogShipmentModal';

export default function FinishedGoodsLog() {
  const token = useAuthStore((state) => state.token);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const { data: shipments } = useQuery({
    queryKey: ['shipments'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/shipments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.data;
    }
  });

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2 className="text-3xl font-bold tracking-tight">Finished Goods Shipping Log</h2>
          <p className="text-white/50 mt-1">Track production completion and warehouse transit</p>
        </motion.div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-white text-black px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-white/90 transition-all flex items-center gap-2"
        >
          <Plus size={18} />
          Log New Shipment
        </button>
      </header>

      <LogShipmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
            <Truck className="text-blue-500 w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">In Transit</p>
            <p className="text-2xl font-bold tracking-tight">{shipments?.filter((s: any) => !s.received).length ?? 0}</p>
          </div>
        </div>
        <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="text-emerald-500 w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">Received (30d)</p>
            <p className="text-2xl font-bold tracking-tight">{shipments?.filter((s: any) => s.received).length ?? 0}</p>
          </div>
        </div>
        <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-critical/10 rounded-xl flex items-center justify-center">
            <AlertCircle className="text-critical w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">Discrepancies</p>
            <p className="text-2xl font-bold tracking-tight">{shipments?.filter((s: any) => s.discrepancyFlag).length ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="bg-bg-card border border-border-subtle rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border-subtle flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search shipments, ASNs, tracking..."
              className="w-full bg-white/5 border border-border-subtle rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-border-subtle rounded-xl text-sm font-medium hover:bg-white/10 transition-all">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="data-table-header">Ship Date</th>
                <th className="data-table-header">ASN / Tracking</th>
                <th className="data-table-header">PO #</th>
                <th className="data-table-header">SKU</th>
                <th className="data-table-header">Units</th>
                <th className="data-table-header">Status</th>
                <th className="data-table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shipments?.map((shipment: any) => (
                <tr key={shipment.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="data-table-cell font-mono text-white/60">
                    {format(new Date(shipment.shipDate), 'MMM d, yyyy')}
                  </td>
                  <td className="data-table-cell">
                    <div className="flex flex-col">
                      <span className="font-mono font-bold text-sm">{shipment.asnNumber ?? 'NO ASN'}</span>
                      <span className="text-[10px] text-white/30 font-mono">{shipment.trackingNumber ?? 'No Tracking'}</span>
                    </div>
                  </td>
                  <td className="data-table-cell font-mono text-white/80">{shipment.po?.poNumber ?? 'N/A'}</td>
                  <td className="data-table-cell">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs">{shipment.sku.skuCode}</span>
                      <span className="text-[10px] text-white/40 truncate max-w-[120px]">{shipment.sku.productDescription}</span>
                    </div>
                  </td>
                  <td className="data-table-cell font-mono font-bold">{shipment.unitsShipped.toLocaleString()}</td>
                  <td className="data-table-cell">
                    <span className={clsx(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight border",
                      shipment.received 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                        : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                    )}>
                      {shipment.received ? 'Received' : 'In Transit'}
                    </span>
                  </td>
                  <td className="data-table-cell">
                    <button className={clsx(
                      "text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all",
                      shipment.received 
                        ? 'text-white/20 cursor-not-allowed' 
                        : 'bg-white text-black hover:bg-white/90'
                    )}>
                      Receive
                    </button>
                  </td>
                </tr>
              ))}
              {(!shipments || shipments.length === 0) && (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <Truck className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <p className="text-white/50 font-medium">No inbound shipments tracked</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
