import { ComplianceStatus, DataIntegrityStatus, DocType, ItemClassificationStatus, ItemValidation, TaxBaseInfo, ValidationStatus } from '../types';
import baseCompleta from '../data/base_completa.json' with { type: 'json' };
import { getElementsByLocalName, getTagValue, parseXmlDate } from './xmlHelpers';
import { validateTaxReductions } from './taxReductionValidation';

interface TaxClassificationEntry {
  codigo: string;
  descricaoReduzida?: string;
  descricaoCompleta?: string;
  reducaoPercentualIBS?: number;
  reducaoPercentualCBS?: number;
  dataInicioVigencia?: string | null;
  dataFimVigencia?: string | null;
  dfesRelacionados?: string[];
}

interface TaxCstEntry {
  codigo: string;
  descricao?: string;
  classificacoes?: TaxClassificationEntry[];
}

interface TaxBase extends Partial<TaxBaseInfo> {
  versao?: string;
  fonteOriginal?: string;
  dataReferencia?: string;
  fonteOficialTabela?: string;
  fonteTecnica?: string;
  fonteLegalBase?: string;
  csts?: TaxCstEntry[];
}

export interface TaxValidationResult {
  contemIBSCBS: boolean;
  cst?: string;
  cClassTrib?: string;
  cstDesc?: string;
  cClassTribDesc?: string;
  validationStatus: ValidationStatus;
  validationReason?: string;
  status: ComplianceStatus;
  itens: ItemValidation[];
}

interface TaxAnalysisInput {
  xmlDoc: Document;
  docType: DocType;
  emissaoDate: Date | null;
  emissionDateStatus: DataIntegrityStatus;
}

const taxBase = baseCompleta as TaxBase;
const NFE_NAMESPACE = 'http://www.portalfiscal.inf.br/nfe';
const NFE_AUTHORIZATION_STATUS_CODES = new Set(['100', '120', '150']);

export const TAX_BASE_INFO: TaxBaseInfo = {
  version: taxBase.versao || 'desconhecida',
  source: taxBase.fonteOriginal || 'Base fiscal local',
  referenceDate: taxBase.dataReferencia || '',
  classificationSource: taxBase.fonteOficialTabela || '',
  technicalSource: taxBase.fonteTecnica || '',
  legalSource: taxBase.fonteLegalBase || '',
};

interface ClassificationResolution {
  currentCst?: TaxCstEntry;
  currentClass?: TaxClassificationEntry;
  otherCstCode?: string;
  otherClass?: TaxClassificationEntry;
}

function resolveClassification(baseCsts: TaxCstEntry[], itemCst: string, itemCClassTrib: string): ClassificationResolution {
  const currentCst = baseCsts.find((item) => item.codigo === itemCst);
  const currentClass = currentCst?.classificacoes?.find((c) => c.codigo === itemCClassTrib);

  if (currentClass) {
    return { currentCst, currentClass };
  }

  for (const item of baseCsts) {
    const otherClass = (item.classificacoes || []).find((c) => c.codigo === itemCClassTrib);
    if (otherClass) {
      return {
        currentCst,
        otherCstCode: item.codigo,
        otherClass,
      };
    }
  }

  return { currentCst };
}

function getElementLocalName(element: Element): string {
  return element.localName || element.tagName.split(':').pop() || element.tagName;
}

function getSingleDirectNFeChild(parent: Element, localName: string): Element | null {
  const children = Array.from(parent.children).filter((element) =>
    getElementLocalName(element) === localName && element.namespaceURI === NFE_NAMESPACE
  );
  return children.length === 1 ? children[0] : null;
}

function getDirectNFeTagValue(parent: Element, localName: string): string | null {
  return getSingleDirectNFeChild(parent, localName)?.textContent?.trim() || null;
}

// Local XML evidence only; this does not replace signature validation or an online SEFAZ consultation.
function hasMatchingNFeAuthorizationProtocol(xmlDoc: Document, docType: DocType): boolean {
  if (docType !== 'NFe' && docType !== 'NFCe') return false;

  const root = xmlDoc.documentElement;
  if (
    !root ||
    getElementLocalName(root) !== 'nfeProc' ||
    root.namespaceURI !== NFE_NAMESPACE
  ) {
    return false;
  }

  const nfeElement = getSingleDirectNFeChild(root, 'NFe');
  const protocolElement = getSingleDirectNFeChild(root, 'protNFe');
  if (!nfeElement || !protocolElement) return false;

  const infNFeElement = getSingleDirectNFeChild(nfeElement, 'infNFe');
  const infProtocolElement = getSingleDirectNFeChild(protocolElement, 'infProt');
  if (!infNFeElement || !infProtocolElement) return false;

  const accessKeyMatch = /^NFe(\d{44})$/.exec(infNFeElement.getAttribute('Id') || '');
  if (!accessKeyMatch) return false;

  const accessKey = accessKeyMatch[1];
  const protocolAccessKey = getDirectNFeTagValue(infProtocolElement, 'chNFe');
  const protocolNumber = getDirectNFeTagValue(infProtocolElement, 'nProt');
  const statusCode = getDirectNFeTagValue(infProtocolElement, 'cStat');
  const expectedModel = docType === 'NFCe' ? '65' : '55';

  return protocolAccessKey === accessKey &&
    accessKey.slice(20, 22) === expectedModel &&
    /^\d{15}$/.test(protocolNumber || '') &&
    NFE_AUTHORIZATION_STATUS_CODES.has(statusCode || '');
}

function getFallbackStatus(itemHasIBSCBS: boolean, documentHasIBSCBS: boolean): ItemClassificationStatus {
  return itemHasIBSCBS || documentHasIBSCBS ? 'incompleto' : 'N/A';
}

function getNfseServiceDetails(serviceElement: Element, xmlDoc: Document): Pick<
  ItemValidation,
  'codigoServico' | 'codigoNbs' | 'descricaoTributacaoNacional' | 'descricaoNbs'
> {
  return {
    codigoServico: getTagValue(serviceElement, 'cTribNac') || getTagValue(serviceElement, 'cServico') || undefined,
    codigoNbs: getTagValue(serviceElement, 'cNBS') || undefined,
    descricaoTributacaoNacional: getTagValue(xmlDoc, 'xTribNac') || getTagValue(xmlDoc, 'xTributacao') || undefined,
    descricaoNbs: getTagValue(xmlDoc, 'xNBS') || undefined,
  };
}

export function analyzeTaxCompliance({ xmlDoc, docType, emissaoDate, emissionDateStatus }: TaxAnalysisInput): TaxValidationResult {
  let contemIBSCBS = false;
  let cst: string | undefined = undefined;
  let cClassTrib: string | undefined = undefined;
  let cstDesc: string | undefined = undefined;
  let cClassTribDesc: string | undefined = undefined;
  let validationStatus: ValidationStatus = 'N/A';
  let validationReason: string | undefined = undefined;
  const itens: ItemValidation[] = [];
  const baseCsts = taxBase.csts || [];

  if (docType === 'NFe' || docType === 'NFCe' || docType === 'NFSe') {
    let detElements: Element[] = getElementsByLocalName(xmlDoc, 'det');
    const nfseServiceElements = docType === 'NFSe'
      ? [
        ...getElementsByLocalName(xmlDoc, 'Servico'),
        ...getElementsByLocalName(xmlDoc, 'serv'),
      ]
      : [];
    const nfseTaxElements = docType === 'NFSe' ? getElementsByLocalName(xmlDoc, 'IBSCBS') : [];
    const nfseServiceDescription = docType === 'NFSe'
      ? getTagValue(xmlDoc, 'xDescServ') || getTagValue(xmlDoc, 'Discriminacao') || getTagValue(xmlDoc, 'xServ') || getTagValue(xmlDoc, 'xDesc')
      : null;
    const nfseDescriptionElement = docType === 'NFSe'
      ? getElementsByLocalName(xmlDoc, 'xDescServ')[0] ||
        getElementsByLocalName(xmlDoc, 'Discriminacao')[0] ||
        getElementsByLocalName(xmlDoc, 'xServ')[0] ||
        getElementsByLocalName(xmlDoc, 'xDesc')[0]
      : null;
    const nfseServiceItemCount = nfseServiceElements.length > 0
      ? nfseServiceElements.length
      : nfseDescriptionElement?.parentElement
        ? 1
        : 0;

    if (detElements.length === 0 && docType === 'NFSe') {
      if (nfseServiceElements.length > 0) {
        detElements = nfseServiceElements;
      } else if (nfseServiceDescription) {
        if (nfseDescriptionElement?.parentElement) {
          detElements = [nfseDescriptionElement.parentElement];
        }
      } else {
        if (nfseTaxElements.length > 0) {
          detElements = nfseTaxElements;
        }
      }
    }

    contemIBSCBS = getElementsByLocalName(xmlDoc, 'IBSCBS').length > 0;
    const siglaDfe = docType === 'NFe' ? 'NFE' : docType === 'NFCe' ? 'NFCE' : 'NFSE';

    if (detElements && detElements.length > 0) {
      for (let i = 0; i < detElements.length; i++) {
        const det = detElements[i];
        let descricaoProduto = 'Descrição não identificada';
        let numeroItem = i + 1;

        const detLocalName = det.localName || det.tagName.split(':').pop() || det.tagName;
        const isNfseService = docType === 'NFSe' && ['servico', 'serv'].includes(detLocalName.toLowerCase());
        const nfseServiceDetails = isNfseService ? getNfseServiceDetails(det, xmlDoc) : {};
        if (detLocalName.toLowerCase() === 'det') {
          const prodElement = getElementsByLocalName(det, 'prod')[0];
          const rawItemNo = det.getAttribute('nItem');
          numeroItem = rawItemNo ? parseInt(rawItemNo, 10) : (i + 1);
          descricaoProduto = prodElement ? (getTagValue(prodElement, 'xProd') || 'Produto sem descrição') : 'Produto sem descrição';
        } else if (detLocalName.toLowerCase() === 'servico') {
          descricaoProduto = getTagValue(det, 'Discriminacao') || getTagValue(det, 'xDescServ') || getTagValue(det, 'xServ') || 'Serviço prestado';
        } else if (detLocalName.toLowerCase() === 'serv') {
          descricaoProduto = getTagValue(det, 'xDescServ') || getTagValue(det, 'Discriminacao') || getTagValue(det, 'xServ') || 'Serviço prestado';
        } else if (detLocalName.toLowerCase() === 'ibscbs') {
          descricaoProduto = nfseServiceDescription || 'Tributação de Reforma Tributária';
        } else {
          descricaoProduto = getTagValue(det, 'xProd') || getTagValue(det, 'xDescServ') || getTagValue(det, 'Discriminacao') || getTagValue(det, 'xServ') || det.tagName || 'Item de serviço/produto';
        }

        const nestedIbscbsElement = detLocalName.toLowerCase() === 'ibscbs' ? det : getElementsByLocalName(det, 'IBSCBS')[0];
        const documentIbscbsElement = docType === 'NFSe' &&
          nfseServiceItemCount === 1 &&
          nfseTaxElements.length === 1
          ? nfseTaxElements[0]
          : undefined;
        const ibscbsElement = nestedIbscbsElement || documentIbscbsElement;
        const itemHasIBSCBS = !!ibscbsElement;

        let itemCst: string | undefined = undefined;
        let itemCClassTrib: string | undefined = undefined;
        let itemCstDesc: string | undefined = undefined;
        let itemCClassTribDesc: string | undefined = undefined;
        let itemValStatus: ValidationStatus = 'N/A';
        let itemValReason = '';
        let itemStatus: ItemClassificationStatus = getFallbackStatus(itemHasIBSCBS, contemIBSCBS);

        if (itemHasIBSCBS) {
          itemCst = getTagValue(ibscbsElement, 'CST') || getTagValue(ibscbsElement, 'cst') || undefined;
          itemCClassTrib = getTagValue(ibscbsElement, 'cClassTrib') || getTagValue(ibscbsElement, 'cclassTrib') || undefined;

          if (!itemCst || !itemCClassTrib) {
            itemValStatus = 'incompleto';
            itemValReason = 'Grupo IBSCBS presente, porém CST ou cClassTrib não foi informado.';
            itemStatus = 'incompleto';
          } else {
            const resolved = resolveClassification(baseCsts, itemCst, itemCClassTrib);
            const cstFound = resolved.currentCst;
            const classFound = resolved.currentClass;

            if (!cstFound) {
              itemValStatus = 'inválido';
              itemValReason = `O CST "${itemCst}" não existe na tabela oficial da Reforma Tributária (LC 214/25).`;
              itemStatus = 'classificacao_invalida';
            } else if (classFound) {
              itemCstDesc = cstFound.descricao;
              const vigenciaInicio = classFound.dataInicioVigencia ? parseXmlDate(classFound.dataInicioVigencia) : null;
              const vigenciaFim = classFound.dataFimVigencia ? parseXmlDate(classFound.dataFimVigencia) : null;

              if (emissionDateStatus !== 'VALID') {
                itemValStatus = 'incompleto';
                itemStatus = 'incompleto';
                itemValReason = emissionDateStatus === 'MISSING'
                  ? 'Data de emissão não informada; não é possível verificar a vigência da classificação tributária.'
                  : 'Data de emissão inválida; não é possível verificar a vigência da classificação tributária.';
              } else {
                let isVigente = true;
                if (emissaoDate) {
                  if (vigenciaInicio && emissaoDate < vigenciaInicio) {
                    isVigente = false;
                  } else if (vigenciaFim && emissaoDate > vigenciaFim) {
                    isVigente = false;
                  }
                }

                if (!isVigente) {
                  itemValStatus = 'inválido';
                  itemStatus = 'fora_vigencia';
                  itemValReason = `Código de classificação fora da vigência original (Início: ${classFound.dataInicioVigencia || 'N/A'}, Fim: ${classFound.dataFimVigencia || 'vigência aberta'}).`;
                } else {
                  const dfes: string[] = classFound.dfesRelacionados || [];
                  const dfeAllowed = dfes.some((d: string) => d.toUpperCase() === siglaDfe);

                  if (dfes.length === 0) {
                    itemValStatus = 'pendente';
                    itemStatus = 'pendente';
                    itemCClassTribDesc = classFound.descricaoReduzida || classFound.descricaoCompleta;
                    itemValReason = 'A tabela oficial não informa DF-e aplicável para esta classificação.';
                  } else if (dfeAllowed) {
                    const reductionValidation = (docType === 'NFe' || docType === 'NFCe')
                      ? validateTaxReductions(ibscbsElement, {
                        expectedIBS: classFound.reducaoPercentualIBS,
                        expectedCBS: classFound.reducaoPercentualCBS,
                      })
                      : {
                        status: 'pendente' as const,
                        reason: 'A validação específica de redução para NFS-e ainda não está disponível nesta etapa.',
                      };

                    if (reductionValidation.status === 'conforme') {
                      itemValStatus = 'válido';
                      itemCClassTribDesc = classFound.descricaoReduzida || classFound.descricaoCompleta;
                      itemValReason = `Código de classificação "${itemCClassTrib}" válido para o CST "${itemCst}" e permitido para ${docType}.`;
                      itemStatus = 'conforme';
                    } else if (reductionValidation.status === 'pendente') {
                      itemValStatus = 'pendente';
                      itemCClassTribDesc = classFound.descricaoReduzida || classFound.descricaoCompleta;
                      itemValReason = `Classificação encontrada, mas a apuração permanece pendente. ${reductionValidation.reason}`;
                      itemStatus = 'pendente';
                    } else if (reductionValidation.status === 'incompleto') {
                      itemValStatus = 'incompleto';
                      itemCClassTribDesc = classFound.descricaoReduzida || classFound.descricaoCompleta;
                      itemValReason = `Dados fiscais insuficientes para confirmar a redução. ${reductionValidation.reason}`;
                      itemStatus = 'incompleto';
                    } else {
                      itemValStatus = 'inválido';
                      itemCClassTribDesc = classFound.descricaoReduzida || classFound.descricaoCompleta;
                      itemValReason = `Inconsistência fiscal comprovada. ${reductionValidation.reason}`;
                      itemStatus = 'nao_conforme_valor';
                    }
                  } else {
                    itemValStatus = 'inválido';
                    itemCClassTribDesc = classFound.descricaoReduzida || classFound.descricaoCompleta;
                    itemValReason = `Inconsistência: O código de classificação "${itemCClassTrib}" não é permitido para o tipo de documento "${docType}" (usado em documento indevido). Permitidos: ${dfes.join(', ')}.`;
                    itemStatus = 'classificacao_invalida';
                  }
                }
              }
            } else {
              itemValStatus = 'inválido';
              itemStatus = 'classificacao_invalida';

              if (resolved.otherClass && resolved.otherCstCode) {
                const tempDesc = resolved.otherClass.descricaoReduzida || resolved.otherClass.descricaoCompleta;
                itemCClassTribDesc = tempDesc;
                const tempDfes = resolved.otherClass.dfesRelacionados || [];
                const tempDfeAllowed = tempDfes.some((d: string) => d.toUpperCase() === siglaDfe);
                if (!tempDfeAllowed) {
                  itemValReason = `O código "${itemCClassTrib}" (${tempDesc}) pertence ao CST "${resolved.otherCstCode}" (não ao CST "${itemCst}") e também não é permitido para o tipo de documento "${docType}".`;
                } else {
                  itemValReason = `O código "${itemCClassTrib}" (${tempDesc}) existe, mas pertence ao CST "${resolved.otherCstCode}" e não ao CST "${itemCst}".`;
                }
              } else {
                itemValReason = `O código de classificação tributária "${itemCClassTrib}" não existe na tabela de CST "${itemCst}" nem em outro CST.`;
              }
            }
            }
          }
        else {
          if (contemIBSCBS) {
            itemValStatus = 'incompleto';
            itemValReason = 'Grupo IBSCBS de tributação da Reforma Tributária ausente neste item.';
            itemStatus = 'incompleto';
          } else {
            itemValStatus = 'N/A';
            itemValReason = 'Nota fiscal não contém informações da Reforma Tributária.';
            itemStatus = 'N/A';
          }
        }

        itens.push({
          numeroItem,
          descricaoProduto,
          ...nfseServiceDetails,
          contemIBSCBS: itemHasIBSCBS,
          cst: itemCst,
          cClassTrib: itemCClassTrib,
          cstDesc: itemCstDesc,
          cClassTribDesc: itemCClassTribDesc,
          validationStatus: itemValStatus,
          validationReason: itemValReason || undefined,
          itemStatus,
        });
      }
    }

    if (contemIBSCBS) {
      if (itens.length > 0) {
        const hasInvalid = itens.some((item) => item.validationStatus === 'inválido');
        const hasIncomplete = itens.some((item) => item.validationStatus === 'incompleto');
        const hasPending = itens.some((item) => item.validationStatus === 'pendente');

        if (hasInvalid) {
          validationStatus = 'inválido';
          const countFail = itens.filter((item) => item.validationStatus === 'inválido').length;
          validationReason = `Encontrado(s) ${countFail} item(ns) com classificação inválida ou em documento indevido.`;
        } else if (hasIncomplete) {
          validationStatus = 'incompleto';
          const countIncomplete = itens.filter((item) => item.validationStatus === 'incompleto').length;
          validationReason = `Encontrado(s) ${countIncomplete} item(ns) com classificação incompleta / sem grupo IBSCBS informado.`;
        } else if (hasPending) {
          validationStatus = 'pendente';
          const countPending = itens.filter((item) => item.validationStatus === 'pendente').length;
          validationReason = `Encontrado(s) ${countPending} item(ns) sem definição de DF-e aplicável na tabela oficial.`;
        } else {
          validationStatus = 'válido';
          validationReason = 'Todos os itens possuem CST e Código de Classificação (cClassTrib) válidos e consistentes para este tipo de documento.';
        }

        const firstIBSCBSItem = itens.find((item) => item.contemIBSCBS);
        if (firstIBSCBSItem) {
          cst = firstIBSCBSItem.cst;
          cClassTrib = firstIBSCBSItem.cClassTrib;
          cstDesc = firstIBSCBSItem.cstDesc;
          cClassTribDesc = firstIBSCBSItem.cClassTribDesc;
        }
      } else {
        validationStatus = 'incompleto';
        validationReason = 'O XML contém marcas de IBSCBS mas não há itens estruturados de forma reconhecida.';
      }
    } else {
      if (docType === 'NFSe') {
        validationStatus = 'N/A';
        validationReason = 'NFS-e (Nota Fiscal de Serviços) não está associada à tabela oficial de CST/cClassTrib (Reforma Tributária - LC 214/2025) ou não possui grupo IBSCBS.';
      } else {
        validationStatus = 'N/A';
        validationReason = 'Esta nota fiscal não possui grupo IBSCBS de tributação da Reforma Tributária.';
      }
    }
  }

  const hasAuthorizationProtocol = hasMatchingNFeAuthorizationProtocol(xmlDoc, docType);
  let status: ComplianceStatus = 'N/A';
  if (contemIBSCBS && validationStatus === 'válido') {
    status = 'CONFORME';
  } else if (contemIBSCBS && validationStatus === 'pendente') {
    status = 'PENDENTE';
  } else if (contemIBSCBS && (validationStatus === 'inválido' || validationStatus === 'incompleto')) {
    status = hasAuthorizationProtocol ? 'AUTORIZADA_COM_PENDENCIAS' : 'NÃO_CONFORME';
  }

  return {
    contemIBSCBS,
    cst,
    cClassTrib,
    cstDesc,
    cClassTribDesc,
    validationStatus,
    validationReason,
    status,
    itens,
  };
}
