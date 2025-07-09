/**
 * エディタの状態(SQL・方言・大文字化)をURLで共有するためのエンコード。
 *
 * 状態をJSONにしてUTF-8安全なbase64urlへ畳み、`#s=...` に載せる。リンクを送れば
 * 相手の画面に同じ入力と設定が開く。サーバーを介さず、すべてURLの中で完結する。
 */

import type { Dialect } from './format';

export interface ShareState {
  sql: string;
  dialect: Dialect;
  uppercase: boolean;
}

const DIALECTS: ReadonlySet<string> = new Set(['standard', 'mysql', 'sqlserver']);

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** 状態を `s=...` の形のハッシュ文字列(先頭の#は付けない)へ符号化する。 */
export function encodeState(state: ShareState): string {
  return 's=' + toBase64Url(JSON.stringify(state));
}

/** ハッシュ(`#s=...` でも `s=...` でも可)から状態を復元する。読めなければnull。 */
export function decodeState(hash: string): ShareState | null {
  const match = /[#&]?s=([^&]+)/.exec(hash);
  if (!match) return null;
  try {
    const data = JSON.parse(fromBase64Url(match[1] as string)) as Partial<ShareState>;
    if (
      typeof data.sql === 'string' &&
      typeof data.uppercase === 'boolean' &&
      typeof data.dialect === 'string' &&
      DIALECTS.has(data.dialect)
    ) {
      return { sql: data.sql, dialect: data.dialect as Dialect, uppercase: data.uppercase };
    }
  } catch {
    /* 壊れたハッシュは無視 */
  }
  return null;
}
