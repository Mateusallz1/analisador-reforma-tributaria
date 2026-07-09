import { formatCnpjOrCpf } from '../../utils/nfeParser';

interface PartyInfoProps {
  label?: string;
  name: string;
  cnpj: string;
  nameFallback?: string;
  containerClassName: string;
  nameClassName: string;
  cnpjClassName: string;
  labelClassName?: string;
  presentCnpjClassName?: string;
  absentBadgeClassName?: string;
}

export function PartyInfo({
  label,
  name,
  cnpj,
  nameFallback,
  containerClassName,
  nameClassName,
  cnpjClassName,
  labelClassName = 'mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400',
  presentCnpjClassName,
  absentBadgeClassName,
}: PartyInfoProps) {
  const displayName = name || nameFallback || '';

  return (
    <div className={containerClassName}>
      {label && <div className={labelClassName}>{label}</div>}
      <div className={nameClassName} title={displayName}>{displayName}</div>
      <div className={cnpjClassName}>
        {cnpj ? (
          presentCnpjClassName ? <span className={presentCnpjClassName}>{formatCnpjOrCpf(cnpj)}</span> : formatCnpjOrCpf(cnpj)
        ) : absentBadgeClassName ? (
          <span className={absentBadgeClassName}>AUSENTE</span>
        ) : (
          'N/A'
        )}
      </div>
    </div>
  );
}