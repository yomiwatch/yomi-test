import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// De tv kan een oudere Chromium hebben: geen replaceAll, optional catch binding, ?. of ??.
test('paginascripts gebruiken geen moderne syntax die oudere Chromium breekt', () => {
  const map = new URL('../pagina/', import.meta.url).pathname;
  for (const f of fs.readdirSync(map).filter((n) => n.endsWith('.js'))) {
    const bron = fs.readFileSync(path.join(map, f), 'utf8');
    for (const [naam, patroon] of [['replaceAll', /\.replaceAll\(/], ['catch zonder binding', /catch\s*\{/], ['?.', /\?\.[a-zA-Z(\[]/], ['??', /\?\?/]] as const) {
      assert.doesNotMatch(bron, patroon, `${f} gebruikt ${naam}`);
    }
  }
});
