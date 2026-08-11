import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  CircleMinus,
  Database,
  ExternalLink,
  FileText,
  Menu,
  ScanLine,
  Scale,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react';
import { NFeAnalysis, FileProcessingError } from './types';
import { parseNFeXml } from './utils/nfeParser';
import { getXmlFingerprint, processFiles } from './utils/fileProcessing';
import type { FileProcessingProgress } from './utils/fileProcessing';
import { groupAnalysesByEmpresaFoco } from './utils/analysisStats';
import { getErrorMessage } from './utils/errors';
import { TAX_BASE_INFO } from './utils/taxValidation';
import UploadSection from './components/UploadSection';
import ResultsTable from './components/ResultsTable';
import DashboardStats from './components/DashboardStats';
import { SAMPLE_NFES } from './data/samples';

interface ProcessingStatusProps {
  message: string;
  progress?: FileProcessingProgress;
  onCancel?: () => void;
}

function ProcessingStatus({ message, progress, onCancel }: ProcessingStatusProps) {
  const progressPercent = progress && progress.total > 0
    ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
    : undefined;

  return (
    <div
      className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-base-300 bg-base-200/35 p-8"
      role="status"
      aria-live="polite"
    >
      <span className="loading loading-spinner loading-lg mb-4" aria-hidden="true" />
      <p className="text-sm font-semibold text-base-content">{message}</p>

      {progress && (
        <div className="mt-4 w-full max-w-sm">
          <progress
            className="progress progress-neutral w-full"
            role="progressbar"
            aria-label="Progresso do processamento"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent || 0}
            value={progressPercent || 0}
            max={100}
          />
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-base-content/60">
            <span>{progress.processed} de {progress.total} arquivos</span>
            <span>{progressPercent || 0}%</span>
          </div>
          {progress.currentFile && (
            <p className="mt-1 truncate text-center text-xs text-base-content/50" title={progress.currentFile}>
              {progress.currentFile}
            </p>
          )}
        </div>
      )}

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-ghost btn-sm mt-5"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Cancelar
        </button>
      )}
    </div>
  );
}

export default function App() {
  const [results, setResults] = useState<NFeAnalysis[]>([]);
  const [errors, setErrors] = useState<FileProcessingError[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<FileProcessingProgress>();
  const [canCancelProcessing, setCanCancelProcessing] = useState(false);
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const processingAbortController = useRef<AbortController | null>(null);
  const aboutCloseButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isAboutOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAboutOpen(false);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    aboutCloseButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isAboutOpen]);

  const groupedResults = useMemo(() => {
    return groupAnalysesByEmpresaFoco(results);
  }, [results]);

  const handleFilesSelected = async (files: File[], append = false) => {
    setIsLoading(true);
    const controller = new AbortController();
    processingAbortController.current = controller;
    setCanCancelProcessing(true);
    setProcessingProgress({
      processed: 0,
      total: files.length,
      currentFile: files[0]?.name,
    });

    try {
      const existingFingerprints: Set<string> | undefined = append
        ? new Set(
            results
              .map((result) => result.contentFingerprint)
              .filter((fingerprint): fingerprint is string => Boolean(fingerprint)),
          )
        : undefined;
      const parsed = await processFiles(files, {
        existingFingerprints,
        signal: controller.signal,
        onProgress: setProcessingProgress,
      });
      setResults((previous) => append ? [...previous, ...parsed.results] : parsed.results);
      setErrors((previous) => append ? [...previous, ...parsed.errors] : parsed.errors);
    } catch (err: unknown) {
      const processingError = {
        fileName: 'Geral',
        error: getErrorMessage(err, 'Falha ao processar arquivos.'),
      };
      setErrors((previous) => append ? [...previous, processingError] : [processingError]);
    } finally {
      if (processingAbortController.current === controller) {
        processingAbortController.current = null;
      }
      setCanCancelProcessing(false);
      setProcessingProgress(undefined);
      setIsLoading(false);
    }
  };

  const cancelProcessing = () => {
    processingAbortController.current?.abort();
  };

  const handleLoadSamples = () => {
    processingAbortController.current = null;
    setCanCancelProcessing(false);
    setProcessingProgress(undefined);
    setIsLoading(true);
    try {
      const sampleResults: NFeAnalysis[] = [];
      const sampleErrors: FileProcessingError[] = [];

      SAMPLE_NFES.forEach((sample) => {
        try {
          const analysis = parseNFeXml(sample.xmlContent, sample.fileName);
          sampleResults.push({
            ...analysis,
            contentFingerprint: getXmlFingerprint(sample.xmlContent),
          });
        } catch (err: unknown) {
          sampleErrors.push({
            fileName: sample.fileName,
            error: getErrorMessage(err, 'Erro de parsing na amostra.'),
          });
        }
      });

      setResults(sampleResults);
      setErrors(sampleErrors);
    } catch (err: unknown) {
      setErrors([
        { fileName: 'Amostras', error: getErrorMessage(err, 'Falha ao carregar amostras.') },
      ]);
    } finally {
      setProcessingProgress(undefined);
      setIsLoading(false);
    }
  };

  const handleResetAnalysis = () => {
    setResults([]);
    setErrors([]);
  };

  const clearSingleError = (index: number) => {
    setErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(Array.from(e.target.files), true);
      e.target.value = '';
    }
  };

  const duplicateErrorCount = errors.filter((error) => error.kind === 'DUPLICATE').length;
  const processingErrorCount = errors.length - duplicateErrorCount;

  const scrollToScanner = () => {
    setIsNavigationOpen(false);
    globalThis.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-base-200 font-sans text-base-content">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col border-r border-base-300 bg-base-100 lg:flex">
        <div className="flex h-16 items-center justify-center border-b border-base-300">
          <Scale className="h-5 w-5 text-base-content/70" aria-hidden="true" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Navegação principal">
          <button
            type="button"
            onClick={scrollToScanner}
            className="btn btn-ghost btn-square"
            title="Scanner"
            aria-label="Ir para o scanner"
          >
            <ScanLine className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="divider my-1" />
          <button
            type="button"
            onClick={() => setIsAboutOpen(true)}
            className="btn btn-ghost btn-square"
            title="Sobre a ferramenta"
            aria-label="Sobre a ferramenta"
          >
            <CircleHelp className="h-5 w-5" aria-hidden="true" />
          </button>
        </nav>
      </aside>

      {isNavigationOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-base-content/25"
            onClick={() => setIsNavigationOpen(false)}
            aria-label="Fechar navegação"
          />
          <aside className="relative flex h-full w-64 flex-col border-r border-base-300 bg-base-100 p-3 shadow-xl">
            <div className="mb-4 flex h-12 items-center gap-3 border-b border-base-300 px-2 font-bold">
              <Scale className="h-5 w-5" aria-hidden="true" />
              Analisador
            </div>
            <button type="button" onClick={scrollToScanner} className="btn btn-ghost justify-start">
              <ScanLine className="h-5 w-5" aria-hidden="true" />
              Scanner
            </button>
            <button
              type="button"
              onClick={() => {
                setIsNavigationOpen(false);
                setIsAboutOpen(true);
              }}
              className="btn btn-ghost justify-start"
            >
              <CircleHelp className="h-5 w-5" aria-hidden="true" />
              Sobre a ferramenta
            </button>
          </aside>
        </div>
      )}

      <div className="min-w-0 lg:pl-16">
        <header className="navbar sticky top-0 z-30 min-h-16 border-b border-base-300 bg-base-100/95 px-2 shadow-sm backdrop-blur sm:px-4">
          <button
            type="button"
            onClick={() => setIsNavigationOpen(true)}
            className="btn btn-ghost btn-square lg:hidden"
            aria-label="Abrir navegação"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1 px-2 lg:px-4">
            <h1 className="truncate text-base font-bold">Analisador da Reforma Tributária</h1>
          </div>
          <span className="badge badge-outline badge-sm mr-2 gap-1.5 text-[11px]">
            <span className="status status-success" />
            Local
          </span>
        </header>

        <main className={`mx-auto w-full px-3 py-5 sm:px-6 sm:py-8 ${results.length === 0 ? 'max-w-5xl' : 'max-w-[1500px]'}`}>
        {errors.length > 0 && (
          <div
            id="error-list-container"
            className={
              'alert mb-6 items-start ' +
              (processingErrorCount > 0
                ? 'alert-error'
                : 'alert-warning')
            }
          >
            <div className="w-full">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <AlertCircle
                className={processingErrorCount > 0 ? 'h-4 w-4 text-rose-500' : 'h-4 w-4 text-amber-500'}
                aria-hidden="true"
              />
              <span>
                {processingErrorCount > 0 && processingErrorCount + ' arquivo(s) não puderam ser processados.'}
                {processingErrorCount > 0 && duplicateErrorCount > 0 && ' '}
                {duplicateErrorCount > 0 && duplicateErrorCount + ' duplicado(s) ignorado(s).'}
              </span>
            </div>
            <div className="max-h-36 space-y-1.5 overflow-y-auto pr-2">
              {errors.map((err, idx) => (
                <div
                  key={`${err.fileName}-${idx}`}
                  className={
                    'flex items-center justify-between gap-3 rounded-box border border-base-300 bg-base-100/80 p-2 text-xs ' +
                    (err.kind === 'DUPLICATE'
                      ? 'border-amber-100 text-amber-800'
                      : 'border-rose-100 text-rose-700')
                  }
                >
                  <span className="min-w-0 truncate font-mono">
                    <strong>{err.fileName}</strong>: {err.error}
                  </span>
                  <button
                    type="button"
                    onClick={() => clearSingleError(idx)}
                    className={
                      'shrink-0 rounded p-1 transition-colors ' +
                      (err.kind === 'DUPLICATE'
                        ? 'text-amber-600 hover:bg-amber-100'
                        : 'text-rose-500 hover:bg-rose-100')
                    }
                    title="Remover aviso"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            </div>
          </div>
        )}

        {results.length === 0 ? (
          <section className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-xl shadow-base-content/10">
            <div className="p-5 sm:p-8">
              <h2 className="text-xl font-bold sm:text-2xl">
                Analise a conformidade das suas notas fiscais
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-base-content/65 sm:text-base">
                Verifique a presença do grupo IBSCBS e a compatibilidade entre CST e cClassTrib
                nos XMLs de NF-e, NFC-e e NFS-e.
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-base-content/45">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                O processamento acontece neste navegador. Seus arquivos não são enviados nem armazenados.
              </p>

              <div className="mt-6">
                {isLoading ? (
                  <ProcessingStatus
                    message="Processando arquivos..."
                    progress={processingProgress}
                    onCancel={canCancelProcessing ? cancelProcessing : undefined}
                  />
                ) : (
                  <UploadSection onFilesSelected={handleFilesSelected} isLoading={isLoading} />
                )}
              </div>

              {!isLoading && (
                <div className="mt-5 flex flex-col gap-3 border-t border-base-300 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-xl text-xs leading-relaxed text-base-content/55">
                    Saída usa o emitente como foco; entrada usa o destinatário. O resultado é calculado por item fiscal.
                  </p>
                  <button
                    type="button"
                    onClick={handleLoadSamples}
                    id="btn-load-samples"
                    disabled={isLoading}
                    className="btn btn-ghost btn-sm shrink-0"
                  >
                    <Database className="h-3.5 w-3.5" aria-hidden="true" />
                    Testar com {SAMPLE_NFES.length} amostras
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="space-y-4 pb-10">
            <DashboardStats
              results={results}
              grouped={groupedResults}
              onReset={handleResetAnalysis}
            />

            <div className="flex flex-col gap-3 border-b border-base-300 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold">Relatório de conformidade</h2>
                <p className="mt-0.5 text-xs text-base-content/60">
                  Selecione um documento para consultar o diagnóstico e as classificações.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleLoadSamples}
                  disabled={isLoading}
                  className="btn btn-ghost btn-sm"
                >
                  <Database className="h-4 w-4 text-base-content/50" />
                  Amostras
                </button>

                <label
                  htmlFor="append-nfe-file-input"
                  className="btn btn-neutral btn-sm"
                >
                  <FileText className="h-4 w-4" />
                  Adicionar arquivos
                  <input
                    id="append-nfe-file-input"
                    type="file"
                    multiple
                    accept=".xml,.zip"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                </label>
              </div>
            </div>

            {isLoading ? (
              <ProcessingStatus
                message="Atualizando análise..."
                progress={processingProgress}
                onCancel={canCancelProcessing ? cancelProcessing : undefined}
              />
            ) : (
              <ResultsTable allResults={results} />
            )}
          </section>
        )}
        </main>
      </div>

      {isAboutOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-base-content/30 p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setIsAboutOpen(false)}
            aria-label="Fechar informações"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            className="relative w-full max-w-2xl rounded-t-2xl border border-base-300 bg-base-100 p-5 shadow-2xl sm:rounded-2xl sm:p-8"
          >
            <button
              ref={aboutCloseButtonRef}
              type="button"
              onClick={() => setIsAboutOpen(false)}
              className="btn btn-ghost btn-circle btn-sm absolute right-4 top-4"
              aria-label="Fechar informações"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="mb-5 flex items-center gap-3 pr-10">
              <BookOpen className="h-6 w-6 text-base-content/60" aria-hidden="true" />
              <h2 id="about-title" className="text-xl font-bold">Sobre esta ferramenta</h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-base-content/70">
              <p>
                O Analisador da Reforma Tributária examina localmente documentos fiscais eletrônicos
                e apresenta indícios de adequação ao IBS e à CBS.
              </p>
              <p>
                A análise confere a estrutura IBSCBS, CST e cClassTrib com a base fiscal incorporada.
                Ela apoia a auditoria, mas não substitui validação oficial ou orientação tributária.
              </p>
              <div className="grid gap-3 border-t border-base-300 pt-5 sm:grid-cols-3">
                {[
                  ['NF-e', 'Nota Fiscal Eletrônica'],
                  ['NFC-e', 'Nota Fiscal ao Consumidor'],
                  ['NFS-e', 'Nota Fiscal de Serviços'],
                ].map(([type, label]) => (
                  <div key={type} className="rounded-xl border border-base-300 bg-base-200/50 p-3">
                    <strong className="block text-base-content">{type}</strong>
                    <span className="text-xs">{label}</span>
                  </div>
                ))}
              </div>

              <div id="about-official-sources" className="rounded-xl border border-base-300 bg-base-200/45 p-4">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-base-content/55" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold text-base-content">Fontes oficiais utilizadas</h3>
                    <p className="mt-1 text-xs">
                      A análise usa uma cópia local da planilha oficial CST/cClassTrib com referência de{' '}
                      {TAX_BASE_INFO.referenceDate.split('-').reverse().join('/')}.
                      A consulta não atualiza essa base automaticamente.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium">
                  <a href={TAX_BASE_INFO.classificationSource} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">
                    Tabela CST/cClassTrib <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                  <a href={TAX_BASE_INFO.technicalSource} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">
                    Informe Técnico <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                  <a href={TAX_BASE_INFO.legalSource} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">
                    LC 214/2025 <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </div>
              </div>

              <div className="space-y-4 border-t border-base-300 pt-5">
                <p className="rounded-xl border border-base-300 bg-base-200/50 p-3 text-xs">
                  Somente itens de documentos que possuem o grupo <strong className="font-mono text-base-content">IBSCBS</strong>
                  {' '}entram na avaliação de conformidade. Quando a nota inteira não possui esse grupo, o resultado é Fora do escopo.
                </p>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                  <p>
                    <strong className="text-base-content">Conforme</strong> é atribuído quando o item possui
                    o grupo IBSCBS e apresenta CST e cClassTrib compatíveis com a base fiscal utilizada.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                  <p>
                    <strong className="text-base-content">Para revisar</strong> é usado quando há IBSCBS no
                    documento, mas o grupo está incompleto ou sua classificação é incompatível. Se apenas parte
                    dos itens possui IBSCBS, os demais ficam incompletos.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CircleMinus className="mt-0.5 h-5 w-5 shrink-0 text-base-content/45" aria-hidden="true" />
                  <p>
                    <strong className="text-base-content">Fora do escopo</strong> identifica a nota sem nenhum
                    grupo IBSCBS. Esse resultado não representa uma conclusão de irregularidade.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

