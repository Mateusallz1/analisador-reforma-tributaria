import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Building2, ChevronDown, ChevronRight, FileSpreadsheet } from 'lucide-react';
import type { DataIntegrityStatus, NFeAnalysis } from '../types';
import { calculateItemStats } from '../utils/analysisStats';
import { formatCnpjOrCpf } from '../utils/nfeParser';
import { getFilteredResultGroups } from '../utils/resultFilters';
import type { DocTypeFilter, StatusFilter, TypeFilter } from '../utils/resultFilters';
import { getTaxpayerDocumentStatusLabel } from '../utils/taxpayerId';
import { NoteDetailPanel } from './results/NoteDetailPanel';
import { ResultsFilters } from './results/ResultsFilters';
import { StatusBadge } from './results/StatusBadges';
import type { ResultsDropdown } from './results/types';

const NOTE_PAGE_SIZE = 100;

interface ResultsTableProps {
  allResults: NFeAnalysis[];
}

interface ResultSection {
  id: string;
  name: string;
  document: string;
  notes: NFeAnalysis[];
  incomplete?: boolean;
}

function PartySummary({
  name,
  document,
  documentStatus,
}: {
  name: string;
  document: string;
  documentStatus: DataIntegrityStatus;
}) {
  const documentStatusLabel = getTaxpayerDocumentStatusLabel(documentStatus);

  return (
    <span className="min-w-0">
      <strong className="block truncate text-xs font-medium text-slate-800" title={name || 'Não informado'}>
        {name || 'Não informado'}
      </strong>
      <span className={`mt-0.5 flex items-center gap-1 font-mono text-[10px] ${document ? 'text-slate-500' : 'font-medium text-amber-700'}`}>
        <span>{document ? formatCnpjOrCpf(document) : 'Documento não informado'}</span>
        {documentStatus !== 'VALID' && document && (
          <span title={documentStatusLabel} aria-label={documentStatusLabel}>
            <AlertTriangle className="h-3 w-3 text-amber-600" aria-hidden="true" />
          </span>
        )}
      </span>
    </span>
  );
}
function EmissionSummary({ note }: { note: NFeAnalysis }) {
  return (
    <span>
      <span className="block font-mono text-xs text-slate-700">{note.dataEmissao || 'Não informada'}</span>
      {note.emissionDateStatus !== 'VALID' && (
        <span className="mt-0.5 block text-[10px] font-medium text-amber-700">
          {note.emissionDateStatus === 'MISSING' ? 'Data não informada' : 'Data inválida'}
        </span>
      )}
    </span>
  );
}
function OperationSummary({ note }: { note: NFeAnalysis }) {
  const isSaida = note.tipoNota === 'SAÍDA';

  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
      {isSaida ? (
        <ArrowUpRight className="h-3 w-3 text-slate-400" aria-hidden="true" />
      ) : (
        <ArrowDownLeft className="h-3 w-3 text-slate-400" aria-hidden="true" />
      )}
      {isSaida ? 'Saída' : 'Entrada'}
    </span>
  );
}
function DocumentRow({ note, selected, onSelect }: { note: NFeAnalysis; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={selected}
      aria-controls={`document-detail-${note.id}`}
      data-note-layer="summary"
      className={`grid w-full min-w-[1100px] grid-cols-[24px_minmax(160px,.95fr)_100px_110px_minmax(180px,1fr)_minmax(180px,1fr)_170px] items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${selected ? 'bg-slate-50' : 'bg-white'}`}
    >
      <ChevronRight className={`mt-0.5 h-4 w-4 text-slate-400 transition-transform ${selected ? 'rotate-90' : ''}`} aria-hidden="true" />
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <strong className="font-mono text-sm text-slate-900">Nº {note.numeroNota || 'N/A'}</strong>
          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{note.docType}</span>
        </span>
        <span className="mt-1 block truncate text-[10px] text-slate-400" title={note.fileName}>{note.fileName}</span>
      </span>
      <OperationSummary note={note} />
      <EmissionSummary note={note} />
      <PartySummary name={note.nomeEmitente} document={note.cnpjEmitente} documentStatus={note.emitterDocumentStatus} />
      <PartySummary name={note.nomeDestinatario} document={note.cnpjDestinatario} documentStatus={note.recipientDocumentStatus} />
      <span><StatusBadge status={note.status} /></span>
    </button>
  );
}
function MobileDocumentRow({ note, selected, onSelect }: { note: NFeAnalysis; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={selected}
      aria-controls={`document-detail-${note.id}`}
      data-note-layer="summary"
      className={`w-full px-3 py-3 text-left ${selected ? 'bg-slate-100/70' : 'bg-white'}`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <strong className="font-mono text-sm text-slate-800">Nº {note.numeroNota || 'N/A'}</strong>
          <span className="ml-2 text-[10px] font-semibold text-slate-400">{note.docType}</span>
        </span>
        <ChevronRight className={`mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform ${selected ? 'rotate-90' : ''}`} aria-hidden="true" />
      </span>
      <span className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <span>
          <span className="block text-[10px] font-semibold uppercase text-slate-400">Operação</span>
          <span className="mt-0.5 block font-medium text-slate-700">{note.tipoNota === 'SAÍDA' ? 'Saída' : 'Entrada'}</span>
        </span>
        <span>
          <span className="block text-[10px] font-semibold uppercase text-slate-400">Emissão</span>
          <EmissionSummary note={note} />
        </span>
        <span className="col-span-2">
          <span className="block text-[10px] font-semibold uppercase text-slate-400">Emitente</span>
          <PartySummary name={note.nomeEmitente} document={note.cnpjEmitente} documentStatus={note.emitterDocumentStatus} />
        </span>
        <span className="col-span-2">
          <span className="block text-[10px] font-semibold uppercase text-slate-400">Destinatário</span>
          <PartySummary name={note.nomeDestinatario} document={note.cnpjDestinatario} documentStatus={note.recipientDocumentStatus} />
        </span>
        <span className="col-span-2">
          <span className="block text-[10px] font-semibold uppercase text-slate-400">Situação perante a Reforma</span>
          <span className="mt-1 block"><StatusBadge status={note.status} /></span>
        </span>
      </span>
    </button>
  );
}
export default function ResultsTable({ allResults }: ResultsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [docTypeFilter, setDocTypeFilter] = useState<DocTypeFilter>('ALL');
  const [openDropdown, setOpenDropdown] = useState<ResultsDropdown>('NONE');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(NOTE_PAGE_SIZE);

  const filtered = useMemo(() => getFilteredResultGroups(allResults, {
    searchTerm,
    statusFilter,
    typeFilter,
    docTypeFilter,
  }), [allResults, docTypeFilter, searchTerm, statusFilter, typeFilter]);

  const sections = useMemo<ResultSection[]>(() => {
    const grouped: ResultSection[] = filtered.activeGroups.map((group) => ({
      id: group.empresaFoco.cnpj,
      name: group.empresaFoco.nome,
      document: group.empresaFoco.cnpj,
      notes: group.notas,
    }));

    if (filtered.matchesWithoutCnpj.length > 0) {
      grouped.push({
        id: 'incomplete',
        name: 'Empresa não identificada',
        document: '',
        notes: filtered.matchesWithoutCnpj,
        incomplete: true,
      });
    }

    return grouped;
  }, [filtered.activeGroups, filtered.matchesWithoutCnpj]);

  const allFilteredNotes = useMemo(() => sections.flatMap((section) => section.notes), [sections]);
  const remainingNotes = Math.max(0, allFilteredNotes.length - visibleCount);

  useEffect(() => {
    setVisibleCount(NOTE_PAGE_SIZE);
    if (selectedNoteId && !allFilteredNotes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(null);
    }
  }, [allFilteredNotes, selectedNoteId]);

  const toggleGroup = (section: ResultSection) => {
    const isCurrentlyCollapsed = collapsedGroups[section.id] !== false;
    setCollapsedGroups((current) => ({ ...current, [section.id]: !isCurrentlyCollapsed }));
    if (!isCurrentlyCollapsed && section.notes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(null);
    }
  };

  const toggleNote = (noteId: string) => {
    setSelectedNoteId((current) => current === noteId ? null : noteId);
  };

  let renderedCount = 0;

  return (
    <div className="space-y-3">
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
        totalProcessedFiltered={filtered.totalProcessedFiltered}
        totalProcessed={filtered.totalProcessed}
      />

      {sections.length === 0 ? (
        <div className="border-y border-slate-200 bg-white px-6 py-12 text-center">
          <FileSpreadsheet className="mx-auto mb-3 h-9 w-9 text-slate-300" aria-hidden="true" />
          <h4 className="text-sm font-semibold text-slate-800">Nenhuma nota corresponde aos filtros</h4>
          <p className="mt-1 text-sm text-slate-500">Remova ou altere os filtros para ver outros documentos.</p>
        </div>
      ) : (
        <div id="results-grouped-list" className="space-y-3">
          {sections.map((section) => {
            const available = Math.max(0, visibleCount - renderedCount);
            const visibleNotes = section.notes.slice(0, available);
            renderedCount += visibleNotes.length;
            if (visibleNotes.length === 0) return null;

            const isCollapsed = collapsedGroups[section.id] !== false;
            const actionableCount = section.notes.filter((note) =>
              note.status === 'NÃO_CONFORME' || note.status === 'AUTORIZADA_COM_PENDENCIAS'
            ).length;
            const stats = calculateItemStats(section.notes);
            const actionableItems = stats.pendingItems + stats.nonCompliantItems;

            return (
              <section key={section.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm" aria-labelledby={`section-${section.id}`}>
                <button
                  type="button"
                  onClick={() => toggleGroup(section)}
                  aria-expanded={!isCollapsed}
                  aria-controls={`group-content-${section.id}`}
                  className="flex w-full items-center justify-between gap-4 bg-white px-4 py-4 text-left hover:bg-slate-50"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                      <Building2 className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <strong id={`section-${section.id}`} className="block truncate text-sm font-semibold text-slate-900">{section.name}</strong>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                        <span>{section.incomplete ? 'CNPJ/CPF não identificado' : `CNPJ/CPF: ${formatCnpjOrCpf(section.document)}`}</span>
                        <span className="text-slate-300" aria-hidden="true">•</span>
                        <span>{stats.totalItems} {stats.totalItems === 1 ? 'item' : 'itens'} ({stats.compliantItems} {stats.compliantItems === 1 ? 'conforme' : 'conformes'}{actionableItems > 0 ? `, ${actionableItems} para revisar` : ''})</span>
                        <span className="text-slate-300" aria-hidden="true">•</span>
                        <span className={stats.complianceRate === 100 ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
                          {stats.complianceRate}% conforme
                        </span>
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    {actionableCount > 0 && (
                      <span className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                        Ação recomendada ({actionableCount})
                      </span>
                    )}
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
                  </span>
                </button>
                {!isCollapsed && (
                  <div id={`group-content-${section.id}`} className="overflow-x-auto">
                    <div className="hidden min-w-[1100px] grid-cols-[24px_minmax(160px,.95fr)_100px_110px_minmax(180px,1fr)_minmax(180px,1fr)_170px] gap-3 border-y border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] font-semibold uppercase text-slate-500 lg:grid">
                      <span />
                      <span>Nota</span>
                      <span>Operação</span>
                      <span>Emissão</span>
                      <span>Emitente / CPF / CNPJ</span>
                      <span>Destinatário / CPF / CNPJ</span>
                      <span>Situação perante a Reforma</span>
                    </div>

                    {visibleNotes.map((note) => {
                      const isSelected = selectedNoteId === note.id;
                      return (
                        <div key={note.id} className="border-b border-slate-100 last:border-b-0">
                          <div className="hidden lg:block">
                            <DocumentRow note={note} selected={isSelected} onSelect={() => toggleNote(note.id)} />
                          </div>
                          <div className="lg:hidden">
                            <MobileDocumentRow note={note} selected={isSelected} onSelect={() => toggleNote(note.id)} />
                          </div>
                          {isSelected && <NoteDetailPanel note={note} onClose={() => setSelectedNoteId(null)} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          {remainingNotes > 0 && (
            <div className="border-y border-slate-200 bg-white px-3 py-3 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((current) => Math.min(current + NOTE_PAGE_SIZE, allFilteredNotes.length))}
                className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Mostrar mais {Math.min(NOTE_PAGE_SIZE, remainingNotes)} {Math.min(NOTE_PAGE_SIZE, remainingNotes) === 1 ? 'nota' : 'notas'}
              </button>
              <span className="ml-2 text-[11px] text-slate-400">{remainingNotes} restantes</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
