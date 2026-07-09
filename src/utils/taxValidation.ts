import { ComplianceStatus, DocType, ItemClassificationStatus, ItemValidation, ValidationStatus } from '../types';
import baseCompleta from '../data/base_completa.json' with { type: 'json' };
import { extractPRedAliq, getTagValue, parseXmlDate } from './xmlHelpers';

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

interface TaxBase {
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
  xmlText: string;
  docType: DocType;
  emissaoDate: Date | null;
}

const taxBase = baseCompleta as TaxBase;


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
function getDocumentHasProtocol(xmlDoc: Document, xmlText: string): boolean {
  return xmlDoc.getElementsByTagName('nProt').length > 0 ||
    xmlDoc.getElementsByTagName('Protocolo').length > 0 ||
    xmlDoc.getElementsByTagName('protocolo').length > 0 ||
    xmlDoc.getElementsByTagName('protNFe').length > 0 ||
    xmlText.includes('<nProt>') ||
    xmlText.includes('<Protocolo>') ||
    xmlText.includes('<protocolo>');
}

function getFallbackStatus(itemHasIBSCBS: boolean, xmlText: string): ItemClassificationStatus {
  return itemHasIBSCBS || xmlText.includes('<IBSCBS>') || xmlText.includes('</IBSCBS>') || xmlText.includes('<IBSCBS ') ? 'incompleto' : 'N/A';
}

export function analyzeTaxCompliance({ xmlDoc, xmlText, docType, emissaoDate }: TaxAnalysisInput): TaxValidationResult {
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
    let detElements: Element[] = Array.from(xmlDoc.getElementsByTagName('det'));

    if (detElements.length === 0 && docType === 'NFSe') {
      const servicos = xmlDoc.getElementsByTagName('Servico');
      if (servicos && servicos.length > 0) {
        detElements = Array.from(servicos);
      } else {
        const ibscbsTags = xmlDoc.getElementsByTagName('IBSCBS');
        if (ibscbsTags && ibscbsTags.length > 0) {
          detElements = Array.from(ibscbsTags);
        }
      }
    }

    contemIBSCBS = xmlText.includes('<IBSCBS>') || xmlText.includes('</IBSCBS>') || xmlText.includes('<IBSCBS ') || xmlDoc.getElementsByTagName('IBSCBS').length > 0;
    const siglaDfe = docType === 'NFe' ? 'NFE' : docType === 'NFCe' ? 'NFCE' : 'NFSE';

    if (detElements && detElements.length > 0) {
      for (let i = 0; i < detElements.length; i++) {
        const det = detElements[i];
        let descricaoProduto = 'Descrição não identificada';
        let numeroItem = i + 1;

        if (det.tagName === 'det') {
          const prodElement = det.getElementsByTagName('prod')[0];
          const rawItemNo = det.getAttribute('nItem');
          numeroItem = rawItemNo ? parseInt(rawItemNo, 10) : (i + 1);
          descricaoProduto = prodElement ? (getTagValue(prodElement, 'xProd') || 'Produto sem descrição') : 'Produto sem descrição';
        } else if (det.tagName === 'Servico') {
          descricaoProduto = getTagValue(det, 'Discriminacao') || getTagValue(det, 'discriminacao') || getTagValue(det, 'xServ') || 'Serviço prestado';
        } else if (det.tagName === 'IBSCBS') {
          descricaoProduto = 'Tributação de Reforma Tributária';
        } else {
          descricaoProduto = getTagValue(det, 'xProd') || getTagValue(det, 'Discriminacao') || det.tagName || 'Item de serviço/produto';
        }

        const ibscbsElement = det.tagName === 'IBSCBS' ? det : det.getElementsByTagName('IBSCBS')[0];
        const itemHasIBSCBS = !!ibscbsElement;

        let itemCst: string | undefined = undefined;
        let itemCClassTrib: string | undefined = undefined;
        let itemCstDesc: string | undefined = undefined;
        let itemCClassTribDesc: string | undefined = undefined;
        let itemValStatus: ValidationStatus = 'N/A';
        let itemValReason = '';
        let itemStatus: ItemClassificationStatus = getFallbackStatus(itemHasIBSCBS, xmlText);

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

                if (dfeAllowed) {
                  const expectedIBS = typeof classFound.reducaoPercentualIBS === 'number' ? classFound.reducaoPercentualIBS : 0.0;
                  const expectedCBS = typeof classFound.reducaoPercentualCBS === 'number' ? classFound.reducaoPercentualCBS : 0.0;

                  const checkGroupExists = (item: Element, groupName: string) => {
                    const gps = item.getElementsByTagName(groupName);
                    if (gps && gps.length > 0) return true;
                    const all = item.getElementsByTagName('*');
                    const targetLower = groupName.toLowerCase();
                    for (let j = 0; j < all.length; j++) {
                      if (all[j].tagName.toLowerCase() === targetLower) return true;
                    }
                    if (item.parentElement) {
                      const pgps = item.parentElement.getElementsByTagName(groupName);
                      if (pgps && pgps.length > 0) return true;
                      const pall = item.parentElement.getElementsByTagName('*');
                      for (let j = 0; j < pall.length; j++) {
                        if (pall[j].tagName.toLowerCase() === targetLower) return true;
                      }
                    }
                    return false;
                  };

                  let declaredIBS = 0.0;
                  const hasIBSUF = checkGroupExists(det, 'gIBSUF');
                  if (hasIBSUF) {
                    declaredIBS = extractPRedAliq(det, 'gIBSUF');
                  } else {
                    const hasIBSMun = checkGroupExists(det, 'gIBSMun');
                    if (hasIBSMun) {
                      declaredIBS = extractPRedAliq(det, 'gIBSMun');
                    }
                  }

                  const declaredCBS = extractPRedAliq(det, 'gCBS');

                  const ibsMatch = Math.abs(declaredIBS - expectedIBS) < 0.0001;
                  const cbsMatch = Math.abs(declaredCBS - expectedCBS) < 0.0001;

                  if (ibsMatch && cbsMatch) {
                    itemValStatus = 'válido';
                    itemCClassTribDesc = classFound.descricaoReduzida || classFound.descricaoCompleta;
                    itemValReason = `Código de classificação "${itemCClassTrib}" válido para o CST "${itemCst}" e permitido para ${docType}.`;
                    itemStatus = 'conforme';
                  } else {
                    itemValStatus = 'inválido';
                    itemCClassTribDesc = classFound.descricaoReduzida || classFound.descricaoCompleta;

                    const p: string[] = [];
                    if (!ibsMatch) {
                      p.push(`IBS declarado: ${declaredIBS}% (esperado: ${expectedIBS}%)`);
                    }
                    if (!cbsMatch) {
                      p.push(`CBS declarado: ${declaredCBS}% (esperado: ${expectedCBS}%)`);
                    }
                    itemValReason = `Inconsistência de redução de alíquota. ${p.join(', ')}.`;
                    itemStatus = 'nao_conforme_valor';
                  }
                } else {
                  itemValStatus = 'inválido';
                  itemCClassTribDesc = classFound.descricaoReduzida || classFound.descricaoCompleta;
                  itemValReason = `Inconsistência: O código de classificação "${itemCClassTrib}" não é permitido para o tipo de documento "${docType}" (usado em documento indevido). Permitidos: ${dfes.join(', ')}.`;
                  itemStatus = 'classificacao_invalida';
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

        if (hasInvalid) {
          validationStatus = 'inválido';
          const countFail = itens.filter((item) => item.validationStatus === 'inválido').length;
          validationReason = `Encontrado(s) ${countFail} item(ns) com classificação inválida ou em documento indevido.`;
        } else if (hasIncomplete) {
          validationStatus = 'incompleto';
          const countIncomplete = itens.filter((item) => item.validationStatus === 'incompleto').length;
          validationReason = `Encontrado(s) ${countIncomplete} item(ns) com classificação incompleta / sem grupo IBSCBS informado.`;
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

  const temProtocolo = getDocumentHasProtocol(xmlDoc, xmlText);
  let status: ComplianceStatus = 'N/A';
  if (contemIBSCBS && validationStatus === 'válido') {
    status = 'CONFORME';
  } else if (contemIBSCBS && (validationStatus === 'inválido' || validationStatus === 'incompleto')) {
    status = temProtocolo ? 'AUTORIZADA_COM_PENDENCIAS' : 'NÃO_CONFORME';
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