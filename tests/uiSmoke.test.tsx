import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import App from '../src/App.tsx';
import ResultsTable from '../src/components/ResultsTable.tsx';
import { SAMPLE_NFES } from '../src/data/samples.ts';
import { parseNFeXml } from '../src/utils/nfeParser.ts';
import type { NFeAnalysis } from '../src/types.ts';
import type { TestCaseResult } from './engine.test.ts';

interface UiTestCase {
  name: string;
  run: () => void;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Esperado ${JSON.stringify(expected)}, recebido ${JSON.stringify(actual)}`);
  }
}

function parseSamples(): NFeAnalysis[] {
  return SAMPLE_NFES.map((sample) => parseNFeXml(sample.xmlContent, sample.fileName));
}

function renderResultsTable() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  flushSync(() => {
    root.render(<ResultsTable allResults={parseSamples()} />);
  });

  return { container, root };
}

function renderApp() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  flushSync(() => {
    root.render(<App />);
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
];

export function runUiSmokeTests(): TestCaseResult[] {
  return tests.map((test) => {
    try {
      test.run();
      return { name: test.name, status: 'passed' };
    } catch (error) {
      return {
        name: test.name,
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
