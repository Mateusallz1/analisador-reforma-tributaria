# Analisador da Reforma Tributaria

Analisador local de IBS/CBS para documentos fiscais eletrônicos, com suporte a arquivos XML individuais e pacotes ZIP.

## Executar localmente com Deno

**Pre-requisito:** Deno 2.x.

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
deno task build    # build de producao em dist/
deno task test     # testes da engine fiscal em browser headless
deno task test:volume # homologacao com 5.000 XMLs em browser headless
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

A suite de engine fiscal roda em um navegador headless via Vite para exercitar o mesmo `DOMParser` usado pela aplicação em produção. Ela cobre parsing das amostras, status por item, KPIs e agrupamento por empresa em foco.

```bash
deno task test
# ou
npm run test
```

Pre-requisito adicional: Chrome ou Edge instalado. Se o navegador estiver em um caminho não padrão, defina `CHROME_PATH` apontando para o executável.

### Homologacao de volume

O teste de volume gera um ZIP deterministico com 5.000 XMLs e valida processamento, agrupamento por empresa, paginacao, filtros e tempos de interacao:

```bash
deno task test:volume
# ou
npm run test:volume
```

O workflow de CI executa essa homologacao separadamente depois do gate principal para que uma regressao de escala seja identificada sem misturar seu diagnostico com os testes funcionais.

## Configuracao

O processamento roda localmente no navegador. Nenhuma variável de ambiente é necessária para analisar XMLs ou ZIPs.

## Deploy em Vercel

O projeto esta preparado para hospedagem estatica na Vercel:

- Framework: `Vite`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Variaveis de ambiente: nenhuma

Para criar um preview a partir da raiz do projeto:

```bash
npx vercel
```

Depois de validar o preview, o deploy de producao pode ser executado com:

```bash
npx vercel --prod
```

O deploy deve ser feito somente depois que `npm run check` passar localmente e a CI estiver verde.

## Atualizacao da base fiscal

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

