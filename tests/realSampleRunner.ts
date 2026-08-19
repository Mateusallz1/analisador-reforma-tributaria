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
const REAL_NFSE_NATIONAL_FIXTURES = import.meta.glob<string>('./fixtures/nfse-national-real/*.xml', {
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

function assertFixturesDoNotContainPrivateMaterial(fixtures: Record<string, string>[]): void {
  const contents = fixtures.flatMap((fixture) => Object.values(fixture));
  assert(
    contents.every((xml) => !/<(?:[A-Za-z_][\w.-]*:)?X509Certificate\b/i.test(xml)),
    'As fixtures não podem conter certificados X.509 de origem',
  );
  assert(
    contents.every((xml) => !/-----BEGIN [^-]*PRIVATE KEY-----/i.test(xml)),
    'As fixtures não podem conter chaves privadas',
  );

  for (const xml of contents) {
    const document = new DOMParser().parseFromString(xml, 'text/xml');
    assert(document, 'Fixture XML inválida durante a verificação de privacidade');

    for (const node of Array.from(document.getElementsByTagName('*'))) {
      const localName = node.localName || node.tagName;
      const value = node.textContent?.trim() || '';

      if (['CNPJ', 'Cnpj'].includes(localName) && value) {
        assert(/^12345\d{3}0001\d{2}$/.test(value), 'Fixture contém CNPJ fora do padrão sintético');
      }
      if (['CPF', 'Cpf'].includes(localName) && value) {
        assert(/^12345\d{4}\d{2}$/.test(value), 'Fixture contém CPF fora do padrão sintético');
      }
      if (['SignatureValue', 'DigestValue'].includes(localName) && value) {
        assert(/^(SIGNATURE|DIGEST|SANITIZED)-/.test(value), 'Fixture contém valor de assinatura de origem');
      }
    }
  }
}

async function createNfseWithoutIbsCbs(file: File): Promise<File> {
  const document = new DOMParser().parseFromString(await file.text(), 'text/xml');
  assert(document, 'Não foi possível ler a fixture NFS-e para a variante sem IBSCBS');
  const ibsCbs = document.getElementsByTagName('IBSCBS')[0];
  assert(ibsCbs, 'A fixture NFS-e não possui IBSCBS para a variante de teste');
  ibsCbs.remove();
  return new File(
    [new XMLSerializer().serializeToString(document)],
    'real-nfse-without-ibscbs.xml',
    { type: 'application/xml' },
  );
}

async function runRealSampleHomologation(): Promise<void> {
  const nfeFiles = createFiles(REAL_NFE_FIXTURES, 'real-nfe');
  const nfceFiles = createFiles(REAL_NFCE_FIXTURES, 'real-nfce');
  const nfseFiles = createFiles(REAL_NFSE_FIXTURES, 'real-nfse');
  const nfseNationalFiles = createFiles(REAL_NFSE_NATIONAL_FIXTURES, 'real-nfse-national');
  const files = [...nfeFiles, ...nfceFiles, ...nfseFiles, ...nfseNationalFiles];

  assertFixturesDoNotContainPrivateMaterial([
    REAL_NFE_FIXTURES,
    REAL_NFCE_FIXTURES,
    REAL_NFSE_FIXTURES,
    REAL_NFSE_NATIONAL_FIXTURES,
  ]);

  const processed = await processFiles(files);
  const totalItems = processed.results.reduce(
    (total, result) => total + (result.itens?.length || 0),
    0,
  );
  const ibsCbsDocuments = processed.results.filter((result) => result.contemIBSCBS).length;
  const nfeResults = processed.results.filter((result) => result.documentKind === 'NFE');
  const nfceResults = processed.results.filter((result) => result.documentKind === 'NFCE');
  const nfseResults = processed.results.filter((result) => result.documentKind === 'NFSE');
  const nationalNfseResults = nfseResults.filter((result) => result.documentLayout === 'NFSE_NATIONAL');
  const nfseWithoutIbsCbs = await createNfseWithoutIbsCbs(nfseFiles[0]);
  const pendingNfse = await processFiles([nfseWithoutIbsCbs]);

  assert(files.length === 45, `Esperadas 45 fixtures fiscais anonimizadas, recebidas ${files.length}`);
  assert(
    processed.errors.length === 0,
    `Homologação produziu ${processed.errors.length} erro(s): ${processed.errors
      .map((error) => `${error.fileName}: ${error.error}`)
      .join('; ')}`,
  );
  assert(processed.results.length === 45, `Esperados 45 resultados aceitos, recebidos ${processed.results.length}`);
  assert(
    nfeResults.length === 25 && nfeResults.every((result) => result.documentLayout === 'NFE'),
    `Esperadas 25 NF-e modelo 55, recebidas ${nfeResults.length}`,
  );
  assert(
    nfceResults.length === 18 && nfceResults.every((result) => result.documentLayout === 'NFE'),
    `Esperadas 18 NFC-e modelo 65, recebidas ${nfceResults.length}`,
  );
  assert(
    nfseResults.length === 2 && nfseResults.some((result) => result.documentLayout === 'NFSE_ABRASF'),
    `Esperadas 2 NFS-e aceitas, recebidas ${nfseResults.length}`,
  );
  assert(nationalNfseResults.length === 1, 'NFS-e nacional real não foi reconhecida');
  assert(nationalNfseResults[0].status === 'CONFORME', 'NFS-e nacional real não permaneceu conforme');
  assert(nationalNfseResults[0].itens?.[0]?.itemStatus === 'conforme', 'Item da NFS-e nacional real não permaneceu conforme');
  assert(totalItems === 115, `Esperados 115 itens/serviços fiscais aceitos, recebidos ${totalItems}`);
  assert(ibsCbsDocuments === 17, `Esperados 17 documentos aceitos com IBSCBS, recebidos ${ibsCbsDocuments}`);
  assert(pendingNfse.errors.length === 0, 'NFS-e sem IBSCBS não deveria gerar erro estrutural');
  assert(pendingNfse.results.length === 1, 'NFS-e sem IBSCBS não foi reconhecida');
  assert(!pendingNfse.results[0].contemIBSCBS, 'Variante sem IBSCBS foi marcada incorretamente');
  assert(pendingNfse.results[0].documentLayout === 'NFSE_ABRASF', 'Variante sem IBSCBS perdeu o perfil ABRASF');
  assert(
    processed.results.every((result) => result.taxBase.version === '1.1.0'),
    'Alguma amostra não usou a versão esperada da base fiscal',
  );
}

let result: TestCaseResult;

try {
  await runRealSampleHomologation();
  result = {
    name: 'homologa NF-e, NFC-e e NFS-e reais anonimizadas com o pipeline de produção',
    status: 'passed',
    message: '25 NF-e, 18 NFC-e, 1 NFS-e ABRASF e 1 NFS-e nacional processadas; 115 itens/serviços e 17 documentos com IBSCBS.',
  };
} catch (error) {
  result = {
    name: 'homologa NF-e, NFC-e e NFS-e reais anonimizadas com o pipeline de produção',
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
