// 흐름 화면에서 공통으로 쓰는 작은 도우미.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const labelOf = (list, id) => list.find((x) => x.id === id)?.label ?? '';

export function flowHeader({ title, date, day, steps, current, labels }) {
  const idx = steps.indexOf(current);
  return `
    <header class="flow-head">
      <button class="link" data-act="back">← ${idx === 0 ? '홈' : '이전'}</button>
      <h1>${esc(title)}</h1>
      <p class="date">${esc(date)} (${day})</p>
      <ol class="stepper">
        ${steps.map((s, i) => `<li class="${i < idx ? 'done' : i === idx ? 'now' : ''}">${labels(s)}</li>`).join('')}
      </ol>
    </header>`;
}
