# Homologação com amostras reais anonimizadas

## Primeira amostra

Em 2026-08-18 foram catalogados XMLs reais locais sem copiar os originais para o repositório. A primeira amostra agora confirma:

- 25 documentos NF-e modelo 55;
- 18 documentos NFC-e modelo 65;
- 1 NFS-e ABRASF em resposta `ConsultarNfseResposta`, aceita pelo perfil sem namespace explícito;
- 1 NFS-e padrão nacional emitida, com classificação válida e conforme;
- 115 itens/serviços aceitos;
- 17 documentos aceitos com grupo `IBSCBS`;
- nenhum erro de leitura XML.

As cópias em `tests/fixtures/real-nfe`, `tests/fixtures/nfce-real`, `tests/fixtures/nfse-real` e `tests/fixtures/nfse-national-real` foram geradas pelo script `scripts/sanitize-real-nfe-fixtures.ps1`. O processo redige CNPJ, CPF, nomes, endereços, produtos, contatos, informações adicionais, chaves, protocolos, certificados X.509, assinaturas, observações e datas operacionais. Os XMLs originais permanecem fora do repositório.

O teste real também exige CNPJ/CPF no padrão sintético da homologação e valores de assinatura com tokens de sanitização.

Para substituir fixtures existentes, use `-Force`. O script nunca remove XMLs que não tenham o padrão `sample-<número>.xml` e recusa uma pasta de saída que contenha outros XMLs.

## Cobertura do teste

O comando abaixo usa `processFiles`, o mesmo pipeline usado pela aplicação:

```bash
npm run test:real
```

O teste valida reconhecimento separado de NF-e, NFC-e, ABRASF sem namespace e NFS-e nacional emitida, quantidade de documentos e itens/serviços, presença de `IBSCBS`, ausência de erros de processamento e uso da versão esperada da base fiscal.

Como chaves de acesso, protocolos e assinaturas foram anonimizados, esta etapa não usa o status de autorização como evidência. Ela valida o comportamento do parser e da análise diante de estruturas reais preservadas.

## Lacunas

A fixture ABRASF atual cobre somente uma resposta `ConsultarNfseResposta` recebida localmente. O XML original não é versionado; sua identificação de proveniência é o SHA-256 `3036fbb96049af554eedaf85465e387dff7cd31fe89686762d1f6fbdb6f56c83`. Como ela não possui namespace nem versão declarada, o parser aceita apenas a assinatura estrutural exata desse envelope; outros XMLs sem namespace continuam rejeitados.
