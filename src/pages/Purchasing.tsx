import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { ShoppingCart, AlertTriangle, Calendar, CheckCircle2, Clock, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import CreatePoModal from '../components/CreatePoModal';

export default function Purchasing() {
  const token = useAuthStore((state) => state.token);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const { data: pos } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/purchase-orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.data;
    }
  });

  const { data: reorderQueue } = useQuery({
    queryKey: ['reorder-queue'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/inventory/reorder-queue', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.data;
    }
  });

  const statusColors = {
    'OPEN': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'IN PRODUCTION': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'SHIPPED': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'COMPLETE': 'bg-white/10 text-white/50 border-white/20',
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2 className="text-3xl font-bold tracking-tight">Purchasing & Procurement</h2>
          <p className="text-white/50 mt-1">Manage purchase orders and reorder triggers</p>
        </motion.div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-white text-black px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-white/90 transition-all flex items-center gap-2"
        >
          <Plus size={18} />
          Create New PO
        </button>
      </header>

      <CreatePoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold tracking-tight">Active Purchase Orders</h3>
            <div className="flex items-center gap-2 text-xs text-white/30 font-bold uppercase tracking-widest">
              <Clock size={12} />
              Updated just now
            </div>
          </div>

          <div className="bg-bg-card border border-border-subtle rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="data-table-header">PO #</th>
                  <th className="data-table-header">SKU</th>
                  <th className="data-table-header">Supplier</th>
                  <th className="data-table-header">Quantity</th>
                  <th className="data-table-header">Status</th>
                  <th className="data-table-header">Expected</th>
                </tr>
              </thead>
              <tbody>
                {pos?.map((po: any) => (
                  <tr key={po.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="data-table-cell font-mono font-bold">{po.poNumber}</td>
                    <td className="data-table-cell">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs">{po.sku.skuCode}</span>
                        <span className="text-[10px] text-white/40 truncate max-w-[120px]">{po.sku.productDescription}</span>
                      </div>
                    </td>
                    <td className="data-table-cell text-white/80">{po.supplier.name}</td>
                    <td className="data-table-cell font-mono">{po.orderQuantity.toLocaleString()}</td>
                    <td className="data-table-cell">
                      <span className={clsx(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight border",
                        statusColors[po.status as keyof typeof statusColors]
                      )}>
                        {po.status}
                      </span>
                    </td>
                    <td className="data-table-cell font-mono text-white/50">
                      {po.expectedArrival ? format(new Date(po.expectedArrival), 'MMM d') : 'TBD'}
                    </td>
                  </tr>
                ))}
                {(!pos || pos.length === 0) && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-white/30 italic">No active purchase orders</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold tracking-tight">Reorder Queue</h3>
            <span className="bg-critical text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {reorderQueue?.length ?? 0}
            </span>
          </div>

          <div className="space-y-4">
            {reorderQueue?.map((item: any, i: number) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-bg-card border border-border-subtle p-4 rounded-xl space-y-3 hover:border-white/20 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-sm font-bold">{item.sku.skuCode}</p>
                    <p className="text-[10px] text-white/40">{item.sku.productDescription}</p>
                  </div>
                  <AlertTriangle className={clsx(
                    "w-4 h-4",
                    item.reorderStatus === 'CRITICAL' ? 'text-critical' : 'text-reorder'
                  )} />
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                  <div>
                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Available</p>
                    <p className="text-sm font-bold font-mono">{item.availableQuantity}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Days Left</p>
                    <p className="text-sm font-bold font-mono">{Math.round(item.daysInStock)}</p>
                  </div>
                </div>

                <button className="w-full py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                  Generate PO Draft
                </button>
              </motion.div>
            ))}
            {(!reorderQueue || reorderQueue.length === 0) && (
              <div className="bg-bg-card border border-border-subtle border-dashed p-8 rounded-xl text-center">
                <CheckCircle2 className="w-8 h-8 text-healthy mx-auto mb-2 opacity-50" />
                <p className="text-xs text-white/30 font-medium">Reorder queue is clear</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
