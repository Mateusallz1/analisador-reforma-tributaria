import { DataIntegrityStatus, DocumentLayout, NFeAnalysis, NFeType, DocType, CompanyInfo } from '../types';
import { formatEmissionDate, getElementsByLocalName, getTagValue, parseXmlDate } from './xmlHelpers';
import { TAX_BASE_INFO, analyzeTaxCompliance } from './taxValidation';
import { getTaxpayerDocumentStatus } from './taxpayerId';
import { getXmlFingerprint } from './xmlFingerprint';

const NFE_NAMESPACE = 'http://www.portalfiscal.inf.br/nfe';
const NFSE_NATIONAL_NAMESPACE = 'http://www.sped.fazenda.gov.br/nfse';
const NFSE_ABRASF_NAMESPACE = 'http://www.abrasf.org.br/nfse.xsd';
const UNSUPPORTED_FORMAT_MESSAGE =
  'Formato XML não reconhecido. São aceitos NF-e/NFC-e e os layouts NFS-e ABRASF ou padrão nacional (DPS/NFS-e).';

interface RecognizedFiscalDocument {
  docType: DocType;
  documentLayout: DocumentLayout;
  dataElement: Element;
  ideElement?: Element;
}

function getElementLocalName(element: Element): string {
  return element.localName || element.tagName.split(':').pop() || element.tagName;
}

function getDirectChildrenByLocalName(parent: Element, localName: string): Element[] {
  return Array.from(parent.children).filter((element) => getElementLocalName(element) === localName);
}

function getSingleDirectChild(parent: Element, localName: string, context: string): Element {
  const children = getDirectChildrenByLocalName(parent, localName);
  if (children.length !== 1) {
    throw new Error(`Estrutura inválida de ${context}: deve existir exatamente uma tag <${localName}>.`);
  }

  return children[0];
}

function assertNamespace(element: Element, expectedNamespace: string, context: string): void {
  if (element.namespaceURI !== expectedNamespace) {
    throw new Error(`Namespace inválido de ${context}. Esperado: ${expectedNamespace}.`);
  }
}

function recognizeNFeDocument(root: Element): RecognizedFiscalDocument | null {
  const rootName = getElementLocalName(root);
  if (rootName !== 'NFe' && rootName !== 'nfeProc') return null;

  assertNamespace(root, NFE_NAMESPACE, 'NF-e/NFC-e');
  const nfeElement = rootName === 'NFe'
    ? root
    : getSingleDirectChild(root, 'NFe', 'NF-e/NFC-e processada');
  assertNamespace(nfeElement, NFE_NAMESPACE, 'NF-e/NFC-e');

  const infNFeElement = getSingleDirectChild(nfeElement, 'infNFe', 'NF-e/NFC-e');
  assertNamespace(infNFeElement, NFE_NAMESPACE, 'NF-e/NFC-e');
  const ideElement = getSingleDirectChild(infNFeElement, 'ide', 'NF-e/NFC-e');
  assertNamespace(ideElement, NFE_NAMESPACE, 'NF-e/NFC-e');
  const modelElements = getDirectChildrenByLocalName(ideElement, 'mod');
  const modelElement = modelElements.length === 1 ? modelElements[0] : null;
  if (modelElement) assertNamespace(modelElement, NFE_NAMESPACE, 'NF-e/NFC-e');
  const model = modelElement?.textContent?.trim();

  if (model !== '55' && model !== '65') {
    throw new Error('Modelo fiscal não suportado. A tag <mod> deve informar 55 (NF-e) ou 65 (NFC-e).');
  }

  return {
    docType: model === '65' ? 'NFCe' : 'NFe',
    documentLayout: 'NFE',
    dataElement: infNFeElement,
    ideElement,
  };
}

function recognizeNationalNfseDocument(root: Element): RecognizedFiscalDocument | null {
  const rootName = getElementLocalName(root);
  if (rootName !== 'DPS' && rootName !== 'NFSe') return null;

  assertNamespace(root, NFSE_NATIONAL_NAMESPACE, 'NFS-e padrão nacional');
  const informationTag = rootName === 'DPS' ? 'infDPS' : 'infNFSe';
  const dataElement = getSingleDirectChild(root, informationTag, 'NFS-e padrão nacional');
  assertNamespace(dataElement, NFSE_NATIONAL_NAMESPACE, 'NFS-e padrão nacional');

  return {
    docType: 'NFSe',
    documentLayout: 'NFSE_NATIONAL',
    dataElement,
  };
}

function recognizeAbrasfNfseDocument(xmlDoc: Document, root: Element): RecognizedFiscalDocument | null {
  if (root.namespaceURI !== NFSE_ABRASF_NAMESPACE) return null;

  const nfseElements = getElementsByLocalName(xmlDoc, 'Nfse').filter((element) => {
    const parent = element.parentElement;
    return getElementLocalName(element) === 'Nfse' &&
      element.namespaceURI === NFSE_ABRASF_NAMESPACE &&
      (element === root ||
        (!!parent &&
          getElementLocalName(parent) === 'CompNfse' &&
          parent.namespaceURI === NFSE_ABRASF_NAMESPACE));
  });

  if (nfseElements.length === 0) {
    throw new Error('Estrutura inválida de NFS-e ABRASF: nenhuma NFS-e emitida foi encontrada no XML.');
  }
  if (nfseElements.length > 1) {
    throw new Error('O XML contém mais de uma NFS-e ABRASF. Separe cada nota em um arquivo para análise.');
  }

  const dataElement = getSingleDirectChild(nfseElements[0], 'InfNfse', 'NFS-e ABRASF');
  assertNamespace(dataElement, NFSE_ABRASF_NAMESPACE, 'NFS-e ABRASF');

  return {
    docType: 'NFSe',
    documentLayout: 'NFSE_ABRASF',
    dataElement,
  };
}

function recognizeFiscalDocument(xmlDoc: Document): RecognizedFiscalDocument {
  const root = xmlDoc.documentElement;
  if (!root) throw new Error(UNSUPPORTED_FORMAT_MESSAGE);

  const recognizedDocument = recognizeNFeDocument(root) ||
    recognizeNationalNfseDocument(root) ||
    recognizeAbrasfNfseDocument(xmlDoc, root);

  if (!recognizedDocument) throw new Error(UNSUPPORTED_FORMAT_MESSAGE);
  return recognizedDocument;
}

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

  const {
    docType,
    documentLayout,
    dataElement,
    ideElement,
  } = recognizeFiscalDocument(xmlDoc);

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
    numeroNota = getTagValue(dataElement, 'nNFSe') || getTagValue(dataElement, 'Numero') ||
      getTagValue(dataElement, 'numero') || getTagValue(dataElement, 'NumeroRps') ||
      getTagValue(dataElement, 'nDPS') || getTagValue(dataElement, 'nNF') || 'N/A';
    const rawDate = getTagValue(dataElement, 'dhEmi') || getTagValue(dataElement, 'dhEmis') ||
      getTagValue(dataElement, 'DataEmissao') || getTagValue(dataElement, 'dataEmissao') ||
      getTagValue(dataElement, 'dEmi');
    dataEmissao = formatEmissionDate(rawDate);
    emissaoDate = parseXmlDate(rawDate);
    emissionDateStatus = !rawDate ? 'MISSING' : emissaoDate ? 'VALID' : 'INVALID';
    tipoNota = 'SAÍDA';

    const prestadorElement = getElementsByLocalName(dataElement, 'PrestadorServico')[0] ||
      getElementsByLocalName(dataElement, 'Prestador')[0] ||
      getElementsByLocalName(dataElement, 'IdentificacaoPrestador')[0] ||
      getElementsByLocalName(dataElement, 'emit')[0] ||
      getElementsByLocalName(dataElement, 'infEmit')[0];
    if (prestadorElement) {
      cnpjEmitente = getTagValue(prestadorElement, 'CNPJ') || getTagValue(prestadorElement, 'Cnpj') || getTagValue(prestadorElement, 'CPF') || getTagValue(prestadorElement, 'Cpf') || '';
      nomeEmitente = getTagValue(prestadorElement, 'RazaoSocial') || getTagValue(prestadorElement, 'razaoSocial') ||
        getTagValue(prestadorElement, 'xNome') || getTagValue(prestadorElement, 'xRazao') || 'Prestador de Serviço';
    } else {
      cnpjEmitente = getTagValue(dataElement, 'CNPJ') || getTagValue(dataElement, 'Cnpj') || '';
      nomeEmitente = getTagValue(dataElement, 'RazaoSocial') || getTagValue(dataElement, 'razaoSocial') ||
        'Prestador Não Identificado';
    }

    const tomadorElement = getElementsByLocalName(dataElement, 'TomadorServico')[0] ||
      getElementsByLocalName(dataElement, 'Tomador')[0] ||
      getElementsByLocalName(dataElement, 'IdentificacaoTomador')[0] ||
      getElementsByLocalName(dataElement, 'toma')[0] ||
      getElementsByLocalName(dataElement, 'infToma')[0];
    if (tomadorElement) {
      cnpjDestinatario = getTagValue(tomadorElement, 'CNPJ') || getTagValue(tomadorElement, 'Cnpj') || getTagValue(tomadorElement, 'CPF') || getTagValue(tomadorElement, 'Cpf') || '';
      nomeDestinatario = getTagValue(tomadorElement, 'RazaoSocial') || getTagValue(tomadorElement, 'razaoSocial') ||
        getTagValue(tomadorElement, 'xNome') || getTagValue(tomadorElement, 'xRazao') || 'Tomador de Serviço';
    } else {
      cnpjDestinatario = getTagValue(dataElement, 'CNPJ') || '';
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
    const emitElement = getElementsByLocalName(dataElement, 'emit')[0];
    if (emitElement) {
      cnpjEmitente = getTagValue(emitElement, 'CNPJ') || getTagValue(emitElement, 'CPF') || '';
      nomeEmitente = getTagValue(emitElement, 'xNome') || 'Emitente sem nome';
    }

    // 3. Identify <dest> block
    const destElement = getElementsByLocalName(dataElement, 'dest')[0];
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
    id: `${docType}-${getXmlFingerprint(xmlText)}`,
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

