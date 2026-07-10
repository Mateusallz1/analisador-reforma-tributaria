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
    name: 'UI renderiza filtros, grupos e seção de documentos incompletos com controles acessíveis',
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
        assertEquals(container.querySelector('#results-advanced-filters'), null);

        flushSync(() => {
          moreFiltersButton.click();
        });
        const advancedPanel = container.querySelector('#results-advanced-filters');
        assert(advancedPanel, 'Painel de filtros avançados não abriu');
        assertEquals(advancedPanel.querySelectorAll('select').length, 2);
        assertEquals(moreFiltersButton.getAttribute('aria-expanded'), 'true');

        const groupToggle = container.querySelector<HTMLButtonElement>('button[aria-controls^="group-content-"]');
        assert(groupToggle, 'Accordion de grupo não foi renderizado como botão acessível');
        assertEquals(groupToggle.getAttribute('aria-expanded'), 'true');

        const groupToggles = Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-controls^="group-content-"]'));
        assert(groupToggles.some((button) => button.getAttribute('aria-expanded') === 'false'), 'Grupos conformes devem iniciar recolhidos');

        const incompleteToggle = container.querySelector<HTMLButtonElement>('#incomplete-documents-block button[aria-controls="incomplete-documents-content"]');
        assert(incompleteToggle, 'Accordion de documentos incompletos não foi renderizado');
        assertEquals(incompleteToggle.getAttribute('aria-expanded'), 'false');

        const incompleteBlock = container.querySelector('#incomplete-documents-block');
        assert(incompleteBlock?.textContent?.includes('Documentos com dados incompletos'), 'Seção de documentos incompletos não está visível');
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