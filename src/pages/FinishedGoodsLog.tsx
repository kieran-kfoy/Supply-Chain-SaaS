import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Truck, CheckCircle2, AlertCircle, Plus, Trash2, Loader2, ArrowUpDown, Search, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import LogShipmentModal from '../components/LogShipmentModal';

type SortKey = 'shipDate' | 'poNumber' | 'skuCode' | 'unitsShipped' | 'trackingNumber' | 'status';
type SortDir = 'asc' | 'desc';

function sortShipments(list: any[], key: SortKey, dir: SortDir) {
  return [...list].sort((a, b) => {
    let va: any, vb: any;
    switch (key) {
      case 'shipDate': va = new Date(a.shipDate).getTime(); vb = new Date(b.shipDate).getTime(); break;
      case 'poNumber': va = a.po?.poNumber ?? ''; vb = b.po?.poNumber ?? ''; break;
      case 'skuCode': va = a.sku?.skuCode ?? ''; vb = b.sku?.skuCode ?? ''; break;
      case 'unitsShipped': va = a.unitsShipped; vb = b.unitsShipped; break;
      case 'trackingNumber': va = a.trackingNumber ?? ''; vb = b.trackingNumber ?? ''; break;
      case 'status': va = a.received ? 1 : 0; vb = b.received ? 1 : 0; break;
    }
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

function SortHeader({ label, sortKey, currentKey, currentDir, onSort }: {
  label: string; sortKey: SortKey; currentKey: SortKey | null; currentDir: SortDir; onSort: (k: SortKey) => void;
}) {
  return (
    <th className="data-table-header">
      <div
        className="cursor-pointer select-none flex items-center gap-2 hover:text-white transition-colors"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <ArrowUpDown className={clsx("w-3 h-3", currentKey === sortKey ? 'text-white' : 'text-white/20')} />
      </div>
    </th>
  );
}

export default function FinishedGoodsLog() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [view, setView] = React.useState<'open' | 'closed'>('open');
  const [sortKey, setSortKey] = React.useState<SortKey | null>(null);
  const [sortDir, setSortDir] = React.useState<SortDir>('asc');
  const [search, setSearch] = React.useState('');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const { data: shipments } = useQuery({
    queryKey: ['shipments'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/shipments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.data;
    }
  });

  const receiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.patch(`/api/v1/shipments/${id}/receive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    }
  });

  const unreceiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.patch(`/api/v1/shipments/${id}/unreceive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/v1/shipments/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setDeletingId(null);
    }
  });

  const handleReceiveToggle = (id: string, currentlyReceived: boolean) => {
    if (currentlyReceived) {
      unreceiveMutation.mutate(id);
    } else {
      receiveMutation.mutate(id);
    }
  };

  const togglePending = receiveMutation.isPending || unreceiveMutation.isPending;
  const toggleVariables = receiveMutation.isPending ? receiveMutation.variables : unreceiveMutation.variables;

  const openShipments = shipments?.filter((s: any) => !s.received) ?? [];
  const closedShipments = shipments?.filter((s: any) => s.received) ?? [];
  const viewShipments = view === 'open' ? openShipments : closedShipments;

  const filtered = viewShipments.filter((s: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.sku?.skuCode?.toLowerCase().includes(q) ||
      s.sku?.productDescription?.toLowerCase().includes(q) ||
      s.trackingNumber?.toLowerCase().includes(q) ||
      s.po?.poNumber?.toLowerCase().includes(q)
    );
  });

  const sorted = sortKey ? sortShipments(filtered, sortKey, sortDir) : filtered;

  const handleExport = () => {
    if (!shipments?.length) return;
    const headers = ['Ship Date', 'PO #', 'SKU', 'Description', 'Units', 'Tracking', 'Status', 'Received'];
    const rows = shipments.map((s: any) => [
      format(new Date(s.shipDate), 'MM/dd/yy'),
      s.po?.poNumber ?? 'N/A',
      s.sku?.skuCode ?? '',
      s.sku?.productDescription ?? '',
      s.unitsShipped,
      s.trackingNumber ?? '',
      s.received ? 'Received' : 'In Transit',
      s.received ? 'Yes' : 'No',
    ]);
    downloadCsv('shipments-export.csv', headers, rows);
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 className="text-3xl font-bold tracking-tight">Finished Goods Shipping Log</h2>
          <p className="text-white/50 mt-1">Track production completion and warehouse transit</p>
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
            className="bg-white text-black px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-white/90 transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            Log New Shipment
          </button>
        </div>
      </header>

      <LogShipmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Delete confirm */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-bg-card border border-border-subtle w-full max-w-sm rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold">Delete Shipment?</h3>
            <p className="text-white/50 text-sm">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingId(null)} className="flex-1 py-2.5 rounded-xl border border-border-subtle text-sm font-medium hover:bg-white/5 transition-all">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-critical text-white text-sm font-bold hover:bg-critical/80 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleteMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">Received</p>
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

      {/* Toggle buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('open')}
          className={clsx(
            "px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
            view === 'open'
              ? 'bg-white text-black'
              : 'bg-white/5 border border-border-subtle text-white/50 hover:bg-white/10'
          )}
        >
          Open ({openShipments.length})
        </button>
        <button
          onClick={() => setView('closed')}
          className={clsx(
            "px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
            view === 'closed'
              ? 'bg-white text-black'
              : 'bg-white/5 border border-border-subtle text-white/50 hover:bg-white/10'
          )}
        >
          Closed ({closedShipments.length})
        </button>
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search shipments, tracking, SKUs..."
          className="w-full bg-white/5 border border-border-subtle rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
        />
      </div>

      {/* Shipment Table — Column order: Ship Date, PO #, SKU, Units, Tracking, Status, Received? */}
      <div className="bg-bg-card border border-border-subtle rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle">
                <SortHeader label="Ship Date" sortKey="shipDate" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="PO #" sortKey="poNumber" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="SKU" sortKey="skuCode" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Units" sortKey="unitsShipped" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Tracking" sortKey="trackingNumber" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <th className="data-table-header">Received?</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((shipment: any) => (
                <tr key={shipment.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="data-table-cell font-mono text-white/60">
                    {format(new Date(shipment.shipDate), 'MM/dd/yy')}
                  </td>
                  <td className="data-table-cell font-mono text-white/80">{shipment.po?.poNumber ?? 'N/A'}</td>
                  <td className="data-table-cell">
                    <div
                      className="flex flex-col cursor-pointer hover:text-blue-400 transition-colors"
                      onClick={() => navigate(`/inventory/${shipment.skuId}`)}
                    >
                      <span className="font-mono text-xs">{shipment.sku.skuCode}</span>
                      <span className="text-[10px] text-white/40 truncate max-w-[120px]">{shipment.sku.productDescription}</span>
                    </div>
                  </td>
                  <td className="data-table-cell font-mono font-bold">{shipment.unitsShipped.toLocaleString()}</td>
                  <td className="data-table-cell">
                    <span className="font-mono font-bold text-sm">{shipment.trackingNumber ?? 'No Tracking'}</span>
                  </td>
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
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        {togglePending && toggleVariables === shipment.id ? (
                          <Loader2 size={16} className="animate-spin text-white/40" />
                        ) : (
                          <input
                            type="checkbox"
                            checked={shipment.received}
                            onChange={() => handleReceiveToggle(shipment.id, shipment.received)}
                            className="w-4 h-4 rounded border-border-subtle bg-white/5 accent-emerald-500 cursor-pointer"
                          />
                        )}
                      </label>
                      <button
                        onClick={() => setDeletingId(shipment.id)}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-critical/20 text-white/40 hover:text-critical transition-all"
                        title="Delete shipment"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Truck className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <p className="text-white/30 italic">No {view} shipments</p>
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
