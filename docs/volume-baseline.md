# Baseline de homologação de volume

Data da medição: 2026-08-18.

Revisão funcional: `3be45fb`.

## Cenário

O comando `npm run test:volume` gera um ZIP determinístico com 5.000 XMLs a partir das amostras versionadas. O cenário exercita:

- processamento e progresso do lote;
- cancelamento durante o processamento;
- mistura de NF-e, NFC-e e NFS-e;
- nomes de arquivos extensos e documento com múltiplos itens;
- agrupamento por empresa e paginação de 100 notas;
- expansão de acordeão e busca por número de nota;
- geração e integridade estrutural do relatório XLSX.

O cenário é sintético e serve como regressão de escala. Ele não substitui a validação com arquivos reais de uma operação.

## Resultado registrado

Ambiente local: Windows, Node.js `v24.19.0`, npm `11.17.0` e Deno `2.7.14`.

| Métrica | Resultado |
| --- | ---: |
| ZIP gerado | 10,9 MB em 293,5 ms |
| Cancelamento | 52,6 ms |
| Processamento dos 5.000 XMLs | 955,9 ms |
| Renderização inicial | 12,9 ms |
| Primeira expansão | 100,9 ms |
| Segunda página | 59,7 ms |
| Filtro | 2,6 ms |
| Relatório XLSX | 260,7 ms |
| Tamanho do relatório | 0,5 MB |
| Variação de heap observada | 109,5 MB |

Resultado do teste: `1/1` cenário aprovado, sem erros de processamento.

## Critérios atuais

- Processamento e geração do relatório devem permanecer abaixo de 60 segundos.
- Renderização, expansão, paginação e filtro devem permanecer abaixo de 5 segundos.
- Os 5.000 resultados devem ser preservados, agrupados e filtráveis.
- A variação de heap é registrada como observação, mas ainda não possui um limite rígido porque a API de memória do navegador pode não estar disponível em todos os ambientes.

## Decisão

Os números atuais não justificam introduzir Web Worker ou virtualização. Esses mecanismos devem voltar à pauta somente se o cenário real ou uma regressão ultrapassar os critérios acima, ou se a variação de heap crescer de forma consistente.

Qualquer alteração em `src/utils/fileProcessing.ts`, `src/utils/nfeParser.ts`, `src/components/ResultsTable.tsx`, `src/components/results/ResultsFilters.tsx`, `src/components/results/ResultNotes.tsx`, `src/utils/analysisReport.ts` ou `src/utils/analysisReportXlsx.ts` deve executar novamente `npm run test:volume` e atualizar este registro quando o baseline mudar de forma relevante.
