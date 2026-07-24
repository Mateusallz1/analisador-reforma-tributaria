import type { DataIntegrityStatus } from '../types';

function hasRepeatedDigits(value: string): boolean {
  return /^(\d)\1+$/.test(value);
}

function calculateCheckDigit(value: string, weights: number[]): number {
  const total = weights.reduce((sum, weight, index) => sum + Number(value[index]) * weight, 0);
  const remainder = total % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function getTaxpayerDocumentStatus(value: string | null | undefined): DataIntegrityStatus {
  const rawValue = value?.trim() || '';
  if (!rawValue) return 'MISSING';

  const normalized = rawValue.replace(/[.\-/\s]/g, '');
  if (!/^[A-Za-z0-9]+$/.test(normalized)) return 'INVALID';

  // NF-e is introducing alphanumeric CNPJ layouts. The legacy numeric algorithm
  // must not classify them as invalid.
  if (/[A-Za-z]/i.test(normalized)) return 'NOT_VERIFIABLE';

  if (normalized.length === 11) {
    if (hasRepeatedDigits(normalized)) return 'INVALID';
    const firstDigit = calculateCheckDigit(normalized.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const secondDigit = calculateCheckDigit(normalized.slice(0, 9) + firstDigit, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return normalized.endsWith(`${firstDigit}${secondDigit}`) ? 'VALID' : 'INVALID';
  }

  if (normalized.length === 14) {
    if (hasRepeatedDigits(normalized)) return 'INVALID';
    const firstDigit = calculateCheckDigit(normalized.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const secondDigit = calculateCheckDigit(normalized.slice(0, 12) + firstDigit, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return normalized.endsWith(`${firstDigit}${secondDigit}`) ? 'VALID' : 'INVALID';
  }

  return 'INVALID';
}

export function getTaxpayerDocumentStatusLabel(status: DataIntegrityStatus): string {
  if (status === 'MISSING') return 'Documento não informado';
  if (status === 'INVALID') return 'CPF/CNPJ inválido';
  if (status === 'NOT_VERIFIABLE') return 'Documento não verificável localmente';
  return 'CPF/CNPJ válido';
}
