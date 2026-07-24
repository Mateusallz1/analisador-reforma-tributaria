import { X } from 'lucide-react';
import type { NFeAnalysis } from '../../types';
import { ItemStatusBadge } from './StatusBadges';

interface NoteDetailPanelProps {
  note: NFeAnalysis;
  onClose: () => void;
}

export function NoteDetailPanel({ note, onClose }: NoteDetailPanelProps) {
  const items = note.itens || [];

  return (
    <section
      id={`document-detail-${note.id}`}
      aria-label={`Itens da nota ${note.numeroNota || note.fileName}`}
      data-detail-layout="inline"
      data-item-layer="items"
      className="border-t border-slate-200 bg-slate-50/50 lg:min-w-[1100px]"
    >
      <div className="flex items-center justify-between gap-3 px-6 py-3">
        <h3 className="text-[10px] font-semibold uppercase text-slate-500">
          Itens da nota e classificações (total: {items.length})
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          aria-label="Recolher itens da nota"
          title="Recolher itens"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
          Nenhum item fiscal identificado.
        </p>
      ) : (
        <>
          <div className="hidden px-6 pb-4 lg:block">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-500">
                  <tr>
                    <th className="w-14 px-3 py-2.5">Item</th>
                    <th className="w-[24%] px-3 py-2.5">Produto / serviço</th>
                    <th className="w-20 px-3 py-2.5">CST</th>
                    <th className="w-28 px-3 py-2.5">Classificação</th>
                    <th className="w-40 px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Diagnóstico da tabela oficial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {items.map((item) => (
                    <tr key={item.numeroItem} className="align-top">
                      <td className="px-3 py-3 font-mono text-slate-500">#{item.numeroItem}</td>
                      <td className="px-3 py-3 font-medium text-slate-900">{item.descricaoProduto}</td>
                      <td className="px-3 py-3 font-mono" title={item.cstDesc}>
                        {item.contemIBSCBS && item.cst ? item.cst : 'ausente'}
                      </td>
                      <td className="px-3 py-3 font-mono" title={item.cClassTribDesc}>
                        {item.contemIBSCBS && item.cClassTrib ? item.cClassTrib : 'ausente'}
                      </td>
                      <td className="px-3 py-3"><ItemStatusBadge status={item.itemStatus} /></td>
                      <td className="px-3 py-3 text-[11px] leading-relaxed">
                        {item.validationReason || 'Nota não possui informações da Reforma Tributária.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="divide-y divide-slate-100 border-t border-slate-200 bg-white lg:hidden">
            {items.map((item) => (
              <div key={item.numeroItem} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase text-slate-400">Item {item.numeroItem}</div>
                    <div className="mt-0.5 text-sm font-medium text-slate-900">{item.descricaoProduto}</div>
                  </div>
                  <ItemStatusBadge status={item.itemStatus} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-slate-400">CST</div>
                    <div className="mt-0.5 font-mono text-slate-700">{item.contemIBSCBS && item.cst ? item.cst : 'ausente'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-slate-400">Classificação</div>
                    <div className="mt-0.5 font-mono text-slate-700">{item.contemIBSCBS && item.cClassTrib ? item.cClassTrib : 'ausente'}</div>
                  </div>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="text-[10px] font-semibold uppercase text-slate-400">Diagnóstico da tabela oficial</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {item.validationReason || 'Nota não possui informações da Reforma Tributária.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
