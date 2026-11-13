import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
const folder = await mkdtemp(join(tmpdir(), 'outfit-compression-'));
const source = await readFile(new URL('../lib/compressOutfitImage.js', import.meta.url), 'utf8');
const test = async function () {
  const results = [];
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  async function fixture(width, height, type, paddedSize = 0) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'navy'; ctx.fillRect(0, 0, width / 2, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, type, .9));
    // Padding simulates large source files; these are not garment photographs.
    return new File([blob, new Uint8Array(Math.max(0, paddedSize - blob.size))], 'fixture', { type });
  }
  for (const [name, w, h, type, size] of [
    ['5 MiB JPEG', 3200, 2400, 'image/jpeg', 5 * 1024 ** 2],
    ['10 MiB PNG', 2400, 3200, 'image/png', 10 * 1024 ** 2],
    ['small JPEG', 160, 120, 'image/jpeg', 0],
    ['transparent portrait PNG', 300, 600, 'image/png', 0],
  ]) {
    const result = await compressOutfitImage(await fixture(w, h, type, size));
    const blob = await (await fetch(result.dataUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    check(blob.size === result.compressedBytes && blob.type === 'image/jpeg', 'JPEG size/type');
    check(bitmap.width <= w && bitmap.height <= h && Math.max(bitmap.width, bitmap.height) <= 1280, 'dimensions');
    check(Math.abs(bitmap.width / bitmap.height - w / h) < .01, 'aspect ratio');
    if (type === 'image/png') {
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
      check(ctx.getImageData(bitmap.width - 2, 2, 1, 1).data[0] > 245, 'white transparency background');
    }
    bitmap.close();
    results.push({ name, original: result.originalBytes, compressed: result.compressedBytes, width: result.width, height: result.height });
  }
  for (const file of [new File(['corrupt'], 'bad.jpg', { type: 'image/jpeg' }), new File([new Uint8Array(21 * 1024 ** 2)], 'large.jpg', { type: 'image/jpeg' })]) {
    let rejected = false;
    try { await compressOutfitImage(file); } catch { rejected = true; }
    check(rejected, 'invalid or oversized file was accepted');
  }
  document.body.textContent = 'PASS ' + JSON.stringify(results);
};
let browserProcess, socket;
try {
  const browser = process.env.TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  browserProcess = spawn(browser, ['--headless', '--no-first-run', '--disable-gpu', `--user-data-dir=${folder}`, '--remote-debugging-port=0', 'about:blank'], { stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(join(folder, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  if (!port) throw new Error('Browser did not start');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  const response = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Browser test timed out')), 30000);
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id === 1) { clearTimeout(timer); resolve(message); }
    });
  });
  socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: `(async () => { ${source.replace('export async function', 'async function')} await (${test.toString()})(); return document.body.textContent; })()`, awaitPromise: true, returnByValue: true } }));
  const output = await response;
  if (output.result?.exceptionDetails) throw new Error(JSON.stringify(output.result.exceptionDetails));
  console.log(output.result.result.value);
} finally {
  socket?.close();
  if (browserProcess) { browserProcess.kill(); await new Promise(resolve => browserProcess.once('exit', resolve)); }
  await rm(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
