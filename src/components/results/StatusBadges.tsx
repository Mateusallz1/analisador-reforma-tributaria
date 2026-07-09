import { ComplianceStatus, ItemClassificationStatus } from '../../types';

interface StatusBadgeProps {
  status: ComplianceStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (status === 'CONFORME') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
        Conforme
      </span>
    );
  }

  if (status === 'AUTORIZADA_COM_PENDENCIAS') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
        Autorizada c/ pendências
      </span>
    );
  }

  if (status === 'NÃO_CONFORME') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-100 animate-pulse">
        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
        Não conforme
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
      Fora do escopo
    </span>
  );
}

interface ItemStatusBadgeProps {
  status?: ItemClassificationStatus;
}

export function ItemStatusBadge({ status }: ItemStatusBadgeProps) {
  if (status === 'conforme') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
        Conforme
      </span>
    );
  }

  if (status === 'nao_conforme_valor') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
        Falha de valor
      </span>
    );
  }

  if (status === 'incompleto') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
        Incompleto
      </span>
    );
  }

  if (status === 'fora_vigencia') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-100">
        Fora de vigência
      </span>
    );
  }

  if (status === 'classificacao_invalida') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-100">
        Classificação inválida
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
      Fora do escopo
    </span>
  );
}
