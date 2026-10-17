// 라우팅 (홈 ↔ 흐름)과 훈련 목록. 새 훈련은 js/flows/에 모듈을 만들고 FLOWS에 등록한다.

import * as body from './flows/body.js';
import * as uncertainty from './flows/uncertainty.js';
import * as daehyup from './flows/daehyup.js';
import * as compassion from './flows/compassion.js';
import { getConfig, setConfig, isConfigured, ping, flushQueue, pendingCount } from './lib/sync.js';
import { esc } from './lib/ui.js';

const FLOWS = [
  { ...body.meta, module: body },
  { ...uncertainty.meta, module: uncertainty },
  { ...daehyup.meta, module: daehyup },
  { ...compassion.meta, module: compassion },
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
      <p class="muted note">
        ${isConfigured()
          ? '작성 중인 내용은 이 브라우저에 저장되고, 저장 화면에서 내 Google Docs로만 보내요.'
          : '입력한 내용은 이 브라우저에만 임시 저장되고, 어디로도 전송되지 않아요.'}
        <a href="#/settings">설정</a>
      </p>
    </main>`;
}

function settingsView() {
  const c = getConfig();
  const pending = pendingCount();
  return `
    <header class="flow-head">
      <a class="link" href="#/">← 홈</a>
      <h1>설정</h1>
    </header>
    <main class="flow">
      <p class="lead">훈련 기록을 월별 Google Docs("훈련 기록 2026-10" 같은 문서)에 자동으로 저장해요. 연결 방법은 저장소의 docs/google-docs-setup.md를 보세요.</p>
      <form id="settings-form">
        <label class="field"><span>Apps Script 웹 앱 주소</span>
          <input name="url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(c.url)}"></label>
        <label class="field"><span>비밀 키</span>
          <input name="secret" type="password" autocomplete="off" value="${esc(c.secret)}">
          <small>Apps Script의 스크립트 속성 SECRET과 같은 값이에요.</small></label>
        <label class="check"><input type="checkbox" name="auto" ${c.auto ? 'checked' : ''}> 저장 화면에 오면 자동으로 보내기</label>
        <div class="actions">
          <button type="button" class="ghost" data-test>연결 테스트</button>
          <button type="submit" class="primary">저장</button>
        </div>
      </form>
      <p class="muted" id="settings-msg" aria-live="polite">${pending ? `보내지 못한 기록 ${pending}개가 기다리고 있어요.` : ''}</p>
      <p class="muted note">주소와 비밀 키는 이 브라우저에만 저장돼요. 기기마다 한 번씩 입력해야 해요.</p>
    </main>`;
}

function mountSettings(view) {
  view.innerHTML = settingsView();
  const form = view.querySelector('#settings-form');
  const msg = view.querySelector('#settings-msg');
  const read = () => {
    const f = new FormData(form);
    return { url: String(f.get('url') ?? '').trim(), secret: String(f.get('secret') ?? '').trim(), auto: f.get('auto') === 'on' };
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setConfig(read());
    msg.textContent = '저장했어요.';
    const sent = await flushQueue();
    if (sent) msg.textContent = `저장했어요. 기다리던 기록 ${sent}개를 보냈어요.`;
  });
  view.querySelector('[data-test]').addEventListener('click', async () => {
    const before = getConfig();
    setConfig(read());
    msg.textContent = '확인 중…';
    try {
      await ping();
      msg.textContent = '연결됐어요. 저장을 눌러 확정하세요.';
    } catch (err) {
      msg.textContent = `연결하지 못했어요. 주소와 비밀 키를 확인해 주세요. (${err.message || err})`;
    }
    setConfig(before);
  });
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
  if (id === 'settings') return mountSettings(view);
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
// 지난번에 보내지 못한 기록이 있으면 조용히 다시 보낸다.
flushQueue();
