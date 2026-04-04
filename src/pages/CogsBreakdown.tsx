import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { ArrowLeft, Download, DollarSign } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx } from 'clsx';

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

export default function CogsBreakdown() {
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();

  const { data: skus = [], isLoading } = useQuery({
    queryKey: ['inventory-skus'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/inventory/skus', { headers: { Authorization: `Bearer ${token}` } });
      return res.data.data;
    }
  });

  const skusWithValue = skus
    .map((s: any) => {
      const qty = s.latestSnapshot?.availableQuantity ?? 0;
      const cost = s.unitCost ?? 0;
      const totalCogs = qty * cost;
      return { ...s, qty, cost, totalCogs };
    })
    .filter((s: any) => s.qty > 0)
    .sort((a: any, b: any) => b.totalCogs - a.totalCogs);

  const grandTotal = skusWithValue.reduce((sum: number, s: any) => sum + s.totalCogs, 0);

  const fmt$ = (n: number) => n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n.toFixed(2)}`;

  const handleExport = () => {
    if (!skusWithValue.length) return;
    const headers = ['SKU', 'Product', 'Available Qty', 'Unit Cost', 'Total COGS', '% of Total'];
    const rows = skusWithValue.map((s: any) => [
      s.skuCode,
      s.productDescription,
      s.qty,
      `$${s.cost.toFixed(2)}`,
      `$${s.totalCogs.toFixed(2)}`,
      grandTotal > 0 ? `${((s.totalCogs / grandTotal) * 100).toFixed(1)}%` : '0%',
    ]);
    rows.push(['', '', '', 'TOTAL', `$${grandTotal.toFixed(2)}`, '100%']);
    downloadCsv('cogs-breakdown.csv', headers, rows);
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-xl bg-white/5 border border-border-subtle flex items-center justify-center hover:bg-white/10 transition-all"
          >
            <ArrowLeft size={18} className="text-white/50" />
          </button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Inventory Cost Breakdown</h2>
            <p className="text-white/50 mt-1">COGS by SKU — total stock on hand at cost</p>
          </div>
        </motion.div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-white/5 border border-border-subtle px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/10 transition-all"
        >
          <Download size={16} />
          Export CSV
        </button>
      </header>

      {/* Summary card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <DollarSign className="text-emerald-400 w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight">{fmt$(grandTotal)}</p>
          <p className="text-sm text-white/50 font-medium mt-0.5">Total Inventory Cost (COGS)</p>
        </div>
        <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
          <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">SKUs in Stock</p>
          <p className="text-3xl font-bold tracking-tight">{skusWithValue.length}</p>
        </div>
        <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
          <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">Total Units</p>
          <p className="text-3xl font-bold tracking-tight">
            {skusWithValue.reduce((sum: number, s: any) => sum + s.qty, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* COGS Table */}
      <div className="bg-bg-card border border-border-subtle rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="data-table-header">SKU</th>
              <th className="data-table-header">Product</th>
              <th className="data-table-header text-right">Available Qty</th>
              <th className="data-table-header text-right">Unit Cost</th>
              <th className="data-table-header text-right">Total COGS</th>
              <th className="data-table-header text-right">% of Total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-white/30">Loading...</td>
              </tr>
            )}
            {skusWithValue.map((sku: any, i: number) => {
              const pct = grandTotal > 0 ? (sku.totalCogs / grandTotal) * 100 : 0;
              return (
                <tr
                  key={sku.id}
                  className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                  onClick={() => navigate(`/inventory/${sku.id}`)}
                >
                  <td className="data-table-cell font-mono font-bold">{sku.skuCode}</td>
                  <td className="data-table-cell text-white/70 truncate max-w-[250px]">{sku.productDescription}</td>
                  <td className="data-table-cell text-right font-mono">{sku.qty.toLocaleString()}</td>
                  <td className="data-table-cell text-right font-mono">${sku.cost.toFixed(2)}</td>
                  <td className="data-table-cell text-right font-mono font-bold">${sku.totalCogs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="data-table-cell text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-white/50 w-12 text-right">{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!isLoading && skusWithValue.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-white/30 italic">No inventory on hand</td>
              </tr>
            )}
          </tbody>
          {skusWithValue.length > 0 && (
            <tfoot>
              <tr className="border-t border-border-subtle bg-white/[0.02]">
                <td className="data-table-cell font-bold" colSpan={2}>Total</td>
                <td className="data-table-cell text-right font-mono font-bold">
                  {skusWithValue.reduce((sum: number, s: any) => sum + s.qty, 0).toLocaleString()}
                </td>
                <td className="data-table-cell"></td>
                <td className="data-table-cell text-right font-mono font-bold">
                  ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="data-table-cell text-right font-mono font-bold text-white/50">100%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
