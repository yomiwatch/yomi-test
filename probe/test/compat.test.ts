import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// The TV may run an older Chromium: no replaceAll, optional catch binding, ?. or ??.
test('page scripts use no modern syntax that breaks older Chromium', () => {
  const dir = new URL('../page/', import.meta.url).pathname;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const [name, pattern] of [['replaceAll', /\.replaceAll\(/], ['catch without binding', /catch\s*\{/], ['?.', /\?\.[a-zA-Z(\[]/], ['??', /\?\?/]] as const) {
      assert.doesNotMatch(source, pattern, `${f} uses ${name}`);
    }
  }
});
