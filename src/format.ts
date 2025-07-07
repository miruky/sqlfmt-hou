/**
 * SQLの整形と方言変換。
 *
 * 整形は「主要句の前で改行し、句の中身を1段インデント」という
 * 保守的な規則に絞る。方言変換は識別子の引用符と
 * LIMIT/OFFSET系の書き換えだけを扱い、それ以外の構文には触れない。
 */

import { type Token, tokenize } from './tokenize';

export type Dialect = 'standard' | 'mysql' | 'sqlserver';

export interface FormatOptions {
  dialect?: Dialect;
  uppercase?: boolean;
  indent?: string;
}

const CLAUSE_STARTERS = new Set([
  'select',
  'from',
  'where',
  'group',
  'having',
  'order',
  'limit',
  'offset',
  'values',
  'set',
  'union',
  'fetch',
]);
const JOIN_WORDS = new Set(['join', 'inner', 'left', 'right', 'full', 'cross']);
const NO_SPACE_BEFORE = new Set([',', ')']);
const FUNCTION_KEYWORDS = new Set(['count', 'sum', 'avg', 'min', 'max', 'cast']);

function unquote(text: string): string {
  const inner = text.slice(1, -1);
  if (text.startsWith('`')) return inner.replaceAll('``', '`');
  if (text.startsWith('"')) return inner.replaceAll('""', '"');
  return inner; // [x]
}

function requote(name: string, dialect: Dialect): string {
  if (dialect === 'mysql') return '`' + name.replaceAll('`', '``') + '`';
  if (dialect === 'sqlserver') return '[' + name + ']';
  return '"' + name.replaceAll('"', '""') + '"';
}

/** LIMIT n / LIMIT n OFFSET m を方言の形へ置き換えたトークン列を返す。 */
function convertLimit(tokens: Token[], dialect: Dialect): Token[] {
  const result: Token[] = [];
  let i = 0;
  const kw = (text: string): Token => ({ type: 'keyword', text });
  while (i < tokens.length) {
    const token = tokens[i] as Token;
    const isLimit = token.type === 'keyword' && token.text.toLowerCase() === 'limit';
    const count = tokens[i + 1];
    if (!isLimit || count === undefined || count.type !== 'number') {
      result.push(token);
      i += 1;
      continue;
    }
    let offset: Token | null = null;
    let consumed = 2;
    const maybeOffset = tokens[i + 2];
    if (
      maybeOffset?.type === 'keyword' &&
      maybeOffset.text.toLowerCase() === 'offset' &&
      tokens[i + 3]?.type === 'number'
    ) {
      offset = tokens[i + 3] as Token;
      consumed = 4;
    }
    if (dialect === 'mysql') {
      result.push(kw('LIMIT'), count);
      if (offset) result.push(kw('OFFSET'), offset);
    } else if (dialect === 'standard') {
      if (offset) result.push(kw('OFFSET'), offset, kw('ROWS'));
      result.push(kw('FETCH'), kw(offset ? 'NEXT' : 'FIRST'), count, kw('ROWS'), kw('ONLY'));
    } else {
      // SQL ServerはOFFSETにORDER BYが必須のため、OFFSET付きは標準形へ
      if (offset) {
        result.push(kw('OFFSET'), offset, kw('ROWS'));
        result.push(kw('FETCH'), kw('NEXT'), count, kw('ROWS'), kw('ONLY'));
      } else {
        // 先頭のSELECT直後に TOP n を差し込む
        const selectAt = result.findIndex(
          (item) => item.type === 'keyword' && item.text.toLowerCase() === 'select',
        );
        if (selectAt >= 0) {
          result.splice(selectAt + 1, 0, kw('TOP'), count);
        } else {
          result.push(kw('FETCH'), kw('FIRST'), count, kw('ROWS'), kw('ONLY'));
        }
      }
    }
    i += consumed;
  }
  return result;
}

/** SQLを整形する。構文エラーでも例外は投げず、できる範囲で並べ直す。 */
export function format(sql: string, options: FormatOptions = {}): string {
  const dialect = options.dialect ?? 'standard';
  const uppercase = options.uppercase ?? true;
  const indent = options.indent ?? '  ';

  let tokens = tokenize(sql);
  tokens = convertLimit(tokens, dialect);

  const lines: string[] = [];
  let current = '';
  let depth = 0;
  let clauseIndent = 0;

  const flush = (): void => {
    if (current.trim() !== '') lines.push(current.trimEnd());
    current = '';
  };
  const newline = (extra = 0): void => {
    flush();
    current = indent.repeat(depth + clauseIndent + extra);
  };
  let glueNext = false;
  // BETWEEN a AND b の AND は論理結合ではなく句の一部なので折り返さない。
  let betweenPending = false;
  // セミコロン直後は1行空けて次の文を始める。末尾に余計な空行を残さないため遅延させる。
  let needBlank = false;
  const append = (text: string): void => {
    if (
      glueNext ||
      current === '' ||
      current.endsWith('(') ||
      /\s$/.test(current) ||
      NO_SPACE_BEFORE.has(text)
    ) {
      current += text;
    } else {
      current += ' ' + text;
    }
    glueNext = false;
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] as Token;
    const lower = token.text.toLowerCase();
    if (needBlank) {
      lines.push('');
      needBlank = false;
    }
    if (token.type === 'keyword') {
      const word = uppercase ? token.text.toUpperCase() : lower;
      const isClause = CLAUSE_STARTERS.has(lower);
      const isJoin = JOIN_WORDS.has(lower);
      const previous = tokens[i - 1];
      const previousLower = previous?.text.toLowerCase() ?? '';
      const continuesClause =
        (lower === 'by' && (previousLower === 'group' || previousLower === 'order')) ||
        lower === 'first' ||
        lower === 'next' ||
        lower === 'rows' ||
        lower === 'only';
      if (isClause && !continuesClause && current.trim() !== '') {
        clauseIndent = 0;
        newline();
      } else if (
        isJoin &&
        previousLower !== 'inner' &&
        previousLower !== 'left' &&
        previousLower !== 'right' &&
        previousLower !== 'full' &&
        previousLower !== 'cross' &&
        current.trim() !== ''
      ) {
        clauseIndent = 0;
        newline();
      } else if (
        (lower === 'or' || (lower === 'and' && !betweenPending)) &&
        current.trim() !== ''
      ) {
        clauseIndent = 1;
        newline();
        clauseIndent = 0;
      }
      append(word);
      if (isClause && lower !== 'union') clauseIndent = 1;
      // BETWEENを見たら直後のANDを句の一部として扱い、出会ったANDで解除する。
      // 句の切り替えでも取りこぼさないよう解除しておく。
      if (lower === 'between') betweenPending = true;
      else if (lower === 'and' || isClause) betweenPending = false;
      continue;
    }
    if (token.type === 'quoted') {
      append(requote(unquote(token.text), dialect));
      continue;
    }
    if (token.type === 'comma') {
      append(',');
      if (depth === 0) newline();
      continue;
    }
    if (token.type === 'lparen') {
      const previous = tokens[i - 1];
      const isCall =
        previous !== undefined &&
        (previous.type === 'identifier' ||
          previous.type === 'quoted' ||
          (previous.type === 'keyword' && FUNCTION_KEYWORDS.has(previous.text.toLowerCase())));
      if (isCall) glueNext = true;
      append('(');
      depth += 1;
      continue;
    }
    if (token.type === 'rparen') {
      depth = Math.max(0, depth - 1);
      append(')');
      continue;
    }
    if (token.type === 'comment') {
      append(token.text);
      newline();
      continue;
    }
    if (token.type === 'operator' && token.text === '.') {
      current += '.';
      glueNext = true;
      continue;
    }
    if (token.type === 'operator' && token.text === ';') {
      // 文末。前に空白を入れず、深さと句インデントを戻し、次の文は1行空けて始める。
      current = current.trimEnd() + ';';
      flush();
      depth = 0;
      clauseIndent = 0;
      betweenPending = false;
      needBlank = true;
      continue;
    }
    append(token.text);
  }
  flush();
  return lines.join('\n') + '\n';
}
