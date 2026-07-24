import { Info, RefreshCcw } from 'lucide-react';
import { useState } from 'react';
import type { GroupedAnalysis, NFeAnalysis } from '../types';
import { calculateItemStats } from '../utils/analysisStats';

interface DashboardStatsProps {
  results: NFeAnalysis[];
  grouped: GroupedAnalysis[];
  onReset: () => void;
}

export default function DashboardStats({ results, grouped, onReset }: DashboardStatsProps) {
  const [showBaseInfo, setShowBaseInfo] = useState(false);
  const stats = calculateItemStats(results);
  const actionableItems = stats.pendingItems + stats.nonCompliantItems;
  const taxBase = results[0]?.taxBase;

  const metrics = [
    { id: 'kpi-total', label: 'Itens', value: stats.totalItems, detail: `${stats.applicableItems} aplicáveis`, tone: 'text-slate-900' },
    { id: 'kpi-compliant', label: 'Conformidade', value: `${stats.complianceRate}%`, detail: `${stats.compliantItems} conformes`, tone: 'text-emerald-700' },
    { id: 'kpi-non-compliant', label: 'Pendências', value: actionableItems, detail: 'exigem revisão', tone: 'text-rose-700' },
    { id: 'kpi-out-of-scope', label: 'Fora do escopo', value: stats.outOfScopeItems, detail: 'sem grupo IBSCBS', tone: 'text-slate-700' },
  ];

  return (
    <div id="analysis-summary" className="border-y border-slate-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span><strong className="text-slate-800">{results.length}</strong> documentos</span>
          <span className="text-slate-300" aria-hidden="true">|</span>
          <span><strong className="text-slate-800">{grouped.length}</strong> empresas</span>
          <span className="text-slate-300" aria-hidden="true">|</span>
          <span>{stats.saidaItems} saída / {stats.entradaItems} entrada</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowBaseInfo((current) => !current)}
            aria-expanded={showBaseInfo}
            aria-controls="tax-base-info"
            className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Informações da base fiscal"
            aria-label="Informações da base fiscal"
          >
            <Info className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onReset}
            id="btn-clear-analysis"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-700"
          >
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Limpar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">
        {metrics.map((metric) => (
          <div key={metric.id} id={metric.id} className="flex items-baseline justify-between gap-2 px-3 py-2.5 sm:block">
            <span className="text-[10px] font-semibold uppercase text-slate-400">{metric.label}</span>
            <div className="sm:mt-1">
              <strong className={`text-lg font-bold ${metric.tone}`}>{metric.value}</strong>
              <span className="ml-2 text-[10px] text-slate-400">{metric.detail}</span>
            </div>
          </div>
        ))}
      </div>

      {showBaseInfo && (
        <div id="tax-base-info" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
          <span>Base fiscal <strong className="text-slate-700">{taxBase?.version || 'N/A'}</strong></span>
          {taxBase?.source && <span className="max-w-[420px] truncate" title={taxBase.source}>Fonte: {taxBase.source}</span>}
          {taxBase?.legalSource && (
            <a href={taxBase.legalSource} target="_blank" rel="noreferrer" className="font-medium text-slate-700 hover:underline">
              Abrir fonte legal
            </a>
          )}
        </div>
      )}
    </div>
  );
}
