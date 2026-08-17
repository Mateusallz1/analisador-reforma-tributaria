export const ABRASF_NFSE_1_00_DIRECT = `<?xml version="1.0" encoding="UTF-8"?>
<Nfse xmlns="http://www.abrasf.org.br/nfse.xsd">
  <InfNfse Id="NFSE1001" versao="1.00">
    <Numero>1001</Numero>
    <CodigoVerificacao>ABC1001</CodigoVerificacao>
    <DataEmissao>2026-08-14T09:30:00</DataEmissao>
    <PrestadorServico>
      <IdentificacaoPrestador>
        <Cnpj>04252011000110</Cnpj>
        <InscricaoMunicipal>123456</InscricaoMunicipal>
      </IdentificacaoPrestador>
      <RazaoSocial>Prestador ABRASF 1</RazaoSocial>
    </PrestadorServico>
    <TomadorServico>
      <IdentificacaoTomador>
        <CpfCnpj>
          <Cnpj>11222333000144</Cnpj>
        </CpfCnpj>
      </IdentificacaoTomador>
      <RazaoSocial>Tomador ABRASF 1</RazaoSocial>
    </TomadorServico>
    <Servico>
      <Valores>
        <ValorServicos>100.00</ValorServicos>
      </Valores>
      <ItemListaServico>0101</ItemListaServico>
      <Discriminacao>Consultoria tributaria ABRASF 1</Discriminacao>
      <CodigoMunicipio>3550308</CodigoMunicipio>
    </Servico>
  </InfNfse>
</Nfse>`;

export const ABRASF_NFSE_1_00_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarNfseResposta xmlns="http://www.abrasf.org.br/nfse.xsd">
  <ListaNfse>
    <CompNfse>
      <Nfse versao="1.00">
        <InfNfse Id="NFSE1002">
          <Numero>1002</Numero>
          <CodigoVerificacao>ABC1002</CodigoVerificacao>
          <DataEmissao>2026-08-14T09:30:00</DataEmissao>
          <NaturezaOperacao>1</NaturezaOperacao>
          <OptanteSimplesNacional>2</OptanteSimplesNacional>
          <IncentivadorCultural>2</IncentivadorCultural>
          <Competencia>2026-08-14T09:30:00</Competencia>
          <Servico>
            <Valores>
              <ValorServicos>100.00</ValorServicos>
              <IssRetido>2</IssRetido>
            </Valores>
            <ItemListaServico>0101</ItemListaServico>
            <Discriminacao>Consultoria tributaria ABRASF 1 resposta</Discriminacao>
            <CodigoMunicipio>3550308</CodigoMunicipio>
          </Servico>
          <PrestadorServico>
            <IdentificacaoPrestador>
              <Cnpj>04252011000110</Cnpj>
            </IdentificacaoPrestador>
            <RazaoSocial>Prestador ABRASF 1 resposta</RazaoSocial>
            <Endereco>
              <Endereco>Rua Oficial</Endereco>
              <Numero>100</Numero>
              <Bairro>Centro</Bairro>
              <CodigoMunicipio>3550308</CodigoMunicipio>
              <Uf>SP</Uf>
              <Cep>01001000</Cep>
            </Endereco>
          </PrestadorServico>
          <TomadorServico>
            <IdentificacaoTomador>
              <CpfCnpj>
                <Cnpj>11222333000144</Cnpj>
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>Tomador ABRASF 1 resposta</RazaoSocial>
          </TomadorServico>
          <OrgaoGerador>
            <CodigoMunicipio>3550308</CodigoMunicipio>
            <Uf>SP</Uf>
          </OrgaoGerador>
        </InfNfse>
        <dsig:Signature xmlns:dsig="http://www.w3.org/2000/09/xmldsig#">
          <dsig:SignedInfo>
            <dsig:CanonicalizationMethod Algorithm="urn:example:canonicalization" />
            <dsig:SignatureMethod Algorithm="urn:example:signature" />
            <dsig:Reference URI="#NFSE1002">
              <dsig:DigestMethod Algorithm="urn:example:digest" />
              <dsig:DigestValue>AQ==</dsig:DigestValue>
            </dsig:Reference>
          </dsig:SignedInfo>
          <dsig:SignatureValue>AQ==</dsig:SignatureValue>
        </dsig:Signature>
      </Nfse>
    </CompNfse>
  </ListaNfse>
</ConsultarNfseResposta>`;

export const ABRASF_NFSE_2_04_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarNfseServicoPrestadoResposta xmlns="http://www.abrasf.org.br/nfse.xsd">
  <ListaNfse>
    <CompNfse>
      <Nfse versao="2.04">
        <InfNfse Id="NFSE2041">
          <Numero>2041</Numero>
          <CodigoVerificacao>ABC2041</CodigoVerificacao>
          <DataEmissao>2026-08-15T14:30:00</DataEmissao>
          <ValoresNfse>
            <BaseCalculo>250.00</BaseCalculo>
            <ValorLiquidoNfse>250.00</ValorLiquidoNfse>
          </ValoresNfse>
          <PrestadorServico>
            <RazaoSocial>Prestador ABRASF 2</RazaoSocial>
            <Endereco>
              <Endereco>Rua Oficial</Endereco>
              <Numero>100</Numero>
              <Bairro>Centro</Bairro>
              <CodigoMunicipio>3550308</CodigoMunicipio>
              <Uf>SP</Uf>
              <Cep>01001000</Cep>
            </Endereco>
          </PrestadorServico>
          <OrgaoGerador>
            <CodigoMunicipio>3550308</CodigoMunicipio>
            <Uf>SP</Uf>
          </OrgaoGerador>
          <DeclaracaoPrestacaoServico>
            <InfDeclaracaoPrestacaoServico>
              <Rps>
                <IdentificacaoRps>
                  <Numero>7001</Numero>
                  <Serie>A</Serie>
                  <Tipo>1</Tipo>
                </IdentificacaoRps>
                <DataEmissao>2026-08-15</DataEmissao>
                <Status>1</Status>
              </Rps>
              <Competencia>2026-08-15</Competencia>
              <Servico>
                <Valores>
                  <ValorServicos>250.00</ValorServicos>
                </Valores>
                <IssRetido>2</IssRetido>
                <ItemListaServico>01.01</ItemListaServico>
                <Discriminacao>Consultoria tributaria ABRASF 2</Discriminacao>
                <CodigoMunicipio>3550308</CodigoMunicipio>
                <ExigibilidadeISS>1</ExigibilidadeISS>
              </Servico>
              <Prestador>
                <CpfCnpj>
                  <Cnpj>55666777000188</Cnpj>
                </CpfCnpj>
              </Prestador>
              <TomadorServico>
                <IdentificacaoTomador>
                  <CpfCnpj>
                    <Cpf>52998224725</Cpf>
                  </CpfCnpj>
                </IdentificacaoTomador>
                <RazaoSocial>Tomador ABRASF 2</RazaoSocial>
              </TomadorServico>
              <OptanteSimplesNacional>2</OptanteSimplesNacional>
              <IncentivoFiscal>2</IncentivoFiscal>
            </InfDeclaracaoPrestacaoServico>
          </DeclaracaoPrestacaoServico>
        </InfNfse>
      </Nfse>
    </CompNfse>
    <Pagina>1</Pagina>
  </ListaNfse>
</ConsultarNfseServicoPrestadoResposta>`;

export const ABRASF_NFSE_2_04_BY_RPS_RESPONSE = ABRASF_NFSE_2_04_RESPONSE
  .replace(
    '<ConsultarNfseServicoPrestadoResposta xmlns="http://www.abrasf.org.br/nfse.xsd">\n  <ListaNfse>\n    <CompNfse>',
    '<ConsultarNfseRpsResposta xmlns="http://www.abrasf.org.br/nfse.xsd">\n    <CompNfse>',
  )
  .replace(
    '</CompNfse>\n    <Pagina>1</Pagina>\n  </ListaNfse>\n</ConsultarNfseServicoPrestadoResposta>',
    '</CompNfse>\n</ConsultarNfseRpsResposta>',
  );

export const ABRASF_NFSE_2_04_LOTE_RESPONSE = ABRASF_NFSE_2_04_RESPONSE
  .replace('<ConsultarNfseServicoPrestadoResposta', '<ConsultarLoteRpsResposta')
  .replace('<ListaNfse>', '<Situacao>2</Situacao>\n  <ListaNfse>')
  .replace('    <Pagina>1</Pagina>\n', '')
  .replace('</ConsultarNfseServicoPrestadoResposta>', '</ConsultarLoteRpsResposta>');

export const ABRASF_NFSE_2_04_FAIXA_RESPONSE = ABRASF_NFSE_2_04_RESPONSE
  .replaceAll('ConsultarNfseServicoPrestadoResposta', 'ConsultarNfseFaixaResposta');

export const ABRASF_NFSE_2_04_TOMADO_RESPONSE = ABRASF_NFSE_2_04_RESPONSE
  .replaceAll('ConsultarNfseServicoPrestadoResposta', 'ConsultarNfseServicoTomadoResposta');

export const ABRASF_NFSE_2_04_GERAR_RESPONSE = ABRASF_NFSE_2_04_RESPONSE
  .replaceAll('ConsultarNfseServicoPrestadoResposta', 'GerarNfseResposta')
  .replace('    <Pagina>1</Pagina>\n', '');

export const ABRASF_NFSE_2_04_SINCRONO_RESPONSE = ABRASF_NFSE_2_04_RESPONSE
  .replaceAll('ConsultarNfseServicoPrestadoResposta', 'EnviarLoteRpsSincronoResposta')
  .replace('    <Pagina>1</Pagina>\n', '');
