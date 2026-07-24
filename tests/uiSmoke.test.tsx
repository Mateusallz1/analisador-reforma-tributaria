import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
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

const tests: UiTestCase[] = [
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

        const groupToggle = container.querySelector<HTMLButtonElement>('button[aria-controls^="group-content-"]');
        assert(groupToggle, 'Empresa não foi renderizada como nível hierárquico recolhível');
        assertEquals(groupToggle.getAttribute('aria-expanded'), 'false', 'Empresa deve iniciar recolhida');
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
        assert(documentButton.textContent?.includes('Alfa Implementos Industriais S.A.'), 'Primeira camada não exibe o emitente');
        assert(documentButton.textContent?.includes('Beta Distribuidora de Bebidas Ltda'), 'Primeira camada não exibe o destinatário');
        assert(!documentButton.textContent?.includes('cClassTrib'), 'Classificação de item vazou para a primeira camada');

        flushSync(() => {
          documentButton.click();
        });

        const detailPanel = container.querySelector<HTMLElement>('[data-detail-layout="inline"]');
        assert(detailPanel, 'Detalhe inline do documento não abriu');
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
