import type {
  AnalysisRunInfo,
  ComplianceStatus,
  FileProcessingError,
  ItemClassificationStatus,
  ItemValidation,
  NFeAnalysis,
} from '../types';
import { calculateItemStats, getNoteItemCount, type ItemStats } from './analysisStats';

export type ReportCell = string | number;

export interface ReportSheet {
  name: string;
  rows: ReportCell[][];
  columnWidths: number[];
  filterRow?: number;
}

export interface AnalysisReport {
  fileName: string;
  generatedAt: string;
  sheets: ReportSheet[];
}

const complianceLabels: Record<ComplianceStatus, string> = {
  CONFORME: 'Conforme',
  NÃO_CONFORME: 'Não conforme',
  AUTORIZADA_COM_PENDENCIAS: 'Autorizada com pendências',
  PENDENTE: 'Pendente',
  'N/A': 'Fora do escopo',
};

const itemStatusLabels: Record<ItemClassificationStatus, string> = {
  conforme: 'Conforme',
  nao_conforme_valor: 'Falha de valor',
  fora_vigencia: 'Fora de vigência',
  classificacao_invalida: 'Classificação inválida',
  incompleto: 'Incompleto',
  pendente: 'Pendente',
  'N/A': 'Fora do escopo',
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
}

function documentTypeLabel(note: NFeAnalysis): string {
  const documentLabel = note.documentKind === 'DPS' ? 'DPS' : note.docType;
  return `${documentLabel} (${note.documentLayout})`;
}

function operationLabel(note: NFeAnalysis): string {
  if (note.documentKind === 'DPS') {
    const role = note.dpsIssuerRole === 'PRESTADOR'
      ? 'prestador'
      : note.dpsIssuerRole === 'TOMADOR'
        ? 'tomador'
        : note.dpsIssuerRole === 'INTERMEDIARIO'
          ? 'intermediário'
          : 'papel não identificado';
    return `DPS - papel: ${role}`;
  }
  if (note.operationStatus === 'MISSING') return 'Operação não informada';
  if (note.operationStatus === 'INVALID') return 'Operação inválida';
  if (note.operationStatus === 'NOT_VERIFIABLE') return 'Operação não verificável';
  return note.tipoNota === 'SAÍDA' ? 'Saída' : 'Entrada';
}

function itemLabel(item: ItemValidation): string {
  return item.numeroItem > 0 ? `#${item.numeroItem}` : 'Documento';
}

function itemStatusLabel(item: ItemValidation): string {
  return item.itemStatus ? itemStatusLabels[item.itemStatus] : 'Pendente';
}

function isActionableItem(item: ItemValidation, note: NFeAnalysis): boolean {
  if (item.itemStatus === 'conforme' || item.itemStatus === 'N/A') return false;
  return Boolean(item.itemStatus) || note.status !== 'CONFORME' && note.status !== 'N/A';
}

function getActionableItems(note: NFeAnalysis): ItemValidation[] {
  const items = note.itens || [];
  const actionable = items.filter((item) => isActionableItem(item, note));

  if (actionable.length > 0 || note.status === 'CONFORME' || note.status === 'N/A') {
    return actionable;
  }

  const hasDetailedItems = items.length > 0;
  return [{
    numeroItem: 0,
    descricaoProduto: hasDetailedItems ? 'Pendência documental' : 'Documento sem item/serviço detalhado',
    contemIBSCBS: note.contemIBSCBS,
    validationStatus: note.validationStatus || 'incompleto',
    validationReason: note.validationReason || 'Documento exige revisão.',
    itemStatus: note.status === 'PENDENTE' ? 'pendente' : 'incompleto',
  }];
}

function getActionableCount(note: NFeAnalysis): number {
  return getActionableItems(note).length;
}

function summaryRows(results: NFeAnalysis[], errors: FileProcessingError[], run: AnalysisRunInfo, stats: ItemStats): ReportCell[][] {
  const duplicateCount = errors.filter((error) => error.kind === 'DUPLICATE').length;
  const processingErrorCount = errors.length - duplicateCount;
  const status = run.cancelled
    ? 'Cancelada'
    : errors.length > 0
      ? 'Concluída com ocorrências'
      : 'Concluída';
  const taxBase = results[0]?.taxBase;

  return [
    ['Relatório da análise'],
    ['Analisador da Reforma Tributária'],
    [],
    ['Resumo da execução', 'Valor'],
    ['Status da execução', status],
    ['Início', formatDateTime(run.startedAt)],
    ['Conclusão', formatDateTime(run.completedAt)],
    ['Arquivos de entrada', run.inputFileCount],
    ['Documentos analisados', results.length],
    ['Duplicidades ignoradas', duplicateCount],
    ['Arquivos/documentos com erro', processingErrorCount],
    [],
    ['Indicadores fiscais', 'Quantidade'],
    ['Itens/serviços analisados', stats.totalItems],
    ['Itens aplicáveis', stats.applicableItems],
    ['Itens conformes', stats.compliantItems],
    ['Itens pendentes', stats.pendingItems],
    ['Itens não conformes', stats.nonCompliantItems],
    ['Itens fora do escopo', stats.outOfScopeItems],
    ['Taxa de conformidade', `${stats.complianceRate}%`],
    [],
    ['Base fiscal utilizada', 'Valor'],
    ['Versão', taxBase?.version || 'Não informada'],
    ['Data de referência', taxBase?.referenceDate || 'Não informada'],
    ['Fonte incorporada', taxBase?.source || 'Não informada'],
    ['Fonte da classificação', taxBase?.classificationSource || 'Não informada'],
    ['Fonte técnica', taxBase?.technicalSource || 'Não informada'],
    ['Fonte legal', taxBase?.legalSource || 'Não informada'],
    [],
    ['Observação'],
    ['Este relatório apresenta uma análise automatizada local e não substitui validação oficial ou orientação tributária.'],
  ];
}

function documentRows(results: NFeAnalysis[]): ReportCell[][] {
  const rows: ReportCell[][] = [[
    'Empresa foco',
    'CPF/CNPJ foco',
    'Tipo de documento',
    'Número',
    'Operação',
    'Emissão',
    'Emitente',
    'CPF/CNPJ emitente',
    'Destinatário',
    'CPF/CNPJ destinatário',
    'Situação perante a Reforma',
    'Itens/serviços',
    'Achados para revisão',
    'Arquivo de origem',
  ]];

  results.forEach((note) => {
    rows.push([
      note.empresaFoco.nome,
      note.empresaFoco.cnpj || 'Não identificado',
      documentTypeLabel(note),
      note.numeroNota || 'Não informado',
      operationLabel(note),
      note.dataEmissao || 'Não informada',
      note.nomeEmitente || 'Não informado',
      note.cnpjEmitente || 'Não informado',
      note.nomeDestinatario || 'Não informado',
      note.cnpjDestinatario || 'Não informado',
      complianceLabels[note.status],
      getNoteItemCount(note),
      getActionableCount(note),
      note.fileName,
    ]);
  });

  return rows;
}

function findingRows(results: NFeAnalysis[]): ReportCell[][] {
  const rows: ReportCell[][] = [[
    'Empresa foco',
    'Tipo de documento',
    'Número',
    'Operação',
    'Emissão',
    'Item',
    'Produto/serviço',
    'CST',
    'Classificação',
    'Status do achado',
    'Diagnóstico',
    'Emitente',
    'Destinatário',
    'Arquivo de origem',
  ]];

  results.forEach((note) => {
    getActionableItems(note).forEach((item) => {
      rows.push([
        note.empresaFoco.nome,
        documentTypeLabel(note),
        note.numeroNota || 'Não informado',
        operationLabel(note),
        note.dataEmissao || 'Não informada',
        itemLabel(item),
        item.descricaoProduto || 'Não informado',
        item.cst || 'Ausente',
        item.cClassTrib || 'Ausente',
        itemStatusLabel(item),
        item.validationReason || note.validationReason || 'Revisão necessária.',
        note.nomeEmitente || 'Não informado',
        note.nomeDestinatario || 'Não informado',
        note.fileName,
      ]);
    });
  });

  return rows;
}

function occurrenceRows(errors: FileProcessingError[]): ReportCell[][] {
  return [
    ['Tipo', 'Arquivo/documento', 'Ocorrência'],
    ...errors.map((error) => [
      error.kind === 'DUPLICATE' ? 'Duplicidade' : 'Erro de processamento',
      error.fileName,
      error.error,
    ]),
  ];
}

export function buildAnalysisReport(
  results: NFeAnalysis[],
  errors: FileProcessingError[],
  run: AnalysisRunInfo,
  generatedAt = new Date().toISOString(),
): AnalysisReport {
  const stats = calculateItemStats(results);
  const generatedDate = new Date(generatedAt);
  const datePart = Number.isNaN(generatedDate.getTime())
    ? 'execucao'
    : generatedDate.toISOString().slice(0, 10).replaceAll('-', '');
  const timePart = Number.isNaN(generatedDate.getTime())
    ? ''
    : generatedDate.toISOString().slice(11, 16).replaceAll(':', '');

  return {
    fileName: `relatorio-analise-${datePart}-${timePart}.xlsx`,
    generatedAt,
    sheets: [
      { name: 'Resumo', rows: summaryRows(results, errors, run, stats), columnWidths: [34, 110] },
      { name: 'Documentos', rows: documentRows(results), columnWidths: [28, 18, 24, 16, 12, 14, 32, 18, 32, 18, 28, 14, 18, 42], filterRow: 1 },
      { name: 'Achados', rows: findingRows(results), columnWidths: [28, 24, 16, 12, 14, 10, 42, 12, 16, 24, 70, 32, 32, 42], filterRow: 1 },
      { name: 'Ocorrências', rows: occurrenceRows(errors), columnWidths: [22, 46, 90], filterRow: 1 },
    ],
  };
}
