// 신체 훈련: 시작 점수 → 공명 호흡 → 감정 위치 찾기 → 그냥 같이 있기 → 저장. docs/design.md 4.3절.

import { todayString, weekday, BODY_PLACES, BODY_FEELS, formatBody, bodyFileName } from '../lib/format.js';
import { load, save, remove } from '../lib/storage.js';
import { startTimer, formatRemaining } from '../lib/timer.js';
import { downloadText, copyText } from '../lib/download.js';
import { esc, flowHeader } from '../lib/ui.js';
import { syncBlock, attachSync } from '../lib/sync.js';

const KEY = 'body-draft-v1';
const STEPS = ['score', 'breath', 'locate', 'stay', 'save'];
const LABELS = { score: '점수', breath: '호흡', locate: '위치', stay: '머물기', save: '저장' };
const BREATH_MS = 5 * 60 * 1000;
const LOCATE_MS = 5 * 60 * 1000;
const STAY_MS = 2 * 60 * 1000;
const HALF_BREATH_MS = 5000; // 5초 들이쉬고 5초 내쉬기

function newState() {
  return {
    version: 1,
    date: todayString(),
    step: 'score',
    scores: { anxiety: null, blame: null },
    breath: { startedAt: null, seconds: 0 },
    moment: '',
    spots: [],
    stay: { startedAt: null, seconds: 0 },
    timers: {},
  };
}

export const meta = { id: 'body', order: 1, label: '신체 훈련', available: true };

export function draftInfo() {
  const s = load(KEY);
  return s ? { date: s.date } : null;
}

export function clearDraft() {
  remove(KEY);
}

export function mount(root, { exit }) {
  let state = load(KEY) || newState();
  let stopTimer = null;
  const persist = () => save(KEY, state);

  // 단계를 떠날 때 진행한 시간을 기록한다.
  function capture(part, maxMs) {
    if (!part.startedAt) return;
    const ms = Math.min(maxMs, Date.now() - part.startedAt);
    part.seconds = Math.max(part.seconds, Math.floor(ms / 1000));
  }

  function go(step) {
    if (state.step === 'breath') capture(state.breath, BREATH_MS);
    if (state.step === 'stay') capture(state.stay, STAY_MS);
    state.step = step;
    persist();
    render();
    window.scrollTo(0, 0);
  }

  const scoreRow = (name, value) => `
    <div class="chips scale">
      ${Array.from({ length: 11 }, (_, i) => `
        <label class="chip"><input type="radio" name="${name}" value="${i}" ${value === i ? 'checked' : ''}><span>${i}</span></label>`).join('')}
    </div>`;

  function scoreView() {
    return `
      <p class="lead">지금 상태를 날씨처럼 적어요. 낮추려는 숫자가 아니에요.</p>
      <fieldset class="field"><legend>지금 불안</legend>${scoreRow('anxiety', state.scores.anxiety)}</fieldset>
      <fieldset class="field"><legend>지금 나를 향한 비난</legend>${scoreRow('blame', state.scores.blame)}</fieldset>
      <div class="actions"><button class="primary" data-act="next">다음</button></div>`;
  }

  function pacer(part, total, startLabel, guide) {
    if (!part.startedAt) {
      return `
        <p class="lead">${guide}</p>
        <div class="actions"><button class="primary" data-act="start">${startLabel}</button></div>`;
    }
    return `
      <div class="timer-row"><span class="timer" id="timer"></span></div>
      <div class="banner" id="timeup" hidden>${total}이 지났어요. 다음으로 가요.</div>
      <div class="pacer-wrap"><div class="pacer" id="pacer"></div><p class="pacer-text" id="phase"></p></div>`;
  }

  function breathView() {
    return `
      ${pacer(state.breath, '5분', '호흡 시작', '5초 들이쉬고 5초 내쉬어요. 원이 커질 때 들이쉬고, 작아질 때 내쉬어요.')}
      <div class="actions"><button class="primary" data-act="next">다음</button></div>`;
  }

  function locateView() {
    return `
      <div class="timer-row"><span class="timer" id="timer"></span></div>
      <div class="banner" id="timeup" hidden>시간이 됐어요. 여기서 멈추고 다음으로 가요.</div>
      <p class="lead">눈을 감고 오늘 가장 텐션이 올랐던 순간을 떠올려요. 몸 어디에 무엇이 느껴지는지 찾아서 이름만 붙여요. 바꾸려 하지 않아요.</p>
      <label class="field">
        <span>떠올린 순간</span>
        <input data-bind="moment" maxlength="200" placeholder="예: 회의에서 말이 빨라졌을 때" value="${esc(state.moment)}">
      </label>

      <form class="card" id="spot-form">
        <fieldset class="chips">
          <legend>어디에</legend>
          ${BODY_PLACES.map((p) => `<label class="chip"><input type="radio" name="place" value="${p}"><span>${p}</span></label>`).join('')}
        </fieldset>
        <fieldset class="chips">
          <legend>무엇이</legend>
          ${BODY_FEELS.map((f) => `<label class="chip"><input type="radio" name="feel" value="${f}"><span>${f}</span></label>`).join('')}
        </fieldset>
        <label class="field">
          <span>직접 적기 (선택)</span>
          <input name="feelText" maxlength="50" placeholder="목록에 없으면 여기에">
        </label>
        <label class="range">
          <span>강도 <output id="int-out">3</output></span>
          <input type="range" name="intensity" min="0" max="10" step="1" value="3">
        </label>
        <div class="row"><button type="submit" class="primary">추가</button></div>
      </form>

      ${state.spots.length ? `
        <ul class="traces">
          ${state.spots.map((p) => `
            <li class="trace">
              <div>${esc(p.place || '?')}, ${esc(p.feel || '?')}, ${p.intensity}</div>
              <div class="trace-acts"><button class="link" data-act="delete" data-id="${p.id}">삭제</button></div>
            </li>`).join('')}
        </ul>` : '<p class="muted">아직 찾은 감각이 없어요. 못 찾아도 괜찮아요.</p>'}

      <div class="actions"><button class="primary" data-act="next">다음</button></div>`;
  }

  function stayView() {
    return `
      ${pacer(state.stay, '2분', '시작', '분석하지 않고, 그 느낌 옆에 2분 동안 그냥 있어요.')}
      ${state.stay.startedAt ? '<p class="lead center">분석하지 않고, 그 느낌 옆에 그냥 있어요.</p>' : ''}
      <div class="actions"><button class="primary" data-act="next">다음</button></div>`;
  }

  function saveView() {
    return `
      <p class="lead">오늘의 기록이에요. 파일로 내려받아 보관해요.</p>
      <pre class="preview">${esc(formatBody(state))}</pre>
      <div class="actions stack">
        <button class="primary" data-act="download">텍스트 파일 다운로드</button>
        <button class="ghost" data-act="copy">복사</button>
        <button class="ghost" data-act="home">홈으로</button>
      </div>
      <p class="muted" id="save-msg" aria-live="polite"></p>
      ${syncBlock()}`;
  }

  function runTimer(startedAt, durationMs, { breathing = false } = {}) {
    const el = root.querySelector('#timer');
    const banner = root.querySelector('#timeup');
    const phase = root.querySelector('#phase');
    const pacerEl = root.querySelector('#pacer');
    if (pacerEl) {
      // 새로고침해도 호흡 리듬이 이어지도록 애니메이션 위치를 맞춘다.
      pacerEl.style.animationDelay = `-${(Date.now() - startedAt) % (HALF_BREATH_MS * 2)}ms`;
      if (!breathing) pacerEl.classList.add('still');
    }
    stopTimer = startTimer({
      startedAt,
      durationMs,
      onTick: (ms) => {
        el.textContent = `남은 시간 ${formatRemaining(ms)}`;
        if (phase && breathing) {
          const t = (Date.now() - startedAt) % (HALF_BREATH_MS * 2);
          const inhale = t < HALF_BREATH_MS;
          const left = Math.ceil((HALF_BREATH_MS - (t % HALF_BREATH_MS)) / 1000);
          phase.textContent = `${inhale ? '들이쉬기' : '내쉬기'} ${left}`;
        }
      },
      onEnd: () => { banner.hidden = false; },
    });
  }

  function render() {
    if (stopTimer) { stopTimer(); stopTimer = null; }
    const body = { score: scoreView, breath: breathView, locate: locateView, stay: stayView, save: saveView }[state.step]();
    root.innerHTML = `${flowHeader({
      title: '신체 훈련', date: state.date, day: weekday(state.date),
      steps: STEPS, current: state.step, labels: (s) => LABELS[s],
    })}<main class="flow">${body}</main>`;
    if (state.step === 'save') {
      attachSync(root, () => ({ date: state.date, title: '신체 훈련', text: formatBody(state) }));
    }

    if (state.step === 'breath' && state.breath.startedAt) runTimer(state.breath.startedAt, BREATH_MS, { breathing: true });
    if (state.step === 'stay' && state.stay.startedAt) runTimer(state.stay.startedAt, STAY_MS);
    if (state.step === 'locate') {
      if (!state.timers.locate) { state.timers.locate = Date.now(); persist(); }
      runTimer(state.timers.locate, LOCATE_MS);
    }
  }

  root.addEventListener('input', (e) => {
    const el = e.target;
    if (el.name === 'anxiety' || el.name === 'blame') {
      state.scores[el.name] = Number(el.value);
      persist();
    } else if (el.dataset.bind === 'moment') {
      state.moment = el.value;
      persist();
    } else if (el.name === 'intensity') {
      root.querySelector('#int-out').textContent = el.value;
    }
  });

  root.addEventListener('submit', (e) => {
    if (e.target.id !== 'spot-form') return;
    e.preventDefault();
    const f = new FormData(e.target);
    const place = String(f.get('place') ?? '');
    const feel = String(f.get('feelText') ?? '').trim() || String(f.get('feel') ?? '');
    if (!place && !feel) return;
    state.spots.push({ id: `p${Date.now().toString(36)}`, place, feel, intensity: Number(f.get('intensity')) });
    persist();
    render();
  });

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const idx = STEPS.indexOf(state.step);

    if (act === 'back') return idx <= 0 ? exit() : go(STEPS[idx - 1]);
    if (act === 'home') return exit();
    if (act === 'next') return go(STEPS[idx + 1]);
    if (act === 'start') {
      const part = state.step === 'breath' ? state.breath : state.stay;
      part.startedAt = Date.now();
      persist();
      return render();
    }
    if (act === 'delete') {
      state.spots = state.spots.filter((p) => p.id !== btn.dataset.id);
      persist();
      return render();
    }
    if (act === 'download') {
      downloadText(bodyFileName(state), formatBody(state));
      root.querySelector('#save-msg').textContent = `${bodyFileName(state)} 파일을 내려받았어요.`;
    }
    if (act === 'copy') {
      const ok = await copyText(formatBody(state));
      root.querySelector('#save-msg').textContent = ok ? '복사했어요.' : '복사할 수 없어요. 미리보기에서 직접 선택해 주세요.';
    }
  });

  render();
  return () => {
    if (stopTimer) stopTimer();
    // 화면을 떠날 때 진행 시간을 남긴다.
    if (state.step === 'breath') capture(state.breath, BREATH_MS);
    if (state.step === 'stay') capture(state.stay, STAY_MS);
    persist();
  };
}
