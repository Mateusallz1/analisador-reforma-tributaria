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

function getMenuOptionClass(isSelected: boolean, withIcon = false): string {
  const base = withIcon
    ? 'flex w-full items-center gap-2 rounded-field px-3 py-2 text-left text-sm font-medium hover:bg-base-200'
    : 'w-full rounded-field px-3 py-2 text-left text-sm font-medium hover:bg-base-200';
  return base + (isSelected ? ' bg-base-200 font-semibold text-base-content' : ' text-base-content/70');
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

      <div className="relative z-20 rounded-2xl border border-base-300 bg-base-100 px-4 py-3 shadow-sm shadow-base-content/5">
        <div className="flex flex-col items-stretch justify-between gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1 lg:max-w-xl">
            <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3 text-base-content/40">
              <Search className="h-4 w-4" aria-hidden="true" />
            </span>
            <input
              type="text"
              id="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nota, CNPJ ou razão social"
              aria-label="Buscar notas por número, CNPJ ou razão social"
              className="input input-bordered input-sm w-full bg-base-100 pl-9"
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
                className="btn btn-outline btn-sm min-w-[150px] justify-between"
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
                  {statusFilter === 'PENDENTE' && (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                      Pendente
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
                  className={'h-4 w-4 shrink-0 text-base-content/40 transition-transform ' + (openDropdown === 'STATUS' ? 'rotate-180 text-base-content/70' : '')}
                  aria-hidden="true"
                />
              </button>

              {openDropdown === 'STATUS' && (
                <div
                  id={statusMenuId}
                  role="menu"
                  className="menu absolute right-0 mt-1.5 w-64 rounded-xl border border-base-300 bg-base-100 p-2 shadow-lg"
                >
                  <MenuButton
                    isSelected={statusFilter === 'ALL'}
                    onClick={() => { setStatusFilter('ALL'); setOpenDropdown('NONE'); }}
                    className={getMenuOptionClass(statusFilter === 'ALL')}
                  >
                    Todos os status
                  </MenuButton>
                  <MenuButton
                    isSelected={statusFilter === 'CONFORME'}
                    onClick={() => { setStatusFilter('CONFORME'); setOpenDropdown('NONE'); }}
                    className={getMenuOptionClass(statusFilter === 'CONFORME', true)}
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                    Conforme
                  </MenuButton>
                  <MenuButton
                    isSelected={statusFilter === 'AUTORIZADA_COM_PENDENCIAS'}
                    onClick={() => { setStatusFilter('AUTORIZADA_COM_PENDENCIAS'); setOpenDropdown('NONE'); }}
                    className={getMenuOptionClass(statusFilter === 'AUTORIZADA_COM_PENDENCIAS', true)}
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                    Autorizada c/ pendências
                  </MenuButton>
                  <MenuButton
                    isSelected={statusFilter === 'PENDENTE'}
                    onClick={() => { setStatusFilter('PENDENTE'); setOpenDropdown('NONE'); }}
                    className={getMenuOptionClass(statusFilter === 'PENDENTE', true)}
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                    Pendente
                  </MenuButton>
                  <MenuButton
                    isSelected={statusFilter === 'NÃO_CONFORME'}
                    onClick={() => { setStatusFilter('NÃO_CONFORME'); setOpenDropdown('NONE'); }}
                    className={getMenuOptionClass(statusFilter === 'NÃO_CONFORME', true)}
                  >
                    <XCircle className="h-4 w-4 text-rose-500" aria-hidden="true" />
                    Não conforme
                  </MenuButton>
                  <MenuButton
                    isSelected={statusFilter === 'N/A'}
                    onClick={() => { setStatusFilter('N/A'); setOpenDropdown('NONE'); }}
                    className={getMenuOptionClass(statusFilter === 'N/A')}
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
                'btn btn-sm ' +
                (hasAdvancedFilters
                  ? 'btn-neutral'
                  : 'btn-outline')
              }
            >
              <SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Mais filtros
              {hasAdvancedFilters && (
                <span className="status status-xs" aria-label="Filtros adicionais ativos" />
              )}
            </button>
          </div>
        </div>

        {openDropdown === 'MORE' && (
          <div
            id={advancedPanelId}
            role="dialog"
            aria-label="Mais filtros de documentos"
            className="mt-3 grid gap-3 border-t border-base-300 pt-3 sm:grid-cols-2"
          >
            <label className="flex items-center justify-between gap-3 text-xs font-semibold text-base-content/70">
              Tipo de operação
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className="select select-bordered select-sm min-w-[170px]"
                aria-label="Filtrar por tipo de operação"
              >
                <option value="ALL">Todos os tipos</option>
                <option value="SAÍDA">Saída (Emitente)</option>
                <option value="ENTRADA">Entrada (Destinatário)</option>
              </select>
            </label>

            <label className="flex items-center justify-between gap-3 text-xs font-semibold text-base-content/70">
              Modelo do documento
              <select
                value={docTypeFilter}
                onChange={(e) => setDocTypeFilter(e.target.value as DocTypeFilter)}
                className="select select-bordered select-sm min-w-[170px]"
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
          <div className="mt-3 flex flex-col items-start justify-between gap-2 border-t border-base-300 pt-3 text-xs text-base-content/60 sm:flex-row sm:items-center">
            <span>
              Filtrado: <strong>{totalProcessedFiltered}</strong> de{' '}
              <strong>{totalProcessed}</strong> itens
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="btn btn-link btn-xs px-0"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>
    </>
  );
}
