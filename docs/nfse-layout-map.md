# Mapa de layouts XML fiscais

Data de referência: 2026-08-17.

Este documento organiza a cobertura por família estrutural de XML, não por município ou fornecedor. O aplicativo é um analisador local e não substitui a validação oficial do documento contra seu XSD e regras de autorização.

## Estados de cobertura

- **Coberto**: reconhecido e exercitado por teste automatizado para os campos relevantes.
- **Parcial**: a estrutura é reconhecida, mas existe diferença semântica, falta validação de versão ou faltam fixtures oficiais completas.
- **Rejeitado por projeto**: não representa uma nota emitida ou contém mais documentos do que o fluxo atual aceita.
- **Não suportado**: exige um perfil de layout explícito antes de qualquer extração.

## Famílias oficiais

### Sistema Nacional NFS-e

O pacote de produção `NFSe-ESQUEMAS_XSD-v1.01-20260209` publica esquemas 1.00 e 1.01 para documentos distintos:

- `DPS` / `infDPS`: Declaração de Prestação de Serviços.
- `NFSe` / `infNFSe`: Nota Fiscal de Serviços Eletrônica emitida.
- `pedRegEvento` e `evento`: pedido e registro de evento, não notas fiscais.

Todos usam o namespace `http://www.sped.fazenda.gov.br/nfse`. Namespace igual, portanto, não significa que os documentos tenham a mesma natureza.

Na referência desta pesquisa, o portal RTC informa que o leiaute disponível em produção usa a base da NT004 com a evolução aplicável da NT007. A NT009 e seus anexos estavam publicados, mas ainda sem implantação em produção em agosto de 2026.

### ABRASF

A biblioteca oficial mantém as versões 1.00, 2.00, 2.01, 2.02, 2.03 e 2.04. O namespace esperado pelo parser atual é `http://www.abrasf.org.br/nfse.xsd`.

O parser registra o atributo de versão quando presente e aceita apenas assinaturas estruturais explícitas. As regressões atuais exercitam as famílias 1.x e 2.x com fixtures 1.00 e 2.04; isso não equivale a validar todos os municípios ou todas as versões apenas porque compartilham namespace ou nomes de tags.

## Matriz de reconhecimento

| Identificador proposto | Assinatura estrutural | Natureza | Cobertura atual | Decisão |
| --- | --- | --- | --- | --- |
| `NFE_55` | `NFe` ou `nfeProc`, namespace NF-e, `ide/mod=55` | Nota emitida | Coberto | Manter |
| `NFCE_65` | `NFe` ou `nfeProc`, namespace NF-e, `ide/mod=65` | Nota emitida | Coberto | Manter |
| `NFSE_NATIONAL_DPS` | raiz `DPS`, namespace nacional, filho direto `infDPS` | Declaração anterior à NFS-e | Coberto semanticamente | Manter pendente e exibir o papel definido por `tpEmit` |
| `NFSE_NATIONAL_ISSUED` | raiz `NFSe`, namespace nacional, filho direto `infNFSe`; pode conter `DPS/infDPS` | Nota emitida | Coberto estruturalmente; versões 1.00 e 1.01 exercitadas | Manter cobertura de campos IBS/CBS por amostra real |
| `NFSE_NATIONAL_EVENT` | raiz `pedRegEvento` ou `evento` | Evento fiscal | Rejeitado por projeto | Continuar fora do fluxo de notas |
| `NFSE_ABRASF_DIRECT` | raiz `Nfse`, namespace ABRASF, filho direto `InfNfse` | Nota emitida | Coberto com fixture 1.00 | Manter leitura versionada sem código por município |
| `NFSE_ABRASF_COMP` | `CompNfse/Nfse/InfNfse` em documento com namespace ABRASF | Nota emitida encapsulada | Coberto com fixture 2.04 | Manter limite de uma nota por arquivo |
| `NFSE_ABRASF_RESPONSE_SINGLE` | respostas ABRASF catalogadas com exatamente um `CompNfse/Nfse/InfNfse` | Resposta contendo uma nota | Coberto com `ConsultarNfseResposta` 1.00 e `ConsultarNfseRpsResposta`, `ConsultarLoteRpsResposta`, `ConsultarNfseServicoPrestadoResposta`, `ConsultarNfseServicoTomadoResposta`, `ConsultarNfseFaixaResposta`, `GerarNfseResposta` e `EnviarLoteRpsSincronoResposta` 2.04 | Adicionar novos envelopes somente com perfil explícito e fixture |
| `NFSE_ABRASF_RESPONSE_BATCH` | resposta ABRASF com mais de uma `Nfse` | Lote de notas emitidas | Rejeitado por projeto | Exigir separação ou criar processamento de lote em mudança própria |
| `ABRASF_RPS_REQUEST` | `Rps/InfRps`, `GerarNfseEnvio` ou `EnviarLoteRpsEnvio` sem `Nfse/InfNfse` | Solicitação, não nota emitida | Rejeitado por projeto | Não classificar como NFS-e |
| `SOAP_WRAPPED_FISCAL_XML` | raiz `Envelope` SOAP e payload fiscal em `Body` | Transporte | Não suportado | Desencapsular somente por perfil explícito e com fixture real |
| `MUNICIPAL_PROPRIETARY` | namespace próprio, namespace ausente ou hierarquia não oficial | Variação municipal | Não suportado | Criar adaptador apenas quando houver demanda e amostra real |

## Campos cobertos por família

| Família | Número e data | Prestador e tomador | Serviço | IBS/CBS | Observação |
| --- | --- | --- | --- | --- | --- |
| Nacional emitida | `nNFSe`, `dhEmi`, `dhEmis`, `DataEmissao`, `dEmi` | `emit`/`infEmit` e `toma`/`infToma`, inclusive dentro de DPS | `serv`, `xDescServ`, `cTribNac`, `cNBS` | Classificação na DPS e cálculos na NFS-e | Há testes de emissão, serviço, valores e redução |
| DPS nacional | `nDPS` e `dhEmi` | `prest`, `toma` e `interm`, com foco definido por `tpEmit` | `serv/xDescServ` | Grupo da declaração pode ser lido | Mantém `docType=NFSe` para os filtros atuais, mas expõe `documentKind=DPS`, papel e situação pendente |
| ABRASF emitida | `Numero` e `DataEmissao` | `PrestadorServico`, `Prestador`, `TomadorServico`, `Tomador`, `CpfCnpj` e identificações aninhadas | `Servico/Discriminacao` e aliases já tratados | Busca estrutural genérica por `IBSCBS` | Fixtures 1.00 direta e 2.04 encapsulada cobrem os caminhos atuais |

## Lacunas encontradas

1. `DPS` e `NFSe` continuam na mesma família de `DocumentLayout`, mas o resultado agora expõe `documentKind` para preservar a diferença entre declaração e nota emitida.
2. A DPS agora interpreta `tpEmit` e não é mais apresentada como operação de saída validada da prestadora.
3. A versão declarada agora é registrada para NF-e e para o padrão nacional; no ABRASF ela continua opcional quando não está presente no XML.
4. A cobertura ABRASF é baseada em assinaturas estruturais e fixtures sintéticas; a aplicação não valida o XML contra o XSD oficial.
5. As fixtures sanitizadas exercitam uma nota direta e uma resposta `ConsultarNfseResposta/ListaNfse/CompNfse` 1.00, além de respostas 2.04 por serviço prestado, serviço tomado, RPS, lote, faixa, geração e envio síncrono; elas não são evidência de aderência completa a todos os municípios.
6. Envelopes SOAP são rejeitados porque o reconhecedor exige que a raiz já pertença ao namespace fiscal.
7. Um XML ABRASF com múltiplas notas é rejeitado; o processamento atual produz um resultado por arquivo.
8. Quando a raiz fiscal é reconhecida, erros estruturais preservam a família e a versão declarada no painel e no relatório; formatos proprietários continuam genéricos por projeto.

## Prioridade de implementação

### P0 - Semântica correta

Implementado nesta etapa:

- `documentKind` separa `DPS` de `NFSE` no resultado, mantendo `docType=NFSe` para os filtros existentes.
- A UI e o relatório apresentam DPS como declaração, não como nota fiscal emitida.
- `tpEmit` define prestador, tomador ou intermediário como papel responsável e empresa em foco.
- A análise fiscal de DPS permanece pendente no nível documental, sem mascarar o `itemStatus` técnico.
- As amostras ABRASF usam respostas estruturalmente coerentes com `ListaNfse/CompNfse` e perfis explicitamente catalogados.

### P1 - Registro de perfil

Implementado nesta etapa:

- O resultado registra a versão declarada de NF-e e do padrão nacional; versões ABRASF continuam opcionais quando não estão presentes no XML.
- O relatório técnico exibe a versão junto da família do documento quando disponível.
- Erros estruturais preservam a família, o tipo e a versão declarada quando a raiz fiscal foi reconhecida.
- As fixtures sanitizadas `DPS` e `NFSe` 1.00 e 1.01 seguem as sequências obrigatórias dos XSD oficiais e foram validadas contra os esquemas correspondentes do pacote de referência; a assinatura é apenas estrutural e não tem validade criptográfica.

### P2 - ABRASF por estrutura

Implementado nesta etapa:

- Fixtures sanitizadas das famílias 1.x e 2.x, representadas por ABRASF 1.00 e 2.04.
- Reconhecimento explícito de `Nfse`, `CompNfse` e respostas ABRASF catalogadas.
- Cobertura de resposta com uma nota, identificação direta e identificação aninhada com `CpfCnpj`.
- Validação do namespace em `ListaNfse`, `CompNfse`, `Nfse` e `InfNfse`.
- Regressões para `ConsultarNfseFaixaResposta`, `GerarNfseResposta` e `EnviarLoteRpsSincronoResposta`.
- Rejeição de raízes ABRASF não catalogadas e de respostas com mais de uma nota.
- Nenhum código específico por município foi adicionado.

O script `scripts/validate-abrasf-schemas.ps1` valida a resposta 1.00 contra uma cópia temporária com o namespace corrigido e as respostas 2.04 contra uma cópia temporária com as restrições incompatíveis removidas. Isso é um diagnóstico de compatibilidade do material de referência, não uma validação executada pelo analisador.

### P3 - Demanda observada

- Adicionar envelope SOAP ou perfil proprietário somente quando um XML real rejeitado demonstrar necessidade.
- Registrar a assinatura desconhecida sem tentar adivinhar prestador, tomador ou situação fiscal.

## Critérios para aceitar um novo perfil

Um perfil novo precisa ter:

1. XML sanitizado que preserve namespace, raiz, versão e hierarquia.
2. Contrato esperado para número, data, prestador, tomador e descrição do serviço.
3. Caso negativo que prove que outro CNPJ do XML não será escolhido por engano.
4. Teste de documento incompleto e mensagem de integridade correspondente.
5. `npm run check` e `npm run test:volume` aprovados.

## Fontes oficiais

- Sistema Nacional, documentação atual de produção: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/documentacao-atual
- Sistema Nacional, documentação RTC: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/rtc
- ABRASF, versões e artefatos públicos: https://abrasf.org.br/biblioteca/arquivos-publicos/nfs-e
