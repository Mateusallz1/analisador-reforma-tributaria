# Inventário de fontes fiscais

## Fonte operacional atual

| Fonte | Uso | Estado |
| --- | --- | --- |
| `src/data/base_completa.json` | Consulta de CST e cClassTrib durante a análise | Em produção |
| `src/data/cClassTrib 2026-06-22.xlsx` | Planilha de origem da base convertida | Referência versionada |

`base_completa.json` registra a versão, a data de referência, a fonte oficial da tabela, a fonte técnica e a base legal. O fluxo atual usa essa base para validar a classificação tributária dos itens.

## Fonte recebida para crédito presumido

O arquivo local `src/data/cCredPres_2026-06-22.xlsx` contém uma tabela diferente da cClassTrib:

- 13 regras de crédito presumido na aba visível `cCredPres`;
- artigos correspondentes da LC 214/2025;
- flags de apropriação por nota e por evento;
- indicadores de IBS, CBS e dedução;
- alíquotas, fórmulas, cClass referenciada e datas de vigência;
- uma aba oculta `Planilha2` com campos de cálculo e impedimentos.

## Decisão de escopo

Essa fonte não será incorporada ao runtime nesta etapa. O analisador atual não extrai nem valida os grupos XML específicos de crédito presumido, e seus contratos de resultado, indicadores e relatório foram desenhados para classificação cClassTrib e conformidade IBS/CBS.

Tratar uma linha de `cCredPres` como regra aplicável sem identificar o grupo fiscal correspondente poderia produzir um diagnóstico aparentemente preciso, mas sem evidência suficiente no XML. Por isso, o XLSX permanece não rastreado e não altera os resultados atuais.

## Pré-requisitos para uma integração futura

1. Registrar a URL oficial, a versão técnica e a data de publicação da planilha.
2. Definir os grupos XML e eventos aceitos para cada regra de crédito presumido.
3. Criar um contrato separado para crédito presumido, sem misturar seus estados com `itemStatus` de cClassTrib.
4. Converter a fonte para JSON versionado somente após definir o esquema e o tratamento de vigência.
5. Adicionar fixtures reais ou oficialmente documentadas, testes de cálculo e uma seção específica no relatório.
