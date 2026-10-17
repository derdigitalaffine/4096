import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('styles.css', 'utf8');
const tileValues = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];

function rules(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? '';
}

function hexProperty(selector, property) {
  return rules(selector).match(new RegExp(`${property}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1] ?? null;
}

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/../g).map((channel) => parseInt(channel, 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test('all numbered tiles keep at least 3:1 text contrast', () => {
  const defaultColor = hexProperty('.tile', 'color');
  assert.ok(defaultColor, 'tile base color must be an explicit hex value');

  for (const value of tileValues) {
    const selector = `.tile[data-value="${value}"]`;
    const background = hexProperty(selector, 'background');
    const color = hexProperty(selector, 'color') ?? defaultColor;

    assert.ok(background, `${value} tile must define an explicit hex background`);
    const ratio = contrastRatio(color, background);
    assert.ok(ratio >= 3, `${value} tile contrast ${ratio.toFixed(2)} is below 3:1`);
  }
});
