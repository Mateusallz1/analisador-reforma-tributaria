import { useMemo, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
} from 'lucide-react';
import { NFeAnalysis } from '../types';
import { formatCnpjOrCpf } from '../utils/nfeParser';
import { calculateItemStats } from '../utils/analysisStats';
import { getFilteredResultGroups } from '../utils/resultFilters';
import type { DocTypeFilter, StatusFilter, TypeFilter } from '../utils/resultFilters';
import { IncompleteDocumentsSection } from './results/IncompleteDocumentsSection';
import { ResultNotes } from './results/ResultNotes';
import { ResultsFilters } from './results/ResultsFilters';
import type { ExpandedNotes, ResultsDropdown } from './results/types';
import { isActionableNote } from './results/notePresentation';
interface ResultsTableProps {
  allResults: NFeAnalysis[];
}

export default function ResultsTable({ allResults }: ResultsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [docTypeFilter, setDocTypeFilter] = useState<DocTypeFilter>('ALL');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [openDropdown, setOpenDropdown] = useState<ResultsDropdown>('NONE');
  const [isIncompleteCollapsed, setIsIncompleteCollapsed] = useState(false);

  // Toggle single group collapse
  const toggleGroup = (cnpj: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [cnpj]: !prev[cnpj]
    }));
  };

  const toggleNote = (noteId: string) => {
    setExpandedNotes(prev => {
      let currentVal = prev[noteId];
      if (currentVal === undefined) {
        const note = allResults.find(n => n.id === noteId);
        const hasFailed = note ? isActionableNote(note) : false;
        currentVal = hasFailed;
      }
      return {
        ...prev,
        [noteId]: !currentVal
      };
    });
  };

  const { activeGroups, matchesWithoutCnpj, totalProcessedFiltered, totalProcessed } = useMemo(() => 
    getFilteredResultGroups(allResults, {
      searchTerm,
      statusFilter,
      typeFilter,
      docTypeFilter,
    }),
  [allResults, docTypeFilter, searchTerm, statusFilter, typeFilter]);

  return (
    <div className="space-y-6">
      
      <ResultsFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        docTypeFilter={docTypeFilter}
        setDocTypeFilter={setDocTypeFilter}
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
        totalProcessedFiltered={totalProcessedFiltered}
        totalProcessed={totalProcessed}
      />
      {/* Main Grouped Container */}
      {activeGroups.length === 0 && matchesWithoutCnpj.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-lg py-12 px-6 shadow-sm text-center">
          <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-4" aria-hidden="true" />
          <h4 className="font-sans font-semibold text-slate-800 text-md mb-1">Nenhuma nota corresponde aos filtros</h4>
          <p className="text-sm text-slate-500 font-sans max-w-sm mx-auto">
            Por favor, ajuste sua pesquisa ou marque a opção de exibir todos os resultados.
          </p>
        </div>
      ) : (
        <div id="results-grouped-list" className="space-y-4">
          {activeGroups.map((group) => {
            const isCollapsed = !!collapsedGroups[group.empresaFoco.cnpj];
            const hasCnpj = group.empresaFoco.cnpj && group.empresaFoco.cnpj !== 'desconhecido';
            const stats = calculateItemStats(group.notas);
            
            return (
              <div 
                key={group.empresaFoco.cnpj} 
                id={`group-${group.empresaFoco.cnpj}`}
                className="bg-white border border-slate-100 rounded-lg shadow-sm overflow-hidden"
              >
                {/* Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.empresaFoco.cnpj)}
                  className="w-full text-left bg-slate-50/50 p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                  aria-expanded={!isCollapsed}
                  aria-controls={`group-content-${group.empresaFoco.cnpj}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg shadow-sm">
                      <Building2 className="w-5 h-5 text-slate-400" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-sans font-bold text-slate-800 text-base">
                          {group.empresaFoco.nome}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-sans text-slate-500 mt-1">
                        <span>CNPJ/CPF: {hasCnpj ? formatCnpjOrCpf(group.empresaFoco.cnpj) : 'Não informado'}</span>
                        <span className="text-slate-300">•</span>
                        <span>
                          {stats.totalItems} {stats.totalItems === 1 ? 'item' : 'itens'}{' '}
                          ({stats.compliantItems} {stats.compliantItems === 1 ? 'conforme' : 'conformes'}
                          {stats.pendingItems > 0 && `, ${stats.pendingItems} c/ pendências`}
                          {stats.nonCompliantItems > 0 && `, ${stats.nonCompliantItems} não conforme`}
                          {stats.outOfScopeItems > 0 && `, ${stats.outOfScopeItems} fora do escopo`})
                        </span>
                        <span className="text-slate-300">•</span>
                        {stats.applicableItems > 0 ? (
                          <span className={`font-semibold ${
                            group.porcentagemEmConformidade === 100
                              ? 'text-emerald-600'
                              : group.porcentagemEmConformidade > 40
                                ? 'text-amber-600'
                                : 'text-rose-600'
                          }`}>
                            {group.porcentagemEmConformidade}% conforme
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-400">Sem itens de Reforma</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right indicators & Arrow */}
                  <div className="flex items-center gap-4 self-stretch sm:self-auto justify-end">
                    {group.naoConformeNotas > 0 && (
                      <span className="text-xs bg-rose-50 text-rose-700 border border-slate-200 py-1 px-2.5 rounded-lg font-sans font-medium">
                        Ação recomendada ({group.naoConformeNotas})
                      </span>
                    )}
                    <div>
                      {isCollapsed ? (
                        <ChevronDown className="w-5 h-5 text-slate-400" aria-hidden="true" />
                      ) : (
                        <ChevronUp className="w-5 h-5 text-slate-400" aria-hidden="true" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Table Body Content (if not collapsed) */}
                {!isCollapsed && (
                  <div id={`group-content-${group.empresaFoco.cnpj}`}>
                    <ResultNotes notes={group.notas} expandedNotes={expandedNotes} onToggleNote={toggleNote} />
                  </div>
                )}
              </div>
            );
          })}

          <IncompleteDocumentsSection
            notes={matchesWithoutCnpj}
            isCollapsed={isIncompleteCollapsed}
            onToggle={() => setIsIncompleteCollapsed((prev) => !prev)}
          />
        </div>
      )}

    </div>
  );
}
