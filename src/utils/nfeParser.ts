import { DataIntegrityStatus, DocumentLayout, NFeAnalysis, NFeType, DocType, CompanyInfo } from '../types';
import { formatEmissionDate, getElementsByLocalName, getTagValue, parseXmlDate } from './xmlHelpers';
import { TAX_BASE_INFO, analyzeTaxCompliance } from './taxValidation';
import { getTaxpayerDocumentStatus } from './taxpayerId';
/**
 * Formats CNPJ with mask (XX.XXX.XXX/XXXX-XX) or CPF (XXX.XXX.XXX-XX)
 */
export function formatCnpjOrCpf(value: string | null): string {
  if (!value) return '';
  const clean = value.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return value;
}

/**
 * Parses a single NF-e XML string and extracts relevant analysis fields
 */
export function parseNFeXml(xmlText: string, fileName: string): NFeAnalysis {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  // Handle parser errors in some browsers
  const parserError = xmlDoc.getElementsByTagName('parsererror');
  if (parserError && parserError.length > 0) {
    throw new Error('Erro de sintaxe no arquivo XML. O arquivo pode estar corrompido.');
  }

  let docType: DocType = 'NFe';
  let documentLayout: DocumentLayout = 'NFE';
  const ideElement = getElementsByLocalName(xmlDoc, 'ide')[0];
  if (ideElement) {
    const mod = getTagValue(xmlDoc, 'mod');
    if (mod === '65') {
      docType = 'NFCe';
    }
  } else {
    const hasNationalNfseTag = ['DPS', 'infDPS', 'infNFSe']
      .some((tagName) => getElementsByLocalName(xmlDoc, tagName).length > 0);
    const hasAbrasfNfseTag = ['Nfse', 'CompNfse', 'PrestadorServico', 'Prestador', 'TomadorServico', 'Tomador', 'Rps', 'EnviarLoteRpsEnvio']
      .some((tagName) => getElementsByLocalName(xmlDoc, tagName).length > 0);

    if (hasNationalNfseTag) {
      docType = 'NFSe';
      documentLayout = 'NFSE_NATIONAL';
    } else if (hasAbrasfNfseTag) {
      docType = 'NFSe';
      documentLayout = 'NFSE_ABRASF';
    } else {
      throw new Error('Formato XML não reconhecido. São aceitos NF-e/NFC-e e os layouts NFS-e ABRASF ou padrão nacional (DPS).');
    }
  }

  let numeroNota = 'N/A';
  let dataEmissao = 'Não informada';
  let emissaoDate: Date | null = null;
  let emissionDateStatus: DataIntegrityStatus = 'MISSING';
  let tipoNota: NFeType = 'SAÍDA';
  let cnpjEmitente = '';
  let nomeEmitente = 'Emitente não identificado';
  let cnpjDestinatario = '';
  let nomeDestinatario = 'Destinatário não identificado';

  if (docType === 'NFSe') {
    numeroNota = getTagValue(xmlDoc, 'nNFSe') || getTagValue(xmlDoc, 'Numero') || getTagValue(xmlDoc, 'numero') ||
      getTagValue(xmlDoc, 'NumeroRps') || getTagValue(xmlDoc, 'nDPS') || getTagValue(xmlDoc, 'nNF') || 'N/A';
    const rawDate = getTagValue(xmlDoc, 'dhEmi') || getTagValue(xmlDoc, 'dhEmis') ||
      getTagValue(xmlDoc, 'DataEmissao') || getTagValue(xmlDoc, 'dataEmissao') || getTagValue(xmlDoc, 'dEmi');
    dataEmissao = formatEmissionDate(rawDate);
    emissaoDate = parseXmlDate(rawDate);
    emissionDateStatus = !rawDate ? 'MISSING' : emissaoDate ? 'VALID' : 'INVALID';
    tipoNota = 'SAÍDA';

    const prestadorElement = getElementsByLocalName(xmlDoc, 'PrestadorServico')[0] ||
      getElementsByLocalName(xmlDoc, 'Prestador')[0] ||
      getElementsByLocalName(xmlDoc, 'IdentificacaoPrestador')[0] ||
      getElementsByLocalName(xmlDoc, 'emit')[0] ||
      getElementsByLocalName(xmlDoc, 'infEmit')[0];
    if (prestadorElement) {
      cnpjEmitente = getTagValue(prestadorElement, 'CNPJ') || getTagValue(prestadorElement, 'Cnpj') || getTagValue(prestadorElement, 'CPF') || getTagValue(prestadorElement, 'Cpf') || '';
      nomeEmitente = getTagValue(prestadorElement, 'RazaoSocial') || getTagValue(prestadorElement, 'razaoSocial') ||
        getTagValue(prestadorElement, 'xNome') || getTagValue(prestadorElement, 'xRazao') || 'Prestador de Serviço';
    } else {
      cnpjEmitente = getTagValue(xmlDoc, 'CNPJ') || getTagValue(xmlDoc, 'Cnpj') || '';
      nomeEmitente = getTagValue(xmlDoc, 'RazaoSocial') || getTagValue(xmlDoc, 'razaoSocial') || 'Prestador Não Identificado';
    }

    const tomadorElement = getElementsByLocalName(xmlDoc, 'TomadorServico')[0] ||
      getElementsByLocalName(xmlDoc, 'Tomador')[0] ||
      getElementsByLocalName(xmlDoc, 'IdentificacaoTomador')[0] ||
      getElementsByLocalName(xmlDoc, 'toma')[0] ||
      getElementsByLocalName(xmlDoc, 'infToma')[0];
    if (tomadorElement) {
      cnpjDestinatario = getTagValue(tomadorElement, 'CNPJ') || getTagValue(tomadorElement, 'Cnpj') || getTagValue(tomadorElement, 'CPF') || getTagValue(tomadorElement, 'Cpf') || '';
      nomeDestinatario = getTagValue(tomadorElement, 'RazaoSocial') || getTagValue(tomadorElement, 'razaoSocial') ||
        getTagValue(tomadorElement, 'xNome') || getTagValue(tomadorElement, 'xRazao') || 'Tomador de Serviço';
    } else {
      cnpjDestinatario = getTagValue(xmlDoc, 'CNPJ') || '';
      nomeDestinatario = 'Tomador Não Identificado';
    }
  } else {
    // Standard NF-e and NFC-e
    if (!ideElement) {
      throw new Error('Estrutura inválida de NF-e: tag <ide> não encontrada.');
    }

    numeroNota = getTagValue(ideElement, 'nNF') || 'N/A';
    const rawDate = getTagValue(ideElement, 'dhEmi') || getTagValue(ideElement, 'dEmi');
    dataEmissao = formatEmissionDate(rawDate);
    emissaoDate = parseXmlDate(rawDate);
    emissionDateStatus = !rawDate ? 'MISSING' : emissaoDate ? 'VALID' : 'INVALID';

    // tpNF: 0 = entrada, 1 = saída
    const tpNFText = getTagValue(ideElement, 'tpNF');
    tipoNota = tpNFText === '0' ? 'ENTRADA' : 'SAÍDA';

    // 2. Identify <emit> block
    const emitElement = getElementsByLocalName(xmlDoc, 'emit')[0];
    if (emitElement) {
      cnpjEmitente = getTagValue(emitElement, 'CNPJ') || getTagValue(emitElement, 'CPF') || '';
      nomeEmitente = getTagValue(emitElement, 'xNome') || 'Emitente sem nome';
    }

    // 3. Identify <dest> block
    const destElement = getElementsByLocalName(xmlDoc, 'dest')[0];
    if (destElement) {
      cnpjDestinatario = getTagValue(destElement, 'CNPJ') || getTagValue(destElement, 'CPF') || '';
      nomeDestinatario = getTagValue(destElement, 'xNome') || 'Destinatário sem nome';
    }
  }

  // 4. Resolve "empresa em foco" based on rule:
  // Se for SAÍDA (tpNF=1): a empresa em foco é o EMITENTE (emit)
  // Se for ENTRADA (tpNF=0): a empresa em foco é o DESTINATÁRIO (dest)
  let empresaFoco: CompanyInfo;
  if (tipoNota === 'SAÍDA') {
    empresaFoco = {
      cnpj: cnpjEmitente,
      nome: nomeEmitente,
    };
  } else {
    empresaFoco = {
      cnpj: cnpjDestinatario,
      nome: nomeDestinatario,
    };
  }

  const emitterDocumentStatus = getTaxpayerDocumentStatus(cnpjEmitente);
  const recipientDocumentStatus = getTaxpayerDocumentStatus(cnpjDestinatario);

  const taxValidation = analyzeTaxCompliance({
    xmlDoc,
    xmlText,
    docType,
    emissaoDate,
    emissionDateStatus,
  });

  const {
    contemIBSCBS,
    cst,
    cClassTrib,
    cstDesc,
    cClassTribDesc,
    validationStatus,
    validationReason,
    status,
    itens,
  } = taxValidation;

  return {
    id: `${numeroNota}-${cnpjEmitente}-${fileName}-${Math.random().toString(36).substr(2, 4)}`,
    fileName,
    numeroNota,
    dataEmissao,
    emissionDateStatus,
    tipoNota,
    docType,
    documentLayout,
    cnpjEmitente,
    nomeEmitente,
    emitterDocumentStatus,
    cnpjDestinatario,
    nomeDestinatario,
    recipientDocumentStatus,
    empresaFoco,
    contemIBSCBS,
    status,
    cst,
    cClassTrib,
    cstDesc,
    cClassTribDesc,
    validationStatus,
    validationReason,
    itens,
    taxBase: TAX_BASE_INFO,
  };
}


