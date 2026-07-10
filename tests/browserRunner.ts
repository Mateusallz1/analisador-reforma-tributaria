import { runEngineTests } from './engine.test.ts';
import type { TestCaseResult } from './engine.test.ts';
import { runUiSmokeTests } from './uiSmoke.test.tsx';

interface BrowserTestReport {
  passed: boolean;
  total: number;
  failed: number;
  results: TestCaseResult[];
}

declare global {
  interface Window {
    __ENGINE_TEST_RESULTS__?: BrowserTestReport;
  }
}

const results = [...await runEngineTests(), ...runUiSmokeTests()];
const failed = results.filter((result) => result.status === 'failed').length;
const report: BrowserTestReport = {
  passed: failed === 0,
  total: results.length,
  failed,
  results,
};

window.__ENGINE_TEST_RESULTS__ = report;

document.body.innerHTML = `<pre>${JSON.stringify(report, null, 2)}</pre>`;

if (!report.passed) {
  throw new Error(`${failed} teste(s) da engine fiscal falharam.`);
}