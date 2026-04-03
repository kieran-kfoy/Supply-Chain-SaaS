import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { ArrowUpDown, Search, Filter, Package, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

interface SkuHealthData {
  id: string;
  skuCode: string;
  productDescription: string;
  latestSnapshot: {
    availableQuantity: number;
    velocity30d: number;
    totalDaysOutstanding: number;
    oosDate: string;
    reorderStatus: 'CRITICAL' | 'REORDER_SOON' | 'MONITOR' | 'HEALTHY';
    demandFlag: 'SPIKE' | 'SOFTENING' | null;
  } | null;
}

const columnHelper = createColumnHelper<SkuHealthData>();

const columns = [
  columnHelper.accessor('skuCode', {
    header: 'SKU',
    cell: info => <span className="font-mono font-medium">{info.getValue()}</span>,
  }),
  columnHelper.accessor('productDescription', {
    header: 'Product',
    cell: info => <span className="text-white/80">{info.getValue()}</span>,
  }),
  columnHelper.accessor('latestSnapshot.availableQuantity', {
    header: 'Available',
    cell: info => <span className="font-mono">{info.getValue()?.toLocaleString() ?? '-'}</span>,
  }),
  columnHelper.accessor('latestSnapshot.velocity30d', {
    header: '30d Vel',
    cell: info => <span className="font-mono">{(info.getValue() ?? 0).toFixed(2)}</span>,
  }),
  columnHelper.accessor('latestSnapshot.totalDaysOutstanding', {
    header: 'Days Out',
    cell: info => <span className="font-mono">{(info.getValue() ?? 0).toFixed(0)}</span>,
  }),
  columnHelper.accessor('latestSnapshot.oosDate', {
    header: 'OOS Date',
    cell: info => {
      const date = info.getValue();
      return <span className="font-mono">{date ? format(new Date(date), 'MMM d, yyyy') : '-'}</span>;
    },
  }),
  columnHelper.accessor('latestSnapshot.reorderStatus', {
    header: 'Status',
    cell: info => {
      const status = info.getValue();
      if (!status) return <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>;
      const styles: Record<string, { bg: string; color: string; border: string }> = {
        CRITICAL:    { bg: 'rgba(248,113,113,0.12)', color: '#F87171', border: 'rgba(248,113,113,0.25)' },
        REORDER_SOON:{ bg: 'rgba(251,146,60,0.12)',  color: '#FB923C', border: 'rgba(251,146,60,0.25)' },
        MONITOR:     { bg: 'rgba(96,165,250,0.12)',  color: '#60A5FA', border: 'rgba(96,165,250,0.25)' },
        HEALTHY:     { bg: 'rgba(52,211,153,0.12)',  color: '#34D399', border: 'rgba(52,211,153,0.25)' },
      };
      const s = styles[status] ?? styles.MONITOR;
      return (
        <span
          className="status-badge"
          style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
        >
          {status.replace('_', ' ')}
        </span>
      );
    },
  }),
  columnHelper.display({
    id: 'action',
    header: '',
    cell: () => (
      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" />
    ),
  }),
];

export default function SkuHealthTable({ data }: { data: SkuHealthData[] }) {
  const navigate = useNavigate();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="section-card overflow-hidden">
      {/* Toolbar */}
      <div
        className="px-5 py-3.5 flex items-center justify-between gap-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.25)' }} />
          <input
            type="text"
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Search SKUs, products..."
            className="input-field pl-9 py-2 text-[13px]"
          />
        </div>
        <button className="btn-secondary text-[12px] py-2">
          <Filter className="w-3.5 h-3.5" />
          Filter
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} style={{ background: 'rgba(255,255,255,0.02)' }}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="data-table-header">
                    <div
                      className={clsx(
                        "flex items-center gap-1.5",
                        header.column.getCanSort() && "cursor-pointer select-none hover:text-white/60 transition-colors"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                onClick={() => navigate(`/inventory/${row.original.id}`)}
                className="group cursor-pointer transition-colors duration-100"
                style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="data-table-cell">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.length === 0 && (
        <div className="py-20 text-center">
          <Package className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.07)' }} />
          <p className="text-[14px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>No SKU data available</p>
          <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.18)' }}>Add a SKU or run a Shopify sync to get started</p>
        </div>
      )}
    </div>
  );
}
