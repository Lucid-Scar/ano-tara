import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const source = await readFile(new URL('../lib/outfitUpload.js', import.meta.url), 'utf8');
const { readOutfitResponse } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
for (const status of [400, 413, 422, 500, 502, 503, 504]) {
  await assert.rejects(readOutfitResponse(new Response('<!DOCTYPE html>private error', { status, headers: { 'content-type': 'text/html' } })), error => !error.message.includes('private') && !(error instanceof SyntaxError));
}
await assert.rejects(readOutfitResponse(new Response('<html>', { headers: { 'content-type': 'text/html' } })));
await assert.rejects(readOutfitResponse(Response.json({ status: 'error' })));
const data = { status: 'success', items: [{ category: 't shirt', conditions: ['Clear / Sunny'] }] };
assert.deepEqual(await readOutfitResponse(Response.json(data)), data);
console.log('Outfit response checks passed: gateway statuses, non-JSON, no detections, successful response.');
