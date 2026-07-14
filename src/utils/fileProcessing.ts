import { FileProcessingError, NFeAnalysis } from '../types';
import { getErrorMessage } from './errors';
import { parseNFeXml } from './nfeParser';

export interface ProcessFilesOptions {
  existingFingerprints?: ReadonlySet<string>;
}

export interface ProcessFilesResult {
  results: NFeAnalysis[];
  errors: FileProcessingError[];
}

export const MAX_XML_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_ZIP_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_ZIP_XML_FILES = 5000;
export const MAX_ZIP_UNCOMPRESSED_SIZE_BYTES = 100 * 1024 * 1024;

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

export function normalizeXmlForFingerprint(xmlText: string): string {
  return xmlText
    .replace(/\r\n?/g, '\n')
    .replace(/>\s+</g, '><')
    .trim();
}

export function getXmlFingerprint(xmlText: string): string {
  const normalizedXml = normalizeXmlForFingerprint(xmlText);
  let hash = 14695981039346656037n;

  for (let index = 0; index < normalizedXml.length; index += 1) {
    hash ^= BigInt(normalizedXml.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }

  return hash.toString(16).padStart(16, '0');
}

function duplicateError(fileName: string): FileProcessingError {
  return {
    fileName,
    kind: 'DUPLICATE',
    error: 'Documento duplicado: o conteúdo já está presente na análise e foi ignorado.',
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

  const addXmlResult = async (
    xmlContent: string,
    analysisFileName: string,
    displayFileName: string,
  ): Promise<void> => {
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

  for (const file of files) {
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
      continue;
    }
    if (lowerName.endsWith('.xml')) {
      try {
        await addXmlResult(await file.text(), file.name, file.name);
      } catch (err: unknown) {
        errors.push({
          fileName: file.name,
          error: getErrorMessage(err, 'Erro desconhecido ao ler XML.'),
        });
      }
    } else if (lowerName.endsWith('.zip')) {
      try {
        const { default: JSZip } = await import('jszip');
        const zip = await JSZip.loadAsync(file);
        const xmlFiles = Object.keys(zip.files).filter(
          (name) =>
            !zip.files[name].dir &&
            name.toLowerCase().endsWith('.xml') &&
            !name.includes('__MACOSX'),
        );

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
          continue;
        }
        if (xmlFiles.length === 0) {
          errors.push({
            fileName: file.name,
            error: 'Arquivo ZIP não contém arquivos XML válidos.',
          });
          continue;
        }

        for (const xmlPath of xmlFiles) {
          try {
            const xmlContent = await zip.files[xmlPath].async('string');
            const pureFileName = xmlPath.split('/').pop() || xmlPath;
            await addXmlResult(xmlContent, pureFileName, file.name + ' -> ' + xmlPath);
          } catch (err: unknown) {
            errors.push({
              fileName: file.name + ' -> ' + xmlPath,
              error: getErrorMessage(err, 'Erro ao processar XML de dentro do ZIP.'),
            });
          }
        }
      } catch (err: unknown) {
        errors.push({
          fileName: file.name,
          error: getErrorMessage(err, 'Erro ao descomprimir ou ler arquivo ZIP.'),
        });
      }
    } else {
      errors.push({
        fileName: file.name,
        error: 'Extensão de arquivo não suportada. Envie apenas arquivos .XML ou .ZIP.',
      });
    }
  }

  return { results, errors };
}