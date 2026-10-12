// 라우팅 (홈 ↔ 흐름)과 훈련 목록. 새 훈련은 js/flows/에 모듈을 만들고 FLOWS에 등록한다.

import * as uncertainty from './flows/uncertainty.js';

const FLOWS = [
  { order: 1, label: '신체 훈련', available: false },
  { ...uncertainty.meta, module: uncertainty },
  { order: 3, label: '조급함 훈련', available: false },
  { order: 4, label: '자기자비', available: false },
].sort((a, b) => a.order - b.order);

const app = document.getElementById('app');
let unmount = null;

function formatShortDate(date) {
  const [, m, d] = date.split('-').map(Number);
  return `${m}/${d}`;
}

function homeView() {
  return `
    <header class="home-head">
      <h1>오늘의 훈련</h1>
      <p class="muted">순서대로, 매일 같은 흐름으로.</p>
    </header>
    <main class="home">
      <ol class="flow-list">
        ${FLOWS.map((f) => {
          if (!f.available) {
            return `<li><div class="flow-btn off" aria-disabled="true"><span class="num">${f.order}</span><span class="name">${f.label}</span><span class="state">준비 중</span></div></li>`;
          }
          const draft = f.module.draftInfo();
          if (!draft) {
            return `<li><a class="flow-btn" href="#/${f.id}"><span class="num">${f.order}</span><span class="name">${f.label}</span><span class="state">시작</span></a></li>`;
          }
          return `
            <li>
              <div class="flow-btn has-draft">
                <span class="num">${f.order}</span><span class="name">${f.label}</span>
                <span class="draft-acts">
                  <a class="primary small" href="#/${f.id}">이어서 하기 (${formatShortDate(draft.date)})</a>
                  <button class="ghost small" data-new="${f.id}">새로 시작</button>
                </span>
              </div>
            </li>`;
        }).join('')}
      </ol>
      <p class="muted note">입력한 내용은 이 브라우저에만 임시 저장되고, 어디로도 전송되지 않아요.</p>
    </main>`;
}

function route() {
  if (unmount) { unmount(); unmount = null; }
  const id = location.hash.replace(/^#\/?/, '');
  const flow = FLOWS.find((f) => f.available && f.id === id);

  // 흐름마다 새 컨테이너를 써서 이벤트 리스너가 쌓이지 않게 한다.
  const view = document.createElement('div');
  app.replaceChildren(view);

  if (flow) {
    unmount = flow.module.mount(view, { exit: () => { location.hash = '#/'; } });
    return;
  }
  view.innerHTML = homeView();
  view.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-new]');
    if (!btn) return;
    const f = FLOWS.find((x) => x.id === btn.dataset.new);
    f.module.clearDraft();
    location.hash = `#/${f.id}`;
  });
}

window.addEventListener('hashchange', route);
route();
