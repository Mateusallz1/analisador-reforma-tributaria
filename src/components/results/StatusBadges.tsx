import { ComplianceStatus, ItemClassificationStatus } from '../../types';

interface StatusBadgeProps {
  status: ComplianceStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (status === 'CONFORME') {
    return (
      <span className="badge badge-sm gap-1.5 border-emerald-200 bg-emerald-50 text-[11px] font-semibold text-emerald-800">
        <span className="status status-success status-xs" />
        Conforme
      </span>
    );
  }

  if (status === 'AUTORIZADA_COM_PENDENCIAS') {
    return (
      <span className="badge badge-sm gap-1.5 border-amber-200 bg-amber-50 text-[11px] font-semibold text-amber-800">
        <span className="status status-warning status-xs" />
        Autorizada c/ pendências
      </span>
    );
  }

  if (status === 'PENDENTE') {
    return (
      <span className="badge badge-sm gap-1.5 border-amber-200 bg-amber-50 text-[11px] font-semibold text-amber-800">
        <span className="status status-warning status-xs" />
        Pendente
      </span>
    );
  }

  if (status === 'NÃO_CONFORME') {
    return (
      <span className="badge badge-sm gap-1.5 border-rose-200 bg-rose-50 text-[11px] font-semibold text-rose-800">
        <span className="status status-error status-xs" />
        Não conforme
      </span>
    );
  }

  return (
    <span className="badge badge-ghost badge-sm gap-1.5 text-[11px] font-semibold">
      <span className="status status-xs" />
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
      <span className="badge badge-ghost badge-xs text-[10px] font-semibold">
        Conforme
      </span>
    );
  }

  if (status === 'nao_conforme_valor') {
    return (
      <span className="badge badge-xs border-amber-200 bg-amber-50 text-[10px] font-semibold text-amber-800">
        Falha de valor
      </span>
    );
  }

  if (status === 'incompleto') {
    return (
      <span className="badge badge-xs border-amber-200 bg-amber-50 text-[10px] font-semibold text-amber-800">
        Incompleto
      </span>
    );
  }

  if (status === 'pendente') {
    return (
      <span className="badge badge-xs border-amber-200 bg-amber-50 text-[10px] font-semibold text-amber-800">
        Pendente
      </span>
    );
  }

  if (status === 'fora_vigencia') {
    return (
      <span className="badge badge-xs border-rose-200 bg-rose-50 text-[10px] font-semibold text-rose-800">
        Fora de vigência
      </span>
    );
  }

  if (status === 'classificacao_invalida') {
    return (
      <span className="badge badge-xs border-rose-200 bg-rose-50 text-[10px] font-semibold text-rose-800">
        Classificação inválida
      </span>
    );
  }

  return (
    <span className="badge badge-ghost badge-xs text-[10px] font-semibold">
      Fora do escopo
    </span>
  );
}
