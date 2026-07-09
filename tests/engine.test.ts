import { calculateItemStats, groupAnalysesByEmpresaFoco } from '../src/utils/analysisStats.ts';
import { getFilteredResultGroups } from '../src/utils/resultFilters.ts';
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
  run: () => void;
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

export function runEngineTests(): TestCaseResult[] {
  return tests.map((test) => {
    try {
      test.run();
      return { name: test.name, status: 'passed' };
    } catch (error) {
      return {
        name: test.name,
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
}