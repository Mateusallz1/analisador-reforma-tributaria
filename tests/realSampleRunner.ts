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

const REAL_NFE_FIXTURES = import.meta.glob<string>('./fixtures/real-nfe/*.xml', {
  eager: true,
  import: 'default',
  query: '?raw',
});
const REAL_NFCE_FIXTURES = import.meta.glob<string>('./fixtures/nfce-real/*.xml', {
  eager: true,
  import: 'default',
  query: '?raw',
});
const REAL_NFSE_FIXTURES = import.meta.glob<string>('./fixtures/nfse-real/*.xml', {
  eager: true,
  import: 'default',
  query: '?raw',
});

function createFiles(
  fixtures: Record<string, string>,
  prefix: string,
): File[] {
  return Object.entries(fixtures)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, xml]) => {
      const fileName = path.split('/').pop() || path;
      return new File([xml], `${prefix}-${fileName}`, { type: 'application/xml' });
    });
}

async function runRealSampleHomologation(): Promise<void> {
  const nfeFiles = createFiles(REAL_NFE_FIXTURES, 'real-nfe');
  const nfceFiles = createFiles(REAL_NFCE_FIXTURES, 'real-nfce');
  const nfseFiles = createFiles(REAL_NFSE_FIXTURES, 'real-nfse');
  const files = [...nfeFiles, ...nfceFiles, ...nfseFiles];

  const processed = await processFiles(files);
  const totalItems = processed.results.reduce(
    (total, result) => total + (result.itens?.length || 0),
    0,
  );
  const ibsCbsDocuments = processed.results.filter((result) => result.contemIBSCBS).length;
  const nfeResults = processed.results.filter((result) => result.documentKind === 'NFE');
  const nfceResults = processed.results.filter((result) => result.documentKind === 'NFCE');
  const nfseResults = processed.results.filter((result) => result.documentKind === 'NFSE');

  assert(files.length === 44, `Esperadas 44 fixtures fiscais anonimizadas, recebidas ${files.length}`);
  const expectedUnsupportedNfse = processed.errors.filter(
    (error) => error.fileName === 'real-nfse-sample-001.xml',
  );

  assert(processed.errors.length === 1, `Esperada 1 rejeição estrutural, recebidos ${processed.errors.length}`);
  assert(expectedUnsupportedNfse.length === 1, 'A rejeição da NFS-e ABRASF não foi identificada');
  assert(
    expectedUnsupportedNfse[0].error === 'Formato XML não reconhecido. São aceitos NF-e/NFC-e e os layouts NFS-e ABRASF ou padrão nacional (DPS/NFS-e).',
    `Motivo de rejeição inesperado: ${expectedUnsupportedNfse[0].error}`,
  );
  assert(processed.results.length === 43, `Esperados 43 resultados aceitos, recebidos ${processed.results.length}`);
  assert(
    nfeResults.length === 25 && nfeResults.every((result) => result.documentLayout === 'NFE'),
    `Esperadas 25 NF-e modelo 55, recebidas ${nfeResults.length}`,
  );
  assert(
    nfceResults.length === 18 && nfceResults.every((result) => result.documentLayout === 'NFE'),
    `Esperadas 18 NFC-e modelo 65, recebidas ${nfceResults.length}`,
  );
  assert(nfseResults.length === 0, 'A NFS-e sem perfil estrutural não deveria entrar nos resultados');
  assert(totalItems === 113, `Esperados 113 itens/serviços fiscais aceitos, recebidos ${totalItems}`);
  assert(ibsCbsDocuments === 15, `Esperados 15 documentos aceitos com IBSCBS, recebidos ${ibsCbsDocuments}`);
  assert(
    processed.results.every((result) => result.taxBase.version === '1.1.0'),
    'Alguma amostra não usou a versão esperada da base fiscal',
  );
}

let result: TestCaseResult;

try {
  await runRealSampleHomologation();
  result = {
    name: 'homologa NF-e e NFC-e reais anonimizadas com o pipeline de produção',
    status: 'passed',
    message: '25 NF-e e 18 NFC-e processadas; 1 NFS-e ABRASF sem perfil foi rejeitada; 113 itens e 15 documentos com IBSCBS.',
  };
} catch (error) {
  result = {
    name: 'homologa NF-e e NFC-e reais anonimizadas com o pipeline de produção',
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
