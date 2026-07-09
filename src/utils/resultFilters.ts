import { ComplianceStatus, DocType, GroupedAnalysis, NFeAnalysis, NFeType } from '../types';
import { getNoteItemCount, groupAnalysesByEmpresaFoco } from './analysisStats';

export type StatusFilter = 'ALL' | ComplianceStatus;
export type TypeFilter = 'ALL' | NFeType;
export type DocTypeFilter = 'ALL' | DocType;

export interface ResultFilters {
  searchTerm: string;
  statusFilter: StatusFilter;
  typeFilter: TypeFilter;
  docTypeFilter: DocTypeFilter;
}

export interface FilteredResultGroups {
  activeGroups: GroupedAnalysis[];
  matchesWithoutCnpj: NFeAnalysis[];
  totalProcessedFiltered: number;
  totalProcessed: number;
}

function matchesSearchTerm(note: NFeAnalysis, searchLower: string): boolean {
  return note.numeroNota.includes(searchLower) ||
    note.empresaFoco.nome.toLowerCase().includes(searchLower) ||
    note.empresaFoco.cnpj.includes(searchLower) ||
    note.nomeEmitente.toLowerCase().includes(searchLower) ||
    note.cnpjEmitente.includes(searchLower) ||
    note.nomeDestinatario.toLowerCase().includes(searchLower) ||
    note.cnpjDestinatario.includes(searchLower);
}

export function getFilteredResultGroups(allResults: NFeAnalysis[], filters: ResultFilters): FilteredResultGroups {
  const searchLower = filters.searchTerm.toLowerCase();
  const matches = allResults.filter((note) => {
    const matchStatus = filters.statusFilter === 'ALL' || note.status === filters.statusFilter;
    const matchType = filters.typeFilter === 'ALL' || note.tipoNota === filters.typeFilter;
    const matchDocType = filters.docTypeFilter === 'ALL' || note.docType === filters.docTypeFilter;

    return matchesSearchTerm(note, searchLower) && matchStatus && matchType && matchDocType;
  });

  const matchesWithCnpj = matches.filter((note) => note.empresaFoco.cnpj && note.empresaFoco.cnpj.trim() !== '');
  const matchesWithoutCnpj = matches.filter((note) => !note.empresaFoco.cnpj || note.empresaFoco.cnpj.trim() === '');
  const activeGroups = groupAnalysesByEmpresaFoco(matchesWithCnpj);
  const totalProcessedFiltered = activeGroups.reduce((acc, group) => acc + group.totalNotas, 0) +
    matchesWithoutCnpj.reduce((acc, note) => acc + getNoteItemCount(note), 0);
  const totalProcessed = allResults.reduce((acc, note) => acc + getNoteItemCount(note), 0);

  return {
    activeGroups,
    matchesWithoutCnpj,
    totalProcessedFiltered,
    totalProcessed,
  };
}
