import { X } from 'lucide-react';
import type { ItemValidation, NFeAnalysis } from '../../types';
import { ItemStatusBadge } from './StatusBadges';

interface NoteDetailPanelProps {
  note: NFeAnalysis;
  onClose: () => void;
}

function ServiceContext({ item }: { item: ItemValidation }) {
  const hasContext = item.codigoServico || item.codigoNbs || item.descricaoTributacaoNacional || item.descricaoNbs;
  if (!hasContext) return null;

  return (
    <div className="mt-1 space-y-0.5 text-[10px] font-normal leading-relaxed text-base-content/55">
      {(item.codigoServico || item.codigoNbs) && (
        <div>
          {item.codigoServico && `cTribNac ${item.codigoServico}`}
          {item.codigoServico && item.codigoNbs && ' · '}
          {item.codigoNbs && `NBS ${item.codigoNbs}`}
        </div>
      )}
      {item.descricaoTributacaoNacional && (
        <div title={item.descricaoTributacaoNacional}>Tributação nacional: {item.descricaoTributacaoNacional}</div>
      )}
      {item.descricaoNbs && (
        <div title={item.descricaoNbs}>NBS: {item.descricaoNbs}</div>
      )}
    </div>
  );
}

export function NoteDetailPanel({ note, onClose }: NoteDetailPanelProps) {
  const items = note.itens || [];
  const isNfse = note.docType === 'NFSe';
  const detailLabel = isNfse ? 'serviços da nota' : 'itens da nota';
  const detailTitle = isNfse ? 'Serviços da nota e classificação' : 'Itens da nota e classificações';
  const firstColumnLabel = 'Item';
  const descriptionColumnLabel = isNfse ? 'Serviço prestado' : 'Produto / serviço';

  return (
    <section
      id={`document-detail-${note.id}`}
      aria-label={`${detailTitle} ${note.numeroNota || note.fileName}`}
      data-detail-layout="inline"
      data-item-layer="items"
      data-detail-surface="inset"
      className="border-t border-base-300 bg-base-200/70 pb-3 lg:min-w-[1100px] lg:pb-4"
    >
      <div className="flex items-center justify-between gap-3 px-6 py-3">
        <h3 className="text-[10px] font-semibold uppercase text-base-content/60">
          {detailTitle} (total: {items.length})
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-square btn-xs shrink-0"
          aria-label={`Recolher ${detailLabel}`}
          title={`Recolher ${detailLabel}`}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="border-t border-base-300 bg-base-100 px-6 py-4 text-xs text-base-content/60">
          {note.docType === 'NFSe' ? 'Nenhum serviço identificado.' : 'Nenhum item fiscal identificado.'}
        </p>
      ) : (
        <>
          <div className="mx-6 hidden overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm lg:block">
            <table className="table table-sm w-full table-fixed text-left text-xs">
              <thead className="bg-base-200 text-[10px] font-semibold text-base-content/60">
                <tr>
                  <th className="w-14 px-4 py-2.5">{firstColumnLabel}</th>
                  <th className="w-[24%] px-3 py-2.5">{descriptionColumnLabel}</th>
                  <th className="w-20 px-3 py-2.5">CST</th>
                  <th className="w-28 px-3 py-2.5">Classificação</th>
                  <th className="w-40 px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Diagnóstico da tabela oficial</th>
                </tr>
              </thead>
              <tbody className="text-base-content/70">
                {items.map((item) => (
                  <tr key={item.numeroItem} className="align-top">
                    <td className="px-4 py-3 font-mono text-base-content/60">#{item.numeroItem}</td>
                    <td className="px-3 py-3 font-medium text-base-content">
                      <div className="whitespace-pre-line">{item.descricaoProduto}</div>
                      <ServiceContext item={item} />
                    </td>
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

          <div className="mx-3 divide-y divide-base-300 overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm lg:hidden">
            {items.map((item) => (
              <div key={item.numeroItem} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase text-base-content/50">{firstColumnLabel} {item.numeroItem}</div>
                    <div className="mt-0.5 whitespace-pre-line text-sm font-medium text-base-content">{item.descricaoProduto}</div>
                    <ServiceContext item={item} />
                  </div>
                  <ItemStatusBadge status={item.itemStatus} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-base-content/50">CST</div>
                    <div className="mt-0.5 font-mono">{item.contemIBSCBS && item.cst ? item.cst : 'ausente'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-base-content/50">Classificação</div>
                    <div className="mt-0.5 font-mono">{item.contemIBSCBS && item.cClassTrib ? item.cClassTrib : 'ausente'}</div>
                  </div>
                </div>
                <div className="mt-3 border-t border-base-300 pt-3">
                  <div className="text-[10px] font-semibold uppercase text-base-content/50">Diagnóstico da tabela oficial</div>
                  <p className="mt-1 text-xs leading-relaxed text-base-content/70">
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
