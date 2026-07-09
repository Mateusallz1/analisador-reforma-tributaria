import type { ReactNode } from 'react';
import type { DocType } from '../../types';

interface DocumentIdentityProps {
  numeroNota: string;
  docType?: DocType;
  fileName: string;
  numberFallback?: string;
  docTypeFallback: string;
  numberClassName: string;
  modelClassName: string;
  fileClassName: string;
  rowClassName?: string;
  leadingContent?: ReactNode;
  children?: ReactNode;
}

export function DocumentIdentity({
  numeroNota,
  docType,
  fileName,
  numberFallback,
  docTypeFallback,
  numberClassName,
  modelClassName,
  fileClassName,
  rowClassName = 'flex items-center gap-2',
  leadingContent,
  children,
}: DocumentIdentityProps) {
  return (
    <>
      <div className={rowClassName}>
        {leadingContent}
        <span className={numberClassName}>
          Nº {numeroNota || numberFallback || ''}
        </span>
        <span className={modelClassName}>
          {docType || docTypeFallback}
        </span>
        {children}
      </div>
      <div className={fileClassName} title={fileName}>
        {fileName}
      </div>
    </>
  );
}