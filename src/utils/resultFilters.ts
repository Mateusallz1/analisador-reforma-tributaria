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

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function matchesSearchTerm(note: NFeAnalysis, searchTerm: string): boolean {
  const searchLower = searchTerm.toLowerCase();
  const searchDigits = onlyDigits(searchTerm);
  const matchesText = (value: string): boolean => value.toLowerCase().includes(searchLower);
  const matchesDocumentId = (value: string): boolean => {
    if (matchesText(value)) return true;
    return searchDigits.length > 0 && onlyDigits(value).includes(searchDigits);
  };

  return matchesText(note.numeroNota) ||
    matchesText(note.empresaFoco.nome) ||
    matchesDocumentId(note.empresaFoco.cnpj) ||
    matchesText(note.nomeEmitente) ||
    matchesDocumentId(note.cnpjEmitente) ||
    matchesText(note.nomeDestinatario) ||
    matchesDocumentId(note.cnpjDestinatario);
}

export function getFilteredResultGroups(allResults: NFeAnalysis[], filters: ResultFilters): FilteredResultGroups {
  const searchTerm = filters.searchTerm.trim();
  const matches = allResults.filter((note) => {
    const matchStatus = filters.statusFilter === 'ALL' || note.status === filters.statusFilter;
    const matchType = filters.typeFilter === 'ALL' || note.tipoNota === filters.typeFilter;
    const matchDocType = filters.docTypeFilter === 'ALL' || note.docType === filters.docTypeFilter;

    return matchesSearchTerm(note, searchTerm) && matchStatus && matchType && matchDocType;
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
