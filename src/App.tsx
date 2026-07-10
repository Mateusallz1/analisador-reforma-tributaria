import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Database,
  FileText,
  FlaskConical,
  Scale,
  X,
} from 'lucide-react';
import { NFeAnalysis, FileProcessingError } from './types';
import { parseNFeXml } from './utils/nfeParser';
import { processFiles } from './utils/fileProcessing';
import { getNoteItemCount, groupAnalysesByEmpresaFoco } from './utils/analysisStats';
import { getErrorMessage } from './utils/errors';
import UploadSection from './components/UploadSection';
import ResultsTable from './components/ResultsTable';
import DashboardStats from './components/DashboardStats';
import { SAMPLE_NFES } from './data/samples';

export default function App() {
  const [results, setResults] = useState<NFeAnalysis[]>([]);
  const [errors, setErrors] = useState<FileProcessingError[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const groupedResults = useMemo(() => {
    return groupAnalysesByEmpresaFoco(results);
  }, [results]);

  const handleFilesSelected = async (files: File[], append = false) => {
    setIsLoading(true);
    try {
      const parsed = await processFiles(files);
      setResults((previous) => append ? [...previous, ...parsed.results] : parsed.results);
      setErrors((previous) => append ? [...previous, ...parsed.errors] : parsed.errors);
    } catch (err: unknown) {
      const processingError = {
        fileName: 'Geral',
        error: getErrorMessage(err, 'Falha ao processar arquivos.'),
      };
      setErrors((previous) => append ? [...previous, processingError] : [processingError]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSamples = () => {
    setIsLoading(true);
    try {
      const sampleResults: NFeAnalysis[] = [];
      const sampleErrors: FileProcessingError[] = [];

      SAMPLE_NFES.forEach((sample) => {
        try {
          sampleResults.push(parseNFeXml(sample.xmlContent, sample.fileName));
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

  const totalItems = results.reduce(
    (acc, note) => acc + getNoteItemCount(note),
    0,
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900">
                Analisador da Reforma Tributária
              </h1>
              <p className="text-xs text-slate-500">
                Análise local de IBS/CBS em XML ou ZIP de documentos fiscais.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Local
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono">
              {results.length} docs
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono">
              {totalItems} itens
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {errors.length > 0 && (
          <div id="error-list-container" className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              <span>{errors.length} arquivo(s) não puderam ser processados.</span>
            </div>
            <div className="max-h-36 space-y-1.5 overflow-y-auto pr-2">
              {errors.map((err, idx) => (
                <div
                  key={`${err.fileName}-${idx}`}
                  className="flex items-center justify-between gap-3 rounded border border-rose-100 bg-white/70 p-2 text-xs text-rose-700"
                >
                  <span className="min-w-0 truncate font-mono">
                    <strong>{err.fileName}</strong>: {err.error}
                  </span>
                  <button
                    type="button"
                    onClick={() => clearSingleError(idx)}
                    className="shrink-0 rounded p-1 text-rose-500 transition-colors hover:bg-rose-100"
                    title="Remover erro"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {results.length === 0 ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <div className="max-w-3xl">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                  Análise local
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Envie XMLs de NF-e/NFC-e/NFS-e para analisar IBS/CBS.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                  O app identifica o grupo IBSCBS, confere CST e cClassTrib contra a base local
                  e agrupa o resultado pela empresa em foco da operação.
                </p>
              </div>

              {isLoading ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-8">
                  <div className="mb-4 h-11 w-11 animate-spin rounded-full border-4 border-slate-100 border-t-slate-800" />
                  <p className="text-sm font-semibold text-slate-700">Processando arquivos...</p>
                  <p className="mt-1 text-xs text-slate-400">A análise acontece no navegador.</p>
                </div>
              ) : (
                <UploadSection onFilesSelected={handleFilesSelected} isLoading={isLoading} />
              )}
            </div>

            <aside className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <FlaskConical className="h-4 w-4 text-slate-500" />
                  Amostras
                </div>
                <p className="mb-4 text-xs leading-relaxed text-slate-500">
                  Use {SAMPLE_NFES.length} notas simuladas para conferir o fluxo sem arquivos próprios.
                </p>
                <button
                  type="button"
                  onClick={handleLoadSamples}
                  id="btn-load-samples"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 disabled:bg-slate-300"
                >
                  <Database className="h-3.5 w-3.5" />
                  Carregar amostras
                </button>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Critério aplicado</h3>
                <p className="text-xs leading-relaxed text-slate-500">
                  Saída usa o emitente como foco. Entrada usa o destinatário. A conformidade é
                  calculada por item fiscal com base em IBSCBS, CST e cClassTrib.
                </p>
              </div>
            </aside>
          </section>
        ) : (
          <section className="space-y-6 pb-10">
            <DashboardStats
              results={results}
              grouped={groupedResults}
              onReset={handleResetAnalysis}
            />

            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Relatório de conformidade</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Resultados agrupados por emitente ou destinatário em foco.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleLoadSamples}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                >
                  <Database className="h-4 w-4 text-slate-500" />
                  Amostras
                </button>

                <label
                  htmlFor="append-nfe-file-input"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <FileText className="h-4 w-4 text-slate-500" />
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
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-8">
                <div className="mb-3 h-10 w-10 animate-spin rounded-full border-4 border-slate-100 border-t-slate-800" />
                <p className="text-sm font-semibold text-slate-700">Atualizando análise...</p>
              </div>
            ) : (
              <ResultsTable allResults={results} />
            )}
          </section>
        )}
      </main>
    </div>
  );
}

