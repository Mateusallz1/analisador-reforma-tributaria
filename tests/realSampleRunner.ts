import { processFiles } from '../src/utils/fileProcessing.ts';
import { assert } from './assertions.ts';

interface TestCaseResult {
  name: string;
  status: 'passed' | 'failed';
  message?: string;
}

interface BrowserTestReport {
  passed: boolean;
  total: number;
  failed: number;
  results: TestCaseResult[];
}

declare global {
  interface Window {
    __ENGINE_TEST_RESULTS__?: BrowserTestReport;
  }
}

const REAL_FIXTURES = import.meta.glob<string>('./fixtures/real-nfe/*.xml', {
  eager: true,
  import: 'default',
  query: '?raw',
});

async function runRealSampleHomologation(): Promise<void> {
  const files = Object.entries(REAL_FIXTURES)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, xml]) => {
      const fileName = path.split('/').pop() || path;
      return new File([xml], fileName, { type: 'application/xml' });
    });

  const processed = await processFiles(files);
  const totalItems = processed.results.reduce(
    (total, result) => total + (result.itens?.length || 0),
    0,
  );
  const ibsCbsDocuments = processed.results.filter((result) => result.contemIBSCBS).length;

  assert(files.length === 25, `Esperadas 25 fixtures reais anonimizadas, recebidas ${files.length}`);
  assert(processed.errors.length === 0, `Homologação produziu ${processed.errors.length} erro(s)`);
  assert(processed.results.length === 25, `Esperados 25 resultados, recebidos ${processed.results.length}`);
  assert(
    processed.results.every((result) => result.documentLayout === 'NFE' && result.documentKind === 'NFE'),
    'Amostras reais não foram reconhecidas como NF-e modelo 55',
  );
  assert(totalItems === 62, `Esperados 62 itens reais, recebidos ${totalItems}`);
  assert(ibsCbsDocuments === 9, `Esperados 9 documentos com IBSCBS, recebidos ${ibsCbsDocuments}`);
  assert(
    processed.results.every((result) => result.taxBase.version === '1.1.0'),
    'Alguma amostra não usou a versão esperada da base fiscal',
  );
}

let result: TestCaseResult;

try {
  await runRealSampleHomologation();
  result = {
    name: 'homologa 25 NF-e reais anonimizadas com o pipeline de produção',
    status: 'passed',
    message: '25 documentos e 62 itens processados; 9 documentos contêm IBSCBS.',
  };
} catch (error) {
  result = {
    name: 'homologa 25 NF-e reais anonimizadas com o pipeline de produção',
    status: 'failed',
    message: error instanceof Error ? error.message : String(error),
  };
}

const report: BrowserTestReport = {
  passed: result.status === 'passed',
  total: 1,
  failed: result.status === 'failed' ? 1 : 0,
  results: [result],
};

globalThis.__ENGINE_TEST_RESULTS__ = report;
document.body.innerHTML = `<pre>${JSON.stringify(report, null, 2)}</pre>`;

if (!report.passed) {
  throw new Error(result.message || 'Homologação com amostras reais falhou.');
}
