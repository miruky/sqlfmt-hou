/** sqlfmt-houのUI。入力のたびに整形して右ペインへ出す。 */

import './style.css';
import { format, highlightHtml, type Dialect } from './index';

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

let lastFormatted = '';

function render(): void {
  lastFormatted = format(input.value, {
    dialect: dialect.value as Dialect,
    uppercase: uppercase.checked,
  });
  output.innerHTML = highlightHtml(lastFormatted);
}

input.addEventListener('input', render);
dialect.addEventListener('input', render);
uppercase.addEventListener('input', render);

query<HTMLButtonElement>('#copy').addEventListener('click', () => {
  void navigator.clipboard.writeText(lastFormatted).then(() => {
    copied.textContent = 'コピーした';
    setTimeout(() => (copied.textContent = ''), 1600);
  });
});

render();
