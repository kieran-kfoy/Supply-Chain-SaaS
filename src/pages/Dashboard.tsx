import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import SkuHealthTable from '../components/SkuHealthTable';
import { Package, AlertTriangle, ShoppingCart, Calendar } from 'lucide-react';
import { motion } from 'motion/react';

export default function Dashboard() {
  const token = useAuthStore((state) => state.token);

  const { data: summary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/dashboard/summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.data;
    }
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

  const stats = [
    { label: 'Total SKUs', value: summary?.totalSkus ?? 0, icon: Package, color: 'text-blue-500' },
    { label: 'Critical SKUs', value: summary?.criticalSkus ?? 0, icon: AlertTriangle, color: 'text-critical' },
    { label: 'Open POs', value: summary?.openPos ?? 0, icon: ShoppingCart, color: 'text-amber-500' },
    { label: 'Next OOS', value: summary?.nextOosDate ? new Date(summary.nextOosDate).toLocaleDateString() : 'None', icon: Calendar, color: 'text-emerald-500' },
  ];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Operations Overview</h2>
          <p className="text-white/50 mt-1">Real-time supply chain intelligence</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-white/30 uppercase font-bold tracking-widest">Last Synced</p>
            <p className="text-sm font-medium">2 minutes ago</p>
          </div>
          <button className="bg-white text-black px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-white/90 transition-all">
            Sync Data
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-bg-card border border-border-subtle p-6 rounded-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <stat.icon className={stat.color} size={20} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Live</span>
            </div>
            <div>
              <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
              <p className="text-sm text-white/50 font-medium">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold tracking-tight">SKU Health Monitoring</h3>
          <button className="text-sm text-white/50 hover:text-white transition-colors">View all SKUs →</button>
        </div>
        <SkuHealthTable data={skus ?? []} />
      </section>
    </div>
  );
}
