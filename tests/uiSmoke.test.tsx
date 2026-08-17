import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import App, { type AppDependencies } from '../src/App.tsx';
import { NoteDetailPanel } from '../src/components/results/NoteDetailPanel.tsx';
import ResultsTable from '../src/components/ResultsTable.tsx';
import { SAMPLE_NFES } from '../src/data/samples.ts';
import { parseNFeXml } from '../src/utils/nfeParser.ts';
import { downloadBlob } from '../src/utils/analysisReportXlsx.ts';
import type { AnalysisReport } from '../src/utils/analysisReport.ts';
import type { NFeAnalysis } from '../src/types.ts';
import { assert, assertEquals } from './assertions.ts';
import type { TestCaseResult } from './engine.test.ts';

interface UiTestCase {
  name: string;
  run: () => void | Promise<void>;
}

function parseSamples(): NFeAnalysis[] {
  return SAMPLE_NFES.map((sample) => parseNFeXml(sample.xmlContent, sample.fileName));
}

function renderResultsTable(results = parseSamples()) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  flushSync(() => {
    root.render(<ResultsTable allResults={results} />);
  });

  return { container, root };
}

function createLongContentResults(): NFeAnalysis[] {
  const sample = parseSamples()[0];
  const longCompanyName = 'Empresa de Operações Industriais e Distribuição de Equipamentos para a Reforma Tributária '.repeat(3).trim();
  const longProductDescription = 'Produto fiscal com descrição operacional extensa para validar a adaptação do detalhamento em telas estreitas '.repeat(3).trim();

  return [{
    ...sample,
    id: `${sample.id}-long-content`,
    fileName: `documento-fiscal-${'com-nome-extenso-'.repeat(8)}.xml`,
    nomeEmitente: longCompanyName,
    nomeDestinatario: longCompanyName,
    empresaFoco: { ...sample.empresaFoco, nome: longCompanyName },
    itens: sample.itens?.map((item) => ({ ...item, descricaoProduto: longProductDescription })),
  }];
}

function renderApp(dependencies?: AppDependencies) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  flushSync(() => {
    root.render(<App dependencies={dependencies} />);
  });

  return { container, root };
}

async function waitForUi(condition: () => boolean, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  assert(condition(), 'A interface não concluiu a atualização esperada no tempo limite');
}

function renderNoteDetail(note: NFeAnalysis) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  flushSync(() => {
    root.render(<NoteDetailPanel note={note} onClose={() => undefined} />);
  });

  return { container, root };
}

const tests: UiTestCase[] = [
  {
    name: 'UI replica a moldura do scanner sem remover ações locais',
    run: () => {
      const { container, root } = renderApp();

      try {
        assert(
          container.textContent?.includes('Analisador da Reforma Tributária'),
          'Título do produto não foi renderizado',
        );
        assert(container.querySelector('#drop-zone'), 'Área de upload não foi renderizada');
        assert(container.querySelector('#btn-load-samples'), 'Ação de amostras não foi preservada');
        assert(
          container.querySelector('button[aria-label="Ir para o scanner"]'),
          'Navegação para o scanner não foi renderizada',
        );

        const aboutButton = container.querySelector<HTMLButtonElement>('button[aria-label="Sobre a ferramenta"]');
        assert(aboutButton, 'Acesso às informações da ferramenta não foi renderizado');

        flushSync(() => {
          aboutButton.click();
        });

        const dialog = container.querySelector<HTMLElement>('[role="dialog"][aria-labelledby="about-title"]');
        assert(dialog, 'Modal informativo não abriu');
        assert(
          dialog.textContent?.includes('não substitui validação oficial'),
          'Modal não preserva o posicionamento de analisador não oficial',
        );
        assert(dialog.textContent?.includes('Conforme'), 'Modal não explica o estado conforme');
        assert(dialog.textContent?.includes('Para revisar'), 'Modal não explica os estados acionáveis');
        assert(dialog.textContent?.includes('Fora do escopo'), 'Modal não explica itens fora do escopo');
        assert(
          dialog.textContent?.includes('Somente itens de documentos que possuem o grupo IBSCBS'),
          'Modal não informa a condição de entrada na avaliação de conformidade',
        );
        assert(
          dialog.textContent?.includes('planilha oficial CST/cClassTrib com referência de 22/06/2026'),
          'Modal não identifica o snapshot oficial usado pela análise',
        );
        assertEquals(dialog.querySelectorAll('#about-official-sources a[target="_blank"]').length, 3);

        const closeButton = dialog.querySelector<HTMLButtonElement>('button[aria-label="Fechar informações"]');
        assert(closeButton, 'Modal não possui ação de fechamento acessível');

        flushSync(() => {
          closeButton.click();
        });

        assertEquals(container.querySelector('[role="dialog"][aria-labelledby="about-title"]'), null);

        flushSync(() => {
          aboutButton.click();
        });
        assert(container.querySelector('[role="dialog"][aria-labelledby="about-title"]'), 'Modal não reabriu');

        flushSync(() => {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        });
        assertEquals(
          container.querySelector('[role="dialog"][aria-labelledby="about-title"]'),
          null,
          'Modal não fechou com Escape',
        );

        const samplesButton = container.querySelector<HTMLButtonElement>('#btn-load-samples');
        assert(samplesButton, 'Ação de amostras não foi encontrada para validar as fontes do relatório');
        flushSync(() => {
          samplesButton.click();
        });

        const exportButton = container.querySelector<HTMLButtonElement>('button[title="Baixar o relatório da análise atual"]');
        assert(exportButton, 'Ação de baixar relatório não foi renderizada após a análise');
        assert(exportButton.textContent?.includes('Baixar relatório'), 'Ação de exportação não possui rótulo explícito');

        const officialSources = container.querySelector<HTMLElement>('#official-sources');
        assert(officialSources, 'Relatório não exibe as fontes oficiais usadas na classificação');
        assert(
          officialSources.textContent?.includes('cClassTrib 2026-06-22.xlsx'),
          'Relatório não informa a versão da planilha incorporada',
        );
        assertEquals(officialSources.querySelectorAll('a[target="_blank"]').length, 3);
      } finally {
        flushSync(() => root.unmount());
        container.remove();
      }
    },
  },
  {
    name: 'UI renderiza hierarquia empresa-documentos, detalhe inline e filtros acessíveis',
    run: () => {
      const { container, root } = renderResultsTable();

      try {
        const searchInput = container.querySelector<HTMLInputElement>('#search-input');
        assert(searchInput, 'Campo de busca não foi renderizado');
        assertEquals(searchInput.getAttribute('aria-label'), 'Buscar notas por número, CNPJ ou razão social');

        const dropdownButtons = container.querySelectorAll('button[aria-haspopup="menu"]');
        assertEquals(dropdownButtons.length, 1, 'Apenas o filtro de status deve ficar visível na barra principal');

        const moreFiltersButton = container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]');
        assert(moreFiltersButton, 'Botão de filtros adicionais não foi renderizado');
        assertEquals(moreFiltersButton.getAttribute('aria-expanded'), 'false');

        flushSync(() => {
          moreFiltersButton.click();
        });

        const advancedPanel = container.querySelector('#results-advanced-filters');
        assert(advancedPanel, 'Painel de filtros avançados não abriu');
        assertEquals(advancedPanel.querySelectorAll('select').length, 2);
        assertEquals(moreFiltersButton.getAttribute('aria-expanded'), 'true');

        const groupedList = container.querySelector('#results-grouped-list');
        assert(groupedList, 'Lista agrupada de documentos não foi renderizada');
        assertEquals(
          groupedList.getAttribute('data-company-layout'),
          'compact-list',
          'Empresas devem compartilhar uma lista compacta em vez de cartões isolados',
        );

        const groupToggle = container.querySelector<HTMLButtonElement>('button[aria-controls^="group-content-"]');
        assert(groupToggle, 'Empresa não foi renderizada como nível hierárquico recolhível');
        assertEquals(groupToggle.getAttribute('aria-expanded'), 'false', 'Empresa deve iniciar recolhida');
        const groupSummaryText = groupToggle.textContent?.replace(/\s+/g, ' ').trim() || '';
        assert(groupSummaryText.includes('3 notas'), 'Resumo empresarial não informa a quantidade de notas');
        assert(
          groupSummaryText.includes('3 itens: 1 conforme, 1 para revisar, 1 fora do escopo'),
          'Categorias de itens do resumo empresarial não reconciliam com o total',
        );
        assert(groupSummaryText.includes('50% conforme'), 'Percentual comparativo deve aparecer para múltiplos itens aplicáveis');
        assert(groupSummaryText.includes('1 nota exige ação'), 'Selo de ação não informa sua unidade em notas');
        const companyToggles = Array.from(
          container.querySelectorAll<HTMLButtonElement>('button[aria-controls^="group-content-"]'),
        );
        const betaToggle = companyToggles.find((button) => button.textContent?.includes('Beta Distribuidora de Bebidas Ltda'));
        assert(betaToggle, 'Empresa conforme não foi renderizada');
        const betaSummaryText = betaToggle.textContent?.replace(/\s+/g, ' ').trim() || '';
        assert(betaSummaryText.includes('1 item: 1 conforme'), 'Resumo empresarial omitiu categoria relevante');
        assert(!betaSummaryText.includes('0 para revisar'), 'Resumo empresarial não deve exibir categoria vazia');
        assert(!betaSummaryText.includes('0 fora do escopo'), 'Resumo empresarial não deve exibir categoria vazia');
        assert(!betaSummaryText.includes('100% conforme'), 'Percentual redundante não deve aparecer para um único item aplicável');
        assert(
          groupedList.textContent?.includes('Empresa não identificada'),
          'Documentos incompletos devem aparecer como um grupo da lista principal',
        );

        flushSync(() => {
          groupToggle.click();
        });

        assertEquals(groupToggle.getAttribute('aria-expanded'), 'true', 'Empresa não abriu');

        const documentButton = container.querySelector<HTMLButtonElement>('button[data-note-layer="summary"]');
        assert(documentButton, 'Documento não foi renderizado como controle selecionável');
        assertEquals(documentButton.getAttribute('aria-expanded'), 'false');
        assertEquals(documentButton.getAttribute('data-note-layout'), 'audit-grid');
        assert(documentButton.textContent?.includes('Alfa Implementos Industriais S.A.'), 'Primeira camada não exibe o emitente');
        assert(documentButton.textContent?.includes('Beta Distribuidora de Bebidas Ltda'), 'Primeira camada não exibe o destinatário');
        assert(!documentButton.textContent?.includes('cClassTrib'), 'Classificação de item vazou para a primeira camada');
        assert(!documentButton.textContent?.includes('.xml'), 'Nome técnico do arquivo não deve competir com os dados prioritários da nota');

        flushSync(() => {
          documentButton.click();
        });

        const detailPanel = container.querySelector<HTMLElement>('[data-detail-layout="inline"]');
        assert(detailPanel, 'Detalhe inline do documento não abriu');
        assertEquals(detailPanel.getAttribute('data-detail-surface'), 'inset');
        assert(detailPanel.closest('[id^="group-content-"]'), 'Detalhe deve permanecer dentro da empresa selecionada');
        const itemHeaders = Array.from(detailPanel.querySelectorAll('th')).map((header) => header.textContent?.trim());
        assertEquals(itemHeaders.join('|'), 'Item|Produto / serviço|CST|Classificação|Status|Diagnóstico da tabela oficial');
        assert(detailPanel.textContent?.includes('Válvula Reguladora de Pressão Reforçada'), 'Detalhe não exibe a descrição do produto');
        assertEquals(documentButton.getAttribute('aria-expanded'), 'true');

        const closeButton = detailPanel.querySelector<HTMLButtonElement>('button[aria-label="Recolher itens da nota"]');
        assert(closeButton, 'Detalhe não possui botão de recolher acessível');

        flushSync(() => {
          closeButton.click();
        });

        assertEquals(container.querySelector('[data-detail-layout="inline"]'), null, 'Detalhe inline não recolheu');

        flushSync(() => {
          groupToggle.click();
        });

        assertEquals(groupToggle.getAttribute('aria-expanded'), 'false', 'Empresa não foi recolhida');
        assertEquals(container.querySelector(groupToggle.getAttribute('aria-controls') || ''), null);
      } finally {
        flushSync(() => root.unmount());
        container.remove();
      }
    },
  },
  {
    name: 'UI identifica DPS como declaração e preserva o papel do emissor',
    run: () => {
      const dps = parseNFeXml([
        '<DPS xmlns="http://www.sped.fazenda.gov.br/nfse"><infDPS>',
        '<nDPS>9012</nDPS><dhEmi>2026-05-29T10:00:00-03:00</dhEmi><tpEmit>1</tpEmit>',
        '<emit><CNPJ>04252011000110</CNPJ><xRazao>Prestador Nacional</xRazao></emit>',
        '<toma><CPF>52998224725</CPF><xRazao>Tomador Nacional</xRazao></toma>',
        '</infDPS></DPS>',
      ].join(''), 'NFSe_DPS_ui.xml');
      const { container, root } = renderResultsTable([dps]);

      try {
        const groupToggle = container.querySelector<HTMLButtonElement>('button[aria-controls^="group-content-"]');
        assert(groupToggle, 'Grupo da DPS não foi renderizado');
        flushSync(() => groupToggle.click());

        const documentButton = container.querySelector<HTMLButtonElement>('button[data-note-layer="summary"]');
        assert(documentButton, 'DPS não foi renderizada na lista de documentos');
        assert(documentButton.textContent?.includes('DPS'), 'A primeira camada não identifica o documento como DPS');
        assert(documentButton.textContent?.includes('DPS · Prestador'), 'A primeira camada não informa o papel do emissor da DPS');
        assert(!documentButton.textContent?.includes('Saída'), 'DPS não deve ser apresentada como operação de saída');
        assert(documentButton.textContent?.includes('Pendente'), 'DPS deve permanecer pendente no nível documental');
      } finally {
        flushSync(() => root.unmount());
        container.remove();
      }
    },
  },
  {
    name: 'UI móvel acomoda conteúdo extenso sem overflow horizontal',
    run: () => {
      if (globalThis.innerWidth > 480) return;

      const { container, root } = renderResultsTable(createLongContentResults());

      try {
        assertEquals(globalThis.innerWidth, 390, 'Viewport móvel deve ser executada com 390 px de largura');
        const groupToggle = container.querySelector<HTMLButtonElement>('button[aria-controls^="group-content-"]');
        assert(groupToggle, 'Grupo não foi renderizado na viewport móvel');

        flushSync(() => {
          groupToggle.click();
        });

        const mobileRow = container.querySelector<HTMLButtonElement>('button[data-note-viewport="mobile"]');
        assert(mobileRow, 'Linha móvel da nota não foi renderizada');
        assert(mobileRow.textContent?.includes('Empresa de Operações Industriais'), 'Conteúdo extenso não foi renderizado na linha móvel');

        flushSync(() => {
          mobileRow.click();
        });

        assert(container.querySelector('[data-detail-layout="inline"]'), 'Detalhamento móvel não foi renderizado');
        const renderedWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
        assert(renderedWidth <= globalThis.innerWidth, `Conteúdo móvel criou overflow horizontal: ${renderedWidth}px`);
      } finally {
        flushSync(() => root.unmount());
        container.remove();
      }
    },
  },
  {
    name: 'UI informa falha na geração do relatório e libera nova tentativa',
    run: async () => {
      let failGeneration = true;
      let downloadCalls = 0;
      let lastReport: AnalysisReport | undefined;
      const { container, root } = renderApp({
        generateReport: (report) => {
          lastReport = report;
          return failGeneration
            ? Promise.reject(new Error('Falha simulada ao compactar o XLSX.'))
            : Promise.resolve(new Blob(['relatorio-valido']));
        },
        downloadReport: () => {
          downloadCalls += 1;
        },
      });

      try {
        const samplesButton = container.querySelector<HTMLButtonElement>('#btn-load-samples');
        assert(samplesButton, 'Ação de amostras não foi encontrada');
        flushSync(() => samplesButton.click());

        const exportButton = container.querySelector<HTMLButtonElement>('button[title="Baixar o relatório da análise atual"]');
        assert(exportButton, 'Ação de baixar relatório não foi renderizada');
        flushSync(() => exportButton.click());

        await waitForUi(() => container.textContent?.includes('Falha simulada ao compactar o XLSX.') === true);
        assert(container.querySelector('#report-error'), 'Falha de exportação não foi exibida como erro do relatório');
        assertEquals(container.querySelector('#error-list-container'), null, 'Falha de exportação não deve ser tratada como erro de arquivo');
        assertEquals(downloadCalls, 0);
        assert(!exportButton.disabled, 'Botão deve ser liberado após falha na geração');
        assert(exportButton.textContent?.includes('Baixar relatório'), 'Botão não voltou ao estado de nova tentativa');

        failGeneration = false;
        flushSync(() => exportButton.click());
        await waitForUi(() => downloadCalls === 1 && !container.textContent?.includes('Gerando...'));
        assertEquals(container.querySelector('#report-error'), null, 'Aviso de falha permaneceu após retry bem-sucedido');
        const occurrences = lastReport?.sheets.find((sheet) => sheet.name === 'Ocorrências');
        const summary = lastReport?.sheets.find((sheet) => sheet.name === 'Resumo');
        assert(occurrences && summary, 'Retry não gerou as abas esperadas');
        assertEquals(occurrences.rows.length, 1, 'Falha anterior de exportação contaminou as ocorrências do retry');
        assert(summary.rows.some((row) => row[0] === 'Status da execução' && row[1] === 'Concluída'));

        failGeneration = true;
        flushSync(() => exportButton.click());
        await waitForUi(() => container.querySelector('#report-error') !== null);
        const samplesAgainButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
          (button) => button.textContent?.trim() === 'Amostras',
        );
        assert(samplesAgainButton, 'Ação de nova análise não foi encontrada');
        flushSync(() => samplesAgainButton.click());
        assertEquals(container.querySelector('#report-error'), null, 'Aviso antigo permaneceu após iniciar nova análise');
      } finally {
        flushSync(() => root.unmount());
        container.remove();
      }
    },
  },
  {
    name: 'UI bloqueia alterações enquanto o relatório é gerado',
    run: () => {
      const { container, root } = renderApp({
        generateReport: () => new Promise(() => undefined),
        downloadReport: () => undefined,
      });

      try {
        const samplesButton = container.querySelector<HTMLButtonElement>('#btn-load-samples');
        assert(samplesButton, 'Ação de amostras não foi encontrada');
        flushSync(() => samplesButton.click());

        const exportButton = container.querySelector<HTMLButtonElement>('button[title="Baixar o relatório da análise atual"]');
        const clearButton = container.querySelector<HTMLButtonElement>('#btn-clear-analysis');
        const appendInput = container.querySelector<HTMLInputElement>('#append-nfe-file-input');
        const appendLabel = container.querySelector<HTMLLabelElement>('label[for="append-nfe-file-input"]');
        const samplesAgainButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
          (button) => button.textContent?.trim() === 'Amostras',
        );

        assert(exportButton && clearButton && appendInput && appendLabel && samplesAgainButton, 'Controles de análise não foram renderizados');
        flushSync(() => exportButton.click());

        assert(exportButton.disabled, 'Exportação concorrente deveria bloquear o próprio botão');
        assert(clearButton.disabled, 'Limpeza deveria ser bloqueada durante a exportação');
        assert(appendInput.disabled, 'Inclusão de arquivos deveria ser bloqueada durante a exportação');
        assertEquals(appendLabel.getAttribute('aria-disabled'), 'true');
        assert(samplesAgainButton.disabled, 'Nova carga de amostras deveria ser bloqueada durante a exportação');
      } finally {
        flushSync(() => root.unmount());
        container.remove();
      }
    },
  },
  {
    name: 'UI limpa recursos quando o disparo do download falha',
    run: async () => {
      const revokedUrls: string[] = [];
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      const originalAnchorClick = HTMLAnchorElement.prototype.click;
      URL.createObjectURL = () => 'blob:relatorio-click-falho';
      URL.revokeObjectURL = (url) => {
        revokedUrls.push(url);
      };
      HTMLAnchorElement.prototype.click = () => {
        throw new Error('Falha simulada ao clicar no download.');
      };

      const { container, root } = renderApp({
        generateReport: () => Promise.resolve(new Blob(['relatorio-valido'])),
        downloadReport: downloadBlob,
      });

      try {
        const samplesButton = container.querySelector<HTMLButtonElement>('#btn-load-samples');
        assert(samplesButton, 'Ação de amostras não foi encontrada');
        flushSync(() => samplesButton.click());

        const exportButton = container.querySelector<HTMLButtonElement>('button[title="Baixar o relatório da análise atual"]');
        assert(exportButton, 'Ação de baixar relatório não foi renderizada');
        flushSync(() => exportButton.click());

        await waitForUi(() => container.textContent?.includes('Falha simulada ao clicar no download.') === true);
        assertEquals(revokedUrls.length, 1, 'ObjectURL não foi revogado após falha no clique');
        assertEquals(revokedUrls[0], 'blob:relatorio-click-falho');
        assertEquals(container.querySelectorAll('a[download]').length, 0, 'Âncora temporária permaneceu no DOM');
        assert(!exportButton.disabled, 'Botão deve ser liberado após falha no clique');
      } finally {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
        HTMLAnchorElement.prototype.click = originalAnchorClick;
        flushSync(() => root.unmount());
        container.remove();
      }
    },
  },
  {
    name: 'UI informa falha no download e permite repetir a exportação',
    run: async () => {
      let shouldFail = true;
      let createObjectUrlCalls = 0;
      const revokedUrls: string[] = [];
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = () => {
        createObjectUrlCalls += 1;
        if (shouldFail) throw new Error('Falha simulada ao iniciar o download.');
        return `blob:relatorio-teste-${createObjectUrlCalls}`;
      };
      URL.revokeObjectURL = (url) => {
        revokedUrls.push(url);
      };

      const { container, root } = renderApp({
        generateReport: () => Promise.resolve(new Blob(['relatorio-valido'])),
        downloadReport: downloadBlob,
      });

      try {
        const samplesButton = container.querySelector<HTMLButtonElement>('#btn-load-samples');
        assert(samplesButton, 'Ação de amostras não foi encontrada');
        flushSync(() => samplesButton.click());

        const exportButton = container.querySelector<HTMLButtonElement>('button[title="Baixar o relatório da análise atual"]');
        assert(exportButton, 'Ação de baixar relatório não foi renderizada');
        flushSync(() => exportButton.click());

        await waitForUi(() => container.textContent?.includes('Falha simulada ao iniciar o download.') === true);
        assertEquals(createObjectUrlCalls, 1);
        assert(!exportButton.disabled, 'Botão deve ser liberado após falha no download');

        shouldFail = false;
        flushSync(() => exportButton.click());
        await waitForUi(() => createObjectUrlCalls === 2 && !container.textContent?.includes('Gerando...'));
        assert(!container.textContent?.includes('Gerando...'), 'Botão permaneceu preso no estado de geração');
        await new Promise((resolve) => setTimeout(resolve, 1100));
        assertEquals(revokedUrls.length, 1);
        assertEquals(revokedUrls[0], 'blob:relatorio-teste-2');
      } finally {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
        flushSync(() => root.unmount());
        container.remove();
      }
    },
  },
  {
    name: 'UI usa rótulos específicos para serviços NFS-e no detalhamento',
    run: () => {
      const sample = SAMPLE_NFES.find((item) => item.fileName === 'NFSe_2026_Prestador_Incompleto.xml');
      assert(sample, 'Amostra NFS-e não encontrada');
      const note = parseNFeXml(sample.xmlContent, sample.fileName);
      const { container, root } = renderNoteDetail(note);

      try {
        const detailPanel = container.querySelector<HTMLElement>('[data-detail-layout="inline"]');
        assert(detailPanel, 'Detalhamento da NFS-e não foi renderizado');
        assert(detailPanel.textContent?.includes('Serviços da nota e classificação (total: 1)'), 'Título específico de NFS-e não foi renderizado');
        const headers = Array.from(detailPanel.querySelectorAll('th')).map((header) => header.textContent?.trim());
        assertEquals(headers.join('|'), 'Item|Serviço prestado|CST|Classificação|Status|Diagnóstico da tabela oficial');
        assert(detailPanel.textContent?.includes('Licenciamento de software de gestao'), 'Descrição do serviço não foi renderizada');
        assert(
          detailPanel.querySelector('button[aria-label="Recolher serviços da nota"]'),
          'Ação de recolher serviços não foi identificada',
        );
      } finally {
        flushSync(() => root.unmount());
        container.remove();
      }
    },
  },
];

export async function runUiSmokeTests(): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];
  for (const test of tests) {
    try {
      await test.run();
      results.push({ name: test.name, status: 'passed' });
    } catch (error) {
      results.push({
        name: test.name,
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
