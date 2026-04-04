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
  unitsOnOrder: number;
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
  columnHelper.accessor('unitsOnOrder', {
    header: 'On Order',
    cell: info => {
      const val = info.getValue();
      return <span className={clsx("font-mono", val > 0 && "text-blue-400")}>{val > 0 ? val.toLocaleString() : '—'}</span>;
    },
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
      if (!status) return <span className="text-white/30">—</span>;
      const colors = {
        CRITICAL: 'bg-critical text-white',
        REORDER_SOON: 'bg-reorder text-white',
        MONITOR: 'bg-monitor text-white',
        HEALTHY: 'bg-healthy text-white',
      };
      return (
        <span className={clsx("status-badge", colors[status])}>
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
    <div className="bg-bg-card rounded-2xl border border-border-subtle overflow-hidden">
      <div className="p-4 border-b border-border-subtle flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Search SKUs or products..."
            className="w-full bg-white/5 border border-border-subtle rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-border-subtle rounded-xl text-sm font-medium hover:bg-white/10 transition-all">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="data-table-header">
                    <div
                      className={clsx(
                        header.column.getCanSort() && "cursor-pointer select-none flex items-center gap-2 hover:text-white transition-colors"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && <ArrowUpDown className="w-3 h-3" />}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                onClick={() => navigate(`/inventory/${row.original.id}`)}
                className="hover:bg-white/[0.04] transition-colors group cursor-pointer"
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
          <Package className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/50 font-medium">No SKU data available</p>
        </div>
      )}
    </div>
  );
}
