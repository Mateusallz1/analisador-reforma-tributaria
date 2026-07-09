import type { Dispatch, ReactNode, SetStateAction } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Search,
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
  const hasActiveFilters = searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL' || docTypeFilter !== 'ALL';
  const typeMenuId = 'results-filter-type-menu';
  const statusMenuId = 'results-filter-status-menu';
  const docTypeMenuId = 'results-filter-document-type-menu';

  return (
    <>
      {openDropdown !== 'NONE' && (
        <div key="backdrop" className="fixed inset-0 z-10" onClick={() => setOpenDropdown('NONE')} aria-hidden="true" />
      )}

      <div className="bg-white border border-slate-200/85 rounded-lg p-4 shadow-sm z-20 relative">
        <div className="flex flex-col lg:flex-row gap-3.5 items-stretch lg:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" aria-hidden="true" />
            </span>
            <input
              type="text"
              id="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por Nota, CNPJ ou razão social..."
              aria-label="Buscar notas por número, CNPJ ou razão social"
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white hover:bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition-all placeholder:text-slate-400 shadow-sm"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((prev) => prev === 'TYPE' ? 'NONE' : 'TYPE')}
                aria-haspopup="menu"
                aria-expanded={openDropdown === 'TYPE'}
                aria-controls={typeMenuId}
                className={`flex items-center justify-between w-full sm:w-auto px-4 py-2 border rounded-lg text-sm font-semibold bg-white transition-all cursor-pointer shadow-sm hover:border-slate-300 min-w-[150px] ${
                  typeFilter !== 'ALL'
                    ? 'border-slate-600 text-slate-900 bg-slate-50/50'
                    : 'border-slate-200 text-slate-800'
                }`}
              >
                <span className="truncate">
                  {typeFilter === 'ALL' && "Todos os tipos"}
                  {typeFilter === 'SAÍDA' && "Saída (Emitente)"}
                  {typeFilter === 'ENTRADA' && "Entrada (Destinatário)"}
                </span>
                <ChevronDown className={`w-4 h-4 ml-2.5 text-slate-400 transition-transform duration-200 shrink-0 ${openDropdown === 'TYPE' ? 'rotate-180 text-slate-600' : ''}`} aria-hidden="true" />
              </button>

              {openDropdown === 'TYPE' && (
                <div id={typeMenuId} role="menu" className="absolute left-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 animate-fade-in divide-y divide-slate-100">
                  <MenuButton
                    isSelected={typeFilter === 'ALL'}
                    onClick={() => { setTypeFilter('ALL'); setOpenDropdown('NONE'); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors ${typeFilter === 'ALL' ? 'text-slate-900 bg-slate-50 font-bold' : 'text-slate-600'}`}
                  >
                    Todos os tipos
                  </MenuButton>
                  <MenuButton
                    isSelected={typeFilter === 'SAÍDA'}
                    onClick={() => { setTypeFilter('SAÍDA'); setOpenDropdown('NONE'); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 ${typeFilter === 'SAÍDA' ? 'text-slate-900 bg-slate-50 font-bold' : 'text-slate-600'}`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    Saída (Emitente)
                  </MenuButton>
                  <MenuButton
                    isSelected={typeFilter === 'ENTRADA'}
                    onClick={() => { setTypeFilter('ENTRADA'); setOpenDropdown('NONE'); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 ${typeFilter === 'ENTRADA' ? 'text-slate-900 bg-slate-50 font-bold' : 'text-slate-600'}`}
                  >
                    <ArrowDownLeft className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    Entrada (Destinatário)
                  </MenuButton>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((prev) => prev === 'STATUS' ? 'NONE' : 'STATUS')}
                aria-haspopup="menu"
                aria-expanded={openDropdown === 'STATUS'}
                aria-controls={statusMenuId}
                className={`flex items-center justify-between w-full sm:w-auto px-4 py-2 border rounded-lg text-sm font-semibold bg-white transition-all cursor-pointer shadow-sm hover:border-slate-300 min-w-[155px] ${
                  statusFilter === 'CONFORME'
                    ? 'border-emerald-250 text-emerald-800 bg-emerald-50/30'
                    : statusFilter === 'NÃO_CONFORME'
                      ? 'border-rose-200 text-rose-800 bg-rose-50/30'
                      : statusFilter === 'AUTORIZADA_COM_PENDENCIAS'
                        ? 'border-amber-200 text-amber-800 bg-amber-50/30'
                        : statusFilter !== 'ALL'
                          ? 'border-slate-600 text-slate-900 bg-slate-50/50'
                          : 'border-slate-200 text-slate-800'
                }`}
              >
                <span className="truncate">
                  {statusFilter === 'ALL' && "Todos os status"}
                  {statusFilter === 'CONFORME' && (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                      Conforme
                    </span>
                  )}
                  {statusFilter === 'AUTORIZADA_COM_PENDENCIAS' && (
                    <span className="text-amber-800 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                      Autorizada c/ pendências
                    </span>
                  )}
                  {statusFilter === 'NÃO_CONFORME' && (
                    <span className="text-rose-700 font-semibold flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" />
                      Não conforme
                    </span>
                  )}
                  {statusFilter === 'N/A' && (
                    <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                      Fora do escopo
                    </span>
                  )}
                </span>
                <ChevronDown className={`w-4 h-4 ml-2.5 text-slate-400 transition-transform duration-200 shrink-0 ${openDropdown === 'STATUS' ? 'rotate-180 text-slate-600' : ''}`} aria-hidden="true" />
              </button>

              {openDropdown === 'STATUS' && (
                <div id={statusMenuId} role="menu" className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 animate-fade-in divide-y divide-slate-100">
                  <MenuButton
                    isSelected={statusFilter === 'ALL'}
                    onClick={() => { setStatusFilter('ALL'); setOpenDropdown('NONE'); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors ${statusFilter === 'ALL' ? 'text-slate-900 bg-slate-50 font-bold' : 'text-slate-600'}`}
                  >
                    Todos os status
                  </MenuButton>
                  <MenuButton
                    isSelected={statusFilter === 'CONFORME'}
                    onClick={() => { setStatusFilter('CONFORME'); setOpenDropdown('NONE'); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 ${
                      statusFilter === 'CONFORME'
                        ? 'text-emerald-700 bg-emerald-50/40 font-bold'
                        : 'text-slate-600 hover:text-emerald-700'
                    }`}
                  >
                    <CheckCircle2 className={`w-4 h-4 ${statusFilter === 'CONFORME' ? 'text-emerald-500' : 'text-slate-400'}`} aria-hidden="true" />
                    Conforme
                  </MenuButton>
                  <MenuButton
                    isSelected={statusFilter === 'AUTORIZADA_COM_PENDENCIAS'}
                    onClick={() => { setStatusFilter('AUTORIZADA_COM_PENDENCIAS'); setOpenDropdown('NONE'); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 ${
                      statusFilter === 'AUTORIZADA_COM_PENDENCIAS'
                        ? 'text-amber-800 bg-amber-50/30 font-bold'
                        : 'text-slate-600 hover:text-amber-800'
                    }`}
                  >
                    <AlertTriangle className={`w-4 h-4 ${statusFilter === 'AUTORIZADA_COM_PENDENCIAS' ? 'text-amber-500' : 'text-slate-400'}`} aria-hidden="true" />
                    Autorizada c/ pendências
                  </MenuButton>
                  <MenuButton
                    isSelected={statusFilter === 'NÃO_CONFORME'}
                    onClick={() => { setStatusFilter('NÃO_CONFORME'); setOpenDropdown('NONE'); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 ${
                      statusFilter === 'NÃO_CONFORME'
                        ? 'text-rose-800 bg-rose-50/10 font-bold'
                        : 'text-slate-600 hover:text-rose-700'
                    }`}
                  >
                    <XCircle className={`w-4 h-4 ${statusFilter === 'NÃO_CONFORME' ? 'text-rose-500' : 'text-slate-400'}`} aria-hidden="true" />
                    Não conforme
                  </MenuButton>
                  <MenuButton
                    isSelected={statusFilter === 'N/A'}
                    onClick={() => { setStatusFilter('N/A'); setOpenDropdown('NONE'); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 ${
                      statusFilter === 'N/A'
                        ? 'text-slate-800 bg-slate-50 font-bold'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${statusFilter === 'N/A' ? 'bg-slate-500' : 'bg-slate-300'}`} />
                    Fora do escopo (sem Reforma)
                  </MenuButton>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((prev) => prev === 'DOCTYPE' ? 'NONE' : 'DOCTYPE')}
                aria-haspopup="menu"
                aria-expanded={openDropdown === 'DOCTYPE'}
                aria-controls={docTypeMenuId}
                className={`flex items-center justify-between w-full sm:w-auto px-4 py-2 border rounded-lg text-sm font-semibold bg-white transition-all cursor-pointer shadow-sm hover:border-slate-300 min-w-[165px] ${
                  docTypeFilter !== 'ALL'
                    ? 'border-slate-600 text-slate-900 bg-slate-50/50'
                    : 'border-slate-200 text-slate-800'
                }`}
              >
                <span className="truncate">
                  {docTypeFilter === 'ALL' && "Todos os modelos"}
                  {docTypeFilter === 'NFe' && "NFe"}
                  {docTypeFilter === 'NFCe' && "NFCe"}
                  {docTypeFilter === 'NFSe' && "NFSe"}
                </span>
                <ChevronDown className={`w-4 h-4 ml-2.5 text-slate-400 transition-transform duration-200 shrink-0 ${openDropdown === 'DOCTYPE' ? 'rotate-180 text-slate-600' : ''}`} aria-hidden="true" />
              </button>

              {openDropdown === 'DOCTYPE' && (
                <div id={docTypeMenuId} role="menu" className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 animate-fade-in divide-y divide-slate-100">
                  <MenuButton
                    isSelected={docTypeFilter === 'ALL'}
                    onClick={() => { setDocTypeFilter('ALL'); setOpenDropdown('NONE'); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors ${docTypeFilter === 'ALL' ? 'text-slate-900 bg-slate-50 font-bold' : 'text-slate-600'}`}
                  >
                    Todos os modelos
                  </MenuButton>
                  <MenuButton
                    isSelected={docTypeFilter === 'NFe'}
                    onClick={() => { setDocTypeFilter('NFe'); setOpenDropdown('NONE'); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors ${docTypeFilter === 'NFe' ? 'text-slate-900 bg-slate-50 font-bold' : 'text-slate-600'}`}
                  >
                    NF-e (Produto)
                  </MenuButton>
                  <MenuButton
                    isSelected={docTypeFilter === 'NFCe'}
                    onClick={() => { setDocTypeFilter('NFCe'); setOpenDropdown('NONE'); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors ${docTypeFilter === 'NFCe' ? 'text-slate-900 bg-slate-50 font-bold' : 'text-slate-600'}`}
                  >
                    NFC-e (Consumidor)
                  </MenuButton>
                  <MenuButton
                    isSelected={docTypeFilter === 'NFSe'}
                    onClick={() => { setDocTypeFilter('NFSe'); setOpenDropdown('NONE'); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors ${docTypeFilter === 'NFSe' ? 'text-slate-900 bg-slate-50 font-bold' : 'text-slate-600'}`}
                  >
                    NFS-e (Serviço)
                  </MenuButton>
                </div>
              )}
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between text-xs text-slate-500 font-sans border-t border-slate-200 pt-3.5 mt-3.5">
            <span>
              Filtrado: <strong className="text-slate-700">{totalProcessedFiltered}</strong> de <strong className="text-slate-700">{totalProcessed}</strong> itens encontrados nos critérios selecionados.
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setTypeFilter('ALL');
                setDocTypeFilter('ALL');
              }}
              className="text-indigo-600 hover:text-indigo-500 hover:underline font-medium cursor-pointer"
            >
              Excluir filtros
            </button>
          </div>
        )}
      </div>
    </>
  );
}