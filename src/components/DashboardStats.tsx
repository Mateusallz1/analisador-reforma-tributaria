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
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div id="kpi-total" className="flex min-h-[150px] flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total analisado</span>
              <h3 className="mt-2 text-3xl font-bold text-slate-900">
                {stats.totalItems} <span className="text-sm font-normal text-slate-400">{stats.totalItems === 1 ? 'item' : 'itens'}</span>
              </h3>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5 text-slate-400">
              <Archive className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="h-1.5 w-full rounded-full bg-slate-100">
              <div
                className="h-1.5 rounded-full bg-slate-800 transition-all duration-500"
                style={{ width: `${stats.complianceRate}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {stats.complianceRate}% sobre {stats.applicableItems} {stats.applicableItems === 1 ? 'item aplicável' : 'itens aplicáveis'}
            </p>
          </div>
        </div>

        <div id="kpi-compliant" className="flex min-h-[150px] flex-col justify-between rounded-lg border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Conforme</span>
              <h3 className="mt-2 text-3xl font-bold text-emerald-600">
                {stats.compliantItems}
              </h3>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-500">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-emerald-700">
            Itens com CST e cClassTrib consistentes
          </p>
        </div>

        <div id="kpi-non-compliant" className="flex min-h-[150px] flex-col justify-between rounded-lg border border-rose-100 bg-white p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">Não conforme</span>
              <h3 className="mt-2 text-3xl font-bold text-rose-600">
                {actionableItems}
              </h3>
            </div>
            <div className="rounded-lg bg-rose-50 p-2.5 text-rose-500">
              <FileX className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-rose-600">
            {stats.pendingItems > 0
              ? `${stats.pendingItems} autorizado(s) com pendência`
              : 'Itens com divergência de classificação ou valor'}
          </p>
        </div>

        <div id="kpi-out-of-scope" className="flex min-h-[150px] flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fora do escopo</span>
              <h3 className="mt-2 text-3xl font-bold text-slate-700">
                {stats.outOfScopeItems}
              </h3>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5 text-slate-400">
              <FileQuestion className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Sem grupo IBSCBS, neutro no cálculo
          </p>
        </div>
      </div>

      <div className="flex flex-col items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          <Archive className="w-4 h-4 text-slate-400" />
          <span><strong className="text-slate-800">{results.length}</strong> documentos</span>
          <span className="text-slate-300">|</span>
          <span><strong className="text-slate-800">{grouped.length}</strong> empresas monitoradas</span>
          <span className="text-slate-300">|</span>
          <span>{stats.saidaItems} saída / {stats.entradaItems} entrada</span>
        </div>
        <button
          onClick={onReset}
          id="btn-clear-analysis"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-rose-50 hover:text-red-700"
        >
          <RefreshCcw className="w-3.5 h-3.5 text-slate-400" />
          Limpar base de análise
        </button>
      </div>
    </div>
  );
}
