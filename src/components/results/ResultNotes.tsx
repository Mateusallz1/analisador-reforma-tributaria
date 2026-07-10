import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { NFeAnalysis } from '../../types';
import { DocumentIdentity } from './DocumentIdentity';
import { ItemStatusBadge, StatusBadge } from './StatusBadges';
import { OperationBadge } from './OperationBadge';
import { PartyInfo } from './PartyInfo';
import type { ExpandedNotes } from './types';
import { getNoteExpansionState, isActionableNote } from './notePresentation';

const NOTE_PAGE_SIZE = 100;

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
  const [visibleCount, setVisibleCount] = useState(NOTE_PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(NOTE_PAGE_SIZE);
  }, [notes]);

  const visibleNotes = notes.slice(0, visibleCount);
  const remainingNotes = notes.length - visibleNotes.length;

  return (
    <>
      <div className="space-y-3 p-3 lg:hidden">
        {visibleNotes.map((note) => {
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
        <table className="w-full min-w-[760px] divide-y divide-slate-100 text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-100/40 text-[11px] font-medium tracking-normal text-slate-500">
              <th className="px-4 py-3">Documento</th>
              <th className="px-4 py-3">Operação / emissão</th>
              <th className="px-4 py-3">Empresa em foco</th>
              <th className="px-4 py-3">Classificação</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
            {visibleNotes.map((note) => {
              const isSaida = note.tipoNota === 'SAÍDA';
              const hasFailedItems = isActionableNote(note);
              const isNoteExpanded = getNoteExpansionState(note, expandedNotes);
              const controlsId = 'note-items-desktop-' + note.id;
              const focusName = isSaida ? note.nomeEmitente : note.nomeDestinatario;
              const focusCnpj = isSaida ? note.cnpjEmitente : note.cnpjDestinatario;

              return (
                <Fragment key={note.id}>
                  <tr className="transition-colors hover:bg-slate-50/50">
                    <td className="px-4 py-3.5">
                      <DocumentIdentity
                        numeroNota={note.numeroNota}
                        docType={note.docType}
                        fileName={note.fileName}
                        docTypeFallback="NFe"
                        numberClassName="font-mono font-semibold text-slate-800"
                        modelClassName="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-700"
                        fileClassName="ml-5 mt-0.5 max-w-[180px] truncate text-[10px] text-slate-400"
                        leadingContent={note.itens && note.itens.length > 0 ? (
                          <NoteToggleButton
                            noteId={note.id}
                            isExpanded={isNoteExpanded}
                            controlsId={controlsId}
                            onToggleNote={onToggleNote}
                            className="rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                            iconClassName="h-3.5 w-3.5"
                          />
                        ) : undefined}
                      />
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-col items-start gap-1.5">
                        <OperationBadge
                          isSaida={isSaida}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                          iconClassName="h-3.5 w-3.5 text-slate-400"
                        />
                        <span className="font-mono text-[11px] text-slate-500">{note.dataEmissao}</span>
                      </div>
                    </td>

                    <td className="max-w-[220px] px-4 py-3.5">
                      <PartyInfo
                        label="Empresa em foco"
                        name={focusName}
                        cnpj={focusCnpj}
                        containerClassName="contents"
                        nameClassName="truncate text-xs font-semibold text-slate-800"
                        cnpjClassName="mt-0.5 font-mono text-[10px] text-slate-500"
                      />
                    </td>

                    <td className="px-4 py-3.5 text-xs">
                      <div className="flex max-w-[180px] flex-wrap items-center gap-1.5">
                        {note.itens && note.itens.length > 0 && (
                          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {note.itens.length} {note.itens.length === 1 ? 'item' : 'itens'}
                          </span>
                        )}
                        {note.contemIBSCBS ? (
                          <>
                            <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                              CST {note.cst || '–'}
                            </span>
                            <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                              CCT {note.cClassTrib || '–'}
                            </span>
                          </>
                        ) : (
                          <span className="font-mono text-[10px] italic text-slate-400">IBSCBS ausente</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-col items-start gap-1.5">
                        <StatusBadge status={note.status} />
                        {note.validationStatus && (
                          <span className="text-[10px] text-slate-400">{note.validationStatus}</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {note.itens && note.itens.length > 0 && isNoteExpanded && (
                    <tr id={controlsId} className="bg-slate-50/20">
                      <td colSpan={5} className="border-t border-slate-100/60 bg-slate-50/10 px-6 py-4">
                        <div className="font-sans">
                          <div className="mb-3 grid gap-2 sm:grid-cols-2">
                            <PartyInfo
                              label="Emitente"
                              name={note.nomeEmitente}
                              cnpj={note.cnpjEmitente}
                              containerClassName="rounded-lg border border-slate-100 bg-white p-2"
                              nameClassName="truncate text-xs font-semibold text-slate-800"
                              cnpjClassName="mt-0.5 font-mono text-[10px] text-slate-500"
                            />
                            <PartyInfo
                              label="Destinatário"
                              name={note.nomeDestinatario}
                              cnpj={note.cnpjDestinatario}
                              containerClassName="rounded-lg border border-slate-100 bg-white p-2"
                              nameClassName="truncate text-xs font-semibold text-slate-800"
                              cnpjClassName="mt-0.5 font-mono text-[10px] text-slate-500"
                            />
                          </div>

                          {note.validationReason && (
                            <p className="mb-3 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs text-slate-500">
                              {note.validationReason}
                            </p>
                          )}

                          <h4 className="mb-2.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            <span>Itens da nota e classificações: {note.itens.length}</span>
                            {hasFailedItems && (
                              <span className="rounded border border-rose-100 bg-rose-50/60 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-rose-600">
                                Itens com inconsistência em destaque
                              </span>
                            )}
                          </h4>

                          <div className="overflow-hidden rounded-lg border border-slate-100 bg-white">
                            <table className="min-w-full divide-y divide-slate-100 text-left text-xs text-slate-600">
                              <thead className="border-b border-slate-100 bg-slate-100/50 text-[10px] font-medium text-slate-500">
                                <tr>
                                  <th className="w-12 px-3 py-2">Item</th>
                                  <th className="px-3 py-2">Produto / serviço</th>
                                  <th className="w-20 px-3 py-2">CST</th>
                                  <th className="w-24 px-3 py-2">Classificação</th>
                                  <th className="px-3 py-2">Status</th>
                                  <th className="px-3 py-2">Diagnóstico</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {note.itens.map((item) => (
                                  <tr key={item.numeroItem} className={getItemRowClass(item.itemStatus)}>
                                    <td className="px-3 py-2 font-mono font-bold text-slate-400">#{item.numeroItem}</td>
                                    <td className="px-3 py-2 font-medium text-slate-800">
                                      <div>{item.descricaoProduto}</div>
                                    </td>
                                    <td className="px-3 py-2 font-mono">
                                      {item.contemIBSCBS && item.cst ? (
                                        <span className="cursor-help rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700" title={item.cstDesc}>
                                          {item.cst}
                                        </span>
                                      ) : (
                                        <span className="italic text-slate-400">ausente</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 font-mono">
                                      {item.contemIBSCBS && item.cClassTrib ? (
                                        <span className="cursor-help rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700" title={item.cClassTribDesc}>
                                          {item.cClassTrib}
                                        </span>
                                      ) : (
                                        <span className="italic text-slate-400">ausente</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      <ItemStatusBadge status={item.itemStatus} />
                                    </td>
                                    <td className={'px-3 py-2 text-[11px] ' + getItemStatusTextClass(item.itemStatus)}>
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
      {remainingNotes > 0 && (
        <div className="border-t border-slate-100 px-3 py-3 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((current) => Math.min(current + NOTE_PAGE_SIZE, notes.length))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            Mostrar mais {Math.min(NOTE_PAGE_SIZE, remainingNotes)} {Math.min(NOTE_PAGE_SIZE, remainingNotes) === 1 ? 'nota' : 'notas'}
          </button>
          <span className="ml-2 text-[11px] text-slate-400">
            {remainingNotes} restantes
          </span>
        </div>
      )}
    </>
  );
}
