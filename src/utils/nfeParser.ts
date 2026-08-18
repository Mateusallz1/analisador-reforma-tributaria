import {
  CompanyInfo,
  DataIntegrityStatus,
  DocumentKind,
  DocumentLayout,
  DpsIssuerRole,
  NFeAnalysis,
  NFeType,
  DocType,
} from '../types';
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
  documentKind: DocumentKind;
  documentVersion?: string;
  dataElement: Element;
  ideElement?: Element;
}

export interface FiscalDocumentErrorContext {
  documentLayout?: DocumentLayout;
  documentKind?: DocumentKind;
  documentVersion?: string;
}

export class FiscalDocumentError extends Error implements FiscalDocumentErrorContext {
  readonly documentLayout?: DocumentLayout;
  readonly documentKind?: DocumentKind;
  readonly documentVersion?: string;

  constructor(message: string, context: FiscalDocumentErrorContext = {}) {
    super(message);
    this.name = 'FiscalDocumentError';
    this.documentLayout = context.documentLayout;
    this.documentKind = context.documentKind;
    this.documentVersion = context.documentVersion;
  }
}

export function getFiscalDocumentErrorContext(error: unknown): FiscalDocumentErrorContext {
  if (!(error instanceof FiscalDocumentError)) return {};

  return {
    documentLayout: error.documentLayout,
    documentKind: error.documentKind,
    documentVersion: error.documentVersion,
  };
}

function withFiscalDocumentContext<T>(
  context: FiscalDocumentErrorContext,
  operation: () => T,
): T {
  try {
    return operation();
  } catch (error: unknown) {
    if (error instanceof FiscalDocumentError) throw error;
    const message = error instanceof Error && error.message
      ? error.message
      : 'Erro ao interpretar a estrutura fiscal.';
    throw new FiscalDocumentError(message, context);
  }
}

function getElementLocalName(element: Element): string {
  return element.localName || element.tagName.split(':').pop() || element.tagName;
}

function getDirectChildrenByLocalName(parent: Element, localName: string): Element[] {
  const expectedName = localName.toLowerCase();
  return Array.from(parent.children).filter((element) => getElementLocalName(element).toLowerCase() === expectedName);
}

function getDirectChildByLocalNames(parent: Element, localNames: string[]): Element | null {
  for (const localName of localNames) {
    const child = getDirectChildrenByLocalName(parent, localName)[0];
    if (child) return child;
  }

  return null;
}

function getDirectTagValue(parent: Element | null, localNames: string[]): string | null {
  if (!parent) return null;

  for (const localName of localNames) {
    const value = getDirectChildrenByLocalName(parent, localName)[0]?.textContent?.trim();
    if (value) return value;
  }

  return null;
}

function getAttributeValue(element: Element | null, attributeName: string): string | undefined {
  const value = element?.getAttribute(attributeName)?.trim();
  return value || undefined;
}

function findNationalNfsePartyElement(dataElement: Element, localNames: string[]): Element | null {
  let current = dataElement;

  // Generated national NFS-e files can wrap the DPS inside infNFSe.
  for (let depth = 0; depth < 3; depth += 1) {
    const partyElement = getDirectChildByLocalNames(current, localNames);
    if (partyElement) return partyElement;

    const nestedContainer = getDirectChildByLocalNames(current, ['DPS', 'infDPS']);
    if (!nestedContainer) return null;
    current = nestedContainer;
  }

  return null;
}

function findAbrasfNfsePartyElement(dataElement: Element, localNames: string[]): Element | null {
  const directParty = getDirectChildByLocalNames(dataElement, localNames);

  const declarationElement = getDirectChildByLocalNames(dataElement, ['DeclaracaoPrestacaoServico']);
  const declarationDataElement = declarationElement
    ? getDirectChildByLocalNames(declarationElement, ['InfDeclaracaoPrestacaoServico'])
    : getDirectChildByLocalNames(dataElement, ['InfDeclaracaoPrestacaoServico']);
  const declarationParty = declarationDataElement
    ? getDirectChildByLocalNames(declarationDataElement, localNames)
    : null;

  if (directParty && hasAbrasfNfsePartyDocument(directParty)) return directParty;
  return declarationParty || directParty;
}

function hasAbrasfNfsePartyDocument(partyElement: Element): boolean {
  const identityElements = [
    partyElement,
    ...getDirectChildrenByLocalName(partyElement, 'CpfCnpj'),
    ...getDirectChildrenByLocalName(partyElement, 'IdentificacaoPrestador'),
    ...getDirectChildrenByLocalName(partyElement, 'IdentificacaoTomador'),
    ...getDirectChildrenByLocalName(partyElement, 'IdentificacaoIntermediario'),
  ];

  return identityElements.some((element) => Boolean(
    getDirectTagValue(element, ['CNPJ', 'Cnpj', 'CPF', 'Cpf']),
  ));
}

type AbrasfResponseProfile = 'DIRECT_COMP_NFSE' | 'LISTA_NFSE';

const ABRASF_RESPONSE_PROFILES: Record<string, AbrasfResponseProfile> = {
  ConsultarNfseResposta: 'LISTA_NFSE',
  ConsultarNfseRpsResposta: 'DIRECT_COMP_NFSE',
  ConsultarLoteRpsResposta: 'LISTA_NFSE',
  ConsultarNfseServicoPrestadoResposta: 'LISTA_NFSE',
  ConsultarNfseServicoTomadoResposta: 'LISTA_NFSE',
  ConsultarNfseFaixaResposta: 'LISTA_NFSE',
  EnviarLoteRpsSincronoResposta: 'LISTA_NFSE',
  GerarNfseResposta: 'LISTA_NFSE',
};

function getAbrasfDirectChildrenByLocalName(
  parent: Element,
  localName: string,
  context: string,
): Element[] {
  const children = getDirectChildrenByLocalName(parent, localName);
  children.forEach((child) => assertNamespace(child, NFSE_ABRASF_NAMESPACE, context));
  return children;
}

function getUnqualifiedAbrasfNfseElements(root: Element): Element[] {
  if (root.namespaceURI || getElementLocalName(root) !== 'ConsultarNfseResposta') return [];

  const listaNfseElements = getDirectChildrenByLocalName(root, 'ListaNfse');
  if (listaNfseElements.length !== 1 || listaNfseElements[0].namespaceURI) return [];

  const compNfseElements = getDirectChildrenByLocalName(listaNfseElements[0], 'CompNfse');
  if (compNfseElements.length !== 1 || compNfseElements[0].namespaceURI) return [];

  const nfseElements = getDirectChildrenByLocalName(compNfseElements[0], 'Nfse');
  if (nfseElements.length !== 1 || nfseElements[0].namespaceURI) return [];

  const dataElements = getDirectChildrenByLocalName(nfseElements[0], 'InfNfse');
  if (dataElements.length !== 1 || dataElements[0].namespaceURI) return [];

  const requiredFields = [
    'Numero',
    'CodigoVerificacao',
    'DataEmissao',
    'IdentificacaoRps',
    'DataEmissaoRps',
    'NaturezaOperacao',
    'OptanteSimplesNacional',
    'Competencia',
    'Servico',
    'PrestadorServico',
    'TomadorServico',
    'OrgaoGerador',
    'DadosDPS',
    'ComercioExterior',
    'RetencoesFederais',
    'TipoReembolsoRepasse',
  ];
  if (requiredFields.some((field) => {
    const children = getDirectChildrenByLocalName(dataElements[0], field);
    return children.length !== 1 || Boolean(children[0].namespaceURI);
  })) {
    return [];
  }

  return nfseElements;
}

function getAbrasfNfseElements(root: Element): Element[] {
  const rootName = getElementLocalName(root);

  if (rootName === 'Nfse') return [root];

  if (rootName === 'CompNfse') {
    return getAbrasfDirectChildrenByLocalName(root, 'Nfse', 'NFS-e ABRASF');
  }

  const responseProfile = ABRASF_RESPONSE_PROFILES[rootName];
  if (responseProfile === 'DIRECT_COMP_NFSE') {
    return getAbrasfDirectChildrenByLocalName(root, 'CompNfse', 'NFS-e ABRASF')
      .flatMap((compNfse) => getAbrasfDirectChildrenByLocalName(compNfse, 'Nfse', 'NFS-e ABRASF'));
  }

  if (responseProfile === 'LISTA_NFSE') {
    const listaNfseElements = getAbrasfDirectChildrenByLocalName(root, 'ListaNfse', 'NFS-e ABRASF');
    if (listaNfseElements.length !== 1) return [];

    return getAbrasfDirectChildrenByLocalName(listaNfseElements[0], 'CompNfse', 'NFS-e ABRASF')
      .flatMap((compNfse) => getAbrasfDirectChildrenByLocalName(compNfse, 'Nfse', 'NFS-e ABRASF'));
  }

  return [];
}

interface NfseParty {
  document: string;
  name: string;
}

function readNfseParty(
  dataElement: Element,
  documentLayout: DocumentLayout,
  role: 'prestador' | 'tomador' | 'intermediario',
): NfseParty | null {
  const isPrestador = role === 'prestador';
  const isTomador = role === 'tomador';
  const partyNames = documentLayout === 'NFSE_ABRASF'
    ? isPrestador
      ? ['PrestadorServico', 'Prestador', 'IdentificacaoPrestador']
      : isTomador
        ? ['TomadorServico', 'Tomador', 'IdentificacaoTomador']
        : ['Intermediario', 'IntermediarioServico', 'IdentificacaoIntermediario']
    : isPrestador
      ? ['prest', 'emit', 'infEmit']
      : isTomador
        ? ['toma', 'Tomador', 'infToma']
        : ['interm', 'Intermediario', 'infIntermediario'];
  const partyElement = documentLayout === 'NFSE_NATIONAL'
    ? findNationalNfsePartyElement(dataElement, partyNames)
    : findAbrasfNfsePartyElement(dataElement, partyNames);

  if (!partyElement) return null;

  const directPartyElement = documentLayout === 'NFSE_ABRASF'
    ? getDirectChildByLocalNames(dataElement, partyNames)
    : null;

  const identityElement = getDirectChildByLocalNames(partyElement, [
    isPrestador
      ? 'IdentificacaoPrestador'
      : isTomador
        ? 'IdentificacaoTomador'
        : 'IdentificacaoIntermediario',
  ]);
  const documentSource = identityElement || partyElement;
  const nestedDocumentSource = getDirectChildByLocalNames(documentSource, ['CpfCnpj']);
  const partyNestedDocumentSource = getDirectChildByLocalNames(partyElement, ['CpfCnpj']);
  const document = getDirectTagValue(documentSource, ['CNPJ', 'Cnpj', 'CPF', 'Cpf']) ||
    getDirectTagValue(nestedDocumentSource, ['CNPJ', 'Cnpj', 'CPF', 'Cpf']) ||
    getDirectTagValue(partyElement, ['CNPJ', 'Cnpj', 'CPF', 'Cpf']) ||
    getDirectTagValue(partyNestedDocumentSource, ['CNPJ', 'Cnpj', 'CPF', 'Cpf']) || '';
  const nameSources = directPartyElement && directPartyElement !== partyElement
    ? [partyElement, directPartyElement]
    : [partyElement];
  const name = nameSources.reduce(
    (currentName, source) => {
      if (currentName) return currentName;
      return getDirectTagValue(source, ['RazaoSocial', 'razaoSocial', 'xNome', 'xRazao']) ||
        (source === partyElement && identityElement
          ? getDirectTagValue(identityElement, ['RazaoSocial', 'razaoSocial', 'xNome', 'xRazao'])
          : '') || '';
    },
    '',
  );

  return { document, name };
}

function getSingleDirectChild(parent: Element, localName: string, context: string): Element {
  const children = getDirectChildrenByLocalName(parent, localName);
  if (children.length !== 1) {
    throw new Error(`Estrutura inválida de ${context}: deve existir exatamente uma tag <${localName}>.`);
  }

  return children[0];
}

function assertNamespace(element: Element, expectedNamespace: string, context: string): void {
  const actualNamespace = element.namespaceURI || '';
  if (actualNamespace !== expectedNamespace) {
    throw new Error(`Namespace inválido de ${context}. Esperado: ${expectedNamespace}.`);
  }
}

function recognizeNFeDocument(root: Element): RecognizedFiscalDocument | null {
  const rootName = getElementLocalName(root);
  if (rootName !== 'NFe' && rootName !== 'nfeProc') return null;

  return withFiscalDocumentContext({ documentLayout: 'NFE' }, () => {
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
      documentKind: model === '65' ? 'NFCE' : 'NFE',
      documentVersion: getAttributeValue(infNFeElement, 'versao'),
      dataElement: infNFeElement,
      ideElement,
    };
  });
}

function recognizeNationalNfseDocument(root: Element): RecognizedFiscalDocument | null {
  const rootName = getElementLocalName(root);
  if (rootName !== 'DPS' && rootName !== 'NFSe') return null;

  const documentKind = rootName === 'DPS' ? 'DPS' : 'NFSE';
  return withFiscalDocumentContext({
    documentLayout: 'NFSE_NATIONAL',
    documentKind,
    documentVersion: getAttributeValue(root, 'versao'),
  }, () => {
    assertNamespace(root, NFSE_NATIONAL_NAMESPACE, 'NFS-e padrão nacional');
    const informationTag = rootName === 'DPS' ? 'infDPS' : 'infNFSe';
    const dataElement = getSingleDirectChild(root, informationTag, 'NFS-e padrão nacional');
    assertNamespace(dataElement, NFSE_NATIONAL_NAMESPACE, 'NFS-e padrão nacional');

    return {
      docType: 'NFSe',
      documentLayout: 'NFSE_NATIONAL',
      documentKind,
      documentVersion: getAttributeValue(root, 'versao') || getAttributeValue(dataElement, 'versao'),
      dataElement,
    };
  });
}

function recognizeAbrasfNfseDocument(root: Element): RecognizedFiscalDocument | null {
  const isQualifiedAbrasf = root.namespaceURI === NFSE_ABRASF_NAMESPACE;
  const unqualifiedNfseElements = isQualifiedAbrasf ? [] : getUnqualifiedAbrasfNfseElements(root);
  if (!isQualifiedAbrasf && unqualifiedNfseElements.length === 0) return null;

  const versionHint = getAttributeValue(root, 'versao') ||
    getAttributeValue(getElementsByLocalName(root, 'Nfse')[0] || null, 'versao') ||
    getAttributeValue(getElementsByLocalName(root, 'InfNfse')[0] || null, 'versao');

  return withFiscalDocumentContext({
    documentLayout: 'NFSE_ABRASF',
    documentKind: 'NFSE',
    documentVersion: versionHint,
  }, () => {
    const nfseElements = isQualifiedAbrasf
      ? getAbrasfNfseElements(root)
      : unqualifiedNfseElements;

    if (nfseElements.length === 0) {
      throw new Error('Estrutura inválida de NFS-e ABRASF: nenhuma NFS-e emitida foi encontrada no XML.');
    }
    if (nfseElements.length > 1) {
      throw new Error('O XML contém mais de uma NFS-e ABRASF. Separe cada nota em um arquivo para análise.');
    }

    assertNamespace(nfseElements[0], isQualifiedAbrasf ? NFSE_ABRASF_NAMESPACE : '', 'NFS-e ABRASF');
    const dataElement = getSingleDirectChild(nfseElements[0], 'InfNfse', 'NFS-e ABRASF');
    assertNamespace(dataElement, isQualifiedAbrasf ? NFSE_ABRASF_NAMESPACE : '', 'NFS-e ABRASF');

    return {
      docType: 'NFSe',
      documentLayout: 'NFSE_ABRASF',
      documentKind: 'NFSE',
      documentVersion: getAttributeValue(dataElement, 'versao') || getAttributeValue(nfseElements[0], 'versao') || getAttributeValue(root, 'versao'),
      dataElement,
    };
  });
}

function recognizeFiscalDocument(xmlDoc: Document): RecognizedFiscalDocument {
  const root = xmlDoc.documentElement;
  if (!root) throw new Error(UNSUPPORTED_FORMAT_MESSAGE);

  const recognizedDocument = recognizeNFeDocument(root) ||
    recognizeNationalNfseDocument(root) ||
    recognizeAbrasfNfseDocument(root);

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
    documentKind,
    documentVersion,
    dataElement,
    ideElement,
  } = recognizeFiscalDocument(xmlDoc);

  let numeroNota = 'N/A';
  let dataEmissao = 'Não informada';
  let emissaoDate: Date | null = null;
  let emissionDateStatus: DataIntegrityStatus = 'MISSING';
  let tipoNota: NFeType = 'SAÍDA';
  let operationStatus: DataIntegrityStatus = 'MISSING';
  let cnpjEmitente = '';
  let nomeEmitente = 'Emitente não identificado';
  let cnpjDestinatario = '';
  let nomeDestinatario = 'Destinatário não identificado';
  let dpsIssuerRole: DpsIssuerRole | undefined;
  let dpsFocusParty: NfseParty | null = null;

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

    const prestador = readNfseParty(dataElement, documentLayout, 'prestador');
    cnpjEmitente = prestador?.document || '';
    nomeEmitente = prestador?.name || 'Prestador Não Identificado';

    const tomador = readNfseParty(dataElement, documentLayout, 'tomador');
    cnpjDestinatario = tomador?.document || '';
    nomeDestinatario = tomador?.name || 'Tomador Não Identificado';

    if (documentKind === 'DPS') {
      const tpEmit = getDirectTagValue(dataElement, ['tpEmit']);
      dpsIssuerRole = tpEmit === '1'
        ? 'PRESTADOR'
        : tpEmit === '2'
          ? 'TOMADOR'
          : tpEmit === '3'
            ? 'INTERMEDIARIO'
            : 'NAO_IDENTIFICADO';
      operationStatus = !tpEmit ? 'MISSING' : dpsIssuerRole === 'NAO_IDENTIFICADO' ? 'INVALID' : 'NOT_VERIFIABLE';

      const intermediary = readNfseParty(dataElement, documentLayout, 'intermediario');
      dpsFocusParty = dpsIssuerRole === 'PRESTADOR'
        ? prestador
        : dpsIssuerRole === 'TOMADOR'
          ? tomador
          : dpsIssuerRole === 'INTERMEDIARIO'
            ? intermediary
            : null;
    } else {
      operationStatus = 'VALID';
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
    if (tpNFText === '0') {
      tipoNota = 'ENTRADA';
      operationStatus = 'VALID';
    } else if (tpNFText === '1') {
      tipoNota = 'SAÍDA';
      operationStatus = 'VALID';
    } else {
      tipoNota = 'SAÍDA';
      operationStatus = tpNFText ? 'INVALID' : 'MISSING';
    }

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

  // 4. Resolve "empresa em foco" based on document operation and DPS issuer role.
  // Se for SAÍDA (tpNF=1): a empresa em foco é o EMITENTE (emit)
  // Se for ENTRADA (tpNF=0): a empresa em foco é o DESTINATÁRIO (dest)
  let empresaFoco: CompanyInfo;
  if (documentKind === 'DPS') {
    empresaFoco = dpsFocusParty?.document
      ? {
          cnpj: dpsFocusParty.document,
          nome: dpsFocusParty.name || 'Empresa em foco sem nome',
        }
      : {
          cnpj: '',
          nome: 'Empresa em foco não determinada',
        };
  } else if (operationStatus !== 'VALID') {
    empresaFoco = {
      cnpj: '',
      nome: 'Empresa em foco não determinada',
    };
  } else if (tipoNota === 'SAÍDA') {
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
    validationStatus: taxValidationStatus,
    validationReason: taxValidationReason,
    status: taxValidationDocumentStatus,
    itens,
  } = taxValidation;

  const validationStatus = documentKind === 'DPS' ? 'pendente' : taxValidationStatus;
  const validationReason = documentKind === 'DPS'
    ? [
        dpsIssuerRole === 'NAO_IDENTIFICADO'
          ? 'DPS sem tpEmit válido. O papel responsável pelo documento não pôde ser determinado.'
          : 'Documento identificado como DPS, uma declaração de prestação de serviço. A análise não representa uma NFS-e emitida.',
        taxValidationReason,
      ].filter(Boolean).join(' ')
    : taxValidationReason;
  const status = documentKind === 'DPS' ? 'PENDENTE' : taxValidationDocumentStatus;

  return {
    id: `${docType}-${getXmlFingerprint(xmlText)}`,
    fileName,
    numeroNota,
    dataEmissao,
    emissionDateStatus,
    tipoNota,
    operationStatus,
    docType,
    documentLayout,
    documentKind,
    documentVersion,
    dpsIssuerRole,
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

