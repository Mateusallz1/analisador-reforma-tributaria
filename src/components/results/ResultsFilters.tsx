import type { Dispatch, ReactNode, SetStateAction } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Search,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react';
import type { DocTypeFilter, StatusFilter, TypeFilter } from '../../utils/resultFilters';
import type { ResultsDropdown } from './types';

interface ResultsFiltersProps {
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  statusFilter: StatusFilter;
  setStatusFilter: Dispatch<SetStateAction<StatusFilter>>;
  typeFilter: TypeFilter;
  setTypeFilter: Dispatch<SetStateAction<TypeFilter>>;
  docTypeFilter: DocTypeFilter;
  setDocTypeFilter: Dispatch<SetStateAction<DocTypeFilter>>;
  openDropdown: ResultsDropdown;
  setOpenDropdown: Dispatch<SetStateAction<ResultsDropdown>>;
  totalProcessedFiltered: number;
  totalProcessed: number;
}

interface MenuButtonProps {
  children: ReactNode;
  isSelected: boolean;
  onClick: () => void;
  className: string;
}

function MenuButton({ children, isSelected, onClick, className }: MenuButtonProps) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={isSelected}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  );
}

function getStatusButtonClass(status: StatusFilter): string {
  const base = 'inline-flex min-w-[150px] items-center justify-between gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold shadow-sm transition-colors';

  if (status === 'CONFORME') return base + ' border-emerald-200 bg-emerald-50/50 text-emerald-800';
  if (status === 'NÃO_CONFORME') return base + ' border-rose-200 bg-rose-50/50 text-rose-800';
  if (status === 'AUTORIZADA_COM_PENDENCIAS') return base + ' border-amber-200 bg-amber-50/50 text-amber-800';
  if (status === 'N/A') return base + ' border-slate-300 bg-slate-50 text-slate-700';
  return base + ' border-slate-200 bg-white text-slate-800';
}

function getMenuOptionClass(isSelected: boolean, selectedClass: string, withIcon = false): string {
  const base = withIcon
    ? 'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-slate-50'
    : 'w-full px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-slate-50';
  return base + (isSelected ? ' ' + selectedClass : ' text-slate-600');
}

export function ResultsFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  docTypeFilter,
  setDocTypeFilter,
  openDropdown,
  setOpenDropdown,
  totalProcessedFiltered,
  totalProcessed,
}: ResultsFiltersProps) {
  const hasActiveFilters = Boolean(
    searchTerm.trim() || statusFilter !== 'ALL' || typeFilter !== 'ALL' || docTypeFilter !== 'ALL',
  );
  const hasAdvancedFilters = typeFilter !== 'ALL' || docTypeFilter !== 'ALL';
  const statusMenuId = 'results-filter-status-menu';
  const advancedPanelId = 'results-advanced-filters';

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setDocTypeFilter('ALL');
  };

  return (
    <>
      {openDropdown !== 'NONE' && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setOpenDropdown('NONE')}
          aria-hidden="true"
        />
      )}

      <div className="relative z-20 border-y border-slate-200 bg-white px-0 py-3">
        <div className="flex flex-col items-stretch justify-between gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1 lg:max-w-xl">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-4 w-4" aria-hidden="true" />
            </span>
            <input
              type="text"
              id="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nota, CNPJ ou razão social"
              aria-label="Buscar notas por número, CNPJ ou razão social"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-4 text-sm shadow-sm transition-all placeholder:text-slate-400 hover:bg-white focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((previous) => previous === 'STATUS' ? 'NONE' : 'STATUS')}
                aria-haspopup="menu"
                aria-expanded={openDropdown === 'STATUS'}
                aria-controls={statusMenuId}
                className={getStatusButtonClass(statusFilter)}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {statusFilter === 'ALL' && 'Todos os status'}
                  {statusFilter === 'CONFORME' && (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                      Conforme
                    </>
                  )}
                  {statusFilter === 'AUTORIZADA_COM_PENDENCIAS' && (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                      Autorizada c/ pendências
                    </>
                  )}
                  {statusFilter === 'NÃO_CONFORME' && (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
                      Não conforme
                    </>
                  )}
                  {statusFilter === 'N/A' && 'Fora do escopo'}
                </span>
                <ChevronDown
                  className={'h-4 w-4 shrink-0 text-slate-400 transition-transform ' + (openDropdown === 'STATUS' ? 'rotate-180 text-slate-600' : '')}
                  aria-hidden="true"
                />
              </button>

              {openDropdown === 'STATUS' && (
                <div
                  id={statusMenuId}
                  role="menu"
                  className="absolute right-0 mt-1.5 w-64 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                >
                  <MenuButton
                    isSelected={statusFilter === 'ALL'}
                    onClick={() => { setStatusFilter('ALL'); setOpenDropdown('NONE'); }}
                    className={getMenuOptionClass(statusFilter === 'ALL', 'bg-slate-50 font-bold text-slate-900')}
                  >
                    Todos os status
                  </MenuButton>
                  <MenuButton
                    isSelected={statusFilter === 'CONFORME'}
                    onClick={() => { setStatusFilter('CONFORME'); setOpenDropdown('NONE'); }}
                    className={getMenuOptionClass(statusFilter === 'CONFORME', 'bg-emerald-50/40 font-bold text-emerald-700', true)}
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                    Conforme
                  </MenuButton>
                  <MenuButton
                    isSelected={statusFilter === 'AUTORIZADA_COM_PENDENCIAS'}
                    onClick={() => { setStatusFilter('AUTORIZADA_COM_PENDENCIAS'); setOpenDropdown('NONE'); }}
                    className={getMenuOptionClass(statusFilter === 'AUTORIZADA_COM_PENDENCIAS', 'bg-amber-50/30 font-bold text-amber-800', true)}
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                    Autorizada c/ pendências
                  </MenuButton>
                  <MenuButton
                    isSelected={statusFilter === 'NÃO_CONFORME'}
                    onClick={() => { setStatusFilter('NÃO_CONFORME'); setOpenDropdown('NONE'); }}
                    className={getMenuOptionClass(statusFilter === 'NÃO_CONFORME', 'bg-rose-50/30 font-bold text-rose-800', true)}
                  >
                    <XCircle className="h-4 w-4 text-rose-500" aria-hidden="true" />
                    Não conforme
                  </MenuButton>
                  <MenuButton
                    isSelected={statusFilter === 'N/A'}
                    onClick={() => { setStatusFilter('N/A'); setOpenDropdown('NONE'); }}
                    className={getMenuOptionClass(statusFilter === 'N/A', 'bg-slate-50 font-bold text-slate-800')}
                  >
                    Fora do escopo
                  </MenuButton>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setOpenDropdown((previous) => previous === 'MORE' ? 'NONE' : 'MORE')}
              aria-haspopup="dialog"
              aria-expanded={openDropdown === 'MORE'}
              aria-controls={advancedPanelId}
              className={
                'inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold shadow-sm transition-colors ' +
                (hasAdvancedFilters
                  ? 'border-slate-400 bg-slate-50 text-slate-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
              }
            >
              <SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Mais filtros
              {hasAdvancedFilters && (
                <span className="h-1.5 w-1.5 rounded-full bg-slate-700" aria-label="Filtros adicionais ativos" />
              )}
            </button>
          </div>
        </div>

        {openDropdown === 'MORE' && (
          <div
            id={advancedPanelId}
            role="dialog"
            aria-label="Mais filtros de documentos"
            className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2"
          >
            <label className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
              Tipo de operação
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className="min-w-[170px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                aria-label="Filtrar por tipo de operação"
              >
                <option value="ALL">Todos os tipos</option>
                <option value="SAÍDA">Saída (Emitente)</option>
                <option value="ENTRADA">Entrada (Destinatário)</option>
              </select>
            </label>

            <label className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
              Modelo do documento
              <select
                value={docTypeFilter}
                onChange={(e) => setDocTypeFilter(e.target.value as DocTypeFilter)}
                className="min-w-[170px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                aria-label="Filtrar por modelo do documento"
              >
                <option value="ALL">Todos os modelos</option>
                <option value="NFe">NF-e (Produto)</option>
                <option value="NFCe">NFC-e (Consumidor)</option>
                <option value="NFSe">NFS-e (Serviço)</option>
              </select>
            </label>
          </div>
        )}

        {hasActiveFilters && (
          <div className="mt-3 flex flex-col items-start justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 sm:flex-row sm:items-center">
            <span>
              Filtrado: <strong className="text-slate-700">{totalProcessedFiltered}</strong> de{' '}
              <strong className="text-slate-700">{totalProcessed}</strong> itens
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>
    </>
  );
}