import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Download, DollarSign, TrendingUp, Package, BarChart3, ArrowUpRight, ArrowDownRight, ArrowUpDown } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx } from 'clsx';

type SortDir = 'asc' | 'desc';

function SortableHeader({ label, sortKey, currentKey, currentDir, onSort, align = 'left' }: {
  label: string; sortKey: string; currentKey: string | null; currentDir: SortDir; onSort: (k: string) => void; align?: 'left' | 'right' | 'center';
}) {
  return (
    <th className={clsx("data-table-header", align === 'right' && 'text-right', align === 'center' && 'text-center')}>
      <div
        className={clsx(
          "cursor-pointer select-none flex items-center gap-2 hover:text-white transition-colors",
          align === 'right' && 'justify-end',
          align === 'center' && 'justify-center'
        )}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <ArrowUpDown className={clsx("w-3 h-3 flex-shrink-0", currentKey === sortKey ? 'text-white' : 'text-white/20')} />
      </div>
    </th>
  );
}

function sortByKey(list: any[], key: string | null, dir: SortDir, getValue: (item: any, key: string) => any) {
  if (!key) return list;
  return [...list].sort((a, b) => {
    const va = getValue(a, key);
    const vb = getValue(b, key);
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

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

type ReportTab = 'cogs' | 'top-sellers' | 'margins' | 'velocity';

export default function Reports() {
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState<ReportTab>('cogs');
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<SortDir>('desc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // Reset sort when switching tabs
  const handleTabChange = (tab: ReportTab) => {
    setActiveTab(tab);
    setSortKey(null);
    setSortDir('desc');
  };

  const { data: skus = [], isLoading } = useQuery({
    queryKey: ['inventory-skus'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/inventory/skus', { headers: { Authorization: `Bearer ${token}` } });
      return res.data.data;
    }
  });

  const { data: pos = [] } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/purchase-orders', { headers: { Authorization: `Bearer ${token}` } });
      return res.data.data;
    }
  });

  const skusWithSnapshot = skus.filter((s: any) => s.latestSnapshot);

  // ── COGS data ──
  const cogsData = skusWithSnapshot
    .map((s: any) => {
      const qty = s.latestSnapshot?.availableQuantity ?? 0;
      const cost = s.unitCost ?? 0;
      const totalCogs = qty * cost;
      return { ...s, qty, cost, totalCogs };
    })
    .filter((s: any) => s.qty > 0)
    .sort((a: any, b: any) => b.totalCogs - a.totalCogs);

  const grandTotalCogs = cogsData.reduce((sum: number, s: any) => sum + s.totalCogs, 0);
  const totalUnits = cogsData.reduce((sum: number, s: any) => sum + s.qty, 0);

  // ── Top sellers by 30d revenue ──
  const topSellers = skusWithSnapshot
    .map((s: any) => {
      const sold30d = s.latestSnapshot?.shipped30Days ?? 0;
      const sold7d = s.latestSnapshot?.shipped7Days ?? 0;
      const sold90d = s.latestSnapshot?.shipped90Days ?? 0;
      const revenue30d = sold30d * (s.sellingPrice ?? 0);
      const profit30d = sold30d * ((s.sellingPrice ?? 0) - (s.unitCost ?? 0));
      const velocity30d = s.latestSnapshot?.velocity30d ?? 0;
      return { ...s, sold30d, sold7d, sold90d, revenue30d, profit30d, velocity30d };
    })
    .sort((a: any, b: any) => b.revenue30d - a.revenue30d);

  const totalRevenue30d = topSellers.reduce((sum: number, s: any) => sum + s.revenue30d, 0);
  const totalProfit30d = topSellers.reduce((sum: number, s: any) => sum + s.profit30d, 0);
  const totalUnitsSold30d = topSellers.reduce((sum: number, s: any) => sum + s.sold30d, 0);

  // ── Margin analysis ──
  const marginData = skusWithSnapshot
    .map((s: any) => {
      const cost = s.unitCost ?? 0;
      const price = s.sellingPrice ?? 0;
      const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
      const profitPerUnit = price - cost;
      const sold30d = s.latestSnapshot?.shipped30Days ?? 0;
      const monthlyProfit = sold30d * profitPerUnit;
      return { ...s, cost, price, margin, profitPerUnit, sold30d, monthlyProfit };
    })
    .sort((a: any, b: any) => b.monthlyProfit - a.monthlyProfit);

  const avgMargin = marginData.length > 0
    ? marginData.reduce((sum: number, s: any) => sum + s.margin, 0) / marginData.length
    : 0;

  // ── Velocity rankings ──
  const velocityData = skusWithSnapshot
    .map((s: any) => {
      const v30 = s.latestSnapshot?.velocity30d ?? 0;
      const v7 = s.latestSnapshot?.velocity7d ?? 0;
      const v90 = s.latestSnapshot?.velocity90d ?? 0;
      const available = s.latestSnapshot?.availableQuantity ?? 0;
      const daysLeft = v30 > 0 ? available / v30 : 0;
      const trend = v7 > 0 && v30 > 0 ? ((v7 - v30) / v30) * 100 : 0;
      const turnover = v30 > 0 && available > 0 ? (v30 * 30) / available : 0;
      return { ...s, v7, v30, v90, available, daysLeft, trend, turnover };
    })
    .sort((a: any, b: any) => b.v30 - a.v30);

  const fmt$ = (n: number) => n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n.toFixed(2)}`;

  const handleExport = () => {
    if (activeTab === 'cogs') {
      const headers = ['SKU', 'Product', 'Available Qty', 'Unit Cost', 'Total COGS', '% of Total'];
      const rows = cogsData.map((s: any) => [
        s.skuCode, s.productDescription, s.qty, `$${s.cost.toFixed(2)}`,
        `$${s.totalCogs.toFixed(2)}`, grandTotalCogs > 0 ? `${((s.totalCogs / grandTotalCogs) * 100).toFixed(1)}%` : '0%',
      ]);
      rows.push(['', '', '', 'TOTAL', `$${grandTotalCogs.toFixed(2)}`, '100%']);
      downloadCsv('cogs-breakdown.csv', headers, rows);
    } else if (activeTab === 'top-sellers') {
      const headers = ['SKU', 'Product', '30D Units Sold', '30D Revenue', '30D Profit', '% of Revenue'];
      const rows = topSellers.map((s: any) => [
        s.skuCode, s.productDescription, s.sold30d, `$${s.revenue30d.toFixed(2)}`,
        `$${s.profit30d.toFixed(2)}`, totalRevenue30d > 0 ? `${((s.revenue30d / totalRevenue30d) * 100).toFixed(1)}%` : '0%',
      ]);
      downloadCsv('top-sellers-30d.csv', headers, rows);
    } else if (activeTab === 'margins') {
      const headers = ['SKU', 'Product', 'Unit Cost', 'Selling Price', 'Margin %', 'Profit/Unit', '30D Units', '30D Profit'];
      const rows = marginData.map((s: any) => [
        s.skuCode, s.productDescription, `$${s.cost.toFixed(2)}`, `$${s.price.toFixed(2)}`,
        `${s.margin.toFixed(1)}%`, `$${s.profitPerUnit.toFixed(2)}`, s.sold30d, `$${s.monthlyProfit.toFixed(2)}`,
      ]);
      downloadCsv('margin-analysis.csv', headers, rows);
    } else if (activeTab === 'velocity') {
      const headers = ['SKU', 'Product', '7D Vel', '30D Vel', '90D Vel', 'Available', 'Days Left', '7D Trend', 'Turnover Rate'];
      const rows = velocityData.map((s: any) => [
        s.skuCode, s.productDescription, s.v7.toFixed(2), s.v30.toFixed(2), s.v90.toFixed(2),
        s.available, Math.round(s.daysLeft), `${s.trend >= 0 ? '+' : ''}${s.trend.toFixed(0)}%`, `${s.turnover.toFixed(2)}x`,
      ]);
      downloadCsv('velocity-report.csv', headers, rows);
    }
  };

  const tabs: { key: ReportTab; label: string }[] = [
    { key: 'cogs', label: 'Inventory Cost (COGS)' },
    { key: 'top-sellers', label: 'Top Sellers' },
    { key: 'margins', label: 'Margin Analysis' },
    { key: 'velocity', label: 'Sales Velocity' },
  ];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
          <p className="text-white/50 mt-1">Financial and performance analytics</p>
        </motion.div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-white/5 border border-border-subtle px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/10 transition-all"
        >
          <Download size={16} />
          Export CSV
        </button>
      </header>

      {/* Report Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={clsx(
              "px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
              activeTab === tab.key
                ? 'bg-white text-black'
                : 'bg-white/5 border border-border-subtle text-white/50 hover:bg-white/10'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════ COGS TAB ═══════════════════════════ */}
      {activeTab === 'cogs' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="text-emerald-400 w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight">{fmt$(grandTotalCogs)}</p>
              <p className="text-sm text-white/50 font-medium mt-0.5">Total Inventory Cost</p>
            </div>
            <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
              <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">SKUs in Stock</p>
              <p className="text-3xl font-bold tracking-tight">{cogsData.length}</p>
            </div>
            <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
              <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">Total Units on Hand</p>
              <p className="text-3xl font-bold tracking-tight">{totalUnits.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-bg-card border border-border-subtle rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle">
                  <SortableHeader label="SKU" sortKey="skuCode" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Product" sortKey="productDescription" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Qty" sortKey="qty" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="Unit Cost" sortKey="cost" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="Total COGS" sortKey="totalCogs" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="% of Total" sortKey="pct" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortByKey(cogsData, sortKey, sortDir, (item, key) => {
                  if (key === 'pct') return grandTotalCogs > 0 ? item.totalCogs / grandTotalCogs : 0;
                  return item[key] ?? '';
                }).map((sku: any) => {
                  const pct = grandTotalCogs > 0 ? (sku.totalCogs / grandTotalCogs) * 100 : 0;
                  return (
                    <tr key={sku.id} className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => navigate(`/inventory/${sku.id}`)}>
                      <td className="data-table-cell font-mono font-bold">{sku.skuCode}</td>
                      <td className="data-table-cell text-white/70 truncate max-w-[250px]">{sku.productDescription}</td>
                      <td className="data-table-cell text-right font-mono">{sku.qty.toLocaleString()}</td>
                      <td className="data-table-cell text-right font-mono">${sku.cost.toFixed(2)}</td>
                      <td className="data-table-cell text-right font-mono font-bold">${sku.totalCogs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="data-table-cell text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="font-mono text-xs text-white/50 w-12 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {cogsData.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border-subtle bg-white/[0.02]">
                    <td className="data-table-cell font-bold" colSpan={2}>Total</td>
                    <td className="data-table-cell text-right font-mono font-bold">{totalUnits.toLocaleString()}</td>
                    <td className="data-table-cell"></td>
                    <td className="data-table-cell text-right font-mono font-bold">${grandTotalCogs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="data-table-cell text-right font-mono font-bold text-white/50">100%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {/* ═══════════════════════════ TOP SELLERS TAB ═══════════════════════════ */}
      {activeTab === 'top-sellers' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
              <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">30D Revenue</p>
              <p className="text-3xl font-bold tracking-tight">{fmt$(totalRevenue30d)}</p>
            </div>
            <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
              <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">30D Gross Profit</p>
              <p className="text-3xl font-bold tracking-tight text-emerald-400">{fmt$(totalProfit30d)}</p>
            </div>
            <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
              <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">30D Units Sold</p>
              <p className="text-3xl font-bold tracking-tight">{totalUnitsSold30d.toLocaleString()}</p>
            </div>
            <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
              <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">Avg Order Value</p>
              <p className="text-3xl font-bold tracking-tight">
                {totalUnitsSold30d > 0 ? fmt$(totalRevenue30d / totalUnitsSold30d) : '$0'}
              </p>
              <p className="text-[11px] text-white/30 mt-1">per unit</p>
            </div>
          </div>

          <div className="bg-bg-card border border-border-subtle rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="data-table-header w-8 text-center">#</th>
                  <SortableHeader label="SKU" sortKey="skuCode" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Product" sortKey="productDescription" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="30D Sold" sortKey="sold30d" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="30D Revenue" sortKey="revenue30d" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="30D Profit" sortKey="profit30d" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="% of Revenue" sortKey="revPct" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortByKey(topSellers, sortKey, sortDir, (item, key) => {
                  if (key === 'revPct') return totalRevenue30d > 0 ? item.revenue30d / totalRevenue30d : 0;
                  return item[key] ?? '';
                }).map((sku: any, i: number) => {
                  const pct = totalRevenue30d > 0 ? (sku.revenue30d / totalRevenue30d) * 100 : 0;
                  return (
                    <tr key={sku.id} className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => navigate(`/inventory/${sku.id}`)}>
                      <td className="data-table-cell text-center font-mono text-white/30">{i + 1}</td>
                      <td className="data-table-cell font-mono font-bold">{sku.skuCode}</td>
                      <td className="data-table-cell text-white/70 truncate max-w-[200px]">{sku.productDescription}</td>
                      <td className="data-table-cell text-right font-mono">{sku.sold30d.toLocaleString()}</td>
                      <td className="data-table-cell text-right font-mono font-bold">{fmt$(sku.revenue30d)}</td>
                      <td className="data-table-cell text-right font-mono text-emerald-400">{fmt$(sku.profit30d)}</td>
                      <td className="data-table-cell text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="font-mono text-xs text-white/50 w-12 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {topSellers.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border-subtle bg-white/[0.02]">
                    <td className="data-table-cell" />
                    <td className="data-table-cell font-bold" colSpan={2}>Total</td>
                    <td className="data-table-cell text-right font-mono font-bold">{totalUnitsSold30d.toLocaleString()}</td>
                    <td className="data-table-cell text-right font-mono font-bold">{fmt$(totalRevenue30d)}</td>
                    <td className="data-table-cell text-right font-mono font-bold text-emerald-400">{fmt$(totalProfit30d)}</td>
                    <td className="data-table-cell text-right font-mono font-bold text-white/50">100%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {/* ═══════════════════════════ MARGIN ANALYSIS TAB ═══════════════════════════ */}
      {activeTab === 'margins' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
              <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">Average Margin</p>
              <p className="text-3xl font-bold tracking-tight">{avgMargin.toFixed(1)}%</p>
              <p className="text-[11px] text-white/30 mt-1">across all SKUs</p>
            </div>
            <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
              <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">Highest Margin SKU</p>
              {marginData.length > 0 ? (() => {
                const best = [...marginData].sort((a, b) => b.margin - a.margin)[0];
                return (
                  <>
                    <p className="text-3xl font-bold tracking-tight text-emerald-400">{best.margin.toFixed(1)}%</p>
                    <p className="text-[11px] text-white/30 mt-1 font-mono">{best.skuCode}</p>
                  </>
                );
              })() : <p className="text-white/30">—</p>}
            </div>
            <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
              <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">Lowest Margin SKU</p>
              {marginData.length > 0 ? (() => {
                const worst = [...marginData].filter(m => m.price > 0).sort((a, b) => a.margin - b.margin)[0];
                if (!worst) return <p className="text-white/30">—</p>;
                return (
                  <>
                    <p className={clsx("text-3xl font-bold tracking-tight", worst.margin < 30 ? "text-critical" : "text-amber-400")}>{worst.margin.toFixed(1)}%</p>
                    <p className="text-[11px] text-white/30 mt-1 font-mono">{worst.skuCode}</p>
                  </>
                );
              })() : <p className="text-white/30">—</p>}
            </div>
          </div>

          <div className="bg-bg-card border border-border-subtle rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle">
                  <SortableHeader label="SKU" sortKey="skuCode" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Product" sortKey="productDescription" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Unit Cost" sortKey="cost" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="Selling Price" sortKey="price" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="Margin" sortKey="margin" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="Profit/Unit" sortKey="profitPerUnit" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="30D Units" sortKey="sold30d" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="30D Profit" sortKey="monthlyProfit" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortByKey(marginData, sortKey, sortDir, (item, key) => item[key] ?? '').map((sku: any) => (
                  <tr key={sku.id} className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => navigate(`/inventory/${sku.id}`)}>
                    <td className="data-table-cell font-mono font-bold">{sku.skuCode}</td>
                    <td className="data-table-cell text-white/70 truncate max-w-[200px]">{sku.productDescription}</td>
                    <td className="data-table-cell text-right font-mono">${sku.cost.toFixed(2)}</td>
                    <td className="data-table-cell text-right font-mono">${sku.price.toFixed(2)}</td>
                    <td className="data-table-cell text-right">
                      <span className={clsx(
                        "font-mono font-bold",
                        sku.margin >= 60 ? 'text-emerald-400' : sku.margin >= 40 ? 'text-white' : sku.margin >= 20 ? 'text-amber-400' : 'text-critical'
                      )}>
                        {sku.margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="data-table-cell text-right font-mono text-emerald-400">${sku.profitPerUnit.toFixed(2)}</td>
                    <td className="data-table-cell text-right font-mono">{sku.sold30d.toLocaleString()}</td>
                    <td className="data-table-cell text-right font-mono font-bold">
                      <span className={clsx(sku.monthlyProfit >= 0 ? 'text-emerald-400' : 'text-critical')}>
                        {fmt$(sku.monthlyProfit)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══════════════════════════ VELOCITY TAB ═══════════════════════════ */}
      {activeTab === 'velocity' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
              <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">Fastest Mover</p>
              {velocityData.length > 0 && velocityData[0].v30 > 0 ? (
                <>
                  <p className="text-3xl font-bold tracking-tight">{velocityData[0].v30.toFixed(1)} <span className="text-lg text-white/50">/day</span></p>
                  <p className="text-[11px] text-white/30 mt-1 font-mono">{velocityData[0].skuCode}</p>
                </>
              ) : <p className="text-white/30 text-xl">—</p>}
            </div>
            <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
              <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">Highest Turnover</p>
              {(() => {
                const best = [...velocityData].sort((a, b) => b.turnover - a.turnover)[0];
                if (!best || best.turnover === 0) return <p className="text-white/30 text-xl">—</p>;
                return (
                  <>
                    <p className="text-3xl font-bold tracking-tight">{best.turnover.toFixed(2)}x <span className="text-lg text-white/50">/mo</span></p>
                    <p className="text-[11px] text-white/30 mt-1 font-mono">{best.skuCode}</p>
                  </>
                );
              })()}
            </div>
            <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
              <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">Slowest Mover</p>
              {(() => {
                const moving = velocityData.filter(s => s.v30 > 0);
                const slowest = moving.length > 0 ? moving[moving.length - 1] : null;
                if (!slowest) return <p className="text-white/30 text-xl">—</p>;
                return (
                  <>
                    <p className="text-3xl font-bold tracking-tight text-amber-400">{slowest.v30.toFixed(2)} <span className="text-lg text-white/50">/day</span></p>
                    <p className="text-[11px] text-white/30 mt-1 font-mono">{slowest.skuCode}</p>
                  </>
                );
              })()}
            </div>
          </div>

          <div className="bg-bg-card border border-border-subtle rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle">
                  <SortableHeader label="SKU" sortKey="skuCode" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Product" sortKey="productDescription" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="7D Vel" sortKey="v7" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="30D Vel" sortKey="v30" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="90D Vel" sortKey="v90" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="Available" sortKey="available" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="Days Left" sortKey="daysLeft" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="7D Trend" sortKey="trend" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="Turnover" sortKey="turnover" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortByKey(velocityData, sortKey, sortDir, (item, key) => item[key] ?? '').map((sku: any) => (
                  <tr key={sku.id} className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => navigate(`/inventory/${sku.id}`)}>
                    <td className="data-table-cell font-mono font-bold">{sku.skuCode}</td>
                    <td className="data-table-cell text-white/70 truncate max-w-[180px]">{sku.productDescription}</td>
                    <td className="data-table-cell text-right font-mono">{sku.v7.toFixed(2)}</td>
                    <td className="data-table-cell text-right font-mono font-bold">{sku.v30.toFixed(2)}</td>
                    <td className="data-table-cell text-right font-mono text-white/50">{sku.v90.toFixed(2)}</td>
                    <td className="data-table-cell text-right font-mono">{sku.available.toLocaleString()}</td>
                    <td className="data-table-cell text-right font-mono">
                      <span className={clsx(
                        sku.daysLeft > 0 && sku.daysLeft <= 30 ? 'text-critical font-bold' :
                        sku.daysLeft > 0 && sku.daysLeft <= 60 ? 'text-amber-400' : 'text-white/70'
                      )}>
                        {sku.daysLeft > 0 ? Math.round(sku.daysLeft) : '—'}
                      </span>
                    </td>
                    <td className="data-table-cell text-right">
                      {sku.trend !== 0 ? (
                        <span className={clsx("flex items-center justify-end gap-1 font-mono text-xs font-bold", sku.trend > 0 ? 'text-emerald-400' : 'text-critical')}>
                          {sku.trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          {Math.abs(sku.trend).toFixed(0)}%
                        </span>
                      ) : <span className="text-white/20 text-xs">—</span>}
                    </td>
                    <td className="data-table-cell text-right font-mono text-white/70">{sku.turnover > 0 ? `${sku.turnover.toFixed(2)}x` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
