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
import { format, differenceInDays, isPast } from 'date-fns';
import { clsx } from 'clsx';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const HEALTH_COLORS: Record<string, string> = {
  CRITICAL:    '#F87171',
  REORDER_SOON:'#FB923C',
  MONITOR:     '#60A5FA',
  HEALTHY:     '#34D399',
};

const HEALTH_LABELS: Record<string, string> = {
  CRITICAL:    'Critical',
  REORDER_SOON:'Reorder Soon',
  MONITOR:     'Monitor',
  HEALTHY:     'Healthy',
};

function StatCard({ label, value, sub, icon: Icon, accentColor, delay }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="stat-card"
    >
      {/* Accent top line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${accentColor}60, ${accentColor}20, transparent)` }}
      />
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${accentColor}15` }}
        >
          <Icon className="w-[18px] h-[18px]" style={{ color: accentColor }} />
        </div>
        <span
          className="text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)' }}
        >
          Live
        </span>
      </div>
      <p className="text-[28px] font-bold tracking-tight leading-none" style={{ color: '#F1F5F9' }}>{value}</p>
      <p className="text-[13px] font-medium mt-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</p>
      {sub && <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.28)' }}>{sub}</p>}
    </motion.div>
  );
}

function FlagBadge({ type }: { type: 'dead_stock' | 'stockout' | 'spike' }) {
  const config = {
    dead_stock: { label: 'Dead Stock', bg: 'rgba(251,146,60,0.12)', color: '#FB923C', border: 'rgba(251,146,60,0.25)' },
    stockout:   { label: 'Stockout',   bg: 'rgba(248,113,113,0.12)', color: '#F87171', border: 'rgba(248,113,113,0.25)' },
    spike:      { label: 'Spike',      bg: 'rgba(96,165,250,0.12)',  color: '#60A5FA', border: 'rgba(96,165,250,0.25)' },
  };
  const { label, bg, color, border } = config[type];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.06em]"
      style={{ background: bg, color, border: `1px solid ${border}` }}
    >
      {label}
    </span>
  );
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

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const healthBreakdown = ['CRITICAL', 'REORDER_SOON', 'MONITOR', 'HEALTHY'].map(status => ({
    status,
    count: skus.filter((s: any) => s.latestSnapshot?.reorderStatus === status).length,
  })).filter(d => d.count > 0);

  const skusWithSnapshot = skus.filter((s: any) => s.latestSnapshot);
  const criticalSkus = skusWithSnapshot
    .filter((s: any) => s.latestSnapshot.reorderStatus === 'CRITICAL' || s.latestSnapshot.reorderStatus === 'REORDER_SOON')
    .sort((a: any, b: any) => (a.latestSnapshot.daysInStock ?? 9999) - (b.latestSnapshot.daysInStock ?? 9999));

  const inventoryValue = skusWithSnapshot.reduce((sum: number, s: any) =>
    sum + (s.latestSnapshot.availableQuantity ?? 0) * (s.unitCost ?? 0), 0);

  const openPOs = pos.filter((p: any) => p.status === 'OPEN' || p.status === 'IN PRODUCTION');
  const capitalOnOrder = openPOs.reduce((sum: number, p: any) =>
    sum + (p.orderQuantity ?? 0) * (p.sku?.unitCost ?? 0), 0);

  const nextOos = skusWithSnapshot
    .filter((s: any) => s.latestSnapshot.oosDate)
    .sort((a: any, b: any) => new Date(a.latestSnapshot.oosDate).getTime() - new Date(b.latestSnapshot.oosDate).getTime())[0];
  const daysToNextOos = nextOos ? differenceInDays(new Date(nextOos.latestSnapshot.oosDate), now) : null;

  const deadStock = skusWithSnapshot.filter((s: any) =>
    (s.latestSnapshot.velocity30d ?? 0) === 0 && (s.latestSnapshot.availableQuantity ?? 0) > 0
  );
  const stockouts = skusWithSnapshot.filter((s: any) =>
    (s.latestSnapshot.availableQuantity ?? 0) === 0
  );

  const upcoming = pos
    .filter((p: any) => p.expectedArrival && !isPast(new Date(p.expectedArrival)) &&
      differenceInDays(new Date(p.expectedArrival), now) <= 60 &&
      p.status !== 'RECEIVED' && p.status !== 'COMPLETE')
    .sort((a: any, b: any) => new Date(a.expectedArrival).getTime() - new Date(b.expectedArrival).getTime());

  const overduePOs = pos.filter((p: any) =>
    p.expectedArrival && isPast(new Date(p.expectedArrival)) &&
    p.status !== 'RECEIVED' && p.status !== 'COMPLETE'
  );

  const inTransit = shipments.filter((s: any) => !s.received);

  const fmt$ = (n: number) => n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n.toFixed(0)}`;

  const allClear = criticalSkus.length === 0 && overduePOs.length === 0 && stockouts.length === 0;

  return (
    <div className="p-8 space-y-7 max-w-7xl mx-auto page-enter">

      {/* Header */}
      <header className="flex items-start justify-between">
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: [0.16,1,0.3,1] }}>
          <h2 className="text-[26px] font-bold tracking-tight" style={{ color: '#F1F5F9' }}>
            {greeting} <span style={{ fontWeight: 300 }}>👋</span>
          </h2>
          <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {format(now, 'EEEE, MMMM d, yyyy')} · Command Center
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-right"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'rgba(255,255,255,0.2)' }}>Portfolio</p>
          <p className="text-[22px] font-bold font-mono tracking-tight mt-0.5" style={{ color: '#F1F5F9' }}>{skus.length} <span className="text-[14px] font-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>SKUs</span></p>
        </motion.div>
      </header>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Inventory Value"
          value={fmt$(inventoryValue)}
          sub="Total stock on hand"
          icon={DollarSign}
          accentColor="#34D399"
          delay={0}
        />
        <StatCard
          label="Capital on Order"
          value={fmt$(capitalOnOrder)}
          sub={`${openPOs.length} open POs`}
          icon={ShoppingCart}
          accentColor="#60A5FA"
          delay={0.06}
        />
        <StatCard
          label="Needs Attention"
          value={criticalSkus.length}
          sub={criticalSkus.length === 0 ? 'All SKUs healthy ✓' : 'SKUs require action'}
          icon={AlertTriangle}
          accentColor={criticalSkus.length > 0 ? '#F87171' : '#34D399'}
          delay={0.12}
        />
        <StatCard
          label="Next Stockout"
          value={daysToNextOos != null ? `${daysToNextOos}d` : '—'}
          sub={nextOos ? `${nextOos.skuCode} · ${format(new Date(nextOos.latestSnapshot.oosDate), 'MMM d')}` : 'No stockouts projected'}
          icon={Clock}
          accentColor={daysToNextOos != null && daysToNextOos < 30 ? '#F87171' : '#6366F1'}
          delay={0.18}
        />
      </div>

      {/* Main two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Action Required */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(248,113,113,0.12)' }}>
                <Zap className="w-3.5 h-3.5" style={{ color: '#F87171' }} />
              </div>
              <h3 className="text-[15px] font-bold tracking-tight" style={{ color: '#F1F5F9' }}>Action Required</h3>
            </div>
            {criticalSkus.length > 0 && (
              <span
                className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(248,113,113,0.1)', color: '#F87171', border: '1px solid rgba(248,113,113,0.2)' }}
              >
                {criticalSkus.length} SKU{criticalSkus.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {allClear ? (
            <div
              className="p-10 rounded-2xl text-center"
              style={{
                background: 'rgba(52,211,153,0.04)',
                border: '1px dashed rgba(52,211,153,0.2)',
              }}
            >
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: '#34D399', opacity: 0.5 }} />
              <p className="font-bold text-[15px]" style={{ color: '#F1F5F9' }}>All clear</p>
              <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>No urgent actions required right now</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Overdue POs */}
              {overduePOs.map((po: any) => (
                <motion.div
                  key={po.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 rounded-2xl flex items-center gap-4"
                  style={{
                    background: 'rgba(248,113,113,0.05)',
                    border: '1px solid rgba(248,113,113,0.2)',
                  }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(248,113,113,0.12)' }}>
                    <ShoppingCart className="w-4 h-4" style={{ color: '#F87171' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[13px]">{po.poNumber}</p>
                      <FlagBadge type="stockout" />
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {po.sku?.skuCode} · Was due {format(new Date(po.expectedArrival), 'MMM d')}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/purchasing')}
                    className="btn-secondary text-[11px] shrink-0"
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
                  className="p-4 rounded-2xl flex items-center gap-4"
                  style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.2)' }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(248,113,113,0.12)' }}>
                    <Package className="w-4 h-4" style={{ color: '#F87171' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[13px] font-mono">{sku.skuCode}</p>
                      <FlagBadge type="stockout" />
                    </div>
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{sku.productDescription}</p>
                  </div>
                  <button onClick={() => navigate(`/inventory/${sku.id}`)} className="btn-secondary text-[11px] shrink-0">View SKU</button>
                </motion.div>
              ))}

              {/* Critical / Reorder SKUs */}
              {criticalSkus.map((sku: any, i: number) => {
                const snap = sku.latestSnapshot;
                const daysLeft = Math.round(snap.daysInStock ?? 0);
                const isCritical = snap.reorderStatus === 'CRITICAL';
                const accent = isCritical ? '#F87171' : '#FB923C';
                return (
                  <motion.div
                    key={sku.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-4 rounded-2xl flex items-center gap-4 transition-all duration-200 cursor-pointer group"
                    style={{
                      background: `${accent}08`,
                      border: `1px solid ${accent}30`,
                    }}
                    onClick={() => navigate(`/inventory/${sku.id}`)}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accent}15` }}>
                      <AlertTriangle className="w-4 h-4" style={{ color: accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-[13px] font-mono">{sku.skuCode}</p>
                        <span
                          className="text-[9px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded"
                          style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}
                        >
                          {isCritical ? 'Critical' : 'Reorder Soon'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{daysLeft}d remaining</span>
                        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{snap.availableQuantity?.toLocaleString()} units</span>
                        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{snap.velocity30d?.toFixed(1)} u/day</span>
                        {snap.oosDate && (
                          <span className="text-[11px] font-bold" style={{ color: isCritical ? '#F87171' : 'rgba(255,255,255,0.4)' }}>
                            OOS {format(new Date(snap.oosDate), 'MMM d')}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'rgba(255,255,255,0.4)' }} />
                  </motion.div>
                );
              })}

              {/* Dead stock */}
              {deadStock.length > 0 && (
                <div
                  className="p-4 rounded-2xl"
                  style={{ background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.18)' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="w-4 h-4" style={{ color: '#FB923C' }} />
                    <p className="text-[13px] font-bold" style={{ color: '#FB923C' }}>Dead Stock Detected</p>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>({deadStock.length} SKU{deadStock.length > 1 ? 's' : ''})</span>
                  </div>
                  <div className="space-y-1.5">
                    {deadStock.map((sku: any) => (
                      <div key={sku.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[12px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{sku.skuCode}</span>
                          <FlagBadge type="dead_stock" />
                        </div>
                        <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {sku.latestSnapshot.availableQuantity?.toLocaleString()} units
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Portfolio Health */}
          <div className="section-card p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <TrendingUp className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <h3 className="text-[14px] font-bold tracking-tight" style={{ color: '#F1F5F9' }}>Portfolio Health</h3>
            </div>
            {healthBreakdown.length > 0 ? (
              <>
                <div className="flex items-center gap-4">
                  <div className="w-28 h-28 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={healthBreakdown} dataKey="count" cx="50%" cy="50%" innerRadius={28} outerRadius={52} paddingAngle={3}>
                          {healthBreakdown.map((entry) => (
                            <Cell key={entry.status} fill={HEALTH_COLORS[entry.status]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: '#0F1521',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 10,
                            fontSize: 11,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                          }}
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
                          <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{HEALTH_LABELS[status]}</span>
                        </div>
                        <span className="text-[12px] font-bold font-mono" style={{ color: '#F1F5F9' }}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 h-1.5 rounded-full overflow-hidden flex gap-0.5">
                  {healthBreakdown.map(({ status, count }) => (
                    <div
                      key={status}
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(count / skus.length) * 100}%`, backgroundColor: HEALTH_COLORS[status] }}
                    />
                  ))}
                </div>
                <p className="text-[10px] mt-1.5 text-right" style={{ color: 'rgba(255,255,255,0.2)' }}>{skus.length} total SKUs</p>
              </>
            ) : (
              <div className="text-center py-6 text-[13px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                No snapshot data yet — run a sync
              </div>
            )}
          </div>

          {/* Pipeline */}
          <div className="section-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <h3 className="text-[14px] font-bold tracking-tight" style={{ color: '#F1F5F9' }}>Pipeline</h3>
              </div>
              <button
                onClick={() => navigate('/purchasing')}
                className="text-[11px] transition-colors hover:opacity-80"
                style={{ color: 'rgba(99,102,241,0.7)' }}
              >
                See all →
              </button>
            </div>

            <div className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-2">
                <Truck className="w-3.5 h-3.5" style={{ color: '#60A5FA' }} />
                <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.6)' }}>In Transit</span>
              </div>
              <span className="font-mono font-bold text-[13px]" style={{ color: '#F1F5F9' }}>
                {inTransit.length} shipment{inTransit.length !== 1 ? 's' : ''}
              </span>
            </div>

            {upcoming.length > 0 ? (
              <div className="space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  Arriving next 60 days
                </p>
                {upcoming.slice(0, 5).map((po: any) => {
                  const days = differenceInDays(new Date(po.expectedArrival), now);
                  return (
                    <div key={po.id} className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-mono font-bold truncate">{po.poNumber}</p>
                        <p className="text-[10px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {po.sku?.skuCode} · {po.orderQuantity?.toLocaleString()} units
                        </p>
                      </div>
                      <div
                        className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded font-mono"
                        style={{
                          background: days <= 7 ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                          color: days <= 7 ? '#34D399' : 'rgba(255,255,255,0.35)',
                        }}
                      >
                        {days}d
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-3 text-[12px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                No upcoming arrivals scheduled
              </div>
            )}

            {overduePOs.length > 0 && (
              <div className="pt-3 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#F87171' }} />
                <p className="text-[12px] font-bold" style={{ color: '#F87171' }}>
                  {overduePOs.length} PO{overduePOs.length > 1 ? 's' : ''} overdue
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full inventory nav */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        onClick={() => navigate('/inventory')}
        className="section-card p-4 flex items-center justify-between cursor-pointer group transition-all duration-200 hover:border-[rgba(99,102,241,0.25)]"
        style={{ borderRadius: 16 }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200 group-hover:bg-[rgba(99,102,241,0.15)]"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <Package className="w-[18px] h-[18px]" style={{ color: 'rgba(255,255,255,0.35)' }} />
          </div>
          <div>
            <p className="font-bold text-[13px]" style={{ color: '#F1F5F9' }}>Full Inventory Report</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              View all {skus.length} SKUs with health, velocity &amp; OOS projections
            </p>
          </div>
        </div>
        <ArrowRight
          className="w-4 h-4 shrink-0 transition-all duration-200 group-hover:translate-x-1"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        />
      </motion.div>
    </div>
  );
}
