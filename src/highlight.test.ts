import { describe, expect, it } from 'vitest';

import { highlightHtml } from './highlight';

describe('highlightHtml', () => {
  it('キーワードと識別子をspanで包む', () => {
    const html = highlightHtml('SELECT id');
    expect(html).toContain('<span class="tok-keyword">SELECT</span>');
    expect(html).toContain('<span class="tok-ident">id</span>');
  });

  it('空白と改行をそのまま保つ', () => {
    const html = highlightHtml('SELECT a\nFROM t\n');
    expect(html).toContain('</span>\n<span class="tok-keyword">FROM</span>');
    expect(html.endsWith('\n')).toBe(true);
  });

  it('HTMLを含む文字列を安全にエスケープする', () => {
    const html = highlightHtml(`SELECT '<b>&' FROM t`);
    expect(html).toContain('&lt;b&gt;&amp;');
    expect(html).not.toContain('<b>');
  });

  it('文字列・数値・コメントを種別ごとに分ける', () => {
    const html = highlightHtml('SELECT 1 -- メモ');
    expect(html).toContain('tok-number');
    expect(html).toContain('tok-comment');
  });
});
