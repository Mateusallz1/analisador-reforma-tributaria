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
          (name) => name.toLowerCase().endsWith('.xml') && !name.includes('__MACOSX'),
        );

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