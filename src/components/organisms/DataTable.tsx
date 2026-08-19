import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { Icon } from '../atoms/Icon';

export interface Column<T> {
  key: keyof T & string;
  label: string;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  searchFilter?: string;
  onRowClick?: (item: T) => void;
  keyExtractor: (item: T) => string | number;
  getRowClassName?: (item: T) => string;
  pageSize?: number;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No se encontraron registros',
  searchFilter,
  onRowClick,
  keyExtractor,
  getRowClassName,
  pageSize = 10,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [selectablePageSize, setSelectablePageSize] = useState(pageSize);

  useEffect(() => {
    setPage(1);
  }, [searchFilter, sortKey, sortDir]);

  // Client-side filtering
  const filtered = useMemo(() => {
    if (!searchFilter) return data;
    const lower = searchFilter.toLowerCase();
    return data.filter((item) =>
      columns.some((col) => {
        const val = item[col.key];
        return val != null && String(val).toLowerCase().includes(lower);
      }),
    );
  }, [data, searchFilter, columns]);

  // Client-side sorting
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey as keyof T];
      const bVal = b[sortKey as keyof T];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp =
        typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / selectablePageSize));
  const safePage = Math.min(page, totalPages);

  const paginated = useMemo(() => {
    const start = (safePage - 1) * selectablePageSize;
    return sorted.slice(start, start + selectablePageSize);
  }, [sorted, safePage, selectablePageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIndicator = ({ columnKey }: { columnKey: string }) => {
    if (sortKey !== columnKey)
      return (
        <Icon
          name="chevron-up"
          size={14}
          className="ml-1 shrink-0 text-slate-300"
        />
      );
    return (
      <Icon
        name={sortDir === 'asc' ? 'chevron-up' : 'chevron-down'}
        size={14}
        className="ml-1 shrink-0 text-blue-600"
      />
    );
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full table-auto">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-slate-100">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Empty state
  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-12">
        <Icon
          name="info"
          size={32}
          className="mb-3 text-slate-300"
        />
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  // Data table
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full table-auto">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 ${
                  col.sortable ? 'cursor-pointer select-none hover:text-slate-700' : ''
                }`}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <span className="inline-flex items-center">
                  {col.label}
                  {col.sortable && <SortIndicator columnKey={col.key} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginated.map((item) => (
            <tr
              key={keyExtractor(item)}
              className={`border-b border-slate-100 transition-colors last:border-0 ${
                onRowClick
                  ? 'cursor-pointer hover:bg-slate-50'
                  : ''
              } ${getRowClassName?.(item) ?? ''}`}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col) => (
                <td key={col.key} className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                  {col.render ? col.render(item) : String(item[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
        <select
          aria-label="Filas por página"
          value={selectablePageSize}
          onChange={(e) => {
            setSelectablePageSize(Number(e.target.value));
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
        >
          {[10, 25, 50].map((size) => (
            <option key={size} value={size}>
              {size} / página
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            Anterior
          </button>
          <span className="text-sm text-slate-600">
            Página {safePage} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
