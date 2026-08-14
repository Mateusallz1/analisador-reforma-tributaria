import { ExternalLink, Info, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { GroupedAnalysis, NFeAnalysis } from '../types';
import { calculateItemStats } from '../utils/analysisStats';

interface DashboardStatsProps {
  results: NFeAnalysis[];
  grouped: GroupedAnalysis[];
  onReset: () => void;
  isBusy?: boolean;
}

export default function DashboardStats({ results, grouped, onReset, isBusy = false }: DashboardStatsProps) {
  const [showBaseInfo, setShowBaseInfo] = useState(false);
  const stats = calculateItemStats(results);
  const actionableItems = stats.pendingItems + stats.nonCompliantItems;
  const taxBase = results[0]?.taxBase;

  const metrics = [
    { id: 'kpi-total', label: 'Itens analisados', value: stats.totalItems, detail: `${stats.applicableItems} aplicáveis`, tone: 'text-base-content' },
    { id: 'kpi-compliant', label: 'Conformidade dos itens', value: `${stats.complianceRate}%`, detail: `${stats.compliantItems} de ${stats.applicableItems} itens`, tone: 'text-base-content' },
    { id: 'kpi-non-compliant', label: 'Itens para revisar', value: actionableItems, detail: 'pendências fiscais', tone: 'text-rose-700' },
    { id: 'kpi-out-of-scope', label: 'Itens fora do escopo', value: stats.outOfScopeItems, detail: 'sem grupo IBSCBS', tone: 'text-base-content/70' },
  ];

  return (
    <div id="analysis-summary" className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-md shadow-base-content/5">
      <div className="flex flex-col gap-2 border-b border-base-300 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/60">
          <span><strong className="text-base-content">{results.length}</strong> documentos</span>
          <span className="text-base-content/20" aria-hidden="true">|</span>
          <span><strong className="text-base-content">{grouped.length}</strong> empresas</span>
          <span className="text-base-content/20" aria-hidden="true">|</span>
          <span>{stats.saidaItems} saída / {stats.entradaItems} entrada</span>
          {stats.unknownOperationItems > 0 && (
            <>
              <span className="text-base-content/20" aria-hidden="true">|</span>
              <span className="font-medium text-warning">{stats.unknownOperationItems} operação não verificada</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowBaseInfo((current) => !current)}
            aria-expanded={showBaseInfo}
            aria-controls="tax-base-info"
            className="btn btn-ghost btn-square btn-sm"
            title="Informações da base fiscal"
            aria-label="Informações da base fiscal"
          >
            <Info className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onReset}
            id="btn-clear-analysis"
            disabled={isBusy}
            className="btn btn-ghost btn-sm text-error"
          >
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Limpar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-y divide-base-300 sm:grid-cols-4 sm:divide-y-0">
        {metrics.map((metric) => (
          <div key={metric.id} id={metric.id} className="stat min-w-0 px-4 py-4">
            <div className="stat-title text-[10px] font-semibold uppercase">{metric.label}</div>
            <div className={`stat-value text-xl ${metric.tone}`}>{metric.value}</div>
            <div className="stat-desc">{metric.detail}</div>
          </div>
        ))}
      </div>

      <div id="official-sources" className="flex flex-col gap-3 border-t border-base-300 bg-base-200/45 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-base-content/55" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-base-content">Classificação baseada em fontes oficiais</p>
            <p className="mt-0.5 break-words text-[11px] text-base-content/55" title={taxBase?.source}>
              Base incorporada: {taxBase?.source || 'referência não informada'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-medium">
          {taxBase?.classificationSource && (
            <a href={taxBase.classificationSource} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">
              Tabela CST/cClassTrib <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
          {taxBase?.technicalSource && (
            <a href={taxBase.technicalSource} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">
              Informe Técnico <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
          {taxBase?.legalSource && (
            <a href={taxBase.legalSource} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">
              LC 214/2025 <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      {showBaseInfo && (
        <div id="tax-base-info" className="alert rounded-none border-x-0 border-b-0 border-base-300 bg-base-200 py-2 text-[11px]">
          <span>Base fiscal <strong>{taxBase?.version || 'N/A'}</strong></span>
          {taxBase?.source && <span className="max-w-[420px] truncate" title={taxBase.source}>Fonte: {taxBase.source}</span>}
          {taxBase?.legalSource && (
            <a href={taxBase.legalSource} target="_blank" rel="noreferrer" className="link font-medium">
              Abrir fonte legal
            </a>
          )}
        </div>
      )}
    </div>
  );
}
