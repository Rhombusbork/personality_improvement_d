// Google Docs 자동 저장. 사용자가 설정에 넣은 자신의 Apps Script 주소로만 보낸다 (gas/Code.gs).
// 주소와 비밀 키는 이 브라우저의 localStorage 에만 저장한다.

import { load, save } from './storage.js';
import { esc } from './ui.js';

const CONFIG_KEY = 'sync-config-v1';
const QUEUE_KEY = 'sync-queue-v1';

export function getConfig() {
  return { url: '', secret: '', auto: true, ...(load(CONFIG_KEY) ?? {}) };
}

export function setConfig(config) {
  save(CONFIG_KEY, config);
}

export const isConfigured = () => {
  const c = getConfig();
  return !!(c.url && c.secret);
};

async function post(body) {
  const { url, secret } = getConfig();
  // text/plain 으로 보내야 Apps Script 가 사전 요청(preflight) 없이 받는다.
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, secret }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'error');
  return data;
}

export const ping = () => post({ action: 'ping' });

// 실패한 기록은 큐에 남겨 두고 나중에 다시 보낸다. 같은 날짜·제목은 최신 것만 남긴다.
function enqueue(entry) {
  const q = (load(QUEUE_KEY) ?? []).filter((x) => !(x.date === entry.date && x.title === entry.title));
  q.push(entry);
  save(QUEUE_KEY, q);
}

export const pendingCount = () => (load(QUEUE_KEY) ?? []).length;

export async function flushQueue() {
  if (!isConfigured()) return 0;
  const q = load(QUEUE_KEY) ?? [];
  const left = [];
  for (const entry of q) {
    try { await post(entry); } catch { left.push(entry); }
  }
  save(QUEUE_KEY, left);
  return q.length - left.length;
}

export async function sendEntry(entry) {
  try {
    const data = await post(entry);
    return { ok: true, url: data.url };
  } catch (err) {
    enqueue(entry);
    return { ok: false, error: String(err.message || err) };
  }
}

// 저장 화면에 붙는 조각. 연결 전이면 설정 안내만 보여 준다.
export function syncBlock() {
  if (!isConfigured()) {
    return '<p class="muted sync-msg">Google Docs에 자동으로 저장하려면 <a href="#/settings">설정</a>에서 연결하세요.</p>';
  }
  return `
    <div class="sync-row">
      <button class="ghost" data-sync>Google Docs에 저장</button>
      <span class="muted sync-msg" id="sync-msg" aria-live="polite"></span>
    </div>`;
}

// 저장 화면에서 호출한다. auto 가 켜져 있으면 바로 보내고, 버튼으로 다시 보낼 수도 있다.
export function attachSync(root, getEntry, { auto = true } = {}) {
  const btn = root.querySelector('[data-sync]');
  if (!btn) return;
  const msg = root.querySelector('#sync-msg');
  const run = async () => {
    btn.disabled = true;
    msg.textContent = '저장 중…';
    const r = await sendEntry(getEntry());
    btn.disabled = false;
    msg.innerHTML = r.ok
      ? `저장됐어요. <a href="${esc(r.url)}" target="_blank" rel="noopener">문서 열기</a>`
      : '지금은 저장하지 못했어요. 다음에 앱을 열 때 다시 보낼게요. 다운로드도 할 수 있어요.';
  };
  btn.addEventListener('click', run);
  if (auto && getConfig().auto) run();
}
