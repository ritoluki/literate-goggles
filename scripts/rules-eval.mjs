import { readFile } from 'node:fs/promises';
const lines = (await readFile('fixtures/ai.eval-cases.jsonl', 'utf8')).trim().split(/\r?\n/).filter(Boolean);
if (lines.length === 0) throw new Error('No offline evaluation cases found');
for (const line of lines) JSON.parse(line);
console.log(`offline rules fixture validation: PASS (${lines.length} synthetic cases; no live provider call)`);
