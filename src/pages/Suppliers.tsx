import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { Users, Mail, MapPin, Package, ShoppingCart, TrendingUp, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx } from 'clsx';
import CreateSupplierModal from '../components/CreateSupplierModal';

export default function Suppliers() {
  const token = useAuthStore((state) => state.token);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/suppliers', {
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
          <h2 className="text-3xl font-bold tracking-tight">Supplier Network</h2>
          <p className="text-white/50 mt-1">Manage global production partners and performance</p>
        </motion.div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-white text-black px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-white/90 transition-all flex items-center gap-2"
        >
          <Plus size={18} />
          Onboard Supplier
        </button>
      </header>

      <CreateSupplierModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers?.map((supplier: any, i: number) => (
          <motion.div
            key={supplier.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-bg-card border border-border-subtle p-6 rounded-2xl space-y-6 hover:border-white/20 transition-all group cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="text-xl font-bold tracking-tight group-hover:text-white transition-colors">{supplier.name}</h3>
                <div className="flex items-center gap-2 text-xs text-white/40 font-medium">
                  <span className={clsx(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight",
                    supplier.productionType === 'manufacturer' ? 'bg-blue-500/10 text-blue-500' : 
                    supplier.productionType === 'packaging' ? 'bg-amber-500/10 text-amber-500' :
                    supplier.productionType === 'ingredients' ? 'bg-emerald-500/10 text-emerald-500' :
                    'bg-white/10 text-white/50'
                  )}>
                    {supplier.productionType}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-white/10 transition-colors">
                <Users className="text-white/40 group-hover:text-white w-5 h-5 transition-colors" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-white/60">
                <Mail size={14} className="text-white/20" />
                <span>{supplier.contactEmail ?? 'No email on file'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-white/60">
                <Users size={14} className="text-white/20" />
                <span className="truncate">{supplier.contactName ?? 'No contact person'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase font-bold tracking-widest">
                  <Package size={10} />
                  SKUs
                </div>
                <p className="text-lg font-bold font-mono">{supplier._count.skus}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase font-bold tracking-widest">
                  <ShoppingCart size={10} />
                  Active POs
                </div>
                <p className="text-lg font-bold font-mono">{supplier._count.purchaseOrders}</p>
              </div>
            </div>
          </motion.div>
        ))}
        {(!suppliers || suppliers.length === 0) && (
          <div className="col-span-full py-20 text-center bg-bg-card border border-border-subtle border-dashed rounded-2xl">
            <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/50 font-medium">No suppliers onboarded</p>
            <button className="mt-4 text-sm text-white/80 hover:text-white underline underline-offset-4">
              Add your first supplier
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
