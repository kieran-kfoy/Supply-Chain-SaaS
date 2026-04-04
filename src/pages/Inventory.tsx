import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import SkuHealthTable from '../components/SkuHealthTable';
import CreateSkuModal from '../components/CreateSkuModal';
import { Package, Search, Filter, Download } from 'lucide-react';
import { motion } from 'motion/react';

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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

  const handleExport = () => {
    if (!skus?.length) return;
    const headers = ['SKU Code', 'Description', 'Available Qty', 'Unit Cost', 'Selling Price', 'Reorder Status', 'Active'];
    const rows = skus.map((s: any) => [
      s.skuCode,
      s.productDescription,
      s.latestSnapshot?.availableQuantity ?? 0,
      s.unitCost ?? 0,
      s.sellingPrice ?? 0,
      s.latestSnapshot?.reorderStatus ?? 'N/A',
      s.isActive ? 'Yes' : 'No',
    ]);
    downloadCsv('inventory-export.csv', headers, rows);
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2 className="text-3xl font-bold tracking-tight">Inventory Management</h2>
          <p className="text-white/50 mt-1">Monitor stock levels and reorder statuses</p>
        </motion.div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-white/5 border border-border-subtle px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/10 transition-all"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-white text-black px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-white/90 transition-all"
          >
            Add New SKU
          </button>
        </div>
      </header>

      <CreateSkuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
          <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">Total SKUs</p>
          <p className="text-3xl font-bold tracking-tight">{skus?.length ?? 0}</p>
        </div>
        <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
          <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">Active SKUs</p>
          <p className="text-3xl font-bold tracking-tight">{skus?.filter((s: any) => s.isActive).length ?? 0}</p>
        </div>
        <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
          <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">Critical Stock</p>
          <p className="text-3xl font-bold tracking-tight text-critical">
            {skus?.filter((s: any) => s.latestSnapshot?.reorderStatus === 'CRITICAL').length ?? 0}
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <SkuHealthTable data={skus ?? []} />
      </section>
    </div>
  );
}
