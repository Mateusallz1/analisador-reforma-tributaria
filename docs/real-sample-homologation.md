# Homologação com amostras reais anonimizadas

## Primeira amostra

Em 2026-08-18 foram catalogados XMLs reais locais sem copiar os originais para o repositório. A primeira amostra agora confirma:

- 25 documentos NF-e modelo 55;
- 18 documentos NFC-e modelo 65;
- 1 NFS-e ABRASF em resposta `ConsultarNfseResposta`, rejeitada por ausência de namespace/perfil estrutural;
- 113 itens/serviços aceitos;
- 15 documentos aceitos com grupo `IBSCBS`;
- nenhum erro de leitura XML.

As cópias em `tests/fixtures/real-nfe`, `tests/fixtures/nfce-real` e `tests/fixtures/nfse-real` foram geradas pelo script `scripts/sanitize-real-nfe-fixtures.ps1`. O processo redige CNPJ, CPF, nomes, endereços, produtos, contatos, informações adicionais, chaves, protocolos, assinaturas, observações e datas operacionais. Os XMLs originais permanecem fora do repositório.

Para substituir fixtures existentes, use `-Force`. O script nunca remove XMLs que não tenham o padrão `sample-<número>.xml` e recusa uma pasta de saída que contenha outros XMLs.

## Cobertura do teste

O comando abaixo usa `processFiles`, o mesmo pipeline usado pela aplicação:

```bash
npm run test:real
```

O teste valida reconhecimento separado de NF-e e NFC-e, quantidade de documentos e itens/serviços, presença de `IBSCBS`, a rejeição explícita da NFS-e sem perfil estrutural e o uso da versão esperada da base fiscal.

Como chaves de acesso, protocolos e assinaturas foram anonimizados, esta etapa não usa o status de autorização como evidência. Ela valida o comportamento do parser e da análise diante de estruturas reais preservadas.

## Lacunas

A fixture ABRASF atual cobre somente a resposta `ConsultarNfseResposta` disponível em `src/data/202300550.xml`, mas ela não possui namespace nem versão declarada e permanece fora dos resultados. Para aceitá-la, será necessário identificar o provedor/leiaute e criar um perfil estrutural explícito com amostra e schema correspondentes.
