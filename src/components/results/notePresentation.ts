import { NFeAnalysis } from '../../types';
import type { ExpandedNotes } from './types';

export function isActionableNote(note: NFeAnalysis): boolean {
  return note.status === 'NÃO_CONFORME' || note.status === 'AUTORIZADA_COM_PENDENCIAS';
}

export function getNoteExpansionState(note: NFeAnalysis, expandedNotes: ExpandedNotes): boolean {
  return expandedNotes[note.id] !== undefined ? !!expandedNotes[note.id] : isActionableNote(note);
}

export function getMissingFocusInfoMessage(note: NFeAnalysis): string {
  return note.tipoNota === 'SAÍDA'
    ? 'CNPJ/CPF do Emitente ausente (Foco da Saída)'
    : 'CNPJ/CPF do Destinatário ausente (Foco da Entrada)';
}