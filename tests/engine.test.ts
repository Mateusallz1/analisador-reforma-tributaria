import { calculateItemStats, groupAnalysesByEmpresaFoco } from '../src/utils/analysisStats.ts';
import { getFilteredResultGroups } from '../src/utils/resultFilters.ts';
import { getXmlFingerprint, processFiles } from '../src/utils/fileProcessing.ts';
import { parseNFeXml } from '../src/utils/nfeParser.ts';
import { SAMPLE_NFES } from '../src/data/samples.ts';
import { ComplianceStatus, DocType, ItemClassificationStatus, NFeAnalysis, NFeType, ValidationStatus } from '../src/types.ts';

export interface TestCaseResult {
  name: string;
  status: 'passed' | 'failed';
  message?: string;
}

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

interface SampleExpectation {
  fileName: string;
  docType: DocType;
  tipoNota: NFeType;
  status: ComplianceStatus;
  itemStatus: ItemClassificationStatus;
  validationStatus: ValidationStatus;
  empresaFocoCnpj: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Esperado ${JSON.stringify(expected)}, recebido ${JSON.stringify(actual)}`);
  }
}

function parseSamples(): NFeAnalysis[] {
  return SAMPLE_NFES.map((sample) => parseNFeXml(sample.xmlContent, sample.fileName));
}

function parsePrefixedMultiItemSample(): NFeAnalysis {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<nfe:nfeProc xmlns:nfe="http://www.portalfiscal.inf.br/nfe">',
    '<nfe:NFe><nfe:infNFe>',
    '<nfe:ide><nfe:mod>55</nfe:mod><nfe:nNF>9001</nfe:nNF><nfe:dhEmi>2026-05-29T10:00:00-03:00</nfe:dhEmi><nfe:tpNF>1</nfe:tpNF></nfe:ide>',
    '<nfe:emit><nfe:CNPJ>61585865000108</nfe:CNPJ><nfe:xNome>Alfa Implementos Industriais S.A.</nfe:xNome></nfe:emit>',
    '<nfe:dest><nfe:CNPJ>12345678000199</nfe:CNPJ><nfe:xNome>Beta Distribuidora de Bebidas Ltda</nfe:xNome></nfe:dest>',
    '<nfe:det nItem="1"><nfe:prod><nfe:xProd>Item sem redução</nfe:xProd></nfe:prod><nfe:imposto><nfe:IBSCBS><nfe:CST>000</nfe:CST><nfe:cClassTrib>000001</nfe:cClassTrib><nfe:gIBSCBS><nfe:vBC>100.00</nfe:vBC><nfe:gCBS><nfe:pCBS>0.9000</nfe:pCBS><nfe:vCBS>0.90</nfe:vCBS></nfe:gCBS></nfe:gIBSCBS></nfe:IBSCBS></nfe:imposto></nfe:det>',
    '<nfe:det nItem="2"><nfe:prod><nfe:xProd>Item com redução</nfe:xProd></nfe:prod><nfe:imposto><nfe:IBSCBS><nfe:CST>200</nfe:CST><nfe:cClassTrib>200038</nfe:cClassTrib><nfe:gIBSCBS><nfe:vBC>100.00</nfe:vBC><nfe:gIBSUF><nfe:pIBSUF>0.1000</nfe:pIBSUF><nfe:gRed><nfe:pRedAliq>60.0000</nfe:pRedAliq><nfe:pAliqEfet>0.0400</nfe:pAliqEfet></nfe:gRed><nfe:vIBSUF>0.04</nfe:vIBSUF></nfe:gIBSUF><nfe:gIBSMun><nfe:pIBSMun>0.0000</nfe:pIBSMun><nfe:gRed><nfe:pRedAliq>60.0000</nfe:pRedAliq><nfe:pAliqEfet>0.0000</nfe:pAliqEfet></nfe:gRed><nfe:vIBSMun>0.00</nfe:vIBSMun></nfe:gIBSMun><nfe:vIBS>0.04</nfe:vIBS><nfe:gCBS><nfe:pCBS>0.9000</nfe:pCBS><nfe:gRed><nfe:pRedAliq>60.0000</nfe:pRedAliq><nfe:pAliqEfet>0.3600</nfe:pAliqEfet></nfe:gRed><nfe:vCBS>0.36</nfe:vCBS></nfe:gCBS></nfe:gIBSCBS></nfe:IBSCBS></nfe:imposto></nfe:det>',
    '</nfe:infNFe></nfe:NFe></nfe:nfeProc>',
  ].join('');

  return parseNFeXml(xml, 'NFe_Prefixado_Multiplos_Itens.xml');
}

function findByFileName(results: NFeAnalysis[], fileName: string): NFeAnalysis {
  const result = results.find((item) => item.fileName === fileName);
  assert(result, `Amostra não encontrada após parsing: ${fileName}`);
  return result;
}

function firstItemStatus(result: NFeAnalysis): ItemClassificationStatus {
  const itemStatus = result.itens?.[0]?.itemStatus;
  assert(itemStatus, `Amostra ${result.fileName} não possui status de item`);
  return itemStatus;
}

const sampleExpectations: SampleExpectation[] = [
  {
    fileName: 'NFe_35260661585865000108_Saida_Conforme.xml',
    docType: 'NFe',
    tipoNota: 'SAÍDA',
    status: 'CONFORME',
    itemStatus: 'conforme',
    validationStatus: 'válido',
    empresaFocoCnpj: '61585865000108',
  },
  {
    fileName: 'NFe_35260661585865000108_Saida_ClassificacaoInvalida.xml',
    docType: 'NFe',
    tipoNota: 'SAÍDA',
    status: 'NÃO_CONFORME',
    itemStatus: 'classificacao_invalida',
    validationStatus: 'inválido',
    empresaFocoCnpj: '61585865000108',
  },
  {
    fileName: 'NFe_43260699999999000100_Entrada_Conforme.xml',
    docType: 'NFe',
    tipoNota: 'ENTRADA',
    status: 'CONFORME',
    itemStatus: 'conforme',
    validationStatus: 'válido',
    empresaFocoCnpj: '44555666000188',
  },
  {
    fileName: 'NFe_43260688888888000111_Entrada_Autorizada_Pendencias.xml',
    docType: 'NFe',
    tipoNota: 'ENTRADA',
    status: 'AUTORIZADA_COM_PENDENCIAS',
    itemStatus: 'nao_conforme_valor',
    validationStatus: 'inválido',
    empresaFocoCnpj: '44555666000188',
  },
  {
    fileName: 'NFCe_35260612345678000199_Saida_Conforme.xml',
    docType: 'NFCe',
    tipoNota: 'SAÍDA',
    status: 'CONFORME',
    itemStatus: 'conforme',
    validationStatus: 'válido',
    empresaFocoCnpj: '12345678000199',
  },
  {
    fileName: 'NFe_35260661585865000108_Saida_SemReforma.xml',
    docType: 'NFe',
    tipoNota: 'SAÍDA',
    status: 'N/A',
    itemStatus: 'N/A',
    validationStatus: 'N/A',
    empresaFocoCnpj: '61585865000108',
  },
  {
    fileName: 'NFSe_2026_Prestador_Incompleto.xml',
    docType: 'NFSe',
    tipoNota: 'SAÍDA',
    status: 'NÃO_CONFORME',
    itemStatus: 'incompleto',
    validationStatus: 'incompleto',
    empresaFocoCnpj: '55666777000188',
  },
  {
    fileName: 'NFe_SemEmitente_DadosIncompletos.xml',
    docType: 'NFe',
    tipoNota: 'SAÍDA',
    status: 'CONFORME',
    itemStatus: 'conforme',
    validationStatus: 'válido',
    empresaFocoCnpj: '',
  },
];

const tests: TestCase[] = [
  {
    name: 'parser classifica cada amostra fiscal no estado esperado',
    run: () => {
      const results = parseSamples();
      assertEquals(results.length, sampleExpectations.length);
      assertEquals(results[0].taxBase.version, '1.0.0');
      assert(results[0].taxBase.source.includes('cClassTrib_2026_04_15.xlsx'), 'Origem da base fiscal não foi preservada');
      assertEquals('xmlContent' in results[0], false);

      sampleExpectations.forEach((expectation) => {
        const result = findByFileName(results, expectation.fileName);
        assertEquals(result.docType, expectation.docType, `${expectation.fileName}: docType divergente`);
        assertEquals(result.tipoNota, expectation.tipoNota, `${expectation.fileName}: tipoNota divergente`);
        assertEquals(result.status, expectation.status, `${expectation.fileName}: status geral divergente`);
        assertEquals(result.validationStatus, expectation.validationStatus, `${expectation.fileName}: validationStatus divergente`);
        assertEquals(firstItemStatus(result), expectation.itemStatus, `${expectation.fileName}: itemStatus divergente`);
        assertEquals(result.empresaFoco.cnpj, expectation.empresaFocoCnpj, `${expectation.fileName}: empresa em foco divergente`);
      });
    },
  },
  {
    name: 'processamento ignora XML duplicado por conteúdo normalizado',
    run: async () => {
      const sourceXml = SAMPLE_NFES[0].xmlContent;
      const equivalentXml = sourceXml.replace(/>\s+</g, '> \n <');
      const parsed = await processFiles([
        new File([sourceXml], 'original.xml', { type: 'text/xml' }),
        new File([equivalentXml], 'copia-renomeada.xml', { type: 'text/xml' }),
      ]);

      assertEquals(parsed.results.length, 1);
      assertEquals(parsed.errors.length, 1);
      assertEquals(parsed.errors[0].kind, 'DUPLICATE');
      assert(parsed.errors[0].error.includes('duplicado'), 'A duplicidade deve ser informada ao usuário');
      assertEquals(parsed.results[0].contentFingerprint, getXmlFingerprint(sourceXml));
    },
  },
  {
    name: 'busca encontra CNPJ formatado e mantém o grupo correspondente',
    run: () => {
      const filtered = getFilteredResultGroups(parseSamples(), {
        searchTerm: '61.585.865/0001-08',
        statusFilter: 'ALL',
        typeFilter: 'ALL',
        docTypeFilter: 'ALL',
      });

      assertEquals(filtered.activeGroups.length, 1);
      assertEquals(filtered.activeGroups[0].empresaFoco.cnpj, '61585865000108');
      assertEquals(filtered.activeGroups[0].notas.length, 3);
      assertEquals(filtered.matchesWithoutCnpj.length, 0);
    },
  },
  {
    name: 'validação de múltiplos itens respeita namespace e não mistura alíquotas entre itens',
    run: () => {
      const result = parsePrefixedMultiItemSample();

      assertEquals(result.status, 'CONFORME');
      assertEquals(result.validationStatus, 'válido');
      assertEquals(result.itens?.length, 2);
      assertEquals(result.itens?.[0]?.itemStatus, 'conforme');
      assertEquals(result.itens?.[1]?.itemStatus, 'conforme');
      assertEquals(result.itens?.[0]?.numeroItem, 1);
      assertEquals(result.itens?.[1]?.numeroItem, 2);
    },
  },
  {
    name: 'KPIs reconciliam N/A fora do denominador de conformidade',
    run: () => {
      const stats = calculateItemStats(parseSamples());

      assertEquals(stats.totalItems, 8);
      assertEquals(stats.applicableItems, 7);
      assertEquals(stats.compliantItems, 4);
      assertEquals(stats.pendingItems, 1);
      assertEquals(stats.nonCompliantItems, 2);
      assertEquals(stats.outOfScopeItems, 1);
      assertEquals(stats.saidaItems, 6);
      assertEquals(stats.entradaItems, 2);
      assertEquals(stats.complianceRate, 57);
    },
  },
  {
    name: 'agrupamento ignora notas sem CNPJ em foco e preserva resumo do Grupo Alfa',
    run: () => {
      const groups = groupAnalysesByEmpresaFoco(parseSamples());
      const alfa = groups.find((group) => group.empresaFoco.cnpj === '61585865000108');

      assertEquals(groups.length, 4);
      assert(alfa, 'Grupo Alfa não foi encontrado');
      assertEquals(alfa.totalNotas, 3);
      assertEquals(alfa.conformeNotas, 1);
      assertEquals(alfa.naoConformeNotas, 1);
      assertEquals(alfa.porcentagemEmConformidade, 50);
      assertEquals(alfa.notas.some((note) => note.status === 'N/A'), true, 'Grupo Alfa deve manter a nota fora do escopo');
      assertEquals(groups.some((group) => group.empresaFoco.cnpj === ''), false, 'Notas sem CNPJ não devem virar grupo');
    },
  },
  {
    name: 'filtros separam grupos ativos e documentos sem CNPJ em foco',
    run: () => {
      const filtered = getFilteredResultGroups(parseSamples(), {
        searchTerm: '',
        statusFilter: 'CONFORME',
        typeFilter: 'SAÍDA',
        docTypeFilter: 'NFe',
      });

      assertEquals(filtered.totalProcessed, 8);
      assertEquals(filtered.totalProcessedFiltered, 2);
      assertEquals(filtered.activeGroups.length, 1);
      assertEquals(filtered.activeGroups[0].empresaFoco.cnpj, '61585865000108');
      assertEquals(filtered.matchesWithoutCnpj.length, 1);
      assertEquals(filtered.matchesWithoutCnpj[0].fileName, 'NFe_SemEmitente_DadosIncompletos.xml');
    },
  },];

export async function runEngineTests(): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];

  for (const test of tests) {
    try {
      await test.run();
      results.push({ name: test.name, status: 'passed' });
    } catch (error) {
      results.push({
        name: test.name,
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}