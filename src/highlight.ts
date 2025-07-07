/**
 * 整形済みSQLのシンタックスハイライト。
 *
 * 既存のトークナイザをそのまま使い、トークンの間にある空白・改行は元のまま流す。
 * こうすることで整形のレイアウトを保ったまま、種別ごとに色を付けたHTMLを作れる。
 * トークン本文も区切りの空白もHTMLエスケープするので、入力をそのまま埋めても安全。
 */

import { tokenize, type TokenType } from './tokenize';

const ESCAPE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (c) => ESCAPE[c] as string);
}

const CLASS_OF: Record<TokenType, string> = {
  keyword: 'keyword',
  identifier: 'ident',
  quoted: 'quoted',
  string: 'string',
  number: 'number',
  operator: 'operator',
  comma: 'punct',
  lparen: 'punct',
  rparen: 'punct',
  comment: 'comment',
};

/** 整形済みSQLを、空白・改行を保ったままトークンを色付けしたHTMLにする。 */
export function highlightHtml(sql: string): string {
  const tokens = tokenize(sql);
  let out = '';
  let cursor = 0;
  for (const token of tokens) {
    // トークンは順番どおりに並ぶので、cursorから次の出現を探せば区切りの空白が取れる。
    const at = sql.indexOf(token.text, cursor);
    if (at < 0) continue;
    out += escapeHtml(sql.slice(cursor, at));
    out += `<span class="tok-${CLASS_OF[token.type]}">${escapeHtml(token.text)}</span>`;
    cursor = at + token.text.length;
  }
  out += escapeHtml(sql.slice(cursor));
  return out;
}
