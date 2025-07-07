import { describe, expect, it } from 'vitest';

import { format } from './format';
import { tokenize } from './tokenize';

describe('tokenize', () => {
  it('文字列と引用識別子を塊で切る', () => {
    const tokens = tokenize(`SELECT "user name", 'O''Brien' FROM \`t\``);
    expect(tokens.map((t) => t.type)).toEqual([
      'keyword',
      'quoted',
      'comma',
      'string',
      'keyword',
      'quoted',
    ]);
    expect(tokens[3]?.text).toBe("'O''Brien'");
  });

  it('コメントを保つ', () => {
    const tokens = tokenize('SELECT 1 -- メモ\n/* 複数行 */');
    expect(tokens.filter((t) => t.type === 'comment').map((t) => t.text)).toEqual([
      '-- メモ',
      '/* 複数行 */',
    ]);
  });

  it('演算子と数値', () => {
    const tokens = tokenize('a >= 10.5');
    expect(tokens.map((t) => `${t.type}:${t.text}`)).toEqual([
      'identifier:a',
      'operator:>=',
      'number:10.5',
    ]);
  });
});

describe('format', () => {
  it('主要句で改行しキーワードを大文字化する', () => {
    const out = format('select id, name from users where age > 20 order by id');
    expect(out).toBe('SELECT id,\n  name\nFROM users\nWHERE age > 20\nORDER BY id\n');
  });

  it('AND/ORで折り返す', () => {
    const out = format('select * from t where a = 1 and b = 2 or c = 3');
    expect(out).toContain('WHERE a = 1\n  AND b = 2\n  OR c = 3');
  });

  it('JOINが行頭に来る', () => {
    const out = format('select * from a left join b on a.id = b.id');
    expect(out).toContain('FROM a\nLEFT JOIN b ON a.id = b.id');
  });

  it('小文字オプション', () => {
    const out = format('SELECT ID FROM T', { uppercase: false });
    expect(out.startsWith('select ID\nfrom T')).toBe(true);
  });

  it('文字列リテラルには触れない', () => {
    const out = format("select 'It''s SELECT FROM where' from t");
    expect(out).toContain("'It''s SELECT FROM where'");
  });

  it('括弧内のカンマでは改行しない', () => {
    const out = format('select count(a, b) from t');
    expect(out).toContain('COUNT(a, b)');
  });

  it('コメントが残る', () => {
    const out = format('select 1 -- 件数\nfrom t');
    expect(out).toContain('-- 件数');
  });
});

describe('識別子の引用変換', () => {
  const sql = 'select `user name`, [order] , "group" from `t`';

  it('standardは二重引用符', () => {
    const out = format(sql, { dialect: 'standard' });
    expect(out).toContain('"user name"');
    expect(out).toContain('"order"');
    expect(out).toContain('"group"');
  });

  it('mysqlはバッククォート', () => {
    const out = format(sql, { dialect: 'mysql' });
    expect(out).toContain('`user name`');
    expect(out).toContain('`order`');
  });

  it('sqlserverは角括弧', () => {
    const out = format(sql, { dialect: 'sqlserver' });
    expect(out).toContain('[user name]');
    expect(out).toContain('[group]');
  });

  it('引用内のエスケープを保つ', () => {
    const out = format('select "a""b" from t', { dialect: 'mysql' });
    expect(out).toContain('`a"b`');
  });
});

describe('LIMITの方言変換', () => {
  it('standardはFETCH FIRSTになる', () => {
    const out = format('select * from t limit 10', { dialect: 'standard' });
    expect(out).toContain('FETCH FIRST 10 ROWS ONLY');
  });

  it('standardのOFFSET付き', () => {
    const out = format('select * from t limit 10 offset 20', { dialect: 'standard' });
    expect(out).toContain('OFFSET 20 ROWS');
    expect(out).toContain('FETCH NEXT 10 ROWS ONLY');
  });

  it('mysqlはLIMITのまま', () => {
    const out = format('select * from t limit 10 offset 20', { dialect: 'mysql' });
    expect(out).toContain('LIMIT 10');
    expect(out).toContain('OFFSET 20');
  });

  it('sqlserverはTOPになる', () => {
    const out = format('select id from t limit 10', { dialect: 'sqlserver' });
    expect(out).toContain('SELECT TOP 10 id');
    expect(out).not.toContain('LIMIT');
  });

  it('sqlserverのOFFSET付きは標準形', () => {
    const out = format('select id from t order by id limit 10 offset 5', {
      dialect: 'sqlserver',
    });
    expect(out).toContain('OFFSET 5 ROWS');
    expect(out).toContain('FETCH NEXT 10 ROWS ONLY');
  });
});

describe('BETWEENと複数文', () => {
  it('BETWEENのANDは折り返さず、続く論理ANDは折り返す', () => {
    const out = format('select * from t where x between 1 and 10 and y = 2');
    expect(out).toContain('WHERE x BETWEEN 1 AND 10\n  AND y = 2');
  });

  it('セミコロンは前に空白を入れず、次の文を1行空けて始める', () => {
    const out = format('select a from t; select b from u');
    expect(out).toBe('SELECT a\nFROM t;\n\nSELECT b\nFROM u\n');
  });

  it('2文目以降もBETWEENの状態を引きずらない', () => {
    const out = format('select * from t where x between 1 and 5; select * from u where a = 1 and b = 2');
    expect(out).toContain('WHERE a = 1\n  AND b = 2');
  });
});

describe('壊れた入力', () => {
  it('閉じていない文字列でも例外を投げない', () => {
    expect(() => format("select 'mitojiru from t")).not.toThrow();
  });

  it('空入力', () => {
    expect(format('')).toBe('\n');
  });
});
