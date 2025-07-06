/**
 * SQLのトークナイザ。
 *
 * 文字列・引用識別子・コメントを正しく塊として切ることが目的で、
 * ここが正確なら整形でリテラルを壊すことがなくなる。
 */

export type TokenType =
  | 'keyword'
  | 'identifier'
  | 'quoted' // "x" `x` [x]
  | 'string' // 'x'
  | 'number'
  | 'operator'
  | 'comma'
  | 'lparen'
  | 'rparen'
  | 'comment';

export interface Token {
  type: TokenType;
  text: string;
}

export const KEYWORDS = new Set([
  'select',
  'from',
  'where',
  'and',
  'or',
  'not',
  'in',
  'is',
  'null',
  'like',
  'between',
  'exists',
  'group',
  'by',
  'having',
  'order',
  'limit',
  'offset',
  'insert',
  'into',
  'values',
  'update',
  'set',
  'delete',
  'create',
  'table',
  'alter',
  'drop',
  'join',
  'inner',
  'left',
  'right',
  'full',
  'outer',
  'cross',
  'on',
  'as',
  'distinct',
  'union',
  'all',
  'case',
  'when',
  'then',
  'else',
  'end',
  'asc',
  'desc',
  'top',
  'fetch',
  'first',
  'next',
  'rows',
  'row',
  'only',
  'with',
  'primary',
  'key',
  'foreign',
  'references',
  'default',
  'index',
  'cast',
  'count',
  'sum',
  'avg',
  'min',
  'max',
]);

const OPERATOR_CHARS = new Set([...'+-*/%<>=!|&^~']);

export function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const push = (type: TokenType, text: string): void => {
    tokens.push({ type, text });
  };
  while (i < sql.length) {
    const ch = sql[i] as string;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end < 0 ? sql.length : end;
      push('comment', sql.slice(i, stop));
      i = stop;
      continue;
    }
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end < 0 ? sql.length : end + 2;
      push('comment', sql.slice(i, stop));
      i = stop;
      continue;
    }
    if (ch === "'") {
      i = readQuoted(sql, i, "'", "'", (text) => push('string', text));
      continue;
    }
    if (ch === '"' || ch === '`') {
      i = readQuoted(sql, i, ch, ch, (text) => push('quoted', text));
      continue;
    }
    if (ch === '[') {
      i = readQuoted(sql, i, '[', ']', (text) => push('quoted', text));
      continue;
    }
    if (ch === ',') {
      push('comma', ',');
      i += 1;
      continue;
    }
    if (ch === '(') {
      push('lparen', '(');
      i += 1;
      continue;
    }
    if (ch === ')') {
      push('rparen', ')');
      i += 1;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let end = i;
      while (end < sql.length && /[0-9.eE_]/.test(sql[end] as string)) end += 1;
      push('number', sql.slice(i, end));
      i = end;
      continue;
    }
    if (/[A-Za-z_-￿]/.test(ch)) {
      let end = i;
      while (end < sql.length && /[A-Za-z0-9_$-￿]/.test(sql[end] as string)) end += 1;
      const word = sql.slice(i, end);
      push(KEYWORDS.has(word.toLowerCase()) ? 'keyword' : 'identifier', word);
      i = end;
      continue;
    }
    if (OPERATOR_CHARS.has(ch)) {
      let end = i;
      while (end < sql.length && OPERATOR_CHARS.has(sql[end] as string)) end += 1;
      push('operator', sql.slice(i, end));
      i = end;
      continue;
    }
    push('operator', ch);
    i += 1;
  }
  return tokens;
}

function readQuoted(
  sql: string,
  start: number,
  _open: string,
  close: string,
  emit: (text: string) => void,
): number {
  let i = start + 1;
  while (i < sql.length) {
    if (sql[i] === close) {
      // '' や "" は引用内のエスケープ
      if (close !== ']' && sql[i + 1] === close) {
        i += 2;
        continue;
      }
      emit(sql.slice(start, i + 1));
      return i + 1;
    }
    i += 1;
  }
  emit(sql.slice(start)); // 閉じ忘れはそのまま末尾まで
  return sql.length;
}
