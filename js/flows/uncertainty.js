// 불확실성 돌아보기: 찾기 → 고르기 → 기록 → 저장. 흐름과 문구는 docs/design.md 4.2절을 따른다.

import { SLOTS, KINDS, RESPONSES, todayString, weekday, objectParticle, formatUncertainty, fileName } from '../lib/format.js';
import { load, save, remove } from '../lib/storage.js';
import { startTimer, formatRemaining } from '../lib/timer.js';
import { downloadText, copyText } from '../lib/download.js';
import { esc, labelOf, flowHeader } from '../lib/ui.js';

const KEY = 'uncertainty-draft-v1';
const DURATIONS = { find: 5 * 60 * 1000, record: 10 * 60 * 1000 };
const STEPS = ['find', 'pick', 'record', 'save'];

const HINTS = [
  ['행동', '확인했다, 다시 읽었다, 장면을 되돌려 봤다, 결론 지으려 했다, 깊은 질문을 서둘렀다, 미리 연습했다, 피했다'],
  ['생각', '"왜 그랬지?", "~하면 어떡하지", "아마 ~겠지"'],
  ['몸', '텐션 상승, 흥분, 조임, 안절부절, 손이 폰으로'],
  ['감정', '조급함, 답답함, 흥분 뒤 후회'],
];

function newState() {
  return {
    version: 1,
    date: todayString(),
    step: 'find',
    noneFound: false,
    traces: [],
    pickedId: null,
    pastUpdate: '',
    record: {
      uncertain: '', prediction: '', confidence: 50,
      actual: '', actualUnknown: false, response: null, evidence: '',
    },
    timers: {},
  };
}

export const meta = { id: 'uncertainty', order: 2, label: '불확실성 훈련', available: true };

export function draftInfo() {
  const s = load(KEY);
  return s ? { date: s.date } : null;
}

export function clearDraft() {
  remove(KEY);
}

export function mount(root, { exit }) {
  let state = load(KEY) || newState();
  let activeSlot = 'morning';
  let editingId = null;
  let stopTimer = null;

  const persist = () => save(KEY, state);
  const go = (step) => {
    state.step = step;
    persist();
    render();
    window.scrollTo(0, 0);
  };

  function stepLabel(step) {
    if (step === 'pick' && state.noneFound) return '업데이트';
    return { find: '찾기', pick: '고르기', record: '기록', save: '저장' }[step];
  }

  function visibleSteps() {
    return state.noneFound ? STEPS.filter((s) => s !== 'record') : STEPS;
  }

  function header() {
    return flowHeader({
      title: '불확실성 돌아보기', date: state.date, day: weekday(state.date),
      steps: visibleSteps(), current: state.step, labels: stepLabel,
    });
  }

  function timerBlock(step) {
    return `
      <div class="timer-row">
        <span class="timer" id="timer" aria-live="off"></span>
      </div>
      <div class="banner" id="timeup" hidden>시간이 됐어요. 여기서 멈추고 다음으로 가요.</div>`;
  }

  // ---------- ① 찾기 ----------
  function findView() {
    const editing = state.traces.find((t) => t.id === editingId);
    const draft = editing ?? { kind: 'action', text: '', unknown: '' };
    const count = (slot) => state.traces.filter((t) => t.slot === slot).length;
    const grouped = SLOTS.map((slot) => {
      const items = state.traces.filter((t) => t.slot === slot.id);
      if (!items.length) return '';
      return `
        <h3 class="group">${slot.label}</h3>
        <ul class="traces">
          ${items.map((t) => `
            <li class="trace ${t.id === editingId ? 'editing' : ''}">
              <div>
                <span class="tag">${labelOf(KINDS, t.kind)}</span> ${esc(t.text)}
                ${t.unknown ? `<div class="sub">→ 나는 ${esc(t.unknown)}${objectParticle(t.unknown)} 모르고, 그게 신경 쓰였다.</div>` : ''}
              </div>
              <div class="trace-acts">
                <button class="link" data-act="edit" data-id="${t.id}">수정</button>
                <button class="link" data-act="delete" data-id="${t.id}">삭제</button>
              </div>
            </li>`).join('')}
        </ul>`;
    }).join('');

    return `
      ${timerBlock('find')}
      <p class="lead">하루를 아침부터 저녁까지 훑으면서, 불확실성이 남긴 흔적을 찾아요.</p>

      <div class="tabs" role="tablist">
        ${SLOTS.map((s) => `
          <button role="tab" class="tab ${s.id === activeSlot ? 'on' : ''}" data-act="slot" data-slot="${s.id}" aria-selected="${s.id === activeSlot}">
            ${s.label}${count(s.id) ? ` <span class="count">${count(s.id)}</span>` : ''}
          </button>`).join('')}
      </div>

      <details class="hints" open>
        <summary>흔적 힌트</summary>
        <dl>${HINTS.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      </details>

      <form class="card" id="trace-form">
        <fieldset class="chips">
          <legend>흔적 종류</legend>
          ${KINDS.map((k) => `
            <label class="chip"><input type="radio" name="kind" value="${k.id}" ${draft.kind === k.id ? 'checked' : ''}><span>${k.label}</span></label>`).join('')}
        </fieldset>
        <label class="field">
          <span>흔적 내용</span>
          <input name="text" required maxlength="200" placeholder="예: 메시지를 몇 번 열어 봄" value="${esc(draft.text)}">
        </label>
        <label class="field">
          <span>나는 <em>____</em>을/를 모르고, 그게 신경 쓰였다.</span>
          <input name="unknown" maxlength="200" placeholder="예: 친구의 반응" value="${esc(draft.unknown)}">
        </label>
        <div class="row">
          ${editing ? '<button type="button" class="ghost" data-act="cancel-edit">취소</button>' : ''}
          <button type="submit" class="primary">${editing ? '수정 저장' : `${labelOf(SLOTS, activeSlot)}에 추가`}</button>
        </div>
      </form>

      ${grouped || '<p class="muted">아직 찾은 흔적이 없어요.</p>'}

      <p class="tip">휴대폰의 메시지 기록이나 사진을 단서로 써도 좋아요.</p>

      <div class="actions">
        <button class="ghost" data-act="none-found">못 찾음</button>
        <button class="primary" data-act="next" ${state.traces.length ? '' : 'disabled'}>다음</button>
      </div>`;
  }

  // ---------- ② 고르기 / 지난 기록 업데이트 ----------
  function pickView() {
    if (state.noneFound) {
      return `
        <p class="lead">지난 기록 중 '아직 모름'이었던 것의 결과가 나왔다면 적어요.</p>
        <label class="field">
          <span>지난 기록 업데이트</span>
          <textarea data-bind="pastUpdate" rows="4">${esc(state.pastUpdate)}</textarea>
        </label>
        <div class="actions"><button class="primary" data-act="next">다음</button></div>`;
    }
    return `
      <p class="lead">가장 신경 쓰였던 것 하나. 고민하지 말고 바로 골라요.</p>
      <fieldset class="pick-list">
        ${state.traces.map((t) => `
          <label class="pick">
            <input type="radio" name="pick" value="${t.id}" ${state.pickedId === t.id ? 'checked' : ''}>
            <span>
              <span class="tag">${labelOf(SLOTS, t.slot)} · ${labelOf(KINDS, t.kind)}</span> ${esc(t.text)}
              ${t.unknown ? `<span class="sub">→ ${esc(t.unknown)}</span>` : ''}
            </span>
          </label>`).join('')}
      </fieldset>
      <div class="actions"><button class="primary" data-act="next" ${state.pickedId ? '' : 'disabled'}>다음</button></div>`;
  }

  // ---------- ③ 기록 ----------
  function recordView() {
    const r = state.record;
    const t = state.traces.find((x) => x.id === state.pickedId);
    return `
      ${timerBlock('record')}
      ${t ? `<div class="picked"><span class="tag">${labelOf(SLOTS, t.slot)} · ${labelOf(KINDS, t.kind)}</span> ${esc(t.text)}</div>` : ''}

      <label class="field">
        <span>1. 불확실했던 것</span>
        <input data-bind="record.uncertain" value="${esc(r.uncertain)}">
      </label>

      <div class="field">
        <label for="prediction">2. 그때 예상</label>
        <input id="prediction" data-bind="record.prediction" placeholder="아마 ___할 거야" value="${esc(r.prediction)}">
        <label class="range">
          <span>확신도 <output id="conf-out">${r.confidence}%</output></span>
          <input type="range" min="0" max="100" step="10" data-bind="record.confidence" value="${r.confidence}">
        </label>
        <small>지금이 아니라 그때 했던 예상을 써요.</small>
      </div>

      <div class="field">
        <label for="actual">3. 실제로 일어난 것</label>
        <input id="actual" data-bind="record.actual" value="${esc(r.actual)}" ${r.actualUnknown ? 'disabled' : ''}>
        <label class="check"><input type="checkbox" data-bind="record.actualUnknown" ${r.actualUnknown ? 'checked' : ''}> 아직 모름</label>
        <small>해석 말고 사실만 써요.</small>
      </div>

      <fieldset class="field chips">
        <legend>4. 나는</legend>
        ${RESPONSES.map((x) => `
          <label class="chip"><input type="radio" name="response" value="${x.id}" ${r.response === x.id ? 'checked' : ''}><span>${x.label}</span></label>`).join('')}
        <small>판단하지 않고 체크만 해요.</small>
      </fieldset>

      <label class="field">
        <span>5. 내가 감당했다는 증거</span>
        <textarea data-bind="record.evidence" rows="3">${esc(r.evidence)}</textarea>
        <small>"불편했는데 하루가 무너지지 않았다"도 충분해요.</small>
      </label>

      <div class="actions"><button class="primary" data-act="next">다음</button></div>`;
  }

  // ---------- ④ 저장 ----------
  function saveView() {
    return `
      <p class="lead">오늘의 기록이에요. 파일로 내려받아 보관해요.</p>
      <pre class="preview">${esc(formatUncertainty(state))}</pre>
      <div class="actions stack">
        <button class="primary" data-act="download">텍스트 파일 다운로드</button>
        <button class="ghost" data-act="copy">복사</button>
        <button class="ghost" data-act="home">홈으로</button>
      </div>
      <p class="muted" id="save-msg" aria-live="polite"></p>`;
  }

  function render() {
    if (stopTimer) { stopTimer(); stopTimer = null; }
    const body = { find: findView, pick: pickView, record: recordView, save: saveView }[state.step]();
    root.innerHTML = `${header()}<main class="flow">${body}</main>`;

    if (DURATIONS[state.step]) {
      const step = state.step;
      if (!state.timers[step]) { state.timers[step] = Date.now(); persist(); }
      const el = root.querySelector('#timer');
      const banner = root.querySelector('#timeup');
      stopTimer = startTimer({
        startedAt: state.timers[step],
        durationMs: DURATIONS[step],
        onTick: (ms) => { el.textContent = `남은 시간 ${formatRemaining(ms)}`; },
        onEnd: () => { banner.hidden = false; },
      });
    }
  }

  function setPath(path, value) {
    const keys = path.split('.');
    let obj = state;
    for (const k of keys.slice(0, -1)) obj = obj[k];
    obj[keys.at(-1)] = value;
  }

  // 입력은 다시 그리지 않고 상태만 갱신한다 (포커스 유지).
  root.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.bind) {
      const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
      setPath(el.dataset.bind, v);
      if (el.type === 'range') root.querySelector('#conf-out').textContent = `${v}%`;
      if (el.dataset.bind === 'record.actualUnknown') root.querySelector('#actual').disabled = v;
      persist();
    } else if (el.name === 'pick') {
      state.pickedId = el.value;
      persist();
      root.querySelector('[data-act="next"]').disabled = false;
    } else if (el.name === 'response') {
      state.record.response = el.value;
      persist();
    }
  });

  root.addEventListener('submit', (e) => {
    if (e.target.id !== 'trace-form') return;
    e.preventDefault();
    const f = new FormData(e.target);
    const text = String(f.get('text') ?? '').trim();
    if (!text) return;
    const fields = { kind: f.get('kind') || 'action', text, unknown: String(f.get('unknown') ?? '').trim() };
    if (editingId) {
      Object.assign(state.traces.find((t) => t.id === editingId), fields);
      editingId = null;
    } else {
      state.traces.push({ id: `t${Date.now().toString(36)}`, slot: activeSlot, ...fields });
    }
    state.noneFound = false;
    persist();
    render();
    root.querySelector('#trace-form input[name="text"]')?.focus();
  });

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'back') {
      const steps = visibleSteps();
      const idx = steps.indexOf(state.step);
      if (idx <= 0) return exit();
      return go(steps[idx - 1]);
    }
    if (act === 'home') return exit();
    if (act === 'slot') { activeSlot = btn.dataset.slot; editingId = null; return render(); }
    if (act === 'edit') {
      editingId = btn.dataset.id;
      activeSlot = state.traces.find((t) => t.id === editingId).slot;
      return render();
    }
    if (act === 'cancel-edit') { editingId = null; return render(); }
    if (act === 'delete') {
      state.traces = state.traces.filter((t) => t.id !== btn.dataset.id);
      if (state.pickedId === btn.dataset.id) state.pickedId = null;
      if (editingId === btn.dataset.id) editingId = null;
      persist();
      return render();
    }
    if (act === 'none-found') { state.noneFound = true; return go('pick'); }
    if (act === 'next') {
      if (state.step === 'find') { state.noneFound = false; return go('pick'); }
      if (state.step === 'pick') {
        if (state.noneFound) return go('save');
        const t = state.traces.find((x) => x.id === state.pickedId);
        if (t && !state.record.uncertain) state.record.uncertain = t.unknown;
        return go('record');
      }
      if (state.step === 'record') return go('save');
    }
    if (act === 'download') {
      downloadText(fileName(state), formatUncertainty(state));
      root.querySelector('#save-msg').textContent = `${fileName(state)} 파일을 내려받았어요.`;
    }
    if (act === 'copy') {
      const ok = await copyText(formatUncertainty(state));
      root.querySelector('#save-msg').textContent = ok ? '복사했어요.' : '복사할 수 없어요. 미리보기에서 직접 선택해 주세요.';
    }
  });

  render();
  return () => { if (stopTimer) stopTimer(); };
}
