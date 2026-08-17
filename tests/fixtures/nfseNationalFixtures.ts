export const NATIONAL_DPS_1_00 = `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infDPS Id="DPS355030810425201100011000001000000000009001">
    <tpAmb>2</tpAmb>
    <dhEmi>2026-05-29T13:00:00+00:00</dhEmi>
    <verAplic>1.00</verAplic>
    <serie>00001</serie>
    <nDPS>9001</nDPS>
    <dCompet>2026-05-29</dCompet>
    <tpEmit>1</tpEmit>
    <cLocEmi>3550308</cLocEmi>
    <prest>
      <CNPJ>04252011000110</CNPJ>
      <xNome>Prestador Nacional</xNome>
      <regTrib>
        <opSimpNac>1</opSimpNac>
        <regEspTrib>0</regEspTrib>
      </regTrib>
    </prest>
    <toma>
      <CPF>52998224725</CPF>
      <xNome>Tomador Nacional</xNome>
    </toma>
    <serv>
      <locPrest>
        <cLocPrestacao>3550308</cLocPrestacao>
      </locPrest>
      <cServ>
        <cTribNac>010101</cTribNac>
        <xDescServ>Consultoria tributaria</xDescServ>
      </cServ>
    </serv>
    <valores>
      <vServPrest>
        <vServ>100.00</vServ>
      </vServPrest>
      <trib>
        <tribMun>
          <tribISSQN>1</tribISSQN>
          <tpRetISSQN>1</tpRetISSQN>
        </tribMun>
        <totTrib>
          <indTotTrib>0</indTotTrib>
        </totTrib>
      </trib>
    </valores>
  </infDPS>
</DPS>`;

export const NATIONAL_DPS_1_01 = NATIONAL_DPS_1_00
  .replace('versao="1.00"', 'versao="1.01"')
  .replace('<verAplic>1.00</verAplic>', '<verAplic>1.01</verAplic>')
  .replace('000000000009001"', '000000000009002"')
  .replace('9001</nDPS>', '9002</nDPS>');

export const NATIONAL_NFSE_1_00 = `<?xml version="1.0" encoding="UTF-8"?>
<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" versao="1.00">
  <infNFSe Id="NFS35503082104252011000110000000000000126050000000010">
    <xLocEmi>Sao Paulo</xLocEmi>
    <xLocPrestacao>Sao Paulo</xLocPrestacao>
    <nNFSe>1</nNFSe>
    <xTribNac>Consultoria em processos tributarios</xTribNac>
    <verAplic>1.00</verAplic>
    <ambGer>2</ambGer>
    <tpEmis>1</tpEmis>
    <cStat>100</cStat>
    <dhProc>2026-05-29T13:05:00+00:00</dhProc>
    <nDFSe>1</nDFSe>
    <emit>
      <CNPJ>04252011000110</CNPJ>
      <xNome>Prestador Nacional</xNome>
      <enderNac>
        <xLgr>Rua Fiscal</xLgr>
        <nro>100</nro>
        <xBairro>Centro</xBairro>
        <cMun>3550308</cMun>
        <UF>SP</UF>
        <CEP>01001000</CEP>
      </enderNac>
    </emit>
    <valores>
      <vLiq>100.00</vLiq>
    </valores>
    <DPS versao="1.00">
      <infDPS Id="DPS355030810425201100011000001000000000009001">
        <tpAmb>2</tpAmb>
        <dhEmi>2026-05-29T13:00:00+00:00</dhEmi>
        <verAplic>1.00</verAplic>
        <serie>00001</serie>
        <nDPS>9001</nDPS>
        <dCompet>2026-05-29</dCompet>
        <tpEmit>1</tpEmit>
        <cLocEmi>3550308</cLocEmi>
        <prest>
          <CNPJ>04252011000110</CNPJ>
          <xNome>Prestador Nacional</xNome>
          <regTrib>
            <opSimpNac>1</opSimpNac>
            <regEspTrib>0</regEspTrib>
          </regTrib>
        </prest>
        <toma>
          <CPF>52998224725</CPF>
          <xNome>Tomador Nacional</xNome>
        </toma>
        <serv>
          <locPrest>
            <cLocPrestacao>3550308</cLocPrestacao>
          </locPrest>
          <cServ>
            <cTribNac>010101</cTribNac>
            <xDescServ>Consultoria tributaria</xDescServ>
          </cServ>
        </serv>
        <valores>
          <vServPrest>
            <vServ>100.00</vServ>
          </vServPrest>
          <trib>
            <tribMun>
              <tribISSQN>1</tribISSQN>
              <tpRetISSQN>1</tpRetISSQN>
            </tribMun>
            <totTrib>
              <indTotTrib>0</indTotTrib>
            </totTrib>
          </trib>
        </valores>
      </infDPS>
    </DPS>
  </infNFSe>
  <ds:Signature>
    <ds:SignedInfo>
      <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      <ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
      <ds:Reference URI="#NFS35503082104252011000110000000000000126050000000010">
        <ds:Transforms>
          <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
          <ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
        </ds:Transforms>
        <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
        <ds:DigestValue>AA==</ds:DigestValue>
      </ds:Reference>
    </ds:SignedInfo>
    <ds:SignatureValue>AA==</ds:SignatureValue>
    <ds:KeyInfo>
      <ds:X509Data>
        <ds:X509Certificate>AA==</ds:X509Certificate>
      </ds:X509Data>
    </ds:KeyInfo>
  </ds:Signature>
</NFSe>`;

export const NATIONAL_NFSE_1_01 = NATIONAL_NFSE_1_00
  .replaceAll('versao="1.00"', 'versao="1.01"')
  .replaceAll('<verAplic>1.00</verAplic>', '<verAplic>1.01</verAplic>')
  .replace('NFS35503082104252011000110000000000000126050000000010', 'NFS35503082104252011000110000000000000226050000000020')
  .replace('<nNFSe>1</nNFSe>', '<nNFSe>2</nNFSe>')
  .replace('000000000009001"', '000000000009002"')
  .replaceAll('9001</nDPS>', '9002</nDPS>');
