interface CdpResponse<T = unknown> {
  id?: number;
  result?: T;
  error?: { message: string };
  method?: string;
  params?: unknown;
}

interface TestReport {
  passed: boolean;
  total: number;
  failed: number;
  results: Array<{ name: string; status: 'passed' | 'failed'; message?: string }>;
}

const HOST = '127.0.0.1';
const MAX_PROCESS_OUTPUT_LENGTH = 8000;
const VITE_SHUTDOWN_TIMEOUT_MS = 2000;
const pagePath = Deno.args[0] || '/tests/browser.html';
const reportTimeoutMs = Number(Deno.args[1] || 20000);
const suiteLabel = Deno.args[2] || 'Engine fiscal';

if (!pagePath.startsWith('/') || !Number.isFinite(reportTimeoutMs) || reportTimeoutMs <= 0) {
  throw new Error('Argumentos inválidos para o runner de testes browser.');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort(): number {
  const listener = Deno.listen({ hostname: HOST, port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  return port;
}

interface ViteDiagnostics {
  status: Deno.CommandStatus;
  stdout: string;
  stderr: string;
}

interface ProcessOutputCapture {
  readonly text: string;
  readonly complete: Promise<string>;
}

interface ViteProcess {
  process: Deno.ChildProcess;
  stdout: ProcessOutputCapture;
  stderr: ProcessOutputCapture;
  diagnostics: Promise<ViteDiagnostics>;
}

async function readProcessOutput(
  stream: ReadableStream<Uint8Array> | null,
  onUpdate: (output: string) => void,
): Promise<string> {
  if (!stream) {
    onUpdate('');
    return '';
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      output += decoder.decode(value, { stream: true });
      if (output.length > MAX_PROCESS_OUTPUT_LENGTH) {
        output = output.slice(-MAX_PROCESS_OUTPUT_LENGTH);
      }
      onUpdate(output);
    }

    output += decoder.decode();
    onUpdate(output);
    return output;
  } finally {
    reader.releaseLock();
  }
}

function createProcessOutputCapture(stream: ReadableStream<Uint8Array> | null): ProcessOutputCapture {
  let currentOutput = '';
  const complete = readProcessOutput(stream, (output) => {
    currentOutput = output;
  });

  return {
    get text() {
      return currentOutput;
    },
    complete,
  };
}

function formatViteDiagnostics(diagnostics: ViteDiagnostics | null, vite: ViteProcess): string {
  const stdout = diagnostics?.stdout ?? vite.stdout.text;
  const stderr = diagnostics?.stderr ?? vite.stderr.text;
  const output = [
    stdout.trim() ? `stdout:\n${stdout.trim()}` : '',
    stderr.trim() ? `stderr:\n${stderr.trim()}` : '',
  ].filter(Boolean).join('\n');
  const outputMessage = output || 'O Vite não produziu saída.';
  const statusMessage = diagnostics
    ? `Vite encerrou com código ${diagnostics.status.code}.`
    : 'Vite não encerrou após o sinal de término.';

  return `${statusMessage}\n${outputMessage}`;
}

async function probeHttp(url: string, timeoutMs: number): Promise<'ready' | 'retry'> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok ? 'ready' : 'retry';
  } catch {
    return 'retry';
  } finally {
    clearTimeout(timeout);
  }
}

async function stopVite(vite: ViteProcess): Promise<ViteDiagnostics | null> {
  stopProcess(vite.process);
  const diagnostics = await Promise.race([
    vite.diagnostics,
    delay(VITE_SHUTDOWN_TIMEOUT_MS).then(() => null),
  ]);

  if (diagnostics) return diagnostics;

  try {
    vite.process.kill('SIGKILL');
  } catch {
    // Process already exited or cannot receive a second termination signal.
  }

  return null;
}

async function waitForHttp(url: string, vite: ViteProcess, timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await Promise.race([
      probeHttp(url, Math.max(1, Math.min(250, deadline - Date.now()))).then((kind) => ({ kind } as const)),
      vite.diagnostics.then((diagnostics) => ({ kind: 'exit' as const, diagnostics })),
    ]);

    if (result.kind === 'ready') return;
    if (result.kind === 'exit') {
      throw new Error(`Servidor de testes não iniciou.\n${formatViteDiagnostics(result.diagnostics, vite)}`);
    }

    await delay(Math.max(1, Math.min(250, deadline - Date.now())));
  }

  const diagnostics = await stopVite(vite);
  throw new Error(`Servidor de testes não respondeu em ${url} após ${timeoutMs} ms.\n${formatViteDiagnostics(diagnostics, vite)}`);
}

async function findExecutable(candidates: string[], envNames: string[]): Promise<string> {
  for (const envName of envNames) {
    const envValue = Deno.env.get(envName);
    if (envValue) return envValue;
  }

  for (const candidate of candidates) {
    try {
      const stat = await Deno.stat(candidate);
      if (stat.isFile) return candidate;
    } catch {
      // Try next candidate.
    }
  }

  return candidates[candidates.length - 1];
}

function getChromeExecutable(): Promise<string> {
  if (Deno.build.os === 'windows') {
    return findExecutable([
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'chrome.exe',
    ], ['CHROME_PATH', 'CHROME']);
  }

  if (Deno.build.os === 'darwin') {
    return findExecutable([
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      'google-chrome',
    ], ['CHROME_PATH', 'CHROME']);
  }

  return findExecutable([
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'google-chrome',
  ], ['CHROME_PATH', 'CHROME']);
}

function startVite(port: number): ViteProcess {
  const process = new Deno.Command('node', {
    args: ['node_modules/vite/bin/vite.js', '--host', HOST, '--port', String(port), '--strictPort'],
    stdout: 'piped',
    stderr: 'piped',
  }).spawn();
  const stdout = createProcessOutputCapture(process.stdout);
  const stderr = createProcessOutputCapture(process.stderr);

  return {
    process,
    stdout,
    stderr,
    diagnostics: Promise.all([
      process.status,
      stdout.complete,
      stderr.complete,
    ]).then(([status, stdoutOutput, stderrOutput]) => ({
      status,
      stdout: stdoutOutput,
      stderr: stderrOutput,
    })),
  };
}

function startChrome(chromeExecutable: string, debugPort: number, userDataDir: string): Deno.ChildProcess {
  return new Deno.Command(chromeExecutable, {
    args: [
      '--headless=new',
      '--disable-gpu',
      '--disable-extensions',
      '--enable-precise-memory-info',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-address=${HOST}`,
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ],
    stdout: 'null',
    stderr: 'null',
  }).spawn();
}

async function waitForChrome(debugPort: number, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${HOST}:${debugPort}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome not ready yet.
    }
    await delay(150);
  }
  throw new Error('Chrome headless não abriu a porta de depuração a tempo.');
}

class CdpClient {
  private nextId = 0;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  readonly events: CdpResponse[] = [];

  private constructor(private readonly socket: WebSocket) {
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as CdpResponse;
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id)!;
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
        return;
      }

      if (message.method) {
        this.events.push(message);
      }
    };
  }

  static connect(webSocketUrl: string): Promise<CdpClient> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(webSocketUrl);
      socket.onopen = () => resolve(new CdpClient(socket));
      socket.onerror = () => reject(new Error('Falha ao conectar ao Chrome via CDP.'));
    });
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} excedeu o tempo limite.`));
      }, 10000);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close(): void {
    this.socket.close();
  }
}

async function openCdpClient(debugPort: number): Promise<CdpClient> {
  const response = await fetch(`http://${HOST}:${debugPort}/json/list`);
  const targets = await response.json() as Array<{ type: string; webSocketDebuggerUrl: string }>;
  const page = targets.find((target) => target.type === 'page') || targets[0];
  if (!page) {
    throw new Error('Nenhuma aba do Chrome encontrada para executar testes.');
  }
  return CdpClient.connect(page.webSocketDebuggerUrl);
}

async function readReport(client: CdpClient, timeoutMs = 20000): Promise<TestReport> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const evaluation = await client.send<{ result: { value?: TestReport | null } }>('Runtime.evaluate', {
      expression: 'window.__ENGINE_TEST_RESULTS__ ?? null',
      returnByValue: true,
    });

    if (evaluation.result.value) {
      return evaluation.result.value;
    }

    await delay(250);
  }

  const exceptions = client.events.filter((event) => event.method === 'Runtime.exceptionThrown');
  throw new Error(`Relatório de testes não foi produzido. Exceções: ${JSON.stringify(exceptions)}`);
}

function stopProcess(process: Deno.ChildProcess): void {
  try {
    process.kill('SIGTERM');
  } catch {
    // Process already exited.
  }
}

const vitePort = getFreePort();
const chromeDebugPort = getFreePort();
const userDataDir = await Deno.makeTempDir({ prefix: 'nfe-engine-tests-' });
const vite = startVite(vitePort);
let chrome: Deno.ChildProcess | undefined;
let client: CdpClient | undefined;

try {
  const testUrl = `http://${HOST}:${vitePort}${pagePath}`;
  await waitForHttp(testUrl, vite);

  const chromeExecutable = await getChromeExecutable();
  chrome = startChrome(chromeExecutable, chromeDebugPort, userDataDir);
  await waitForChrome(chromeDebugPort);

  client = await openCdpClient(chromeDebugPort);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Log.enable');
  await client.send('Page.navigate', { url: testUrl });

  const report = await readReport(client, reportTimeoutMs);
  report.results.forEach((result) => {
    const marker = result.status === 'passed' ? 'ok' : 'fail';
    console.log(`${marker} - ${result.name}${result.message ? `: ${result.message}` : ''}`);
  });

  if (!report.passed) {
    throw new Error(`${report.failed}/${report.total} teste(s) falharam.`);
  }

  console.log(`${suiteLabel}: ${report.total}/${report.total} testes passaram.`);
} finally {
  client?.close();
  if (chrome) stopProcess(chrome);
  stopProcess(vite.process);
  await Deno.remove(userDataDir, { recursive: true }).catch(() => undefined);
}
