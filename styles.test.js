import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('styles.css', 'utf8');

function rules(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'));
  return [...matches].map((match) => match[1]).join('\n');
}

test('primary controls wrap and buttons meet the minimum touch target', () => {
  assert.match(rules('.controls'), /flex-wrap:\s*wrap/);
  assert.match(rules('button'), /min-height:\s*44px/);
});

test('small-screen connection status gets its own row', () => {
  const smallScreen = css.match(/@media \(max-width: 560px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const connection = smallScreen.match(/\.connection\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(connection, /flex-basis:\s*100%/);
  assert.match(connection, /margin-left:\s*0/);
});

test('connection colors distinguish readiness from warning states', () => {
  assert.match(css, /\.connection\[data-offline-ready="true"\]\s*\{\s*color:\s*#b9e8b5/);
  assert.match(css, /\.connection\[data-offline-error="true"\][\s\S]*?color:\s*var\(--accent\)/);
  assert.match(css, /data-offline="true"\]\[data-offline-ready="false"\][\s\S]*?color:\s*var\(--accent\)/);
  assert.doesNotMatch(css, /\.connection\[data-offline="true"\]\s*\{\s*color:\s*#b9e8b5/);
});

test('380px breakpoint no longer carries control-layout fixes', () => {
  const narrow = css.match(/@media \(max-width: 380px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.doesNotMatch(narrow, /\.controls|\.connection/);
});
