/**
 * Types for the NF-e Tax Reform Analyser
 */

export type NFeType = 'ENTRADA' | 'SAÍDA';

export type DocType = 'NFe' | 'NFCe' | 'NFSe';

export type ValidationStatus = 'válido' | 'inválido' | 'incompleto' | 'pendente' | 'N/A';

export type DataIntegrityStatus = 'VALID' | 'MISSING' | 'INVALID' | 'NOT_VERIFIABLE';

export type DocumentLayout = 'NFE' | 'NFSE_ABRASF' | 'NFSE_NATIONAL';

export type DocumentKind = 'NFE' | 'NFCE' | 'NFSE' | 'DPS';

export type DpsIssuerRole = 'PRESTADOR' | 'TOMADOR' | 'INTERMEDIARIO' | 'NAO_IDENTIFICADO';

export type ComplianceStatus = 'CONFORME' | 'NÃO_CONFORME' | 'AUTORIZADA_COM_PENDENCIAS' | 'PENDENTE' | 'N/A';

export type ItemClassificationStatus =
  | 'conforme'
  | 'nao_conforme_valor'
  | 'fora_vigencia'
  | 'classificacao_invalida'
  | 'incompleto'
  | 'pendente'
  | 'N/A';

export interface CompanyInfo {
  cnpj: string;
  nome: string;
}

export interface TaxBaseInfo {
  version: string;
  source: string;
  referenceDate: string;
  classificationSource: string;
  technicalSource: string;
  legalSource: string;
}

export interface ItemValidation {
  numeroItem: number;
  descricaoProduto: string;
  codigoServico?: string;
  codigoNbs?: string;
  descricaoTributacaoNacional?: string;
  descricaoNbs?: string;
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
  emissionDateStatus: DataIntegrityStatus;
  tipoNota: NFeType;
  operationStatus: DataIntegrityStatus;
  docType: DocType;
  documentLayout: DocumentLayout;
  documentKind: DocumentKind;
  documentVersion?: string;
  dpsIssuerRole?: DpsIssuerRole;
  cnpjEmitente: string;
  nomeEmitente: string;
  emitterDocumentStatus: DataIntegrityStatus;
  cnpjDestinatario: string;
  nomeDestinatario: string;
  recipientDocumentStatus: DataIntegrityStatus;
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
  documentLayout?: DocumentLayout;
  documentKind?: DocumentKind;
  documentVersion?: string;
}

export interface AnalysisRunInfo {
  startedAt: string;
  completedAt: string;
  inputFileCount: number;
  cancelled: boolean;
  inputUncompressedSizeBytes?: number;
}
