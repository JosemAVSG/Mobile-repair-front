import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { DataTable, type Column } from './DataTable';
import { Icon } from '../atoms/Icon';

export interface EntityListProps<T> {
  columns: Column<T>[];
  data: T[];
  renderCard?: (item: T) => ReactNode;
  loading?: boolean;
  emptyMessage?: string;
  searchFilter?: string;
  onRowClick?: (item: T) => void;
  keyExtractor: (item: T) => string | number;
  getRowClassName?: (item: T) => string;
  pageSize?: number;
  viewToggle?: boolean;
  storageKey?: string;
}

type ViewMode = 'list' | 'grid';

const CARD_SKELETON_CLASS =
  'h-28 animate-pulse rounded-xl border border-slate-200 bg-white';

/**
 * Lista de entidades con dos modos:
 * - Sin `renderCard`: delega en DataTable tal cual (cero cambios).
 * - Con `renderCard`: cards en mobile (< md) y toggle Lista/Grilla en
 *   desktop (>= md), con preferencia persistida en localStorage.
 */
export function EntityList<T>({
  columns,
  data,
  renderCard,
  loading = false,
  emptyMessage = 'No se encontraron registros',
  searchFilter,
  onRowClick,
  keyExtractor,
  getRowClassName,
  pageSize = 10,
  viewToggle = renderCard != null,
  storageKey = 'list',
}: EntityListProps<T>) {
  // Sin card personalizada → comportamiento original de DataTable.
  if (!renderCard) {
    return (
      <DataTable<T>
        columns={columns}
        data={data}
        loading={loading}
        emptyMessage={emptyMessage}
        searchFilter={searchFilter}
        onRowClick={onRowClick}
        keyExtractor={keyExtractor}
        getRowClassName={getRowClassName}
        pageSize={pageSize}
      />
    );
  }

  return (
    <EntityListWithCards<T>
      columns={columns}
      data={data}
      renderCard={renderCard}
      loading={loading}
      emptyMessage={emptyMessage}
      searchFilter={searchFilter}
      onRowClick={onRowClick}
      keyExtractor={keyExtractor}
      getRowClassName={getRowClassName}
      pageSize={pageSize}
      viewToggle={viewToggle}
      storageKey={storageKey}
    />
  );
}

interface EntityListWithCardsProps<T> extends EntityListProps<T> {
  renderCard: (item: T) => ReactNode;
}

function EntityListWithCards<T>({
  columns,
  data,
  renderCard,
  loading = false,
  emptyMessage = 'No se encontraron registros',
  searchFilter,
  onRowClick,
  keyExtractor,
  getRowClassName,
  pageSize = 10,
  viewToggle = true,
  storageKey = 'list',
}: EntityListWithCardsProps<T>) {
  // Preferencia de vista persistida en localStorage.
  const [view, setView] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem(storageKey) === 'grid' ? 'grid' : 'list';
    } catch {
      return 'list';
    }
  });

  useEffect(() => {
    if (!viewToggle) return;
    try {
      localStorage.setItem(storageKey, view);
    } catch {
      // localStorage no disponible (modo incógnito): ignorar.
    }
  }, [storageKey, view, viewToggle]);

  // Mismo predicado de búsqueda que DataTable, compartido por grid y mobile.
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

  // ───── Paginación de la vista Grid ─────

  const [gridPage, setGridPage] = useState(1);
  const [gridPageSize, setGridPageSize] = useState(pageSize);

  useEffect(() => {
    setGridPage(1);
  }, [searchFilter, view]);

  const totalGridPages = Math.max(1, Math.ceil(filtered.length / gridPageSize));
  const safeGridPage = Math.min(gridPage, totalGridPages);

  const paginatedGrid = useMemo(() => {
    const start = (safeGridPage - 1) * gridPageSize;
    return filtered.slice(start, start + gridPageSize);
  }, [filtered, safeGridPage, gridPageSize]);

  // ───── Render helpers ─────

  const renderSkeletons = () => (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={CARD_SKELETON_CLASS} />
      ))}
    </>
  );

  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-12">
      <Icon name="info" size={32} className="mb-3 text-slate-300" />
      <p className="text-sm text-slate-500">{emptyMessage}</p>
    </div>
  );

  const renderCardItem = (item: T) => {
    const rowClass = getRowClassName?.(item) ?? '';
    // Si la entidad aporta su propio color de fondo/borde (ej. resaltar
    // atrasada), no pisarlo con los defaults de la card.
    const hasCustomBg = rowClass.split(/\s+/).some((c) => c.startsWith('bg-'));
    const hasCustomBorderColor = rowClass
      .split(/\s+/)
      .some(
        (c) =>
          c.startsWith('border-') &&
          !/^border(-(t|b|l|r|s|e|x|y))?$/.test(c) &&
          !/^border-\d/.test(c),
      );

    return (
      <div
        key={keyExtractor(item)}
        onClick={() => onRowClick?.(item)}
        className={`rounded-xl border p-4 shadow-sm transition-colors ${
          hasCustomBg ? '' : 'bg-white'
        } ${hasCustomBorderColor ? '' : 'border-slate-200'} ${
          onRowClick ? 'cursor-pointer hover:shadow-md active:bg-slate-50' : ''
        } ${rowClass}`}
      >
        {renderCard(item)}
      </div>
    );
  };

  const renderPagination = () => (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
      <select
        aria-label="Filas por página"
        value={gridPageSize}
        onChange={(e) => {
          setGridPageSize(Number(e.target.value));
          setGridPage(1);
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
          onClick={() => setGridPage((p) => Math.max(1, p - 1))}
          disabled={safeGridPage <= 1}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          Anterior
        </button>
        <span className="text-sm text-slate-600">
          Página {safeGridPage} de {totalGridPages}
        </span>
        <button
          onClick={() => setGridPage((p) => Math.min(totalGridPages, p + 1))}
          disabled={safeGridPage >= totalGridPages}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          Siguiente
        </button>
      </div>
    </div>
  );

  const renderToggle = () => (
    <div className="mb-4 flex items-center justify-between">
      <span className="text-sm text-slate-500">
        {loading
          ? 'Cargando…'
          : `${filtered.length} ${filtered.length === 1 ? 'registro' : 'registros'}`}
      </span>
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setView('list')}
          aria-pressed={view === 'list'}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            view === 'list'
              ? 'bg-primary text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon name="menu" size={16} />
          Lista
        </button>
        <button
          type="button"
          onClick={() => setView('grid')}
          aria-pressed={view === 'grid'}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            view === 'grid'
              ? 'bg-primary text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon name="layers" size={16} />
          Grilla
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile (< md): cards, siempre */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          renderSkeletons()
        ) : filtered.length === 0 ? (
          renderEmpty()
        ) : (
          filtered.map(renderCardItem)
        )}
      </div>

      {/* Desktop (>= md) */}
      <div className="hidden md:block">
        {viewToggle && renderToggle()}

        {view === 'list' || !viewToggle ? (
          <DataTable<T>
            columns={columns}
            data={data}
            loading={loading}
            emptyMessage={emptyMessage}
            searchFilter={searchFilter}
            onRowClick={onRowClick}
            keyExtractor={keyExtractor}
            getRowClassName={getRowClassName}
            pageSize={pageSize}
          />
        ) : loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {renderSkeletons()}
          </div>
        ) : filtered.length === 0 ? (
          renderEmpty()
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedGrid.map(renderCardItem)}
            </div>
            {renderPagination()}
          </>
        )}
      </div>
    </>
  );
}