import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { NFeAnalysis } from '../../types';
import { DocumentIdentity } from './DocumentIdentity';
import { OperationBadge } from './OperationBadge';
import { PartyInfo } from './PartyInfo';
import { getMissingFocusInfoMessage } from './notePresentation';

interface IncompleteDocumentsSectionProps {
  notes: NFeAnalysis[];
  isCollapsed: boolean;
  onToggle: () => void;
}

function MissingFocusBadge({ message, className, iconClassName }: { message: string; className: string; iconClassName: string }) {
  return (
    <span className={className}>
      <AlertTriangle className={iconClassName} aria-hidden="true" />
      {message}
    </span>
  );
}

export function IncompleteDocumentsSection({ notes, isCollapsed, onToggle }: IncompleteDocumentsSectionProps) {
  if (notes.length === 0) return null;

  const contentId = 'incomplete-documents-content';

  return (
    <div id="incomplete-documents-block" className="bg-white border border-amber-200/80 rounded-lg shadow-sm overflow-hidden mt-6">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left bg-amber-50/10 p-4 border-b border-amber-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer select-none hover:bg-amber-50/20 transition-colors border-l-4 border-l-amber-500/70"
        aria-expanded={!isCollapsed}
        aria-controls={contentId}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white border border-amber-200 text-amber-600 rounded-lg shadow-sm">
            <AlertTriangle className="w-5 h-5 text-amber-500" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-sans font-bold text-slate-800 text-base">
                Documentos com dados incompletos
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-100 font-mono">
                {notes.length} {notes.length === 1 ? 'documento' : 'documentos'}
              </span>
            </div>
            <p className="text-xs font-sans text-slate-500 mt-1">
              Empresa em foco sem CNPJ/CPF identificado no XML.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 self-stretch sm:self-auto justify-end">
          <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100/50 rounded-lg px-2.5 py-1">
            CNPJ/CPF ausente
          </span>
          <div>
            {isCollapsed ? (
              <ChevronDown className="w-5 h-5 text-slate-400" aria-hidden="true" />
            ) : (
              <ChevronUp className="w-5 h-5 text-slate-400" aria-hidden="true" />
            )}
          </div>
        </div>
      </button>

      {!isCollapsed && (
        <div id={contentId}>
          <div className="space-y-3 p-3 lg:hidden">
            {notes.map((note) => {
              const isSaida = note.tipoNota === 'SAÍDA';
              const missingInfoMessage = getMissingFocusInfoMessage(note);

              return (
                <div key={note.id} className="rounded-lg border border-amber-100 bg-white p-3 shadow-sm">
                  <DocumentIdentity
                    numeroNota={note.numeroNota}
                    docType={note.docType}
                    fileName={note.fileName}
                    numberFallback="S/N"
                    docTypeFallback="N/A"
                    numberClassName="font-mono text-sm font-semibold text-slate-900"
                    modelClassName="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-normal font-sans bg-slate-100 text-slate-500 border border-slate-200"
                    fileClassName="mt-1 truncate text-[10px] text-slate-400"
                    rowClassName="flex flex-wrap items-center gap-2"
                  >
                    <OperationBadge isSaida={isSaida} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700" iconClassName="h-3.5 w-3.5 text-slate-500" />
                  </DocumentIdentity>

                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <PartyInfo
                      label="Emitente"
                      name={note.nomeEmitente}
                      cnpj={note.cnpjEmitente}
                      nameFallback="Emitente não informado"
                      containerClassName="min-w-0 rounded-lg border border-slate-100 p-2"
                      nameClassName="truncate font-semibold text-slate-800"
                      cnpjClassName="mt-0.5 font-mono text-[10px]"
                      presentCnpjClassName="text-slate-500"
                      absentBadgeClassName="rounded border border-rose-100 bg-rose-50 px-1 py-0.5 text-[9px] font-semibold text-rose-600"
                    />
                    <PartyInfo
                      label="Destinatário"
                      name={note.nomeDestinatario}
                      cnpj={note.cnpjDestinatario}
                      nameFallback="Destinatário não informado"
                      containerClassName="min-w-0 rounded-lg border border-slate-100 p-2"
                      nameClassName="truncate font-semibold text-slate-800"
                      cnpjClassName="mt-0.5 font-mono text-[10px]"
                      presentCnpjClassName="text-slate-500"
                      absentBadgeClassName="rounded border border-rose-100 bg-rose-50 px-1 py-0.5 text-[9px] font-semibold text-rose-600"
                    />
                  </div>
                  <MissingFocusBadge
                    message={missingInfoMessage}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-100 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"
                    iconClassName="h-3.5 w-3.5 text-rose-500"
                  />
                </div>
              );
            })}
          </div>

          <div className="hidden w-full overflow-x-auto lg:block">
            <table className="w-full min-w-[900px] divide-y divide-slate-100 text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[11px] font-sans font-medium tracking-normal border-b border-slate-100 font-sans">
                  <th className="py-3 px-4">Código / nota</th>
                  <th className="py-3 px-4">Operação</th>
                  <th className="py-3 px-4">Emissão</th>
                  <th className="py-3 px-4">Emitente / CNPJ</th>
                  <th className="py-3 px-4">Destinatário / CNPJ</th>
                  <th className="py-3 px-4 text-rose-700 bg-rose-50/25">Identificação Ausente (Empresa Foco)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-sans text-slate-600">
                {notes.map((note) => {
                  const isSaida = note.tipoNota === 'SAÍDA';
                  const missingInfoMessage = getMissingFocusInfoMessage(note);

                  return (
                    <tr key={note.id} className="hover:bg-slate-50/35 transition-colors">
                      <td className="py-3.5 px-4 font-sans font-medium text-slate-900">
                        <DocumentIdentity
                          numeroNota={note.numeroNota}
                          docType={note.docType}
                          fileName={note.fileName}
                          numberFallback="S/N"
                          docTypeFallback="N/A"
                          numberClassName="font-semibold text-slate-800 font-mono"
                          modelClassName="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-normal font-sans bg-slate-100 text-slate-500 border border-slate-200"
                          fileClassName="text-[10px] text-slate-400 truncate max-w-[150px] mt-0.5"
                        />
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <OperationBadge isSaida={isSaida} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/50" iconClassName="w-3.5 h-3.5 text-slate-500" />
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-slate-500">
                        {note.dataEmissao}
                      </td>

                      <td className="py-3.5 px-4 max-w-[200px]">
                        <PartyInfo
                          name={note.nomeEmitente}
                          cnpj={note.cnpjEmitente}
                          nameFallback="Emitente não informado"
                          containerClassName="contents"
                          nameClassName="truncate text-xs font-semibold text-slate-800"
                          cnpjClassName="text-[10px] font-mono mt-0.5"
                          presentCnpjClassName="text-slate-500"
                          absentBadgeClassName="text-rose-600 font-semibold bg-rose-50 px-1 py-0.5 rounded border border-rose-100 text-[9px]"
                        />
                      </td>

                      <td className="py-3.5 px-4 max-w-[200px]">
                        <PartyInfo
                          name={note.nomeDestinatario}
                          cnpj={note.cnpjDestinatario}
                          nameFallback="Destinatário não informado"
                          containerClassName="contents"
                          nameClassName="truncate text-xs font-semibold text-slate-800"
                          cnpjClassName="text-[10px] font-mono mt-0.5"
                          presentCnpjClassName="text-slate-500"
                          absentBadgeClassName="text-rose-600 font-semibold bg-rose-50 px-1 py-0.5 rounded border border-rose-100/80 text-[9px]"
                        />
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs bg-rose-50/5 font-sans">
                        <MissingFocusBadge
                          message={missingInfoMessage}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100"
                          iconClassName="w-3.5 h-3.5 text-rose-500 animate-pulse"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
