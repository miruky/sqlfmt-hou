/** sqlfmt-houのUI。入力のたびに整形して右ペインへ出す。 */

import './style.css';
import { format, highlightHtml, type Dialect } from './index';
import { decodeState, encodeState, type ShareState } from './share';

function query<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`要素が見つからない: ${selector}`);
  return el;
}

const input = query<HTMLTextAreaElement>('#input');
const output = query<HTMLPreElement>('#output');
const dialect = query<HTMLSelectElement>('#dialect');
const uppercase = query<HTMLInputElement>('#uppercase');
const copied = query<HTMLSpanElement>('#copied');
const stats = query<HTMLParagraphElement>('#stats');

const STORE_KEY = 'sqlfmt-hou-state';

// localStorageはプライベートモード等で例外を投げるため、失敗しても黙って続ける。
function saveLocal(state: ShareState): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* 保存できなくても整形は使える */
  }
}

function loadLocal(): ShareState | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<ShareState>;
    if (typeof data.sql === 'string' && typeof data.uppercase === 'boolean' && data.dialect) {
      return { sql: data.sql, dialect: data.dialect, uppercase: data.uppercase };
    }
  } catch {
    /* 読めなければ既定値 */
  }
  return null;
}

function currentState(): ShareState {
  return { sql: input.value, dialect: dialect.value as Dialect, uppercase: uppercase.checked };
}

let lastFormatted = '';

function render(): void {
  lastFormatted = format(input.value, {
    dialect: dialect.value as Dialect,
    uppercase: uppercase.checked,
  });
  if (input.value.trim() === '') {
    output.textContent = '';
    output.dataset.empty = 'ここに整形結果が出ます';
  } else {
    delete output.dataset.empty;
    output.innerHTML = highlightHtml(lastFormatted);
  }
  renderStats();
  saveLocal(currentState());
}

function renderStats(): void {
  if (input.value.trim() === '') {
    stats.textContent = '';
    return;
  }
  const lines = lastFormatted.replace(/\n+$/, '').split('\n').length;
  const statements = lastFormatted.split(';').filter((s) => s.trim() !== '').length;
  stats.textContent = `${lines} 行 · ${statements} 文`;
}

function flash(message: string): void {
  copied.textContent = message;
  setTimeout(() => (copied.textContent = ''), 1600);
}

function applyState(state: ShareState): void {
  input.value = state.sql;
  dialect.value = state.dialect;
  uppercase.checked = state.uppercase;
}

input.addEventListener('input', render);
dialect.addEventListener('input', render);
uppercase.addEventListener('input', render);

query<HTMLButtonElement>('#copy').addEventListener('click', () => {
  void navigator.clipboard.writeText(lastFormatted).then(() => flash('コピーした'));
});

query<HTMLButtonElement>('#share').addEventListener('click', () => {
  const hash = '#' + encodeState(currentState());
  history.replaceState(null, '', location.pathname + location.search + hash);
  const url = location.href;
  void navigator.clipboard.writeText(url).then(() => flash('リンクをコピーした'));
});

// 起動時は 共有リンク → localStorage → HTMLの既定 の順に状態を決める。
const initial = decodeState(location.hash) ?? loadLocal();
if (initial) applyState(initial);
render();
