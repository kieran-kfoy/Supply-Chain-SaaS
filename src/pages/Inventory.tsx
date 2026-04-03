import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import SkuHealthTable from '../components/SkuHealthTable';
import CreateSkuModal from '../components/CreateSkuModal';
import { Package, Download, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

export default function Inventory() {
  const token = useAuthStore((state) => state.token);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const { data: skus, isLoading } = useQuery({
    queryKey: ['inventory-skus'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/inventory/skus', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.data;
    }
  });

  const totalSkus = skus?.length ?? 0;
  const activeSkus = skus?.filter((s: any) => s.isActive).length ?? 0;
  const criticalCount = skus?.filter((s: any) => s.latestSnapshot?.reorderStatus === 'CRITICAL').length ?? 0;

  return (
    <div className="p-8 space-y-7 max-w-7xl mx-auto page-enter">

      {/* Header */}
      <header className="page-header">
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: [0.16,1,0.3,1] }}>
          <h2 className="page-title">Inventory</h2>
          <p className="page-subtitle">Monitor stock levels, velocity &amp; reorder status</p>
        </motion.div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary">
            <Download size={15} />
            Export
          </button>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary">
            <Package size={15} />
            Add SKU
          </button>
        </div>
      </header>

      <CreateSkuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total SKUs', value: totalSkus, color: '#6366F1' },
          { label: 'Active SKUs', value: activeSkus, color: '#34D399' },
          { label: 'Critical Stock', value: criticalCount, color: criticalCount > 0 ? '#F87171' : '#34D399' },
        ].map(({ label, value, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.35, ease: [0.16,1,0.3,1] }}
            className="stat-card"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${color}50, transparent)` }} />
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
            <p className="text-[30px] font-bold tracking-tight font-mono" style={{ color }}>{value}</p>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <SkuHealthTable data={skus ?? []} />
      </motion.section>
    </div>
  );
}
