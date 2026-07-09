export interface SampleNfe {
  fileName: string;
  xmlContent: string;
}

/**
 * Amostras sintéticas para demonstrar o fluxo sem arquivos próprios.
 * Cada nota exercita um estado distinto da engine de validação:
 *  1. NFe Saída ....... CONFORME (tributação integral, CST 000/000001)
 *  2. NFe Saída ....... NÃO CONFORME — classificação inválida (cClassTrib de outro CST)
 *  3. NFe Entrada ..... CONFORME (alíquota reduzida 60%, CST 200/200038, com gRed/pRedAliq)
 *  4. NFe Entrada ..... AUTORIZADA C/ PENDÊNCIAS — falha de valor (protocolada, mas pRedAliq ≠ base)
 *  5. NFCe Saída ...... CONFORME (tributação integral, CST 000/000001)
 *  6. NFe Saída ....... FORA DO ESCOPO — nota só com ICMS, sem grupo IBSCBS
 *  7. NFSe ............ INCOMPLETO — grupo IBSCBS presente sem CST/cClassTrib
 *  8. NFe Saída ....... DADOS INCOMPLETOS — sem CNPJ do emitente (sem empresa em foco)
 */
export const SAMPLE_NFES: SampleNfe[] = [
  {
    fileName: 'NFe_35260661585865000108_Saida_Conforme.xml',
    xmlContent: `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35260661585865000108550010008451871234567890" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <cNF>12345678</cNF>
        <natOp>Venda de mercadoria</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>845187</nNF>
        <dhEmi>2026-05-29T10:00:00-03:00</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>3550308</cMunFG>
        <tpAmb>1</tpAmb>
        <finNFe>1</finNFe>
      </ide>
      <emit>
        <CNPJ>61585865000108</CNPJ>
        <xNome>Alfa Implementos Industriais S.A.</xNome>
        <xFant>Alfa Ind</xFant>
      </emit>
      <dest>
        <CNPJ>12345678000199</CNPJ>
        <xNome>Beta Distribuidora de Bebidas Ltda</xNome>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>ALFA-90</cProd>
          <xProd>Válvula Reguladora de Pressão Reforçada</xProd>
          <NCM>84811000</NCM>
          <CFOP>5101</CFOP>
          <uCom>UN</uCom>
          <qCom>10.0000</qCom>
          <vUnCom>150.0000</vUnCom>
          <vProd>1500.00</vProd>
        </prod>
        <imposto>
          <vTotTrib>250.00</vTotTrib>
          <IBSCBS>
            <CST>000</CST>
            <cClassTrib>000001</cClassTrib>
            <gIBSCBS>
              <vBC>1500.00</vBC>
              <gIBSUF>
                <pIBSUF>0.1000</pIBSUF>
                <vIBSUF>1.50</vIBSUF>
              </gIBSUF>
              <gIBSMun>
                <pIBSMun>0.0000</pIBSMun>
                <vIBSMun>0.00</vIBSMun>
              </gIBSMun>
              <vIBS>1.50</vIBS>
              <gCBS>
                <pCBS>0.9000</pCBS>
                <vCBS>13.50</vCBS>
              </gCBS>
            </gIBSCBS>
          </IBSCBS>
        </imposto>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`
  },
  {
    fileName: 'NFe_35260661585865000108_Saida_ClassificacaoInvalida.xml',
    xmlContent: `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35260661585865000108550010008451881234567890" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <cNF>87654321</cNF>
        <natOp>Venda de mercadoria</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>845188</nNF>
        <dhEmi>2026-05-28T15:30:00-03:00</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>3550308</cMunFG>
        <tpAmb>1</tpAmb>
        <finNFe>1</finNFe>
      </ide>
      <emit>
        <CNPJ>61585865000108</CNPJ>
        <xNome>Alfa Implementos Industriais S.A.</xNome>
        <xFant>Alfa Ind</xFant>
      </emit>
      <dest>
        <CNPJ>33444555000122</CNPJ>
        <xNome>Gama Embalagens de Papelão Ltda</xNome>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>BOX-01</cProd>
          <xProd>Caixas de papelão modelo C1 estruturada</xProd>
          <NCM>48191000</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>500.0000</qCom>
          <vUnCom>2.0000</vUnCom>
          <vProd>1000.00</vProd>
        </prod>
        <imposto>
          <vTotTrib>170.00</vTotTrib>
          <IBSCBS>
            <CST>000</CST>
            <cClassTrib>200030</cClassTrib>
            <gIBSCBS>
              <vBC>1000.00</vBC>
              <gIBSUF>
                <pIBSUF>0.1000</pIBSUF>
                <vIBSUF>1.00</vIBSUF>
              </gIBSUF>
              <vIBS>1.00</vIBS>
              <gCBS>
                <pCBS>0.9000</pCBS>
                <vCBS>9.00</vCBS>
              </gCBS>
            </gIBSCBS>
          </IBSCBS>
        </imposto>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`
  },
  {
    fileName: 'NFe_43260699999999000100_Entrada_Conforme.xml',
    xmlContent: `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe43260699999999000100550010000012345551222333" versao="4.00">
      <ide>
        <cUF>43</cUF>
        <cNF>99912345</cNF>
        <natOp>Compra de insumos agropecuarios</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>1234</nNF>
        <dhEmi>2026-05-25T11:20:00-03:00</dhEmi>
        <tpNF>0</tpNF>
        <idDest>1</idDest>
        <cMunFG>4314902</cMunFG>
        <tpAmb>1</tpAmb>
        <finNFe>1</finNFe>
      </ide>
      <emit>
        <CNPJ>99999999000100</CNPJ>
        <xNome>Omega Agroquimica e Insumos EIRELI</xNome>
        <xFant>Omega Agro</xFant>
      </emit>
      <dest>
        <CNPJ>44555666000188</CNPJ>
        <xNome>Delta Agropecuaria e Cooperativa S.A.</xNome>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>ADB-102</cProd>
          <xProd>Fertilizante NPK 04-14-08 (insumo agropecuario)</xProd>
          <NCM>31052000</NCM>
          <CFOP>1101</CFOP>
          <uCom>KG</uCom>
          <qCom>250.0000</qCom>
          <vUnCom>12.0000</vUnCom>
          <vProd>3000.00</vProd>
        </prod>
        <imposto>
          <vTotTrib>150.00</vTotTrib>
          <IBSCBS>
            <CST>200</CST>
            <cClassTrib>200038</cClassTrib>
            <gIBSCBS>
              <vBC>3000.00</vBC>
              <gIBSUF>
                <pIBSUF>0.1000</pIBSUF>
                <gRed>
                  <pRedAliq>60.0000</pRedAliq>
                  <pAliqEfet>0.0400</pAliqEfet>
                </gRed>
                <vIBSUF>1.20</vIBSUF>
              </gIBSUF>
              <gIBSMun>
                <pIBSMun>0.0000</pIBSMun>
                <gRed>
                  <pRedAliq>60.0000</pRedAliq>
                  <pAliqEfet>0.0000</pAliqEfet>
                </gRed>
                <vIBSMun>0.00</vIBSMun>
              </gIBSMun>
              <vIBS>1.20</vIBS>
              <gCBS>
                <pCBS>0.9000</pCBS>
                <gRed>
                  <pRedAliq>60.0000</pRedAliq>
                  <pAliqEfet>0.3600</pAliqEfet>
                </gRed>
                <vCBS>10.80</vCBS>
              </gCBS>
            </gIBSCBS>
          </IBSCBS>
        </imposto>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`
  },
  {
    fileName: 'NFe_43260688888888000111_Entrada_Autorizada_Pendencias.xml',
    xmlContent: `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe43260688888888000111550010000045675551222444" versao="4.00">
      <ide>
        <cUF>43</cUF>
        <cNF>99912346</cNF>
        <natOp>Compra de insumos agropecuarios</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>4567</nNF>
        <dhEmi>2026-05-24T09:45:00-03:00</dhEmi>
        <tpNF>0</tpNF>
        <idDest>1</idDest>
        <cMunFG>4314902</cMunFG>
        <tpAmb>1</tpAmb>
        <finNFe>1</finNFe>
      </ide>
      <emit>
        <CNPJ>88888888000111</CNPJ>
        <xNome>Zeta Defensivos Agricolas S.A.</xNome>
        <xFant>Zeta Agro</xFant>
      </emit>
      <dest>
        <CNPJ>44555666000188</CNPJ>
        <xNome>Delta Agropecuaria e Cooperativa S.A.</xNome>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>ZET-082</cProd>
          <xProd>Adubo foliar concentrado (insumo agropecuario)</xProd>
          <NCM>31059090</NCM>
          <CFOP>1101</CFOP>
          <uCom>L</uCom>
          <qCom>50.0000</qCom>
          <vUnCom>18.0000</vUnCom>
          <vProd>900.00</vProd>
        </prod>
        <imposto>
          <vTotTrib>72.00</vTotTrib>
          <IBSCBS>
            <CST>200</CST>
            <cClassTrib>200038</cClassTrib>
            <gIBSCBS>
              <vBC>900.00</vBC>
              <gIBSUF>
                <pIBSUF>0.1000</pIBSUF>
                <gRed>
                  <pRedAliq>40.0000</pRedAliq>
                  <pAliqEfet>0.0600</pAliqEfet>
                </gRed>
                <vIBSUF>0.54</vIBSUF>
              </gIBSUF>
              <vIBS>0.54</vIBS>
              <gCBS>
                <pCBS>0.9000</pCBS>
                <gRed>
                  <pRedAliq>40.0000</pRedAliq>
                  <pAliqEfet>0.5400</pAliqEfet>
                </gRed>
                <vCBS>4.86</vCBS>
              </gCBS>
            </gIBSCBS>
          </IBSCBS>
        </imposto>
      </det>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>1</tpAmb>
      <chNFe>43260688888888000111550010000045675551222444</chNFe>
      <dhRecbto>2026-05-24T09:46:10-03:00</dhRecbto>
      <nProt>143260000045671</nProt>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`
  },
  {
    fileName: 'NFCe_35260612345678000199_Saida_Conforme.xml',
    xmlContent: `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35260612345678000199650010009995551234567111" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <cNF>99912347</cNF>
        <natOp>Venda de mercadoria</natOp>
        <mod>65</mod>
        <serie>1</serie>
        <nNF>999555</nNF>
        <dhEmi>2026-05-26T18:15:00-03:00</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>3550308</cMunFG>
        <tpAmb>1</tpAmb>
        <finNFe>1</finNFe>
        <indPres>1</indPres>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>Beta Distribuidora de Bebidas Ltda</xNome>
        <xFant>Beta Distrib</xFant>
      </emit>
      <dest>
        <CNPJ>44555666000188</CNPJ>
        <xNome>Delta Agropecuaria e Cooperativa S.A.</xNome>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>BEV-501</cProd>
          <xProd>Agua Mineral com Gas Pack 12x500ml</xProd>
          <NCM>22011000</NCM>
          <CFOP>5102</CFOP>
          <uCom>CX</uCom>
          <qCom>100.0000</qCom>
          <vUnCom>14.5000</vUnCom>
          <vProd>1450.00</vProd>
        </prod>
        <imposto>
          <vTotTrib>243.00</vTotTrib>
          <IBSCBS>
            <CST>000</CST>
            <cClassTrib>000001</cClassTrib>
            <gIBSCBS>
              <vBC>1450.00</vBC>
              <gIBSUF>
                <pIBSUF>0.1000</pIBSUF>
                <vIBSUF>1.45</vIBSUF>
              </gIBSUF>
              <vIBS>1.45</vIBS>
              <gCBS>
                <pCBS>0.9000</pCBS>
                <vCBS>13.05</vCBS>
              </gCBS>
            </gIBSCBS>
          </IBSCBS>
        </imposto>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`
  },
  {
    fileName: 'NFe_35260661585865000108_Saida_SemReforma.xml',
    xmlContent: `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35260661585865000108550010008451911234567890" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <cNF>55501234</cNF>
        <natOp>Venda de mercadoria</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>845191</nNF>
        <dhEmi>2026-05-23T14:10:00-03:00</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>3550308</cMunFG>
        <tpAmb>1</tpAmb>
        <finNFe>1</finNFe>
      </ide>
      <emit>
        <CNPJ>61585865000108</CNPJ>
        <xNome>Alfa Implementos Industriais S.A.</xNome>
        <xFant>Alfa Ind</xFant>
      </emit>
      <dest>
        <CNPJ>33444555000122</CNPJ>
        <xNome>Gama Embalagens de Papelão Ltda</xNome>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>ALFA-77</cProd>
          <xProd>Rolamento Industrial Blindado</xProd>
          <NCM>84821010</NCM>
          <CFOP>5101</CFOP>
          <uCom>UN</uCom>
          <qCom>20.0000</qCom>
          <vUnCom>85.0000</vUnCom>
          <vProd>1700.00</vProd>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <modBC>0</modBC>
              <vBC>1700.00</vBC>
              <pICMS>18.00</pICMS>
              <vICMS>306.00</vICMS>
            </ICMS00>
          </ICMS>
        </imposto>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`
  },
  {
    fileName: 'NFSe_2026_Prestador_Incompleto.xml',
    xmlContent: `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <LoteRps>
    <Numero>412</Numero>
    <CompNfse>
      <Nfse>
        <InfNfse>
          <Numero>12340</Numero>
          <DataEmissao>2026-05-27</DataEmissao>
          <PrestadorServico>
            <CNPJ>55666777000188</CNPJ>
            <RazaoSocial>Sigma Desenvolvimento de Softwares S.A.</RazaoSocial>
          </PrestadorServico>
          <TomadorServico>
            <CNPJ>44555666000188</CNPJ>
            <RazaoSocial>Delta Agropecuaria e Cooperativa S.A.</RazaoSocial>
          </TomadorServico>
          <Servico>
            <Discriminacao>Licenciamento de software de gestao</Discriminacao>
            <valores>
              <vServicos>4500.00</vServicos>
              <IBSCBS>
                <!-- Sem CST e sem cClassTrib para simular status incompleto -->
                <vIBS>405.00</vIBS>
                <vCBS>337.50</vCBS>
              </IBSCBS>
            </valores>
          </Servico>
        </InfNfse>
      </Nfse>
    </CompNfse>
  </LoteRps>
</EnviarLoteRpsEnvio>`
  },
  {
    fileName: 'NFe_SemEmitente_DadosIncompletos.xml',
    xmlContent: `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35260600000000000000550010008451891234567890" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <cNF>99999999</cNF>
        <natOp>Venda de mercadoria</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>845189</nNF>
        <dhEmi>2026-05-26T11:00:00-03:00</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
      </ide>
      <emit>
        <xNome>Industria Desconhecida Ltda</xNome>
      </emit>
      <dest>
        <CNPJ>12345678000199</CNPJ>
        <xNome>Beta Distribuidora de Bebidas Ltda</xNome>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>ALFA-90</cProd>
          <xProd>Produto de Teste sem Emitente</xProd>
          <NCM>84811000</NCM>
          <CFOP>5101</CFOP>
          <uCom>UN</uCom>
          <qCom>10.0000</qCom>
          <vUnCom>150.0000</vUnCom>
          <vProd>1500.00</vProd>
        </prod>
        <imposto>
          <IBSCBS>
            <CST>000</CST>
            <cClassTrib>000001</cClassTrib>
          </IBSCBS>
        </imposto>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`
  }
];
