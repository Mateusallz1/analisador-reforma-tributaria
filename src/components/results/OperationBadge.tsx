import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface OperationBadgeProps {
  isSaida: boolean;
  className: string;
  iconClassName: string;
}

export function OperationBadge({ isSaida, className, iconClassName }: OperationBadgeProps) {
  return (
    <span className={className}>
      {isSaida ? (
        <>
          <ArrowUpRight className={iconClassName} />
          Saída
        </>
      ) : (
        <>
          <ArrowDownLeft className={iconClassName} />
          Entrada
        </>
      )}
    </span>
  );
}