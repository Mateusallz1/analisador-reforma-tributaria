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
## Configuracao

O processamento roda localmente no navegador. Nenhuma variável de ambiente é necessária para analisar XMLs ou ZIPs.

