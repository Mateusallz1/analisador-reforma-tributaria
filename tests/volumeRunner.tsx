import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import ResultsTable from '../src/components/ResultsTable.tsx';
import { SAMPLE_NFES } from '../src/data/samples.ts';
import { processFiles } from '../src/utils/fileProcessing.ts';
import { getFilteredResultGroups } from '../src/utils/resultFilters.ts';
import { buildAnalysisReport } from '../src/utils/analysisReport.ts';
import { generateAnalysisReportXlsx } from '../src/utils/analysisReportXlsx.ts';
import { assert } from './assertions.ts';

interface VolumeMetrics {
  archiveMs: number;
  processingMs: number;
  initialRenderMs: number;
  firstExpansionMs: number;
  secondPageMs: number;
  filterMs: number;
  reportMs: number;
  archiveBytes: number;
  reportBytes: number;
  heapDeltaBytes?: number;
}

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

const DOCUMENT_COUNT = 5000;
const PAGE_SIZE = 100;
const PROCESSING_BUDGET_MS = 60000;
const INTERACTION_BUDGET_MS = 5000;

function uniqueXml(xml: string, index: number): string {
  const noteNumber = String(1_000_000 + index);
  const withNfeNumber = xml.replace(/<nNF>[^<]*<\/nNF>/, `<nNF>${noteNumber}</nNF>`);
  const withNfseNumber = withNfeNumber.replace(/<Numero>[^<]*<\/Numero>/g, `<Numero>${noteNumber}</Numero>`);
  return `${withNfseNumber}\n<!-- volume-document-${index} -->`;
}

function heapSize(): number | undefined {
  return (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
}

function elapsedSince(start: number): number {
  return Math.round((performance.now() - start) * 100) / 100;
}

function formatMetrics(metrics: VolumeMetrics): string {
  const heap = metrics.heapDeltaBytes === undefined
    ? 'heap indisponível'
    : `heap ${(metrics.heapDeltaBytes / (1024 * 1024)).toFixed(1)} MB`;

  return [
    `ZIP ${(metrics.archiveBytes / (1024 * 1024)).toFixed(1)} MB em ${metrics.archiveMs} ms`,
    `processamento ${metrics.processingMs} ms`,
    `render ${metrics.initialRenderMs} ms`,
    `expansão ${metrics.firstExpansionMs} ms`,
    `segunda página ${metrics.secondPageMs} ms`,
    `filtro ${metrics.filterMs} ms`,
    `relatório ${metrics.reportMs} ms`,
    `XLSX ${(metrics.reportBytes / (1024 * 1024)).toFixed(1)} MB`,
    heap,
  ].join('; ');
}

async function runVolumeTest(): Promise<VolumeMetrics> {
  const initialHeap = heapSize();
  const archiveStart = performance.now();
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  for (let index = 0; index < DOCUMENT_COUNT; index += 1) {
    const sample = SAMPLE_NFES[index % SAMPLE_NFES.length];
    const sequence = String(index + 1).padStart(5, '0');
    zip.file(`volume/${sequence}-${sample.fileName}`, uniqueXml(sample.xmlContent, index));
  }

  const archiveBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true });
  const archiveMs = elapsedSince(archiveStart);
  const volumeFile = new File([archiveBlob], 'homologacao-5000.xml.zip', { type: 'application/zip' });
  let finalProgress = { processed: 0, total: 0 };

  const processingStart = performance.now();
  const processed = await processFiles([volumeFile], {
    onProgress: ({ processed: processedCount, total }) => {
      finalProgress = { processed: processedCount, total };
    },
  });
  const processingMs = elapsedSince(processingStart);

  assert(!processed.cancelled, 'Processamento de volume foi cancelado inesperadamente');
  assert(processed.errors.length === 0, `Volume produziu ${processed.errors.length} erro(s)`);
  assert(processed.results.length === DOCUMENT_COUNT, `Esperados ${DOCUMENT_COUNT} resultados, recebidos ${processed.results.length}`);
  assert(finalProgress.processed === DOCUMENT_COUNT, `Progresso final marcou ${finalProgress.processed} documentos`);
  assert(finalProgress.total === DOCUMENT_COUNT, `Total de progresso marcou ${finalProgress.total} documentos`);
  assert(processingMs <= PROCESSING_BUDGET_MS, `Processamento excedeu ${PROCESSING_BUDGET_MS} ms: ${processingMs} ms`);

  const filtered = getFilteredResultGroups(processed.results, {
    searchTerm: '',
    statusFilter: 'ALL',
    typeFilter: 'ALL',
    docTypeFilter: 'ALL',
  });
  const expectedGroups = filtered.activeGroups.length + (filtered.matchesWithoutCnpj.length > 0 ? 1 : 0);
  assert(expectedGroups >= 5, `Esperados ao menos 5 grupos empresariais, recebidos ${expectedGroups}`);

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  try {
    const renderStart = performance.now();
    flushSync(() => root.render(<ResultsTable allResults={processed.results} />));
    const initialRenderMs = elapsedSince(renderStart);
    assert(initialRenderMs <= INTERACTION_BUDGET_MS, `Render inicial excedeu ${INTERACTION_BUDGET_MS} ms: ${initialRenderMs} ms`);

    const companyToggles = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[aria-controls^="group-content-"]'),
    );
    assert(companyToggles.length === expectedGroups, `UI exibiu ${companyToggles.length} de ${expectedGroups} grupos`);

    const expansionStart = performance.now();
    flushSync(() => companyToggles[0].click());
    const firstExpansionMs = elapsedSince(expansionStart);
    assert(firstExpansionMs <= INTERACTION_BUDGET_MS, `Expansão excedeu ${INTERACTION_BUDGET_MS} ms: ${firstExpansionMs} ms`);
    assert(
      container.querySelectorAll('button[data-note-layer="summary"][data-note-viewport="desktop"]').length === PAGE_SIZE,
      'Primeira página não exibiu 100 notas',
    );

    const showMoreButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim().startsWith('Mostrar mais'),
    );
    assert(showMoreButton, 'Paginação da empresa não foi renderizada');

    const secondPageStart = performance.now();
    flushSync(() => showMoreButton.click());
    const secondPageMs = elapsedSince(secondPageStart);
    assert(secondPageMs <= INTERACTION_BUDGET_MS, `Segunda página excedeu ${INTERACTION_BUDGET_MS} ms: ${secondPageMs} ms`);
    assert(
      container.querySelectorAll('button[data-note-layer="summary"][data-note-viewport="desktop"]').length === PAGE_SIZE * 2,
      'Segunda página não acumulou 200 notas',
    );

    const uniqueResult = processed.results[DOCUMENT_COUNT - 1];
    const filterStart = performance.now();
    const uniqueFilter = getFilteredResultGroups(processed.results, {
      searchTerm: uniqueResult.numeroNota,
      statusFilter: 'ALL',
      typeFilter: 'ALL',
      docTypeFilter: 'ALL',
    });
    const filterMs = elapsedSince(filterStart);
    assert(filterMs <= INTERACTION_BUDGET_MS, `Filtro excedeu ${INTERACTION_BUDGET_MS} ms: ${filterMs} ms`);
    assert(uniqueFilter.totalProcessedFiltered === 1, `Busca única retornou ${uniqueFilter.totalProcessedFiltered} itens`);

    const reportStart = performance.now();
    const report = buildAnalysisReport(
      processed.results,
      processed.errors,
      {
        startedAt: new Date(0).toISOString(),
        completedAt: new Date().toISOString(),
        inputFileCount: DOCUMENT_COUNT,
        cancelled: false,
      },
      new Date().toISOString(),
    );
    const reportBlob = await generateAnalysisReportXlsx(report);
    const reportMs = elapsedSince(reportStart);
    assert(reportBlob.size > 0, 'Relatório de volume gerou um arquivo vazio');
    const reportArchive = await JSZip.loadAsync(reportBlob);
    assert(reportArchive.file('xl/workbook.xml'), 'Relatório de volume não contém workbook.xml');
    assert(reportArchive.file('xl/worksheets/sheet3.xml'), 'Relatório de volume não contém a aba de achados');
    assert(reportMs <= PROCESSING_BUDGET_MS, `Geração do relatório excedeu ${PROCESSING_BUDGET_MS} ms: ${reportMs} ms`);

    const finalHeap = heapSize();
    return {
      archiveMs,
      processingMs,
      initialRenderMs,
      firstExpansionMs,
      secondPageMs,
      filterMs,
      reportMs,
      archiveBytes: archiveBlob.size,
      reportBytes: reportBlob.size,
      heapDeltaBytes: initialHeap === undefined || finalHeap === undefined ? undefined : finalHeap - initialHeap,
    };
  } finally {
    flushSync(() => root.unmount());
    container.remove();
  }
}

let result: TestCaseResult;

try {
  const metrics = await runVolumeTest();
  result = {
    name: 'processa e audita 5.000 XMLs com paginação por empresa',
    status: 'passed',
    message: formatMetrics(metrics),
  };
} catch (error) {
  result = {
    name: 'processa e audita 5.000 XMLs com paginação por empresa',
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
  throw new Error(result.message || 'Teste de volume falhou.');
}
