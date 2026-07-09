import { FileProcessingError, NFeAnalysis } from '../types';
import { getErrorMessage } from './errors';
import { parseNFeXml } from './nfeParser';

/**
 * Process a list of uploaded files, supporting XML and ZIP files.
 */
export async function processFiles(
  files: File[],
): Promise<{ results: NFeAnalysis[]; errors: FileProcessingError[] }> {
  const results: NFeAnalysis[] = [];
  const errors: FileProcessingError[] = [];

  for (const file of files) {
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.xml')) {
      try {
        const text = await file.text();
        const analysis = parseNFeXml(text, file.name);
        results.push(analysis);
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
            const analysis = parseNFeXml(xmlContent, pureFileName);
            results.push(analysis);
          } catch (err: unknown) {
            errors.push({
              fileName: `${file.name} -> ${xmlPath}`,
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
