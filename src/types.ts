/**
 * Types for the NF-e Tax Reform Analyser
 */

export type NFeType = 'ENTRADA' | 'SAÍDA';

export type DocType = 'NFe' | 'NFCe' | 'NFSe';

export type ValidationStatus = 'válido' | 'inválido' | 'incompleto' | 'N/A';

export type ComplianceStatus = 'CONFORME' | 'NÃO_CONFORME' | 'AUTORIZADA_COM_PENDENCIAS' | 'N/A';

export type ItemClassificationStatus =
  | 'conforme'
  | 'nao_conforme_valor'
  | 'fora_vigencia'
  | 'classificacao_invalida'
  | 'incompleto'
  | 'N/A';

export interface CompanyInfo {
  cnpj: string;
  nome: string;
}

export interface TaxBaseInfo {
  version: string;
  source: string;
  legalSource: string;
}

export interface ItemValidation {
  numeroItem: number;
  descricaoProduto: string;
  contemIBSCBS: boolean;
  cst?: string;
  cClassTrib?: string;
  cstDesc?: string;
  cClassTribDesc?: string;
  validationStatus: ValidationStatus;
  validationReason?: string;
  itemStatus?: ItemClassificationStatus;
}

export interface NFeAnalysis {
  id: string; // unique ID constructed from file name / index
  fileName: string;
  numeroNota: string;
  dataEmissao: string;
  tipoNota: NFeType;
  docType: DocType;
  cnpjEmitente: string;
  nomeEmitente: string;
  cnpjDestinatario: string;
  nomeDestinatario: string;
  empresaFoco: CompanyInfo;
  contemIBSCBS: boolean;
  status: ComplianceStatus;
  cst?: string;
  cClassTrib?: string;
  cstDesc?: string;
  cClassTribDesc?: string;
  validationStatus?: ValidationStatus;
  validationReason?: string;
  itens?: ItemValidation[];
  taxBase: TaxBaseInfo;
  contentFingerprint?: string;
}

export interface GroupedAnalysis {
  empresaFoco: CompanyInfo;
  notas: NFeAnalysis[];
  totalNotas: number;
  conformeNotas: number;
  naoConformeNotas: number;
  porcentagemEmConformidade: number;
}

export type FileProcessingErrorKind = 'PROCESSING' | 'DUPLICATE';

export interface FileProcessingError {
  fileName: string;
  error: string;
  kind?: FileProcessingErrorKind;
}
