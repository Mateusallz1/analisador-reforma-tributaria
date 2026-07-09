import { NFeAnalysis, NFeType, DocType, CompanyInfo } from '../types';
import { formatEmissionDate, getTagValue, parseXmlDate } from './xmlHelpers';
import { analyzeTaxCompliance } from './taxValidation';
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

  // Detect docType
  let docType: DocType = 'NFe';
  const ideElement = xmlDoc.getElementsByTagName('ide')[0];
  if (ideElement) {
    const mod = getTagValue(xmlDoc, 'mod'); // search document-wide or under ide
    if (mod === '65') {
      docType = 'NFCe';
    } else if (mod === '55') {
      docType = 'NFe';
    }
  } else {
    // No <ide> element. Let's see if there are any NFS-e indicators or service markers
    const hasNfseTag = xmlDoc.getElementsByTagName('Nfse').length > 0 || 
                       xmlDoc.getElementsByTagName('CompNfse').length > 0 ||
                       xmlDoc.getElementsByTagName('PrestadorServico').length > 0 ||
                       xmlDoc.getElementsByTagName('Prestador').length > 0 ||
                       xmlDoc.getElementsByTagName('TomadorServico').length > 0 ||
                       xmlText.includes('<Nfse') || 
                       xmlText.includes('<nfse') ||
                       xmlText.includes('<Rps') ||
                       xmlText.includes('<rps') ||
                       xmlText.includes('<EnviarLoteRpsEnvio');
    if (hasNfseTag) {
      docType = 'NFSe';
    }
  }

  let numeroNota = 'N/A';
  let dataEmissao = 'Não informada';
  let emissaoDate: Date | null = null;
  let tipoNota: NFeType = 'SAÍDA';
  let cnpjEmitente = '';
  let nomeEmitente = 'Emitente não identificado';
  let cnpjDestinatario = '';
  let nomeDestinatario = 'Destinatário não identificado';

  if (docType === 'NFSe') {
    // 1. Número
    numeroNota = getTagValue(xmlDoc, 'Numero') || getTagValue(xmlDoc, 'numero') || getTagValue(xmlDoc, 'NumeroRps') || getTagValue(xmlDoc, 'nNF') || 'N/A';
    
    // 2. Emissão
    const rawDate = getTagValue(xmlDoc, 'DataEmissao') || getTagValue(xmlDoc, 'dataEmissao') || getTagValue(xmlDoc, 'dhEmi');
    dataEmissao = formatEmissionDate(rawDate);
    emissaoDate = parseXmlDate(rawDate);
    
    // 3. Tipo: NFS-e acts as Service Outgoing
    tipoNota = 'SAÍDA';

    // 4. Emitente (Prestador)
    const prestadorElement = xmlDoc.getElementsByTagName('PrestadorServico')[0] || xmlDoc.getElementsByTagName('Prestador')[0] || xmlDoc.getElementsByTagName('IdentificacaoPrestador')[0];
    if (prestadorElement) {
      cnpjEmitente = getTagValue(prestadorElement, 'CNPJ') || getTagValue(prestadorElement, 'Cnpj') || getTagValue(prestadorElement, 'CPF') || getTagValue(prestadorElement, 'Cpf') || '';
      nomeEmitente = getTagValue(prestadorElement, 'RazaoSocial') || getTagValue(prestadorElement, 'razaoSocial') || getTagValue(prestadorElement, 'xNome') || 'Prestador de Serviço';
    } else {
      cnpjEmitente = getTagValue(xmlDoc, 'CNPJ') || getTagValue(xmlDoc, 'Cnpj') || '';
      nomeEmitente = getTagValue(xmlDoc, 'RazaoSocial') || getTagValue(xmlDoc, 'razaoSocial') || 'Prestador Não Identificado';
    }

    // 5. Destinatário (Tomador)
    const tomadorElement = xmlDoc.getElementsByTagName('TomadorServico')[0] || xmlDoc.getElementsByTagName('Tomador')[0] || xmlDoc.getElementsByTagName('IdentificacaoTomador')[0];
    if (tomadorElement) {
      cnpjDestinatario = getTagValue(tomadorElement, 'CNPJ') || getTagValue(tomadorElement, 'Cnpj') || getTagValue(tomadorElement, 'CPF') || getTagValue(tomadorElement, 'Cpf') || '';
      nomeDestinatario = getTagValue(tomadorElement, 'RazaoSocial') || getTagValue(tomadorElement, 'razaoSocial') || getTagValue(tomadorElement, 'xNome') || 'Tomador de Serviço';
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

    // tpNF: 0 = entrada, 1 = saída
    const tpNFText = getTagValue(ideElement, 'tpNF');
    tipoNota = tpNFText === '0' ? 'ENTRADA' : 'SAÍDA';

    // 2. Identify <emit> block
    const emitElement = xmlDoc.getElementsByTagName('emit')[0];
    if (emitElement) {
      cnpjEmitente = getTagValue(emitElement, 'CNPJ') || getTagValue(emitElement, 'CPF') || '';
      nomeEmitente = getTagValue(emitElement, 'xNome') || 'Emitente sem nome';
    }

    // 3. Identify <dest> block
    const destElement = xmlDoc.getElementsByTagName('dest')[0];
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

  const taxValidation = analyzeTaxCompliance({
    xmlDoc,
    xmlText,
    docType,
    emissaoDate,
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
    tipoNota,
    docType,
    cnpjEmitente,
    nomeEmitente,
    cnpjDestinatario,
    nomeDestinatario,
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
    xmlContent: xmlText,
  };
}


