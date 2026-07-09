import { Fragment } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { NFeAnalysis } from '../../types';
import { DocumentIdentity } from './DocumentIdentity';
import { ItemStatusBadge, StatusBadge } from './StatusBadges';
import { OperationBadge } from './OperationBadge';
import { PartyInfo } from './PartyInfo';
import type { ExpandedNotes } from './types';
import { getNoteExpansionState, isActionableNote } from './notePresentation';

interface ResultNotesProps {
  notes: NFeAnalysis[];
  expandedNotes: ExpandedNotes;
  onToggleNote: (noteId: string) => void;
}

function getItemHighlightClass(itemStatus?: string): string {
  if (itemStatus === 'fora_vigencia' || itemStatus === 'classificacao_invalida') return 'border-rose-100 bg-rose-50/20';
  if (itemStatus === 'nao_conforme_valor' || itemStatus === 'incompleto') return 'border-amber-100 bg-amber-50/20';
  return 'border-slate-100 bg-white';
}

function getItemRowClass(itemStatus?: string): string {
  if (itemStatus === 'fora_vigencia' || itemStatus === 'classificacao_invalida') return 'bg-rose-50/15 hover:bg-rose-50/30';
  if (itemStatus === 'nao_conforme_valor' || itemStatus === 'incompleto') return 'bg-amber-50/10 hover:bg-amber-50/20';
  return 'hover:bg-slate-50/50';
}

function getItemStatusTextClass(itemStatus?: string): string {
  if (itemStatus === 'fora_vigencia' || itemStatus === 'classificacao_invalida') return 'text-rose-700 font-semibold';
  if (itemStatus === 'nao_conforme_valor' || itemStatus === 'incompleto') return 'text-amber-800 font-medium';
  return 'text-slate-500';
}

function getCstSummary(note: NFeAnalysis): string {
  return note.contemIBSCBS ? `[CST ${Array.from(new Set(note.itens?.map((item) => item.cst).filter(Boolean))).join(', ')}]` : '';
}

interface NoteToggleButtonProps {
  noteId: string;
  isExpanded: boolean;
  controlsId: string;
  className: string;
  iconClassName: string;
  onToggleNote: (noteId: string) => void;
}

function NoteToggleButton({ noteId, isExpanded, controlsId, className, iconClassName, onToggleNote }: NoteToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onToggleNote(noteId)}
      className={className}
      title={isExpanded ? 'Recolher itens' : 'Expandir itens'}
      aria-label={isExpanded ? 'Recolher itens da nota' : 'Expandir itens da nota'}
      aria-expanded={isExpanded}
      aria-controls={controlsId}
    >
      {isExpanded ? (
        <ChevronUp className={iconClassName} aria-hidden="true" />
      ) : (
        <ChevronDown className={iconClassName} aria-hidden="true" />
      )}
    </button>
  );
}

function CstSummaryBlock({ note, isExpanded, controlsId, onToggleNote }: {
  note: NFeAnalysis;
  isExpanded: boolean;
  controlsId: string;
  onToggleNote: (noteId: string) => void;
}) {
  if (note.itens && note.itens.length > 1) {
    return (
      <button
        type="button"
        onClick={() => onToggleNote(note.id)}
        className="text-left font-medium text-slate-700"
        aria-expanded={isExpanded}
        aria-controls={controlsId}
      >
        {note.itens.length} itens {getCstSummary(note)}
      </button>
    );
  }

  if (note.contemIBSCBS) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono font-semibold text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
          CST {note.cst || '–'}
        </span>
        <span className="font-mono font-semibold text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
          CCT {note.cClassTrib || '–'}
        </span>
      </div>
    );
  }

  return <span className="font-mono text-slate-400 italic">IBSCBS ausente</span>;
}

function MobileItemDetails({ note }: { note: NFeAnalysis }) {
  if (!note.itens || note.itens.length === 0) return null;

  return (
    <div id={`note-items-mobile-${note.id}`} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      {note.itens.map((item) => (
        <div key={item.numeroItem} className={`rounded-lg border p-2 text-xs ${getItemHighlightClass(item.itemStatus)}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono text-[10px] font-bold text-slate-400">#{item.numeroItem}</div>
              <div className="font-medium text-slate-800">{item.descricaoProduto}</div>
            </div>
            <ItemStatusBadge status={item.itemStatus} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[10px]">
            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-600">
              CST {item.contemIBSCBS && item.cst ? item.cst : 'ausente'}
            </span>
            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-600">
              CCT {item.contemIBSCBS && item.cClassTrib ? item.cClassTrib : 'ausente'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {item.validationReason || 'Nota não possui informações da Reforma Tributária.'}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ResultNotes({ notes, expandedNotes, onToggleNote }: ResultNotesProps) {
  return (
    <>
      <div className="space-y-3 p-3 lg:hidden">
        {notes.map((note) => {
          const isSaida = note.tipoNota === 'SAÍDA';
          const isNoteExpanded = getNoteExpansionState(note, expandedNotes);
          const controlsId = `note-items-mobile-${note.id}`;

          return (
            <div key={note.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DocumentIdentity
                    numeroNota={note.numeroNota}
                    docType={note.docType}
                    fileName={note.fileName}
                    docTypeFallback="NFe"
                    numberClassName="font-mono text-sm font-semibold text-slate-900"
                    modelClassName="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-normal font-sans bg-slate-100 text-slate-700 border border-slate-200"
                    fileClassName="mt-1 truncate text-[10px] text-slate-400"
                    rowClassName="flex flex-wrap items-center gap-2"
                  >
                    <StatusBadge status={note.status} />
                  </DocumentIdentity>
                </div>

                {note.itens && note.itens.length > 0 && (
                  <NoteToggleButton
                    noteId={note.id}
                    isExpanded={isNoteExpanded}
                    controlsId={controlsId}
                    onToggleNote={onToggleNote}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                    iconClassName="h-4 w-4"
                  />
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <OperationBadge isSaida={isSaida} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700" iconClassName="h-3.5 w-3.5 text-slate-400" />
                <span className="font-mono text-slate-500">{note.dataEmissao}</span>
              </div>

              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <PartyInfo
                  label="Emitente"
                  name={note.nomeEmitente}
                  cnpj={note.cnpjEmitente}
                  containerClassName={`min-w-0 rounded-lg border p-2 ${isSaida ? 'border-slate-300 bg-slate-50' : 'border-slate-100 bg-white'}`}
                  nameClassName="truncate font-semibold text-slate-800"
                  cnpjClassName="mt-0.5 font-mono text-[10px] text-slate-500"
                />
                <PartyInfo
                  label="Destinatário"
                  name={note.nomeDestinatario}
                  cnpj={note.cnpjDestinatario}
                  containerClassName={`min-w-0 rounded-lg border p-2 ${!isSaida ? 'border-slate-300 bg-slate-50' : 'border-slate-100 bg-white'}`}
                  nameClassName="truncate font-semibold text-slate-800"
                  cnpjClassName="mt-0.5 font-mono text-[10px] text-slate-500"
                />
              </div>

              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-xs">
                <CstSummaryBlock note={note} isExpanded={isNoteExpanded} controlsId={controlsId} onToggleNote={onToggleNote} />
                {note.validationReason && (
                  <div className="mt-1 text-[11px] text-slate-500">
                    {note.validationReason}
                  </div>
                )}
              </div>

              {note.itens && note.itens.length > 0 && isNoteExpanded && <MobileItemDetails note={note} />}
            </div>
          );
        })}
      </div>

      <div className="hidden w-full overflow-x-auto lg:block">
        <table className="min-w-[1080px] divide-y divide-slate-100 text-left">
          <thead>
            <tr className="bg-slate-100/40 text-slate-500 text-[11px] font-sans font-medium tracking-normal border-b border-slate-100">
              <th className="py-3 px-4">Código / nota</th>
              <th className="py-3 px-4">Operação</th>
              <th className="py-3 px-4">Emissão</th>
              <th className="py-3 px-4">Emitente / CPF / CNPJ</th>
              <th className="py-3 px-4">Destinatário / CPF / CNPJ</th>
              <th className="py-3 px-4">CST / Classificação (LC 214)</th>
              <th className="py-3 px-4">Status geral</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm font-sans text-slate-600">
            {notes.map((note) => {
              const isSaida = note.tipoNota === 'SAÍDA';
              const hasFailedItems = isActionableNote(note);
              const isNoteExpanded = getNoteExpansionState(note, expandedNotes);
              const controlsId = `note-items-desktop-${note.id}`;

              return (
                <Fragment key={note.id}>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-sans">
                      <DocumentIdentity
                        numeroNota={note.numeroNota}
                        docType={note.docType}
                        fileName={note.fileName}
                        docTypeFallback="NFe"
                        numberClassName="font-semibold text-slate-800 font-mono"
                        modelClassName="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-normal font-sans bg-slate-100 text-slate-700 border border-slate-200"
                        fileClassName="text-[10px] text-slate-400 truncate max-w-[150px] mt-0.5 ml-5"
                        leadingContent={note.itens && note.itens.length > 0 ? (
                          <NoteToggleButton
                            noteId={note.id}
                            isExpanded={isNoteExpanded}
                            controlsId={controlsId}
                            onToggleNote={onToggleNote}
                            className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition cursor-pointer"
                            iconClassName="w-3.5 h-3.5"
                          />
                        ) : undefined}
                      />
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <OperationBadge isSaida={isSaida} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60" iconClassName="w-3.5 h-3.5 text-slate-400" />
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-slate-500">
                      {note.dataEmissao}
                    </td>

                    <td className="py-3.5 px-4 max-w-[200px]">
                      <PartyInfo
                        name={note.nomeEmitente}
                        cnpj={note.cnpjEmitente}
                        containerClassName="contents"
                        nameClassName={`truncate text-xs ${isSaida ? 'font-semibold text-slate-900 border-l-2 border-slate-700 pl-1.5' : 'text-slate-500'}`}
                        cnpjClassName="text-[10px] font-mono text-slate-400 mt-0.5"
                      />
                    </td>

                    <td className="py-3.5 px-4 max-w-[200px]">
                      <PartyInfo
                        name={note.nomeDestinatario}
                        cnpj={note.cnpjDestinatario}
                        containerClassName="contents"
                        nameClassName={`truncate text-xs ${!isSaida ? 'font-semibold text-slate-900 border-l-2 border-slate-700 pl-1.5' : 'text-slate-500'}`}
                        cnpjClassName="text-[10px] font-mono text-slate-400 mt-0.5"
                      />
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                      {note.itens && note.itens.length > 1 ? (
                        <div className="flex flex-col gap-1 leading-normal">
                          <button
                            type="button"
                            onClick={() => onToggleNote(note.id)}
                            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] font-medium text-slate-700 px-1.5 py-0.5 rounded cursor-pointer w-max"
                            aria-expanded={isNoteExpanded}
                            aria-controls={controlsId}
                          >
                            {note.itens.length} itens {getCstSummary(note)}
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleNote(note.id)}
                            className="text-[10px] text-slate-600 hover:underline cursor-pointer text-left font-medium"
                            aria-expanded={isNoteExpanded}
                            aria-controls={controlsId}
                          >
                            {isNoteExpanded ? 'Recolher itens' : 'Ver todos os itens'}
                          </button>
                        </div>
                      ) : note.contemIBSCBS ? (
                        <div className="flex flex-col gap-1 leading-normal">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-1.5 py-0.5 rounded cursor-help" title={note.cstDesc || 'Código de Situação Tributária (CST)'}>
                              CST {note.cst || '–'}
                            </span>
                            <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-1.5 py-0.5 rounded cursor-help" title={note.cClassTribDesc || 'Classificação de Tributos (cClassTrib)'}>
                              CCT {note.cClassTrib || '–'}
                            </span>
                          </div>
                          {note.cClassTribDesc && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[150px] block" title={note.cClassTribDesc}>
                              {note.cClassTribDesc}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic font-mono">IBSCBS ausente</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                      <div className="flex flex-col gap-1 max-w-[220px] leading-tight">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={note.status} />
                        </div>
                        {note.validationReason && (
                          <span className="text-[10px] text-slate-400 block max-w-[200px] truncate" title={note.validationReason}>
                            {note.validationReason}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {note.itens && note.itens.length > 0 && isNoteExpanded && (
                    <tr id={controlsId} className="bg-slate-50/20">
                      <td colSpan={7} className="px-6 py-4 border-t border-slate-100/60 bg-slate-50/10">
                        <div className="font-sans">
                          <h4 className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                            <span>Itens da nota e classificações (Total: {note.itens.length})</span>
                            {hasFailedItems && (
                              <span className="text-rose-600 bg-rose-50/60 border border-rose-100 px-2 py-0.5 rounded text-[10px] font-sans font-medium">
                                Itens com inconsistência em destaque
                              </span>
                            )}
                          </h4>

                          <div className="overflow-hidden border border-slate-100 rounded-lg bg-white shadow-sm">
                            <table className="min-w-full divide-y divide-slate-100 text-left text-xs text-slate-600 font-sans">
                              <thead className="bg-slate-100/50 text-[10px] font-sans text-slate-500 font-medium border-b border-slate-100">
                                <tr>
                                  <th className="py-2 px-3 w-12 text-slate-500">Item</th>
                                  <th className="py-2 px-3 text-slate-500">Produto / serviço</th>
                                  <th className="py-2 px-3 w-20 text-slate-500">CST</th>
                                  <th className="py-2 px-3 w-24 text-slate-500">Classificação (LC 214)</th>
                                  <th className="py-2 px-3 text-slate-500">Status</th>
                                  <th className="py-2 px-3 text-slate-500">Diagnóstico da tabela oficial</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {note.itens.map((item) => (
                                  <tr key={item.numeroItem} className={getItemRowClass(item.itemStatus)}>
                                    <td className="py-2 px-3 font-mono font-bold text-slate-400">#{item.numeroItem}</td>
                                    <td className="py-2 px-3 font-medium text-slate-800">
                                      <div>{item.descricaoProduto}</div>
                                    </td>
                                    <td className="py-2 px-3 font-mono">
                                      {item.contemIBSCBS && item.cst ? (
                                        <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded text-xs font-semibold cursor-help" title={item.cstDesc}>
                                          {item.cst}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 italic">ausente</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 font-mono">
                                      {item.contemIBSCBS && item.cClassTrib ? (
                                        <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded text-xs font-semibold cursor-help" title={item.cClassTribDesc}>
                                          {item.cClassTrib}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 italic">ausente</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3">
                                      <ItemStatusBadge status={item.itemStatus} />
                                    </td>
                                    <td className={`py-2 px-3 text-[11px] font-sans ${getItemStatusTextClass(item.itemStatus)}`}>
                                      {item.validationReason || 'Nota não possui informações da Reforma Tributária.'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}