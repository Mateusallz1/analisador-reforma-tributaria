import { Archive, FileCheck, FileQuestion, FileX, RefreshCcw } from 'lucide-react';
import { NFeAnalysis, GroupedAnalysis } from '../types';
import { calculateItemStats } from '../utils/analysisStats';

interface DashboardStatsProps {
  results: NFeAnalysis[];
  grouped: GroupedAnalysis[];
  onReset: () => void;
}

export default function DashboardStats({ results, grouped, onReset }: DashboardStatsProps) {
  const stats = calculateItemStats(results);
  const actionableItems = stats.pendingItems + stats.nonCompliantItems;

  return (
    <div className="space-y-3">
      <div
        id="analysis-summary"
        className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-y border-slate-200 bg-white sm:grid-cols-4 sm:divide-y-0"
      >
        <div id="kpi-total" className="flex min-h-[92px] flex-col justify-between p-3.5 sm:p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Itens analisados
          </span>
          <div className="mt-2 flex items-center gap-2">
            <Archive className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <strong className="text-2xl font-bold text-slate-900">{stats.totalItems}</strong>
          </div>
          <span className="mt-1 text-[11px] text-slate-500">
            {stats.applicableItems} aplicáveis
          </span>
        </div>

        <div id="kpi-compliant" className="flex min-h-[92px] flex-col justify-between p-3.5 sm:p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Conformidade
          </span>
          <div className="mt-2 flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <strong className="text-2xl font-bold text-emerald-600">{stats.complianceRate}%</strong>
          </div>
          <span className="mt-1 text-[11px] text-emerald-700">
            {stats.compliantItems} {stats.compliantItems === 1 ? 'item conforme' : 'itens conformes'}
          </span>
        </div>

        <div id="kpi-non-compliant" className="flex min-h-[92px] flex-col justify-between p-3.5 sm:p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
            Pendências
          </span>
          <div className="mt-2 flex items-center gap-2">
            <FileX className="h-4 w-4 text-rose-500" aria-hidden="true" />
            <strong className="text-2xl font-bold text-rose-600">{actionableItems}</strong>
          </div>
          <span className="mt-1 text-[11px] text-rose-600">
            {stats.pendingItems > 0
              ? stats.pendingItems + ' autorizada(s) com pendência'
              : 'Divergências que exigem revisão'}
          </span>
        </div>

        <div id="kpi-out-of-scope" className="flex min-h-[92px] flex-col justify-between p-3.5 sm:p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Fora do escopo
          </span>
          <div className="mt-2 flex items-center gap-2">
            <FileQuestion className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <strong className="text-2xl font-bold text-slate-700">{stats.outOfScopeItems}</strong>
          </div>
          <span className="mt-1 text-[11px] text-slate-500">
            Sem grupo IBSCBS
          </span>
        </div>
      </div>

      <div className="flex flex-col items-start justify-between gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span><strong className="text-slate-800">{results.length}</strong> documentos</span>
          <span className="text-slate-300" aria-hidden="true">|</span>
          <span><strong className="text-slate-800">{grouped.length}</strong> empresas em foco</span>
          <span className="text-slate-300" aria-hidden="true">|</span>
          <span>{stats.saidaItems} saída / {stats.entradaItems} entrada</span>
        </div>
        <button
          type="button"
          onClick={onReset}
          id="btn-clear-analysis"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
        >
          <RefreshCcw className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          Limpar análise
        </button>
      </div>
    </div>
  );
}