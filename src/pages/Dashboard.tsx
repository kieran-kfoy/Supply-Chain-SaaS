import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, TrendingDown, TrendingUp, Clock, Package,
  ShoppingCart, Truck, CheckCircle2, ArrowRight, Zap, DollarSign
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, differenceInDays, isPast, addDays } from 'date-fns';
import { clsx } from 'clsx';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const HEALTH_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  REORDER_SOON: '#f59e0b',
  MONITOR: '#3b82f6',
  HEALTHY: '#22c55e',
};

const HEALTH_LABELS: Record<string, string> = {
  CRITICAL: 'Critical',
  REORDER_SOON: 'Reorder Soon',
  MONITOR: 'Monitor',
  HEALTHY: 'Healthy',
};

function StatCard({ label, value, sub, icon: Icon, color, delay, onClick }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={clsx(
        "bg-bg-card border border-border-subtle p-6 rounded-2xl space-y-4",
        onClick && "cursor-pointer hover:border-white/20 transition-all"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center", color.bg)}>
          <Icon className={clsx("w-5 h-5", color.icon)} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Live</span>
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        <p className="text-sm text-white/50 font-medium mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-white/30 mt-1">{sub}</p>}
      </div>
    </motion.div>
  );
}

function FlagBadge({ type }: { type: 'dead_stock' | 'stockout' | 'spike' }) {
  const config = {
    dead_stock: { label: 'Dead Stock', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    stockout: { label: 'Stockout', color: 'bg-critical/10 text-critical border-critical/20' },
    spike: { label: 'Velocity Spike', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  };
  const { label, color } = config[type];
  return <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight border", color)}>{label}</span>;
}

export default function Dashboard() {
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const { data: skus = [] } = useQuery({
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

  const { data: shipments = [] } = useQuery({
    queryKey: ['shipments'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/shipments', { headers: { Authorization: `Bearer ${token}` } });
      return res.data.data;
    }
  });

  // ── Derived metrics ──────────────────────────────────────────────────────────

  // Portfolio health breakdown
  const healthBreakdown = ['CRITICAL', 'REORDER_SOON', 'MONITOR', 'HEALTHY'].map(status => ({
    status,
    count: skus.filter((s: any) => s.latestSnapshot?.reorderStatus === status).length,
  })).filter(d => d.count > 0);

  const skusWithSnapshot = skus.filter((s: any) => s.latestSnapshot);
  const criticalSkus = skusWithSnapshot
    .filter((s: any) => s.latestSnapshot.reorderStatus === 'CRITICAL' || s.latestSnapshot.reorderStatus === 'REORDER_SOON')
    .sort((a: any, b: any) => (a.latestSnapshot.daysInStock ?? 9999) - (b.latestSnapshot.daysInStock ?? 9999));

  // Capital metrics
  const inventoryValue = skusWithSnapshot.reduce((sum: number, s: any) =>
    sum + (s.latestSnapshot.availableQuantity ?? 0) * (s.unitCost ?? 0), 0);

  const openPOs = pos.filter((p: any) => p.status === 'OPEN' || p.status === 'IN PRODUCTION' || p.status === 'SHIPPED');
  const capitalOnOrder = openPOs.reduce((sum: number, p: any) =>
    sum + (p.orderQuantity ?? 0) * (p.sku?.unitCost ?? 0), 0);

  // Next OOS
  const nextOos = skusWithSnapshot
    .filter((s: any) => s.latestSnapshot.oosDate)
    .sort((a: any, b: any) => new Date(a.latestSnapshot.oosDate).getTime() - new Date(b.latestSnapshot.oosDate).getTime())[0];
  const daysToNextOos = nextOos ? differenceInDays(new Date(nextOos.latestSnapshot.oosDate), now) : null;

  // Anomaly flags
  const deadStock = skusWithSnapshot.filter((s: any) =>
    (s.latestSnapshot.velocity30d ?? 0) === 0 && (s.latestSnapshot.availableQuantity ?? 0) > 0
  );
  const stockouts = skusWithSnapshot.filter((s: any) =>
    (s.latestSnapshot.availableQuantity ?? 0) === 0
  );

  // Upcoming arrivals (next 60 days)
  const upcoming = pos
    .filter((p: any) => p.expectedArrival && !isPast(new Date(p.expectedArrival)) &&
      differenceInDays(new Date(p.expectedArrival), now) <= 60 &&
      p.status !== 'RECEIVED' && p.status !== 'COMPLETE')
    .sort((a: any, b: any) => new Date(a.expectedArrival).getTime() - new Date(b.expectedArrival).getTime());

  // Overdue POs (expected arrival passed, not received/complete)
  const overduePOs = pos.filter((p: any) =>
    p.expectedArrival && isPast(new Date(p.expectedArrival)) &&
    p.status !== 'RECEIVED' && p.status !== 'COMPLETE'
  );

  // In transit
  const inTransit = shipments.filter((s: any) => !s.received);

  const fmt$ = (n: number) => n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n.toFixed(0)}`;

  const allClear = criticalSkus.length === 0 && overduePOs.length === 0 && stockouts.length === 0;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">

      {/* Header */}
      <header className="flex items-start justify-between">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 className="text-3xl font-bold tracking-tight">{greeting} 👋</h2>
          <p className="text-white/40 mt-1">{format(now, 'EEEE, MMMM d, yyyy')} · Supply Chain Command Center</p>
        </motion.div>
        <div className="text-right text-xs text-white/30 font-medium">
          <p className="uppercase tracking-widest font-bold">Portfolio</p>
          <p className="text-white font-mono text-lg mt-0.5">{skus.length} SKUs</p>
        </div>
      </header>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Inventory Cost (COGS)"
          value={fmt$(inventoryValue)}
          sub="Total stock on hand (at cost)"
          icon={DollarSign}
          color={{ bg: 'bg-emerald-500/10', icon: 'text-emerald-400' }}
          delay={0}
          onClick={() => navigate('/reports')}
        />
        <StatCard
          label="Capital on Order"
          value={fmt$(capitalOnOrder)}
          sub={`${openPOs.length} open POs`}
          icon={ShoppingCart}
          color={{ bg: 'bg-blue-500/10', icon: 'text-blue-400' }}
          delay={0.05}
        />
        <StatCard
          label="Needs Attention"
          value={criticalSkus.length}
          sub={criticalSkus.length === 0 ? 'All SKUs healthy' : 'SKUs require action'}
          icon={AlertTriangle}
          color={{ bg: criticalSkus.length > 0 ? 'bg-critical/10' : 'bg-emerald-500/10', icon: criticalSkus.length > 0 ? 'text-critical' : 'text-emerald-400' }}
          delay={0.1}
        />
        <StatCard
          label="Next Stockout"
          value={daysToNextOos != null ? `${daysToNextOos}d` : 'None'}
          sub={nextOos ? `${nextOos.skuCode} · ${format(new Date(nextOos.latestSnapshot.oosDate), 'MMM d')}` : 'No stockouts projected'}
          icon={Clock}
          color={{ bg: daysToNextOos != null && daysToNextOos < 30 ? 'bg-critical/10' : 'bg-white/5', icon: daysToNextOos != null && daysToNextOos < 30 ? 'text-critical' : 'text-white/40' }}
          delay={0.15}
        />
      </div>

      {/* Main two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Action Required — wider left column */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Zap className="text-critical w-5 h-5" />
              Action Required
            </h3>
            {criticalSkus.length > 0 && (
              <span className="bg-critical/10 text-critical text-[10px] font-bold px-2.5 py-1 rounded-full border border-critical/20">
                {criticalSkus.length} SKU{criticalSkus.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {allClear ? (
            <div className="bg-bg-card border border-border-subtle border-dashed p-10 rounded-2xl text-center">
              <CheckCircle2 className="w-10 h-10 text-healthy mx-auto mb-3 opacity-60" />
              <p className="text-white font-bold text-lg">All clear</p>
              <p className="text-white/40 text-sm mt-1">No urgent actions required right now</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Overdue POs */}
              {overduePOs.map((po: any) => (
                <motion.div
                  key={po.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-bg-card border border-critical/30 p-4 rounded-xl flex items-center gap-4"
                >
                  <div className="w-9 h-9 bg-critical/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="text-critical w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm">{po.poNumber}</p>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight bg-critical/10 text-critical border border-critical/20">Overdue</span>
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5">{po.sku?.skuCode} · Was due {format(new Date(po.expectedArrival), 'MMM d')}</p>
                  </div>
                  <button
                    onClick={() => navigate('/purchasing')}
                    className="flex-shrink-0 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white hover:text-black transition-all"
                  >
                    View PO
                  </button>
                </motion.div>
              ))}

              {/* Stockouts */}
              {stockouts.map((sku: any) => (
                <motion.div
                  key={sku.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-bg-card border border-critical/30 p-4 rounded-xl flex items-center gap-4"
                >
                  <div className="w-9 h-9 bg-critical/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package className="text-critical w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm font-mono">{sku.skuCode}</p>
                      <FlagBadge type="stockout" />
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5 truncate">{sku.productDescription}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/inventory/${sku.id}`)}
                    className="flex-shrink-0 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white hover:text-black transition-all"
                  >
                    View SKU
                  </button>
                </motion.div>
              ))}

              {/* Critical / Reorder SKUs */}
              {criticalSkus.map((sku: any, i: number) => {
                const snap = sku.latestSnapshot;
                const daysLeft = Math.round(snap.daysInStock ?? 0);
                const isCritical = snap.reorderStatus === 'CRITICAL';
                return (
                  <motion.div
                    key={sku.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={clsx(
                      "bg-bg-card border p-4 rounded-xl flex items-center gap-4 hover:border-white/20 transition-all",
                      isCritical ? 'border-critical/30' : 'border-amber-500/30'
                    )}
                  >
                    <div className={clsx(
                      "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                      isCritical ? 'bg-critical/10' : 'bg-amber-500/10'
                    )}>
                      <AlertTriangle className={clsx("w-4 h-4", isCritical ? 'text-critical' : 'text-amber-400')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm font-mono">{sku.skuCode}</p>
                        <span className={clsx(
                          "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight border",
                          isCritical ? 'bg-critical/10 text-critical border-critical/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        )}>
                          {isCritical ? 'Critical' : 'Reorder Soon'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-[11px] text-white/40">{daysLeft}d remaining</span>
                        <span className="text-[11px] text-white/40">{snap.availableQuantity?.toLocaleString()} units</span>
                        <span className="text-[11px] text-white/40">{snap.velocity30d?.toFixed(1)} u/day</span>
                        {snap.oosDate && (
                          <span className={clsx("text-[11px]", isCritical ? 'text-critical font-bold' : 'text-white/40')}>
                            OOS {format(new Date(snap.oosDate), 'MMM d')}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/inventory/${sku.id}`)}
                      className="flex-shrink-0 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white hover:text-black transition-all"
                    >
                      View →
                    </button>
                  </motion.div>
                );
              })}

              {/* Dead stock flags */}
              {deadStock.length > 0 && (
                <div className="bg-bg-card border border-amber-500/20 p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="text-amber-400 w-4 h-4" />
                    <p className="text-sm font-bold text-amber-400">Dead Stock Detected</p>
                    <span className="text-[10px] text-white/30">({deadStock.length} SKU{deadStock.length > 1 ? 's' : ''})</span>
                  </div>
                  <div className="space-y-1.5">
                    {deadStock.map((sku: any) => (
                      <div key={sku.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-white/70">{sku.skuCode}</span>
                          <FlagBadge type="dead_stock" />
                        </div>
                        <span className="text-white/40 text-xs font-mono">{sku.latestSnapshot.availableQuantity?.toLocaleString()} units · $0 velocity</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column — Pipeline + Health */}
        <div className="lg:col-span-2 space-y-6">

          {/* Portfolio Health Donut */}
          <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
            <h3 className="text-base font-bold tracking-tight mb-4">Portfolio Health</h3>
            {healthBreakdown.length > 0 ? (
              <>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={healthBreakdown} dataKey="count" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2}>
                          {healthBreakdown.map((entry) => (
                            <Cell key={entry.status} fill={HEALTH_COLORS[entry.status]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                          formatter={(val: any, _: any, props: any) => [`${val} SKUs`, HEALTH_LABELS[props.payload.status]]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 flex-1">
                    {healthBreakdown.map(({ status, count }) => (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: HEALTH_COLORS[status] }} />
                          <span className="text-xs text-white/60">{HEALTH_LABELS[status]}</span>
                        </div>
                        <span className="text-xs font-bold font-mono">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Health bar */}
                <div className="mt-4 h-2 rounded-full overflow-hidden flex gap-0.5">
                  {healthBreakdown.map(({ status, count }) => (
                    <div
                      key={status}
                      className="h-full rounded-sm transition-all"
                      style={{
                        width: `${(count / skus.length) * 100}%`,
                        backgroundColor: HEALTH_COLORS[status]
                      }}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-white/30 mt-2 text-right">{skus.length} total SKUs</p>
              </>
            ) : (
              <div className="text-center py-6 text-white/30 text-sm">No snapshot data yet — run a sync</div>
            )}
          </div>

          {/* Supply Chain Pipeline */}
          <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold tracking-tight">Pipeline</h3>
              <button onClick={() => navigate('/purchasing')} className="text-xs text-white/30 hover:text-white transition-colors">See all →</button>
            </div>

            {/* In transit */}
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Truck className="text-blue-400 w-4 h-4" />
                <span className="text-sm text-white/70">In Transit</span>
              </div>
              <span className="font-mono font-bold text-sm">{inTransit.length} shipment{inTransit.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Upcoming arrivals */}
            {upcoming.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Arriving next 60 days</p>
                {upcoming.slice(0, 5).map((po: any) => {
                  const days = differenceInDays(new Date(po.expectedArrival), now);
                  return (
                    <div key={po.id} className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono font-bold truncate">{po.poNumber}</p>
                        <p className="text-[10px] text-white/30 truncate">{po.sku?.skuCode} · {po.orderQuantity?.toLocaleString()} units</p>
                      </div>
                      <div className={clsx(
                        "flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded font-mono",
                        days <= 7 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/40'
                      )}>
                        {days}d
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-white/20 text-xs">No upcoming arrivals scheduled</div>
            )}

            {/* Overdue warning */}
            {overduePOs.length > 0 && (
              <div className="pt-2 border-t border-white/5">
                <div className="flex items-center gap-2 text-critical">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <p className="text-xs font-bold">{overduePOs.length} PO{overduePOs.length > 1 ? 's' : ''} overdue</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick nav to full inventory */}
      <div
        onClick={() => navigate('/inventory')}
        className="bg-bg-card border border-border-subtle p-5 rounded-2xl flex items-center justify-between cursor-pointer hover:border-white/20 group transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-white/10 transition-colors">
            <Package className="text-white/40 w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-sm">Full Inventory Report</p>
            <p className="text-xs text-white/40">View all {skus.length} SKUs with health status, velocity, and OOS projections</p>
          </div>
        </div>
        <ArrowRight className="text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all w-5 h-5" />
      </div>

    </div>
  );
}
