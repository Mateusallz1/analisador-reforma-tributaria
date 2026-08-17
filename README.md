# Analisador da Reforma Tributária

[![CI](https://github.com/Mateusallz1/analisador-reforma-tributaria/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Mateusallz1/analisador-reforma-tributaria/actions/workflows/ci.yml)

Analisador local de IBS/CBS para documentos fiscais eletrônicos, com suporte a arquivos XML individuais e pacotes ZIP.

O analisador reconhece NF-e, NFC-e, NFS-e padrão nacional e NFS-e ABRASF. Para ABRASF, a cobertura estrutural atual inclui respostas das famílias 1.00 e 2.04; o aplicativo não substitui a validação oficial do documento nem a autorização municipal.

## Executar localmente com Deno

**Pré-requisito:** Deno 2.x.

1. Instale/cacheie as dependências npm declaradas no projeto:

   ```bash
   deno install
   ```

2. Inicie o servidor de desenvolvimento:

   ```bash
   deno task dev
   ```

3. Acesse:

   ```text
   http://localhost:3000
   ```

## Comandos Deno

```bash
deno task dev      # servidor Vite local
deno task lint     # TypeScript sem emitir arquivos
deno task build    # build de produção em dist/
deno task test     # testes da engine fiscal em browser headless
deno task test:volume # homologação com 5.000 XMLs em browser headless
deno task check    # lint + test + build
deno task preview  # preview do build
deno task clean    # remove dist/ e server.js
```

## Alternativa com Node.js/npm

O fluxo npm continua suportado para compatibilidade:

```bash
npm install
npm run dev
npm run lint
npm run test
npm run test:volume
npm run build
npm run check
```

## Testes

A suíte da engine fiscal roda em um navegador headless via Vite para exercitar o mesmo `DOMParser` usado pela aplicação em produção. Ela cobre parsing das amostras, status por item, KPIs e agrupamento por empresa em foco.

```bash
deno task test
# ou
npm run test
```

Pré-requisito adicional: Chrome ou Edge instalado. Se o navegador estiver em um caminho não padrão, defina `CHROME_PATH` apontando para o executável.

### Homologação de volume

O teste de volume gera um ZIP determinístico com 5.000 XMLs e valida processamento, agrupamento por empresa, paginação, filtros e tempos de interação:

```bash
deno task test:volume
# ou
npm run test:volume
```

O workflow de CI executa essa homologação separadamente depois do gate principal para que uma regressão de escala seja identificada sem misturar seu diagnóstico com os testes funcionais.

## Configuração

O processamento roda localmente no navegador. Nenhuma variável de ambiente é necessária para analisar XMLs ou ZIPs.

## Publicação

A aplicação é publicada automaticamente no GitHub Pages após um push aprovado na `main`:

```text
https://mateusallz1.github.io/analisador-reforma-tributaria/
```

O CI executa lint, testes funcionais, testes móveis, build e homologação com 5.000 XMLs antes da publicação.

### Deploy em Vercel

O projeto também está preparado para hospedagem estática na Vercel:

- Framework: `Vite`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Variáveis de ambiente: nenhuma

Para criar um preview a partir da raiz do projeto:

```bash
npx vercel
```

Depois de validar o preview, o deploy de produção pode ser executado com:

```bash
npx vercel --prod
```

O deploy deve ser feito somente depois que `npm run check` passar localmente e a CI estiver verde.

## Atualização da base fiscal

A planilha oficial CST/cClassTrib pode ser convertida para o contrato JSON usado pelo analisador com o script versionado:

```powershell
.\scripts\convert-cclass-base.ps1 `
  -InputPath 'src\data\cClassTrib 2026-06-22.xlsx' `
  -OutputPath 'src\data\base_completa.json' `
  -ComparePath 'src\data\base_completa.json' `
  -Version '1.1.0' `
  -ReferenceDate '2026-06-22' `
  -PublicationDate '2026-06-23' `
  -TechnicalVersion 'IT 2025.002 v1.60' `
  -TechnicalSource 'https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=jxTMMQeEVM8%3D'
```

O conversor preserva os campos consumidos pela aplicação e informa CSTs e classificações adicionados, removidos ou alterados antes de gravar a nova base. Depois da conversão, execute `npm run check` e `npm run test:volume`.

## Validação local dos schemas ABRASF

Os schemas ABRASF mantidos em `src/data` podem ser verificados localmente, fora do fluxo principal de CI. O comando usa `jjs`/Nashorn, preserva os arquivos originais e normaliza somente cópias temporárias: o namespace inconsistente do schema v1 e as restrições incompatíveis do schema v2.04:

```powershell
.\scripts\validate-abrasf-schemas.ps1
```

Pré-requisitos no Windows: JRE 8 com `jjs` disponível no `PATH` ou em `JAVA_HOME`, além dos XSD nos caminhos esperados em `src/data`. As fixtures 1.00 e 2.04 devem passar nas cópias diagnósticas; falhas de compilação dos schemas originais são reportadas separadamente. O script não baixa nem altera os XSD.

