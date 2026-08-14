import { FileProcessingError, NFeAnalysis } from '../types';
import { getErrorMessage } from './errors';
import { parseNFeXml } from './nfeParser';
import { getXmlFingerprint } from './xmlFingerprint';

export { getXmlFingerprint, normalizeXmlForFingerprint } from './xmlFingerprint';

export interface FileProcessingProgress {
  processed: number;
  total: number;
  currentFile?: string;
}

export interface ProcessFilesOptions {
  existingFingerprints?: ReadonlySet<string>;
  existingResultCount?: number;
  existingUncompressedSizeBytes?: number;
  signal?: AbortSignal;
  onProgress?: (progress: FileProcessingProgress) => void;
}

export interface ProcessFilesResult {
  results: NFeAnalysis[];
  errors: FileProcessingError[];
  cancelled: boolean;
  uncompressedSizeBytes: number;
}

export const MAX_XML_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_ZIP_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_ZIP_XML_FILES = 5000;
export const MAX_ZIP_UNCOMPRESSED_SIZE_BYTES = 100 * 1024 * 1024;
export const MAX_ANALYSIS_XML_FILES = MAX_ZIP_XML_FILES;
export const MAX_ANALYSIS_UNCOMPRESSED_SIZE_BYTES = MAX_ZIP_UNCOMPRESSED_SIZE_BYTES;

function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(0) + ' MB';
}

export interface ZipEntryLimitInfo {
  uncompressedSize?: number;
}

function getZipEntryUncompressedSize(entry: unknown): number | undefined {
  const size = (entry as { _data?: ZipEntryLimitInfo })._data?.uncompressedSize;
  return typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : undefined;
}

export function getZipLimitError(entries: readonly ZipEntryLimitInfo[]): string | undefined {
  if (entries.length > MAX_ZIP_XML_FILES) {
    return 'Arquivo ZIP contém ' + entries.length + ' XMLs; o limite é ' + MAX_ZIP_XML_FILES + '.';
  }

  if (entries.some((entry) => entry.uncompressedSize === undefined)) {
    return 'Não foi possível verificar o tamanho descompactado dos XMLs do arquivo ZIP.';
  }

  const totalUncompressedSize = entries.reduce(
    (total, entry) => total + (entry.uncompressedSize || 0),
    0,
  );

  if (totalUncompressedSize > MAX_ZIP_UNCOMPRESSED_SIZE_BYTES) {
    return (
      'O conteúdo XML do arquivo ZIP excede o limite de ' +
      formatMegabytes(MAX_ZIP_UNCOMPRESSED_SIZE_BYTES) +
      ' descompactados.'
    );
  }

  return undefined;
}

function duplicateError(fileName: string): FileProcessingError {
  return {
    fileName,
    kind: 'DUPLICATE',
    error: 'Documento duplicado: o conteúdo já está presente na análise e foi ignorado.',
  };
}

function analysisXmlLimitError(fileName: string): FileProcessingError {
  return {
    fileName,
    error: 'A análise atingiu o limite total de ' + MAX_ANALYSIS_XML_FILES + ' XMLs. Remova documentos ou inicie uma nova análise.',
  };
}

function analysisSizeLimitError(fileName: string): FileProcessingError {
  return {
    fileName,
    error: 'O lote excede o limite total de ' + formatMegabytes(MAX_ANALYSIS_UNCOMPRESSED_SIZE_BYTES) + ' descompactados para esta análise.',
  };
}

/**
 * Process a list of uploaded files, supporting XML and ZIP files.
 * Raw XML is parsed and released after processing; only a compact fingerprint is retained.
 */
export async function processFiles(
  files: File[],
  options: ProcessFilesOptions = {},
): Promise<ProcessFilesResult> {
  const results: NFeAnalysis[] = [];
  const errors: FileProcessingError[] = [];
  const knownFingerprints = new Set(options.existingFingerprints || []);
  let processedFiles = 0;
  let totalFiles = files.length;
  let analyzedXmlCount = options.existingResultCount || 0;
  let analyzedUncompressedSize = options.existingUncompressedSizeBytes || 0;
  const isCancelled = () => options.signal?.aborted === true;
  const reportProgress = (currentFile?: string): void => {
    options.onProgress?.({
      processed: processedFiles,
      total: totalFiles,
      currentFile,
    });
  };
  const markProcessed = (currentFile: string): void => {
    processedFiles += 1;
    reportProgress(currentFile);
  };

  const addXmlResult = (
    xmlContent: string,
    analysisFileName: string,
    displayFileName: string,
  ): void => {
    const contentFingerprint = getXmlFingerprint(xmlContent);

    if (knownFingerprints.has(contentFingerprint)) {
      errors.push(duplicateError(displayFileName));
      return;
    }

    try {
      const analysis = parseNFeXml(xmlContent, analysisFileName);
      results.push({ ...analysis, contentFingerprint });
      knownFingerprints.add(contentFingerprint);
    } catch (err: unknown) {
      errors.push({
        fileName: displayFileName,
        error: getErrorMessage(err, 'Erro desconhecido ao ler XML.'),
      });
    }
  };

  reportProgress(files[0]?.name);

  for (const file of files) {
    if (isCancelled()) break;

    const lowerName = file.name.toLowerCase();

    const maxSize = lowerName.endsWith('.xml')
      ? MAX_XML_FILE_SIZE_BYTES
      : lowerName.endsWith('.zip')
        ? MAX_ZIP_FILE_SIZE_BYTES
        : undefined;

    if (maxSize !== undefined && file.size > maxSize) {
      errors.push({
        fileName: file.name,
        error: 'Arquivo excede o limite de ' + formatMegabytes(maxSize) + ' para este formato.',
      });
      markProcessed(file.name);
      continue;
    }

    if (lowerName.endsWith('.xml')) {
      if (analyzedXmlCount >= MAX_ANALYSIS_XML_FILES) {
        errors.push(analysisXmlLimitError(file.name));
        markProcessed(file.name);
        continue;
      }

      if (analyzedUncompressedSize + file.size > MAX_ANALYSIS_UNCOMPRESSED_SIZE_BYTES) {
        errors.push(analysisSizeLimitError(file.name));
        markProcessed(file.name);
        continue;
      }

      analyzedXmlCount += 1;
      analyzedUncompressedSize += file.size;
      try {
        const xmlContent = await file.text();
        if (!isCancelled()) {
          addXmlResult(xmlContent, file.name, file.name);
        }
      } catch (err: unknown) {
        if (!isCancelled()) {
          errors.push({
            fileName: file.name,
            error: getErrorMessage(err, 'Erro desconhecido ao ler XML.'),
          });
        }
      }
      markProcessed(file.name);
    } else if (lowerName.endsWith('.zip')) {
      try {
        const { default: JSZip } = await import('jszip');
        if (isCancelled()) continue;

        const zip = await JSZip.loadAsync(file);
        if (isCancelled()) continue;

        const xmlFiles = Object.keys(zip.files).filter(
          (name) =>
            !zip.files[name].dir &&
            name.toLowerCase().endsWith('.xml') &&
            !name.includes('__MACOSX'),
        );

        if (xmlFiles.length === 0) {
          errors.push({
            fileName: file.name,
            error: 'Arquivo ZIP não contém arquivos XML válidos.',
          });
          markProcessed(file.name);
          continue;
        }

        const zipLimitError = getZipLimitError(
          xmlFiles.map((name) => ({
            uncompressedSize: getZipEntryUncompressedSize(zip.files[name]),
          })),
        );
        if (zipLimitError) {
          errors.push({
            fileName: file.name,
            error: zipLimitError,
          });
          markProcessed(file.name);
          continue;
        }

        const zipUncompressedSize = xmlFiles.reduce(
          (total, name) => total + (getZipEntryUncompressedSize(zip.files[name]) || 0),
          0,
        );

        if (analyzedXmlCount + xmlFiles.length > MAX_ANALYSIS_XML_FILES) {
          errors.push(analysisXmlLimitError(file.name));
          markProcessed(file.name);
          continue;
        }

        if (analyzedUncompressedSize + zipUncompressedSize > MAX_ANALYSIS_UNCOMPRESSED_SIZE_BYTES) {
          errors.push(analysisSizeLimitError(file.name));
          markProcessed(file.name);
          continue;
        }

        totalFiles += xmlFiles.length - 1;
        analyzedXmlCount += xmlFiles.length;
        analyzedUncompressedSize += zipUncompressedSize;
        reportProgress(file.name);

        for (const xmlPath of xmlFiles) {
          if (isCancelled()) break;

          try {
            const xmlContent = await zip.files[xmlPath].async('string');
            if (!isCancelled()) {
              const pureFileName = xmlPath.split('/').pop() || xmlPath;
              addXmlResult(xmlContent, pureFileName, file.name + ' -> ' + xmlPath);
            }
          } catch (err: unknown) {
            if (!isCancelled()) {
              errors.push({
                fileName: file.name + ' -> ' + xmlPath,
                error: getErrorMessage(err, 'Erro ao processar XML de dentro do ZIP.'),
              });
            }
          }
          markProcessed(file.name + ' -> ' + xmlPath);
        }
      } catch (err: unknown) {
        if (!isCancelled()) {
          errors.push({
            fileName: file.name,
            error: getErrorMessage(err, 'Erro ao descomprimir ou ler arquivo ZIP.'),
          });
        }
        markProcessed(file.name);
      }
    } else {
      errors.push({
        fileName: file.name,
        error: 'Extensão de arquivo não suportada. Envie apenas arquivos .XML ou .ZIP.',
      });
      markProcessed(file.name);
    }
  }

  return {
    results,
    errors,
    cancelled: isCancelled(),
    uncompressedSizeBytes: analyzedUncompressedSize,
  };
}
