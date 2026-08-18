# Homologação com amostras reais anonimizadas

## Primeira amostra

Em 2026-08-18 foram catalogados 25 XMLs reais locais sem copiar os originais para o repositório. A análise estrutural confirmou:

- 25 documentos XML válidos;
- 25 documentos NF-e modelo 55;
- 62 itens;
- 9 documentos com grupo `IBSCBS`;
- nenhum erro de leitura XML.

As cópias em `tests/fixtures/real-nfe` foram geradas pelo script `scripts/sanitize-real-nfe-fixtures.ps1`. O processo redige CNPJ, CPF, nomes, endereços, produtos, contatos, informações adicionais, chaves, protocolos, assinaturas, observações e datas operacionais. Os XMLs originais permanecem fora do repositório.

Para substituir fixtures existentes, use `-Force`. O script nunca remove XMLs que não tenham o padrão `sample-<número>.xml` e recusa uma pasta de saída que contenha outros XMLs.

## Cobertura do teste

O comando abaixo usa `processFiles`, o mesmo pipeline usado pela aplicação:

```bash
npm run test:real
```

O teste valida reconhecimento do layout, quantidade de documentos e itens, presença de `IBSCBS`, ausência de erros de processamento e uso da versão esperada da base fiscal.

Como chaves de acesso, protocolos e assinaturas foram anonimizados, esta etapa não usa o status de autorização como evidência. Ela valida o comportamento do parser e da análise diante de estruturas reais preservadas.

## Lacunas

Esta primeira amostra não contém NFS-e, NFC-e modelo 65 ou variações ABRASF. Esses casos precisam de amostras reais anonimizadas separadas antes de serem considerados cobertos pela homologação.
