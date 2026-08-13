import { calculateItemStats, groupAnalysesByEmpresaFoco } from '../src/utils/analysisStats.ts';
import { getFilteredResultGroups } from '../src/utils/resultFilters.ts';
import {
  getXmlFingerprint,
  getZipLimitError,
  MAX_XML_FILE_SIZE_BYTES,
  MAX_ZIP_FILE_SIZE_BYTES,
  MAX_ZIP_UNCOMPRESSED_SIZE_BYTES,
  MAX_ZIP_XML_FILES,
  processFiles,
} from '../src/utils/fileProcessing.ts';
import { parseNFeXml } from '../src/utils/nfeParser.ts';
import { parseXmlDate } from '../src/utils/xmlHelpers.ts';
import { validateTaxReductions } from '../src/utils/taxReductionValidation.ts';
import { getTaxpayerDocumentStatus } from '../src/utils/taxpayerId.ts';
import { buildAnalysisReport } from '../src/utils/analysisReport.ts';
import { generateAnalysisReportXlsx } from '../src/utils/analysisReportXlsx.ts';
import { SAMPLE_NFES } from '../src/data/samples.ts';
import taxBaseData from '../src/data/base_completa.json';
import { ComplianceStatus, DocType, ItemClassificationStatus, NFeAnalysis, NFeType, ValidationStatus } from '../src/types.ts';
import { assert, assertEquals } from './assertions.ts';

export interface TestCaseResult {
  name: string;
  status: 'passed' | 'failed';
  message?: string;
}

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

interface SampleExpectation {
  fileName: string;
  docType: DocType;
  tipoNota: NFeType;
  status: ComplianceStatus;
  itemStatus: ItemClassificationStatus;
  validationStatus: ValidationStatus;
  empresaFocoCnpj: string;
}

function parseSamples(): NFeAnalysis[] {
  return SAMPLE_NFES.map((sample) => parseNFeXml(sample.xmlContent, sample.fileName));
}

function parsePrefixedMultiItemSample(): NFeAnalysis {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<nfe:nfeProc xmlns:nfe="http://www.portalfiscal.inf.br/nfe">',
    '<nfe:NFe><nfe:infNFe>',
    '<nfe:ide><nfe:mod>55</nfe:mod><nfe:nNF>9001</nfe:nNF><nfe:dhEmi>2026-05-29T10:00:00-03:00</nfe:dhEmi><nfe:tpNF>1</nfe:tpNF></nfe:ide>',
    '<nfe:emit><nfe:CNPJ>61585865000108</nfe:CNPJ><nfe:xNome>Alfa Implementos Industriais S.A.</nfe:xNome></nfe:emit>',
    '<nfe:dest><nfe:CNPJ>12345678000199</nfe:CNPJ><nfe:xNome>Beta Distribuidora de Bebidas Ltda</nfe:xNome></nfe:dest>',
    '<nfe:det nItem="1"><nfe:prod><nfe:xProd>Item sem redução</nfe:xProd></nfe:prod><nfe:imposto><nfe:IBSCBS><nfe:CST>000</nfe:CST><nfe:cClassTrib>000001</nfe:cClassTrib><nfe:gIBSCBS><nfe:vBC>100.00</nfe:vBC><nfe:gCBS><nfe:pCBS>0.9000</nfe:pCBS><nfe:vCBS>0.90</nfe:vCBS></nfe:gCBS></nfe:gIBSCBS></nfe:IBSCBS></nfe:imposto></nfe:det>',
    '<nfe:det nItem="2"><nfe:prod><nfe:xProd>Item com redução</nfe:xProd></nfe:prod><nfe:imposto><nfe:IBSCBS><nfe:CST>200</nfe:CST><nfe:cClassTrib>200038</nfe:cClassTrib><nfe:gIBSCBS><nfe:vBC>100.00</nfe:vBC><nfe:gIBSUF><nfe:pIBSUF>0.1000</nfe:pIBSUF><nfe:gRed><nfe:pRedAliq>60.0000</nfe:pRedAliq><nfe:pAliqEfet>0.0400</nfe:pAliqEfet></nfe:gRed><nfe:vIBSUF>0.04</nfe:vIBSUF></nfe:gIBSUF><nfe:gIBSMun><nfe:pIBSMun>0.0000</nfe:pIBSMun><nfe:gRed><nfe:pRedAliq>60.0000</nfe:pRedAliq><nfe:pAliqEfet>0.0000</nfe:pAliqEfet></nfe:gRed><nfe:vIBSMun>0.00</nfe:vIBSMun></nfe:gIBSMun><nfe:vIBS>0.04</nfe:vIBS><nfe:gCBS><nfe:pCBS>0.9000</nfe:pCBS><nfe:gRed><nfe:pRedAliq>60.0000</nfe:pRedAliq><nfe:pAliqEfet>0.3600</nfe:pAliqEfet></nfe:gRed><nfe:vCBS>0.36</nfe:vCBS></nfe:gCBS></nfe:gIBSCBS></nfe:IBSCBS></nfe:imposto></nfe:det>',
    '</nfe:infNFe></nfe:NFe></nfe:nfeProc>',
  ].join('');

  return parseNFeXml(xml, 'NFe_Prefixado_Multiplos_Itens.xml');
}

function findByFileName(results: NFeAnalysis[], fileName: string): NFeAnalysis {
  const result = results.find((item) => item.fileName === fileName);
  assert(result, `Amostra não encontrada após parsing: ${fileName}`);
  return result;
}

function firstItemStatus(result: NFeAnalysis): ItemClassificationStatus {
  const itemStatus = result.itens?.[0]?.itemStatus;
  assert(itemStatus, `Amostra ${result.fileName} não possui status de item`);
  return itemStatus;
}

function assertParseError(xml: string, expectedMessage: string): void {
  let actualMessage = '';

  try {
    parseNFeXml(xml, 'documento-invalido.xml');
  } catch (error) {
    actualMessage = error instanceof Error ? error.message : String(error);
  }

  assert(
    actualMessage.includes(expectedMessage),
    `Erro esperado contendo "${expectedMessage}", recebido: "${actualMessage || 'nenhum erro'}"`,
  );
}

const sampleExpectations: SampleExpectation[] = [
  {
    fileName: 'NFe_35260661585865000108_Saida_Conforme.xml',
    docType: 'NFe',
    tipoNota: 'SAÍDA',
    status: 'CONFORME',
    itemStatus: 'conforme',
    validationStatus: 'válido',
    empresaFocoCnpj: '61585865000108',
  },
  {
    fileName: 'NFe_35260661585865000108_Saida_ClassificacaoInvalida.xml',
    docType: 'NFe',
    tipoNota: 'SAÍDA',
    status: 'NÃO_CONFORME',
    itemStatus: 'classificacao_invalida',
    validationStatus: 'inválido',
    empresaFocoCnpj: '61585865000108',
  },
  {
    fileName: 'NFe_43260699999999000100_Entrada_Conforme.xml',
    docType: 'NFe',
    tipoNota: 'ENTRADA',
    status: 'CONFORME',
    itemStatus: 'conforme',
    validationStatus: 'válido',
    empresaFocoCnpj: '44555666000188',
  },
  {
    fileName: 'NFe_43260688888888000111_Entrada_Autorizada_Pendencias.xml',
    docType: 'NFe',
    tipoNota: 'ENTRADA',
    status: 'AUTORIZADA_COM_PENDENCIAS',
    itemStatus: 'nao_conforme_valor',
    validationStatus: 'inválido',
    empresaFocoCnpj: '44555666000188',
  },
  {
    fileName: 'NFCe_35260612345678000199_Saida_Conforme.xml',
    docType: 'NFCe',
    tipoNota: 'SAÍDA',
    status: 'CONFORME',
    itemStatus: 'conforme',
    validationStatus: 'válido',
    empresaFocoCnpj: '12345678000199',
  },
  {
    fileName: 'NFe_35260661585865000108_Saida_SemReforma.xml',
    docType: 'NFe',
    tipoNota: 'SAÍDA',
    status: 'N/A',
    itemStatus: 'N/A',
    validationStatus: 'N/A',
    empresaFocoCnpj: '61585865000108',
  },
  {
    fileName: 'NFSe_2026_Prestador_Incompleto.xml',
    docType: 'NFSe',
    tipoNota: 'SAÍDA',
    status: 'NÃO_CONFORME',
    itemStatus: 'incompleto',
    validationStatus: 'incompleto',
    empresaFocoCnpj: '55666777000188',
  },
  {
    fileName: 'NFe_SemEmitente_DadosIncompletos.xml',
    docType: 'NFe',
    tipoNota: 'SAÍDA',
    status: 'CONFORME',
    itemStatus: 'conforme',
    validationStatus: 'válido',
    empresaFocoCnpj: '',
  },
];

const tests: TestCase[] = [
  {
    name: 'parser classifica cada amostra fiscal no estado esperado',
    run: () => {
      const results = parseSamples();
      assertEquals(results.length, sampleExpectations.length);
      assertEquals(results[0].taxBase.version, '1.1.0');
      assert(results[0].taxBase.source.includes('cClassTrib 2026-06-22.xlsx'), 'Origem da base fiscal não foi preservada');
      assertEquals('xmlContent' in results[0], false);

      sampleExpectations.forEach((expectation) => {
        const result = findByFileName(results, expectation.fileName);
        assertEquals(result.docType, expectation.docType, `${expectation.fileName}: docType divergente`);
        assertEquals(result.tipoNota, expectation.tipoNota, `${expectation.fileName}: tipoNota divergente`);
        assertEquals(result.status, expectation.status, `${expectation.fileName}: status geral divergente`);
        assertEquals(result.validationStatus, expectation.validationStatus, `${expectation.fileName}: validationStatus divergente`);
        assertEquals(firstItemStatus(result), expectation.itemStatus, `${expectation.fileName}: itemStatus divergente`);
        assertEquals(result.empresaFoco.cnpj, expectation.empresaFocoCnpj, `${expectation.fileName}: empresa em foco divergente`);
      });
    },
  },
  {
    name: 'autorização exige protocolo NF-e válido e vinculado à própria chave de acesso',
    run: () => {
      const authorizedSample = SAMPLE_NFES.find((sample) =>
        sample.fileName === 'NFe_43260688888888000111_Entrada_Autorizada_Pendencias.xml'
      );
      const invalidSample = SAMPLE_NFES.find((sample) =>
        sample.fileName === 'NFe_35260661585865000108_Saida_ClassificacaoInvalida.xml'
      );
      const nfseSample = SAMPLE_NFES.find((sample) =>
        sample.fileName === 'NFSe_2026_Prestador_Incompleto.xml'
      );
      assert(authorizedSample, 'Amostra NF-e autorizada não encontrada');
      assert(invalidSample, 'Amostra NF-e inválida não encontrada');
      assert(nfseSample, 'Amostra NFS-e incompleta não encontrada');

      for (const statusCode of ['100', '120', '150']) {
        const xml = authorizedSample.xmlContent.replace(
          '<cStat>100</cStat>',
          `<cStat>${statusCode}</cStat>`,
        );
        assertEquals(
          parseNFeXml(xml, `NFe_cStat_${statusCode}.xml`).status,
          'AUTORIZADA_COM_PENDENCIAS',
          `cStat ${statusCode} deve comprovar autorização no protocolo vinculado`,
        );
      }

      const deniedXml = authorizedSample.xmlContent.replace('<cStat>100</cStat>', '<cStat>110</cStat>');
      assertEquals(
        parseNFeXml(deniedXml, 'NFe_denegada.xml').status,
        'NÃO_CONFORME',
        'Protocolo de uso denegado não pode ser tratado como autorização',
      );

      const mismatchedKeyXml = authorizedSample.xmlContent.replace(
        /<chNFe>(\d{43})\d<\/chNFe>/,
        (_match, prefix: string) => `<chNFe>${prefix}5</chNFe>`,
      );
      assertEquals(
        parseNFeXml(mismatchedKeyXml, 'NFe_protocolo_outra_chave.xml').status,
        'NÃO_CONFORME',
        'Protocolo de outra chave de acesso não pode comprovar autorização',
      );

      const malformedProtocolXml = authorizedSample.xmlContent.replace(
        /<nProt>[^<]+<\/nProt>/,
        '<nProt>protocolo-inválido</nProt>',
      );
      assertEquals(
        parseNFeXml(malformedProtocolXml, 'NFe_protocolo_invalido.xml').status,
        'NÃO_CONFORME',
        'Número de protocolo inválido não pode comprovar autorização',
      );

      const looseProtocolXml = invalidSample.xmlContent.replace(
        '</nfeProc>',
        '<nProt>143260000045671</nProt></nfeProc>',
      );
      assertEquals(
        parseNFeXml(looseProtocolXml, 'NFe_tag_protocolo_solto.xml').status,
        'NÃO_CONFORME',
        'Tag de protocolo fora de protNFe/infProt deve ser ignorada',
      );

      const commentedProtocolXml = invalidSample.xmlContent.replace(
        '</nfeProc>',
        '<!-- <nProt>143260000045671</nProt> --></nfeProc>',
      );
      assertEquals(
        parseNFeXml(commentedProtocolXml, 'NFe_protocolo_em_comentario.xml').status,
        'NÃO_CONFORME',
        'Texto de protocolo em comentário XML deve ser ignorado',
      );

      const nfseBatchProtocolXml = nfseSample.xmlContent.replace(
        '</LoteRps>',
        '<Protocolo>123456789</Protocolo></LoteRps>',
      );
      assertEquals(
        parseNFeXml(nfseBatchProtocolXml, 'NFSe_protocolo_lote.xml').status,
        'NÃO_CONFORME',
        'Protocolo de lote NFS-e não comprova autorização da nota',
      );
    },
  },
  {
    name: 'base fiscal preserva a integridade da planilha oficial de 22/06/2026',
    run: () => {
      const classifications = taxBaseData.csts.flatMap((cst) =>
        cst.classificacoes.map((classification) => ({ cst: cst.codigo, ...classification }))
      );
      const byCode = new Map(classifications.map((classification) => [classification.codigo, classification]));
      const addedCodes = ['221002', '221003', '221004', '410036', '410037', '550024', '550025', '620007'];

      assertEquals(taxBaseData.dataReferencia, '2026-06-22');
      assertEquals(taxBaseData.csts.length, 18);
      assertEquals(classifications.length, 164);
      assert(addedCodes.every((code) => byCode.has(code)), 'A base convertida não contém todos os novos códigos oficiais');
      assertEquals(byCode.get('220001')?.dataFimVigencia, '2026-01-01');
      assert(byCode.get('221002')?.dfesRelacionados.includes('NFeABI'), 'cClassTrib 221002 perdeu o vínculo NFeABI');
      assert(byCode.get('410037')?.dfesRelacionados.includes('DUIMP'), 'cClassTrib 410037 perdeu o vínculo DUIMP');
    },
  },
  {
    name: 'classificação sem DF-e definido na tabela oficial permanece pendente',
    run: () => {
      const xml = SAMPLE_NFES[0].xmlContent
        .replace('<CST>000</CST>', '<CST>410</CST>')
        .replace('<cClassTrib>000001</cClassTrib>', '<cClassTrib>410011</cClassTrib>');
      const result = parseNFeXml(xml, 'NFe_classificacao_sem_dfe.xml');
      const item = result.itens?.[0];

      assert(item, 'Item com classificação sem DF-e não foi analisado');
      assertEquals(item.itemStatus, 'pendente');
      assertEquals(item.validationStatus, 'pendente');
      assertEquals(item.validationReason, 'A tabela oficial não informa DF-e aplicável para esta classificação.');
      assertEquals(result.validationStatus, 'pendente');
      assertEquals(result.status, 'PENDENTE');
    },
  },
  {
    name: 'identificador da análise é determinístico e baseado no conteúdo',
    run: () => {
      const xml = SAMPLE_NFES[0].xmlContent;
      const original = parseNFeXml(xml, 'original.xml');
      const renamed = parseNFeXml(xml, 'renomeado.xml');
      const changed = parseNFeXml(
        xml.replace(/<nNF>[^<]+<\/nNF>/, '<nNF>999999</nNF>'),
        'original.xml',
      );

      assertEquals(original.id, renamed.id, 'Renomear o mesmo XML não deve alterar sua identidade');
      assert(original.id !== changed.id, 'Conteúdo fiscal diferente deve produzir outra identidade');
      assert(/^NFe-[0-9a-f]{16}$/.test(original.id), `Formato inesperado para ID determinístico: ${original.id}`);
    },
  },
  {
    name: 'vigência e tipo de DF-e são validados em casos oficiais limítrofes',
    run: () => {
      const expiredXml = SAMPLE_NFES[0].xmlContent
        .replace('<CST>000</CST>', '<CST>220</CST>')
        .replace('<cClassTrib>000001</cClassTrib>', '<cClassTrib>220001</cClassTrib>');
      const expired = parseNFeXml(expiredXml, 'NFe_classificacao_expirada.xml');

      assertEquals(expired.itens?.[0]?.itemStatus, 'fora_vigencia');
      assertEquals(expired.itens?.[0]?.validationStatus, 'inválido');
      assert(expired.itens?.[0]?.validationReason?.includes('fora da vigência'), 'Fim de vigência não foi explicado');

      const wrongDfeXml = SAMPLE_NFES[0].xmlContent
        .replace('<CST>000</CST>', '<CST>410</CST>')
        .replace('<cClassTrib>000001</cClassTrib>', '<cClassTrib>410037</cClassTrib>');
      const wrongDfe = parseNFeXml(wrongDfeXml, 'NFe_classificacao_de_DUIMP.xml');

      assertEquals(wrongDfe.itens?.[0]?.itemStatus, 'classificacao_invalida');
      assertEquals(wrongDfe.itens?.[0]?.validationStatus, 'inválido');
      assert(wrongDfe.itens?.[0]?.validationReason?.includes('Permitidos: DUIMP'), 'DF-e oficial permitido não foi explicado');
    },
  },
  {
    name: 'integridade de datas, identificadores e layout DPS é reportada sem falso positivo fiscal',
    run: () => {
      assertEquals(parseXmlDate('2026-02-29'), null);
      assertEquals(parseXmlDate('2028-02-29')?.toISOString().slice(0, 10), '2028-02-29');
      assertEquals(getTaxpayerDocumentStatus('529.982.247-25'), 'VALID');
      assertEquals(getTaxpayerDocumentStatus('04.252.011/0001-10'), 'VALID');
      assertEquals(getTaxpayerDocumentStatus('04.252.011/0001-11'), 'INVALID');
      assertEquals(getTaxpayerDocumentStatus('AB.252.011/0001-10'), 'NOT_VERIFIABLE');
      assertEquals(getTaxpayerDocumentStatus(''), 'MISSING');

      const missingDate = parseNFeXml(
        SAMPLE_NFES[0].xmlContent.replace(/<dhEmi>[^<]+<\/dhEmi>/, ''),
        'NFe_sem_data.xml',
      );
      assertEquals(missingDate.emissionDateStatus, 'MISSING');
      assert(missingDate.status !== 'CONFORME', 'Classificação sem data de emissão não pode ser confirmada como conforme');
      assert(missingDate.itens?.some((item) => item.validationReason?.includes('Data de emissão')), 'A pendência de data deve ser explicada');

      const nationalNfse = parseNFeXml([
        '<DPS xmlns="http://www.sped.fazenda.gov.br/nfse"><infDPS>',
        '<nDPS>9001</nDPS><dhEmi>2026-05-29T10:00:00-03:00</dhEmi>',
        '<emit><CNPJ>04252011000110</CNPJ><xRazao>Prestador Nacional</xRazao></emit>',
        '<toma><CPF>52998224725</CPF><xRazao>Tomador Nacional</xRazao></toma>',
        '</infDPS></DPS>',
      ].join(''), 'NFSe_DPS.xml');

      assertEquals(nationalNfse.docType, 'NFSe');
      assertEquals(nationalNfse.documentLayout, 'NFSE_NATIONAL');
      assertEquals(nationalNfse.numeroNota, '9001');
      assertEquals(nationalNfse.nomeEmitente, 'Prestador Nacional');
      assertEquals(nationalNfse.nomeDestinatario, 'Tomador Nacional');

      const nationalNfseWithService = parseNFeXml([
        '<DPS xmlns="http://www.sped.fazenda.gov.br/nfse"><infDPS>',
        '<nDPS>9003</nDPS><dhEmi>2026-05-29T10:00:00-03:00</dhEmi>',
        '<emit><CNPJ>04252011000110</CNPJ><xRazao>Prestador Nacional</xRazao></emit>',
        '<toma><CPF>52998224725</CPF><xRazao>Tomador Nacional</xRazao></toma>',
        '<serv><cServ><xDescServ>Consultoria em processos tributários</xDescServ></cServ></serv>',
        '</infDPS></DPS>',
      ].join(''), 'NFSe_DPS_com_servico.xml');

      assertEquals(nationalNfseWithService.itens?.length, 1);
      assertEquals(nationalNfseWithService.itens?.[0]?.descricaoProduto, 'Consultoria em processos tributários');
      assertEquals(nationalNfseWithService.itens?.[0]?.itemStatus, 'N/A');

      const nationalNfseWithServiceMetadata = parseNFeXml([
        '<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe>',
        '<nNFSe>4940</nNFSe><dhProc>2026-08-11T16:56:25-03:00</dhProc>',
        '<xTribNac>Serviços de registros públicos, cartorários e notariais.</xTribNac>',
        '<xNBS>Serviços notariais e de registro</xNBS>',
        '<emit><CNPJ>07649362000157</CNPJ><xNome>FOX INLINE TECHNOLOGIES LTDA</xNome></emit>',
        '<DPS xmlns="http://www.sped.fazenda.gov.br/nfse"><infDPS>',
        '<dhEmi>2026-08-11T16:56:24-03:00</dhEmi>',
        '<serv><cServ><cTribNac>210101</cTribNac><xDescServ>Venda #42455 - Servidor em Nuvem - Data da Venda 11/08/2026\n\nData em que o servico foi prestado (11/08/2026)</xDescServ><cNBS>113040000</cNBS></cServ></serv>',
        '</infDPS></DPS>',
        '</infNFSe></NFSe>',
      ].join(''), 'NFSe_Nacional_servico_metadata.xml');

      const nationalServiceItem = nationalNfseWithServiceMetadata.itens?.[0];
      assert(nationalServiceItem, 'NFS-e nacional realista não gerou item de serviço');
      assertEquals(nationalServiceItem.descricaoProduto, 'Venda #42455 - Servidor em Nuvem - Data da Venda 11/08/2026\n\nData em que o servico foi prestado (11/08/2026)');
      assertEquals(nationalServiceItem.codigoServico, '210101');
      assertEquals(nationalServiceItem.codigoNbs, '113040000');
      assertEquals(nationalServiceItem.descricaoTributacaoNacional, 'Serviços de registros públicos, cartorários e notariais.');
      assertEquals(nationalServiceItem.descricaoNbs, 'Serviços notariais e de registro');

      const nationalNfseWithServiceAndTax = parseNFeXml([
        '<DPS xmlns="http://www.sped.fazenda.gov.br/nfse"><infDPS>',
        '<nDPS>9004</nDPS><dhEmi>2026-05-29T10:00:00-03:00</dhEmi>',
        '<emit><CNPJ>04252011000110</CNPJ><xRazao>Prestador Nacional</xRazao></emit>',
        '<toma><CPF>52998224725</CPF><xRazao>Tomador Nacional</xRazao></toma>',
        '<serv><cServ><xDescServ>Consultoria em processos tributários</xDescServ></cServ></serv>',
        '<IBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib></IBSCBS>',
        '</infDPS></DPS>',
      ].join(''), 'NFSe_DPS_com_servico_e_tributacao.xml');

      assertEquals(nationalNfseWithServiceAndTax.itens?.length, 1);
      assertEquals(nationalNfseWithServiceAndTax.itens?.[0]?.descricaoProduto, 'Consultoria em processos tributários');
      assertEquals(nationalNfseWithServiceAndTax.itens?.[0]?.contemIBSCBS, true);
      assertEquals(nationalNfseWithServiceAndTax.itens?.[0]?.cst, '000');
      assertEquals(nationalNfseWithServiceAndTax.itens?.[0]?.cClassTrib, '000001');
      assertEquals(nationalNfseWithServiceAndTax.itens?.[0]?.itemStatus, 'pendente');

      const generatedNationalNfse = parseNFeXml([
        '<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe>',
        '<nNFSe>9002</nNFSe><dhEmi>2026-05-30T10:00:00-03:00</dhEmi>',
        '<emit><CNPJ>04252011000110</CNPJ><xRazao>Prestador Nacional</xRazao></emit>',
        '<toma><CPF>52998224725</CPF><xRazao>Tomador Nacional</xRazao></toma>',
        '</infNFSe></NFSe>',
      ].join(''), 'NFSe_Nacional.xml');

      assertEquals(generatedNationalNfse.docType, 'NFSe');
      assertEquals(generatedNationalNfse.documentLayout, 'NFSE_NATIONAL');
      assertEquals(generatedNationalNfse.numeroNota, '9002');
    },
  },
  {
    name: 'parser rejeita coincidências de tags sem uma estrutura fiscal suportada',
    run: () => {
      assertParseError(
        '<Documento><ide><mod>55</mod></ide><Prestador><Rps>1</Rps></Prestador></Documento>',
        'Formato XML não reconhecido',
      );
      assertParseError(
        '<DPS><infDPS><nDPS>1</nDPS></infDPS></DPS>',
        'Namespace inválido de NFS-e padrão nacional',
      );
      assertParseError(
        '<NFe xmlns="urn:documento-nao-fiscal"><infNFe><ide><mod>55</mod></ide></infNFe></NFe>',
        'Namespace inválido de NF-e/NFC-e',
      );
      assertParseError(
        '<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe><ide xmlns=""><mod>55</mod></ide></infNFe></NFe>',
        'Namespace inválido de NF-e/NFC-e',
      );
      assertParseError(
        '<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe><ide><mod>57</mod></ide></infNFe></NFe>',
        '55 (NF-e) ou 65 (NFC-e)',
      );
      assertParseError(
        [
          '<EnviarLoteRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">',
          '<LoteRps><ListaRps><Rps><InfRps><Numero>1</Numero></InfRps></Rps></ListaRps></LoteRps>',
          '</EnviarLoteRpsEnvio>',
        ].join(''),
        'nenhuma NFS-e emitida',
      );
      assertParseError(
        [
          '<ConsultarNfseResposta xmlns="http://www.abrasf.org.br/nfse.xsd"><ListaNfse>',
          '<CompNfse><Nfse><InfNfse><Numero>1</Numero></InfNfse></Nfse></CompNfse>',
          '<CompNfse><Nfse><InfNfse><Numero>2</Numero></InfNfse></Nfse></CompNfse>',
          '</ListaNfse></ConsultarNfseResposta>',
        ].join(''),
        'mais de uma NFS-e ABRASF',
      );
    },
  },
  {
    name: 'processamento ignora XML duplicado por conteúdo normalizado',
    run: async () => {
      const sourceXml = SAMPLE_NFES[0].xmlContent;
      const equivalentXml = sourceXml.replace(/>\s+</g, '> \n <');
      const parsed = await processFiles([
        new File([sourceXml], 'original.xml', { type: 'text/xml' }),
        new File([equivalentXml], 'copia-renomeada.xml', { type: 'text/xml' }),
      ]);

      assertEquals(parsed.results.length, 1);
      assertEquals(parsed.errors.length, 1);
      assertEquals(parsed.errors[0].kind, 'DUPLICATE');
      assert(parsed.errors[0].error.includes('duplicado'), 'A duplicidade deve ser informada ao usuário');
      assertEquals(parsed.results[0].contentFingerprint, getXmlFingerprint(sourceXml));
    },
  },
  {
    name: 'processamento rejeita arquivos acima do limite de tamanho',
    run: async () => {
      const oversizedXml = new File(['x'], 'grande.xml', { type: 'text/xml' });
      const oversizedZip = new File(['x'], 'grande.zip', { type: 'application/zip' });
      Object.defineProperty(oversizedXml, 'size', { value: MAX_XML_FILE_SIZE_BYTES + 1 });
      Object.defineProperty(oversizedZip, 'size', { value: MAX_ZIP_FILE_SIZE_BYTES + 1 });

      const parsed = await processFiles([oversizedXml, oversizedZip]);

      assertEquals(parsed.results.length, 0);
      assertEquals(parsed.errors.length, 2);
      assert(parsed.errors.every((error) => error.error.includes('limite de')), 'O limite deve ser informado ao usuário');
    },
  },
  {
    name: 'limites de ZIP bloqueiam excesso de arquivos e volume descompactado',
    run: () => {
      const tooManyEntries = Array.from(
        { length: MAX_ZIP_XML_FILES + 1 },
        () => ({ uncompressedSize: 1 }),
      );
      const tooLargeEntries = [
        { uncompressedSize: MAX_ZIP_UNCOMPRESSED_SIZE_BYTES + 1 },
      ];

      assert(getZipLimitError(tooManyEntries)?.includes('limite'), 'O limite de XMLs deve ser aplicado');
      assert(getZipLimitError(tooLargeEntries)?.includes('descompactados'), 'O limite descompactado deve ser aplicado');
      assert(
        getZipLimitError([{}])?.includes('verificar'),
        'Entradas sem tamanho declarado devem ser rejeitadas',
      );
    },
  },
  {
    name: 'processamento aceita ZIP válido dentro dos limites',
    run: async () => {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      zip.file('nota.xml', SAMPLE_NFES[0].xmlContent);
      const zipContent = await zip.generateAsync({ type: 'uint8array' });
      const parsed = await processFiles([
        new File([zipContent], 'notas.zip', { type: 'application/zip' }),
      ]);

      assertEquals(parsed.results.length, 1);
      assertEquals(parsed.errors.length, 0);
      assertEquals(parsed.results[0].fileName, 'nota.xml');
    },
  },
  {
    name: 'processamento reporta progresso e permite cancelamento',
    run: async () => {
      const controller = new AbortController();
      const progressUpdates: Array<{ processed: number; total: number }> = [];
      const parsed = await processFiles(
        [
          new File([SAMPLE_NFES[0].xmlContent], 'primeira.xml', { type: 'text/xml' }),
          new File([SAMPLE_NFES[1].xmlContent], 'segunda.xml', { type: 'text/xml' }),
        ],
        {
          signal: controller.signal,
          onProgress: (progress) => {
            progressUpdates.push({
              processed: progress.processed,
              total: progress.total,
            });
            if (progress.processed === 1) {
              controller.abort();
            }
          },
        },
      );

      assertEquals(parsed.cancelled, true);
      assertEquals(parsed.results.length, 1);
      assertEquals(parsed.errors.length, 0);
      assertEquals(progressUpdates[0].processed, 0);
      assertEquals(progressUpdates[0].total, 2);
      assertEquals(progressUpdates.at(-1)?.processed, 1);
    },
  },
  {
    name: 'busca encontra CNPJ formatado e mantém o grupo correspondente',
    run: () => {
      const filtered = getFilteredResultGroups(parseSamples(), {
        searchTerm: '61.585.865/0001-08',
        statusFilter: 'ALL',
        typeFilter: 'ALL',
        docTypeFilter: 'ALL',
      });

      assertEquals(filtered.activeGroups.length, 1);
      assertEquals(filtered.activeGroups[0].empresaFoco.cnpj, '61585865000108');
      assertEquals(filtered.activeGroups[0].notas.length, 3);
      assertEquals(filtered.matchesWithoutCnpj.length, 0);
    },
  },
  {
    name: 'validação de múltiplos itens respeita namespace e não mistura alíquotas entre itens',
    run: () => {
      const result = parsePrefixedMultiItemSample();

      assertEquals(result.status, 'CONFORME');
      assertEquals(result.validationStatus, 'válido');
      assertEquals(result.itens?.length, 2);
      assertEquals(result.itens?.[0]?.itemStatus, 'conforme');
      assertEquals(result.itens?.[1]?.itemStatus, 'conforme');
      assertEquals(result.itens?.[0]?.numeroItem, 1);
      assertEquals(result.itens?.[1]?.numeroItem, 2);
    },
  },
  {
    name: 'redução valida pAliqEfet e valores monetários por componente',
    run: () => {
      const sample = SAMPLE_NFES.find((item) => item.fileName === 'NFe_43260699999999000100_Entrada_Conforme.xml');
      assert(sample, 'Amostra com redução não encontrada');

      const wrongEffectiveRate = parseNFeXml(
        sample.xmlContent.replace('<pAliqEfet>0.0400</pAliqEfet>', '<pAliqEfet>0.0500</pAliqEfet>'),
        'NFe_reducao_aliquota_efetiva_invalida.xml',
      );
      assertEquals(wrongEffectiveRate.itens?.[0]?.itemStatus, 'nao_conforme_valor');
      assert(wrongEffectiveRate.itens?.[0]?.validationReason?.includes('IBS UF'), 'A divergência deve identificar o componente IBS UF');
      assert(wrongEffectiveRate.itens?.[0]?.validationReason?.includes('pAliqEfet'), 'A divergência deve identificar pAliqEfet');

      const wrongAmount = parseNFeXml(
        sample.xmlContent.replace('<vCBS>10.80</vCBS>', '<vCBS>10.82</vCBS>'),
        'NFe_reducao_valor_cbs_invalido.xml',
      );
      assertEquals(wrongAmount.itens?.[0]?.itemStatus, 'nao_conforme_valor');
      assert(wrongAmount.itens?.[0]?.validationReason?.includes('CBS'), 'A divergência deve identificar o componente CBS');
      assert(wrongAmount.itens?.[0]?.validationReason?.includes('vCBS'), 'A divergência deve identificar vCBS');

      const amountAtTolerance = parseNFeXml(
        sample.xmlContent.replace('<vCBS>10.80</vCBS>', '<vCBS>10.81</vCBS>'),
        'NFe_reducao_valor_cbs_no_limite.xml',
      );
      assertEquals(amountAtTolerance.itens?.[0]?.itemStatus, 'conforme', 'Diferença de R$ 0,01 deve permanecer dentro da tolerância');
    },
  },
  {
    name: 'redução sem pRedAliq fica incompleta e ajustes não suportados ficam pendentes',
    run: () => {
      const sample = SAMPLE_NFES.find((item) => item.fileName === 'NFe_43260699999999000100_Entrada_Conforme.xml');
      assert(sample, 'Amostra com redução não encontrada');

      const missingReduction = parseNFeXml(
        sample.xmlContent.replace('<pRedAliq>60.0000</pRedAliq>', ''),
        'NFe_reducao_sem_percentual.xml',
      );
      assertEquals(missingReduction.itens?.[0]?.itemStatus, 'incompleto');
      assert(missingReduction.itens?.[0]?.validationReason?.includes('pRedAliq'), 'A ausência de pRedAliq deve ser explicada');

      const unsupportedAdjustment = parseNFeXml(
        sample.xmlContent.replace('<vIBSUF>1.20</vIBSUF>', '<vDif>0.01</vDif><vIBSUF>1.20</vIBSUF>'),
        'NFe_reducao_com_ajuste_pendente.xml',
      );
      assertEquals(unsupportedAdjustment.itens?.[0]?.itemStatus, 'pendente');
      assert(unsupportedAdjustment.itens?.[0]?.validationReason?.includes('ajustes fiscais'), 'O ajuste não suportado deve ficar pendente');
    },
  },
  {
    name: 'redução valida IBS municipal e o total agregado de IBS',
    run: () => {
      const sample = SAMPLE_NFES.find((item) => item.fileName === 'NFe_43260699999999000100_Entrada_Conforme.xml');
      assert(sample, 'Amostra com redução não encontrada');

      const wrongMunicipalRate = parseNFeXml(
        sample.xmlContent.replace('<pIBSMun>0.0000</pIBSMun>', '<pIBSMun>0.1000</pIBSMun>'),
        'NFe_reducao_ibs_municipal_invalida.xml',
      );
      assertEquals(wrongMunicipalRate.itens?.[0]?.itemStatus, 'nao_conforme_valor');
      assert(wrongMunicipalRate.itens?.[0]?.validationReason?.includes('IBS Município'), 'A divergência deve identificar o IBS municipal');

      const wrongTotal = parseNFeXml(
        sample.xmlContent.replace('<vIBS>1.20</vIBS>', '<vIBS>1.21</vIBS>'),
        'NFe_reducao_total_ibs_invalido.xml',
      );
      assertEquals(wrongTotal.itens?.[0]?.itemStatus, 'nao_conforme_valor');
      assert(wrongTotal.itens?.[0]?.validationReason?.includes('IBS total'), 'A divergência deve identificar o total de IBS');
      assert(wrongTotal.itens?.[0]?.validationReason?.includes('vIBS'), 'A divergência deve identificar vIBS');

      const missingTotal = parseNFeXml(
        sample.xmlContent.replace('<vIBS>1.20</vIBS>', ''),
        'NFe_reducao_sem_total_ibs.xml',
      );
      assertEquals(missingTotal.itens?.[0]?.itemStatus, 'incompleto');
      assert(missingTotal.itens?.[0]?.validationReason?.includes('vIBS'), 'A ausência de vIBS deve ser identificada');
    },
  },
  {
    name: 'redução rejeita gRed quando a classificação não prevê redução',
    run: () => {
      const sample = SAMPLE_NFES.find((item) => item.fileName === 'NFe_35260661585865000108_Saida_Conforme.xml');
      assert(sample, 'Amostra sem redução não encontrada');

      const unexpectedReduction = parseNFeXml(
        sample.xmlContent.replace(
          '<pCBS>0.9000</pCBS>',
          '<pCBS>0.9000</pCBS><gRed><pRedAliq>0.0000</pRedAliq><pAliqEfet>0.9000</pAliqEfet></gRed>',
        ),
        'NFe_reducao_nao_prevista.xml',
      );
      assertEquals(unexpectedReduction.itens?.[0]?.itemStatus, 'nao_conforme_valor');
      assert(unexpectedReduction.itens?.[0]?.validationReason?.includes('sem redução prevista'), 'A redução indevida deve ser explicada');
    },
  },
  {
    name: 'redução reporta alíquota efetiva inválida e grupo obrigatório ausente',
    run: () => {
      const sample = SAMPLE_NFES.find((item) => item.fileName === 'NFe_43260699999999000100_Entrada_Conforme.xml');
      assert(sample, 'Amostra com redução não encontrada');

      const malformedEffectiveRate = parseNFeXml(
        sample.xmlContent.replace('<pAliqEfet>0.0400</pAliqEfet>', '<pAliqEfet>invalido</pAliqEfet>'),
        'NFe_reducao_aliquota_efetiva_malformada.xml',
      );
      assertEquals(malformedEffectiveRate.itens?.[0]?.itemStatus, 'incompleto');
      assert(malformedEffectiveRate.itens?.[0]?.validationReason?.includes('pAliqEfet'), 'A alíquota efetiva inválida deve ser identificada');

      const missingMunicipalGroup = parseNFeXml(
        sample.xmlContent.replace(/\s*<gIBSMun>[\s\S]*?<\/gIBSMun>/, ''),
        'NFe_reducao_sem_ibs_municipal.xml',
      );
      assertEquals(missingMunicipalGroup.itens?.[0]?.itemStatus, 'incompleto');
      assert(missingMunicipalGroup.itens?.[0]?.validationReason?.includes('gIBSMun'), 'O grupo IBS municipal ausente deve ser identificado');
    },
  },
  {
    name: 'NFS-e com classificação válida permanece pendente sem valores calculados',
    run: () => {
      const sample = SAMPLE_NFES.find((item) => item.fileName === 'NFSe_2026_Prestador_Incompleto.xml');
      assert(sample, 'Amostra NFS-e não encontrada');

      const classifiedNfse = parseNFeXml(
        sample.xmlContent.replace(
          '<!-- Sem CST e sem cClassTrib para simular status incompleto -->',
          '<CST>000</CST><cClassTrib>000001</cClassTrib>',
        ),
        'NFSe_classificada_sem_validador_especifico.xml',
      );
      assertEquals(classifiedNfse.docType, 'NFSe');
      assertEquals(classifiedNfse.itens?.[0]?.itemStatus, 'pendente');
      assertEquals(classifiedNfse.validationStatus, 'pendente');
      assertEquals(classifiedNfse.status, 'PENDENTE');
      assert(classifiedNfse.itens?.[0]?.validationReason?.includes('NFS-e'), 'A pendência deve indicar o escopo NFS-e');
    },
  },
  {
    name: 'NFS-e emitida valida valores IBS/CBS e rejeita totalizador divergente',
    run: () => {
      const createNationalNfse = (classification: string, values: string, totals: string) => [
        '<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe>',
        '<nNFSe>9010</nNFSe><dhProc>2026-05-29T10:00:00-03:00</dhProc>',
        '<emit><CNPJ>04252011000110</CNPJ><xNome>Prestador Nacional</xNome></emit>',
        '<ext:metadata xmlns:ext="urn:example"><ext:IBSCBS><ext:CST>410</ext:CST><ext:cClassTrib>410037</ext:cClassTrib></ext:IBSCBS></ext:metadata>',
        '<DPS xmlns="http://www.sped.fazenda.gov.br/nfse"><infDPS>',
        '<dhEmi>2026-05-29T10:00:00-03:00</dhEmi>',
        '<serv><cServ><cTribNac>010101</cTribNac><xDescServ>Consultoria tributária</xDescServ></cServ></serv>',
        `<IBSCBS><valores><trib><gIBSCBS>${classification}</gIBSCBS></trib></valores></IBSCBS>`,
        '</infDPS></DPS>',
        `<IBSCBS>${values}${totals}</IBSCBS>`,
        '</infNFSe></NFSe>',
      ].join('');

      const fullTaxValues = [
        '<valores><vBC>100.00</vBC>',
        '<uf><pIBSUF>0.1000</pIBSUF><pAliqEfetUF>0.1000</pAliqEfetUF></uf>',
        '<mun><pIBSMun>0.0000</pIBSMun><pAliqEfetMun>0.0000</pAliqEfetMun></mun>',
        '<fed><pCBS>0.9000</pCBS><pAliqEfetCBS>0.9000</pAliqEfetCBS></fed></valores>',
      ].join('');
      const fullTaxTotals = [
        '<totCIBS><gIBS><vIBSTot>0.10</vIBSTot>',
        '<gIBSUFTot><vDifUF>0.00</vDifUF><vIBSUF>0.10</vIBSUF></gIBSUFTot>',
        '<gIBSMunTot><vDifMun>0.00</vDifMun><vIBSMun>0.00</vIBSMun></gIBSMunTot></gIBS>',
        '<gCBS><vDifCBS>0.00</vDifCBS><vCBS>0.90</vCBS></gCBS></totCIBS>',
      ].join('');
      const conformNfse = parseNFeXml(
        createNationalNfse('<CST>000</CST><cClassTrib>000001</cClassTrib>', fullTaxValues, fullTaxTotals),
        'NFSe_emitida_conforme.xml',
      );

      assertEquals(conformNfse.itens?.[0]?.cst, '000');
      assertEquals(conformNfse.itens?.[0]?.cClassTrib, '000001');
      assertEquals(conformNfse.itens?.[0]?.itemStatus, 'conforme');
      assertEquals(conformNfse.itens?.[0]?.validationStatus, 'válido');

      const divergentNfse = parseNFeXml(
        createNationalNfse(
          '<CST>000</CST><cClassTrib>000001</cClassTrib>',
          fullTaxValues,
          fullTaxTotals.replace('<vCBS>0.90</vCBS>', '<vCBS>1.20</vCBS>'),
        ),
        'NFSe_emitida_totalizador_divergente.xml',
      );

      assertEquals(divergentNfse.itens?.[0]?.itemStatus, 'nao_conforme_valor');
      assert(divergentNfse.itens?.[0]?.validationReason?.includes('vCBS'), 'A divergência do totalizador CBS deve ser explicada');

      const deferredNfse = parseNFeXml(
        createNationalNfse(
          '<CST>000</CST><cClassTrib>000001</cClassTrib>',
          fullTaxValues,
          fullTaxTotals.replace('<vDifUF>0.00</vDifUF>', '<vDifUF>0.10</vDifUF>'),
        ),
        'NFSe_emitida_com_diferimento_pendente.xml',
      );

      assertEquals(deferredNfse.itens?.[0]?.itemStatus, 'pendente');
      assert(deferredNfse.itens?.[0]?.validationReason?.includes('vDifUF'), 'O diferimento informado deve permanecer pendente');

      const reducedNfse = parseNFeXml(
        createNationalNfse(
          '<CST>200</CST><cClassTrib>200038</cClassTrib>',
          [
            '<valores><vBC>100.00</vBC>',
            '<uf><pIBSUF>0.1000</pIBSUF><pRedAliqUF>60.0000</pRedAliqUF><pAliqEfetUF>0.0400</pAliqEfetUF></uf>',
            '<mun><pIBSMun>0.0000</pIBSMun><pRedAliqMun>60.0000</pRedAliqMun><pAliqEfetMun>0.0000</pAliqEfetMun></mun>',
            '<fed><pCBS>0.9000</pCBS><pRedAliqCBS>60.0000</pRedAliqCBS><pAliqEfetCBS>0.3600</pAliqEfetCBS></fed></valores>',
          ].join(''),
          '<totCIBS><gIBS><vIBSTot>0.04</vIBSTot><gIBSUFTot><vDifUF>0.00</vDifUF><vIBSUF>0.04</vIBSUF></gIBSUFTot><gIBSMunTot><vDifMun>0.00</vDifMun><vIBSMun>0.00</vIBSMun></gIBSMunTot></gIBS><gCBS><vDifCBS>0.00</vDifCBS><vCBS>0.36</vCBS></gCBS></totCIBS>',
        ),
        'NFSe_emitida_com_reducao_conforme.xml',
      );

      assertEquals(reducedNfse.itens?.[0]?.itemStatus, 'conforme');
      assertEquals(reducedNfse.itens?.[0]?.validationStatus, 'válido');
    },
  },
  {
    name: 'percentual de redução ausente na base oficial permanece pendente mesmo sem grupos XML',
    run: () => {
      const document = new DOMParser().parseFromString('<IBSCBS />', 'application/xml');
      assert(document?.documentElement, 'Documento XML de teste não foi criado');

      const validation = validateTaxReductions(document.documentElement, {});
      assertEquals(validation.status, 'pendente');
      assert(validation.reason?.includes('não está disponível'), 'A ausência do percentual oficial deve ser explicada');
    },
  },
  {
    name: 'KPIs reconciliam N/A fora do denominador de conformidade',
    run: () => {
      const stats = calculateItemStats(parseSamples());

      assertEquals(stats.totalItems, 8);
      assertEquals(stats.applicableItems, 7);
      assertEquals(stats.compliantItems, 4);
      assertEquals(stats.pendingItems, 1);
      assertEquals(stats.nonCompliantItems, 2);
      assertEquals(stats.outOfScopeItems, 1);
      assertEquals(stats.saidaItems, 6);
      assertEquals(stats.entradaItems, 2);
      assertEquals(stats.complianceRate, 57);
    },
  },
  {
    name: 'agrupamento ignora notas sem CNPJ em foco e preserva resumo do Grupo Alfa',
    run: () => {
      const groups = groupAnalysesByEmpresaFoco(parseSamples());
      const alfa = groups.find((group) => group.empresaFoco.cnpj === '61585865000108');

      assertEquals(groups.length, 4);
      assert(alfa, 'Grupo Alfa não foi encontrado');
      assertEquals(alfa.totalNotas, 3);
      assertEquals(alfa.conformeNotas, 1);
      assertEquals(alfa.naoConformeNotas, 1);
      assertEquals(alfa.porcentagemEmConformidade, 50);
      assertEquals(alfa.notas.some((note) => note.status === 'N/A'), true, 'Grupo Alfa deve manter a nota fora do escopo');
      assertEquals(groups.some((group) => group.empresaFoco.cnpj === ''), false, 'Notas sem CNPJ não devem virar grupo');
    },
  },
  {
    name: 'filtros separam grupos ativos e documentos sem CNPJ em foco',
    run: () => {
      const filtered = getFilteredResultGroups(parseSamples(), {
        searchTerm: '',
        statusFilter: 'CONFORME',
        typeFilter: 'SAÍDA',
        docTypeFilter: 'NFe',
      });

      assertEquals(filtered.totalProcessed, 8);
      assertEquals(filtered.totalProcessedFiltered, 2);
      assertEquals(filtered.activeGroups.length, 1);
      assertEquals(filtered.activeGroups[0].empresaFoco.cnpj, '61585865000108');
      assertEquals(filtered.matchesWithoutCnpj.length, 1);
      assertEquals(filtered.matchesWithoutCnpj[0].fileName, 'NFe_SemEmitente_DadosIncompletos.xml');
    },
  },
  {
    name: 'relatório resume a execução e separa documentos de achados',
    run: async () => {
      const results = parseSamples();
      const report = buildAnalysisReport(results, [], {
        startedAt: '2026-08-13T10:00:00.000Z',
        completedAt: '2026-08-13T10:01:00.000Z',
        inputFileCount: results.length,
        cancelled: false,
      }, '2026-08-13T10:02:00.000Z');
      const summary = report.sheets.find((sheet) => sheet.name === 'Resumo');
      const documents = report.sheets.find((sheet) => sheet.name === 'Documentos');
      const findings = report.sheets.find((sheet) => sheet.name === 'Achados');

      assert(summary && documents && findings, 'Relatório não criou as abas esperadas');
      assertEquals(documents.rows.length, results.length + 1);
      assert(findings.rows.length > 1, 'Relatório deveria conter achados das amostras');
      assert(summary.rows.some((row) => row[0] === 'Documentos analisados' && row[1] === results.length));

      const fallbackReport = buildAnalysisReport([{
        ...results[0],
        itens: [],
      }], [], {
        startedAt: '2026-08-13T10:00:00.000Z',
        completedAt: '2026-08-13T10:01:00.000Z',
        inputFileCount: 1,
        cancelled: false,
      }, '2026-08-13T10:02:00.000Z');
      const fallbackDocuments = fallbackReport.sheets.find((sheet) => sheet.name === 'Documentos');
      assert(fallbackDocuments, 'Relatório fallback não criou a aba de documentos');
      assertEquals(fallbackDocuments.rows[1][11], 1, 'Contagem fallback diverge dos KPIs de itens');

      const workbook = await generateAnalysisReportXlsx(report);
      assert(workbook.size > 0, 'Arquivo XLSX vazio');
      const { default: JSZip } = await import('jszip');
      const archive = await JSZip.loadAsync(workbook);
      assert(archive.file('xl/workbook.xml'), 'Workbook XML ausente');
      assert(archive.file('xl/worksheets/sheet3.xml'), 'Aba de achados ausente');
      const findingsXml = await archive.file('xl/worksheets/sheet3.xml')!.async('string');
      assert(findingsXml.includes('Diagnóstico'), 'Cabeçalho de diagnóstico ausente');
      assert(!findingsXml.includes('<f>'), 'Relatório não deve criar fórmulas a partir dos dados XML');
    },
  },];

export async function runEngineTests(): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];

  for (const test of tests) {
    try {
      await test.run();
      results.push({ name: test.name, status: 'passed' });
    } catch (error) {
      results.push({
        name: test.name,
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
