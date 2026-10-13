// 자기자비: (처음 한 번 자비로운 나 정의) → 떠올리기 → 편지 → 마무리 → 저장. docs/design.md 4.4절.

import {
  todayString, weekday, SELF_FIELDS, LETTER_PARTS, RESONANCE, CLOSING,
  formatCompassion, compassionFileName, formatSelf,
} from '../lib/format.js';
import { load, save, remove } from '../lib/storage.js';
import { startTimer, formatRemaining } from '../lib/timer.js';
import { downloadText, copyText } from '../lib/download.js';
import { esc, flowHeader } from '../lib/ui.js';
import { todayScene } from './uncertainty.js';

const KEY = 'compassion-draft-v1';
const SELF_KEY = 'compassion-self-v1';
const STEPS = ['imagine', 'letter', 'close', 'save'];
const LABELS = { define: '정의', imagine: '떠올리기', letter: '편지', close: '마무리', save: '저장', pause: '쉬기' };
const MS = { imagine: 5 * 60 * 1000, letter: 8 * 60 * 1000, pause: 2 * 60 * 1000, hand: 60 * 1000 };
const HALF_BREATH_MS = 5000;

function newState(hasSelf) {
  return {
    version: 1,
    date: todayString(),
    step: hasSelf ? 'imagine' : 'define',
    returnStep: null,
    scene: { source: null, text: '' },
    letter: { ack: '', common: '', toYou: '' },
    resonance: null,
    handBreath: false,
    switched: false,
    timers: {},
  };
}

export const meta = { id: 'compassion', order: 4, label: '자기자비', available: true };

export function draftInfo() {
  const s = load(KEY);
  return s ? { date: s.date } : null;
}

export function clearDraft() {
  remove(KEY);
}

export function mount(root, { exit }) {
  let profile = load(SELF_KEY);
  let state = load(KEY) || newState(!!profile);
  let stopTimer = null;
  const persist = () => save(KEY, state);

  function go(step) {
    state.step = step;
    persist();
    render();
    window.scrollTo(0, 0);
  }

  const visibleSteps = () => (state.step === 'define' ? ['define', ...STEPS] : state.step === 'pause' ? [...STEPS.slice(0, STEPS.indexOf(state.returnStep) + 1), 'pause'] : STEPS);

  const timerHtml = (msg = '시간이 됐어요. 여기서 멈추고 다음으로 가요.') => `
    <div class="timer-row"><span class="timer" id="timer"></span></div>
    <div class="banner" id="timeup" hidden>${msg}</div>`;

  const hardButton = () => `
    <div class="row"><button class="ghost small" data-act="hard">지금은 힘들어요</button></div>`;

  function defineView() {
    const p = profile ?? {};
    return `
      <p class="lead">매일 떠올릴 "자비로운 나"를 적어요. 지혜롭고, 강하고, 따뜻한 버전의 나예요. 한 번 적으면 매일 그대로 불러와요.</p>
      <form id="self-form">
        ${SELF_FIELDS.map((f) => `
          <label class="field">
            <span>${f.label}</span>
            <textarea name="${f.id}" rows="2" placeholder="${esc(f.hint)}">${esc(p[f.id])}</textarea>
          </label>`).join('')}
        <div class="actions">
          <button type="button" class="ghost" data-act="self-download">텍스트로 내려받기</button>
          <button type="submit" class="primary">저장하고 계속</button>
        </div>
      </form>`;
  }

  function imagineView() {
    const p = profile ?? {};
    const v = (id) => (p[id] ? esc(p[id]) : '<span class="muted">(적지 않음)</span>');
    return `
      ${timerHtml()}
      ${hardButton()}
      <ol class="guide">
        <li>편하게 앉아서 천천히 호흡해요.</li>
        <li>자세를 잡아요. ${v('posture')}</li>
        <li>얼굴에 그 표정을 지어 봐요. ${v('face')}</li>
        <li>마음속으로 그 목소리로 말해 봐요. ${v('voice')}</li>
        <li>그 사람이 되어 봐요. 처음엔 연기여도 괜찮아요.
          <dl class="self-dl">
            <dt>지혜로움</dt><dd>${v('wisdom')}</dd>
            <dt>강함</dt><dd>${v('strength')}</dd>
            <dt>따뜻함</dt><dd>${v('warmth')}</dd>
          </dl>
        </li>
      </ol>
      <div class="actions">
        <button class="ghost" data-act="edit-self">자비로운 나 수정</button>
        <button class="primary" data-act="next">다음</button>
      </div>`;
  }

  function letterView() {
    const fromUnc = todayScene();
    const src = state.scene.source;
    return `
      ${timerHtml()}
      ${hardButton()}
      <p class="lead">자비로운 나가 되어, 그 장면 속의 나에게 편지를 써요.</p>
      <fieldset class="field">
        <legend>장면</legend>
        <div class="row start">
          <button class="${src === 'uncertainty' ? 'primary' : 'ghost'}" data-act="scene-unc" ${fromUnc ? '' : 'disabled'}>오늘 불확실성 기록에서 가져오기</button>
          <button class="${src === 'new' ? 'primary' : 'ghost'}" data-act="scene-new">새로 쓰기</button>
        </div>
        ${fromUnc ? '' : '<small>오늘 불확실성 기록에서 고른 장면이 없어요.</small>'}
        ${src === 'uncertainty' ? `<div class="picked">${esc(state.scene.text)}</div>` : ''}
        ${src === 'new' ? `<textarea data-bind="scene" rows="2" placeholder="오늘 편지를 쓰고 싶은 장면">${esc(state.scene.text)}</textarea>` : ''}
      </fieldset>
      ${LETTER_PARTS.map((part, i) => `
        <label class="field">
          <span>${i + 1}. ${part.label}</span>
          <small>${esc(part.starter)}</small>
          <textarea data-bind="${part.id}" rows="3">${esc(state.letter[part.id])}</textarea>
        </label>`).join('')}
      <div class="actions"><button class="primary" data-act="next">다음</button></div>`;
  }

  function closeView() {
    const hand = state.resonance === 'empty';
    return `
      ${hardButton()}
      <fieldset class="field chips">
        <legend>이 말이 얼마나 와닿았나요?</legend>
        ${RESONANCE.map((r) => `
          <label class="chip"><input type="radio" name="resonance" value="${r.id}" ${state.resonance === r.id ? 'checked' : ''}><span>${r.label}</span></label>`).join('')}
        <small>점수가 아니라 관찰이에요.</small>
      </fieldset>
      ${hand ? `
        <div class="card">
          <p>오늘은 말 대신, 손을 가슴에 얹고 1분 호흡해요.</p>
          ${state.timers.hand ? `${timerHtml('1분이 지났어요.')}<div class="pacer-wrap"><div class="pacer" id="pacer"></div><p class="pacer-text" id="phase"></p></div>` : '<div class="row"><button class="primary" data-act="hand-start">시작</button></div>'}
        </div>` : ''}
      <blockquote class="closing">${CLOSING}</blockquote>
      <div class="actions"><button class="primary" data-act="next">다음</button></div>`;
  }

  function pauseView() {
    return `
      <p class="lead">편지는 잠시 내려놓고, 호흡으로 돌아와요.</p>
      ${timerHtml('2분이 지났어요.')}
      <div class="pacer-wrap"><div class="pacer" id="pacer"></div><p class="pacer-text" id="phase"></p></div>
      <div class="actions">
        <button class="ghost" data-act="resume">이어서 하기</button>
        <button class="primary" data-act="stop-here">오늘은 여기까지</button>
      </div>`;
  }

  function saveView() {
    return `
      <p class="lead">오늘의 기록이에요. 파일로 내려받아 보관해요.</p>
      <pre class="preview">${esc(formatCompassion(state))}</pre>
      <div class="actions stack">
        <button class="primary" data-act="download">텍스트 파일 다운로드</button>
        <button class="ghost" data-act="copy">복사</button>
        <button class="ghost" data-act="home">홈으로</button>
      </div>
      <p class="muted" id="save-msg" aria-live="polite"></p>`;
  }

  function runTimer(key, { breathing = false } = {}) {
    if (!state.timers[key]) { state.timers[key] = Date.now(); persist(); }
    const startedAt = state.timers[key];
    const el = root.querySelector('#timer');
    const banner = root.querySelector('#timeup');
    const phase = root.querySelector('#phase');
    const pacerEl = root.querySelector('#pacer');
    if (pacerEl) pacerEl.style.animationDelay = `-${(Date.now() - startedAt) % (HALF_BREATH_MS * 2)}ms`;
    stopTimer = startTimer({
      startedAt,
      durationMs: MS[key],
      onTick: (ms) => {
        el.textContent = `남은 시간 ${formatRemaining(ms)}`;
        if (phase && breathing) {
          const t = (Date.now() - startedAt) % (HALF_BREATH_MS * 2);
          const left = Math.ceil((HALF_BREATH_MS - (t % HALF_BREATH_MS)) / 1000);
          phase.textContent = `${t < HALF_BREATH_MS ? '들이쉬기' : '내쉬기'} ${left}`;
        }
      },
      onEnd: () => { banner.hidden = false; },
    });
  }

  function render() {
    if (stopTimer) { stopTimer(); stopTimer = null; }
    const views = { define: defineView, imagine: imagineView, letter: letterView, close: closeView, pause: pauseView, save: saveView };
    root.innerHTML = `${flowHeader({
      title: '자기자비', date: state.date, day: weekday(state.date),
      steps: visibleSteps(), current: state.step, labels: (s) => LABELS[s],
    })}<main class="flow">${views[state.step]()}</main>`;

    if (state.step === 'imagine') runTimer('imagine');
    if (state.step === 'letter') runTimer('letter');
    if (state.step === 'pause') runTimer('pause', { breathing: true });
    if (state.step === 'close' && state.resonance === 'empty' && state.timers.hand) runTimer('hand', { breathing: true });
  }

  root.addEventListener('input', (e) => {
    const el = e.target;
    const bind = el.dataset.bind;
    if (bind === 'scene') state.scene.text = el.value;
    else if (bind) state.letter[bind] = el.value;
    else if (el.name === 'resonance') {
      state.resonance = el.value;
      persist();
      return render();
    } else return;
    persist();
  });

  root.addEventListener('submit', (e) => {
    if (e.target.id !== 'self-form') return;
    e.preventDefault();
    const f = new FormData(e.target);
    profile = Object.fromEntries(SELF_FIELDS.map((x) => [x.id, String(f.get(x.id) ?? '').trim()]));
    save(SELF_KEY, profile);
    go('imagine');
  });

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const steps = visibleSteps();
    const idx = steps.indexOf(state.step);

    if (act === 'back') {
      if (state.step === 'pause') return go(state.returnStep);
      return idx <= 0 ? exit() : go(steps[idx - 1]);
    }
    if (act === 'home') return exit();
    if (act === 'next') return go(STEPS[STEPS.indexOf(state.step) + 1]);
    if (act === 'edit-self') return go('define');
    if (act === 'self-download') {
      const f = new FormData(root.querySelector('#self-form'));
      const draft = Object.fromEntries(SELF_FIELDS.map((x) => [x.id, String(f.get(x.id) ?? '').trim()]));
      return downloadText('compassionate-self.txt', formatSelf(draft));
    }
    if (act === 'scene-unc') {
      state.scene = { source: 'uncertainty', text: todayScene() ?? '' };
      persist();
      return render();
    }
    if (act === 'scene-new') {
      if (state.scene.source !== 'new') state.scene = { source: 'new', text: '' };
      persist();
      return render();
    }
    if (act === 'hand-start') {
      state.handBreath = true;
      state.timers.hand = Date.now();
      persist();
      return render();
    }
    if (act === 'hard') {
      state.switched = true;
      state.returnStep = state.step;
      delete state.timers.pause;
      return go('pause');
    }
    if (act === 'resume') return go(state.returnStep);
    if (act === 'stop-here') return go('save');
    if (act === 'download') {
      downloadText(compassionFileName(state), formatCompassion(state));
      root.querySelector('#save-msg').textContent = `${compassionFileName(state)} 파일을 내려받았어요.`;
    }
    if (act === 'copy') {
      const ok = await copyText(formatCompassion(state));
      root.querySelector('#save-msg').textContent = ok ? '복사했어요.' : '복사할 수 없어요. 미리보기에서 직접 선택해 주세요.';
    }
  });

  render();
  return () => { if (stopTimer) stopTimer(); };
}
