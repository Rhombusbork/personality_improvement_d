// 대협 훈련: 인물 설명서(처음 한 번) + 하루 허브(아침 출진, 모임 전 예측, 저녁 회고, 주간 점검). docs/design.md 4.5절.

import {
  todayString, weekday, dayOfWeek, weekInfo, problemsFor,
  formatDaehyupDay, formatDaehyupWeek, formatDaehyupProfile,
} from '../lib/format.js';
import {
  DEFAULT_PRINCIPLES, DEFAULT_SHADOWS, VERDICT_PRINCIPLE, VERDICT_PROBLEMS,
  SHADOW_OPTIONS, ACTION_OPTIONS, CHECK_OPTIONS,
} from '../data/daehyup.js';
import { load, save, remove, keys } from '../lib/storage.js';
import { startTimer, formatRemaining } from '../lib/timer.js';
import { downloadText } from '../lib/download.js';
import { esc } from '../lib/ui.js';

const PROFILE_KEY = 'daehyup-profile-v1';
const DAY_PREFIX = 'daehyup-day-';
const WEEK_KEY = 'daehyup-week-v1';
const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const MS = { morning: 3 * 60 * 1000, evening: 10 * 60 * 1000 };

export const meta = { id: 'daehyup', order: 3, label: '대협 훈련', available: true };
export const draftInfo = () => null;
export const clearDraft = () => {};

function mondayOf(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return todayString(dt);
}

function newProfile(today) {
  return {
    version: 1,
    principles: DEFAULT_PRINCIPLES.map((p) => ({ ...p })),
    shadows: DEFAULT_SHADOWS,
    look: { posture: '', voice: '', laugh: '', speech: '' },
    aim: '',
    situation: '',
    meetingDays: [5, 6],
    startDate: mondayOf(today),
  };
}

function newDay(date) {
  return {
    version: 1,
    date,
    morning: false,
    predict: { text: '', confidence: 50 },
    evening: { action: null, hero: '', pushed: '', ifHero: '', shadow: null, admired: '', admiredWhy: '', expActual: '', expDiff: '' },
    problems: [{}, {}],
    real: { behavior: '', verdict: '', situ: '', state: '', trait: '', worth: '', checked: null },
  };
}

const newWeek = (date) => ({ version: 1, date, days: null, pattern: '', note: '' });

export function mount(root, { exit }) {
  const today = todayString();
  let profile = load(PROFILE_KEY);
  let day = load(DAY_PREFIX + today) || newDay(today);
  let week = load(WEEK_KEY);
  if (!week || week.date !== today) week = newWeek(today);
  let view = profile ? 'hub' : 'setup';
  let stopTimer = null;
  let timerStart = {};
  let message = '';

  const saveDay = () => save(DAY_PREFIX + day.date, day);
  const saveWeek = () => save(WEEK_KEY, week);

  function ctxFor(date) {
    const info = weekInfo(profile.startDate, date, profile.principles);
    return {
      ...info,
      isMeeting: profile.meetingDays.includes(dayOfWeek(date)),
      isVerdictWeek: info.principle.id === VERDICT_PRINCIPLE,
      problems: problemsFor(date, VERDICT_PROBLEMS),
      shadowOptions: SHADOW_OPTIONS,
      actionOptions: ACTION_OPTIONS,
      checkOptions: CHECK_OPTIONS,
    };
  }

  function go(next) {
    view = next;
    message = '';
    render();
    window.scrollTo(0, 0);
  }

  // ---------- 공통 조각 ----------
  const head = (title, back = 'hub') => `
    <header class="flow-head">
      <button class="link" data-act="back" data-to="${back}">← ${back === 'home' ? '홈' : '대협 훈련'}</button>
      <h1>${title}</h1>
      <p class="date">${esc(today)} (${weekday(today)})</p>
    </header>`;

  const timerHtml = () => `
    <div class="timer-row"><span class="timer" id="timer"></span></div>
    <div class="banner" id="timeup" hidden>시간이 됐어요. 여기서 멈추고 다음으로 가요.</div>`;

  const text = (scope, path, value, { rows = 2, placeholder = '' } = {}) =>
    `<textarea data-scope="${scope}" data-bind="${path}" rows="${rows}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`;

  const chips = (scope, path, options, value) => `
    <div class="chips">
      ${options.map((o) => `
        <label class="chip"><input type="radio" name="${scope}.${path}" data-scope="${scope}" data-bind="${path}" value="${o.id}" ${value === o.id ? 'checked' : ''}><span>${o.label}</span></label>`).join('')}
    </div>`;

  const field = (label, inner, hint = '') =>
    `<div class="field"><span class="field-label">${label}</span>${inner}${hint ? `<small>${hint}</small>` : ''}</div>`;

  const weekCard = (c) => `
    <div class="card week-card">
      <p class="muted">${c.week >= 1 ? `${c.week}주차` : `시작 전 (시작일 ${esc(profile.startDate)})`}</p>
      <h2>${esc(c.principle.title)}</h2>
      <p>${esc(c.principle.desc)}</p>
      <p><strong>행동:</strong> ${esc(c.principle.action)}</p>
    </div>`;

  // ---------- 인물 설명서 ----------
  function setupView() {
    const p = profile ?? newProfile(today);
    return `
      ${head('나의 대협', profile ? 'profile' : 'home')}
      <main class="flow">
        <p class="lead">매일 불러올 인물 설명서예요. 원칙과 행동은 고쳐도 되고, 모습과 큰 뜻은 직접 적어요.</p>
        <form id="profile-form">
          <h3 class="group">원칙 (주차 순서)</h3>
          ${p.principles.map((x, i) => `
            <div class="card principle">
              <input name="p-title-${i}" value="${esc(x.title)}" aria-label="원칙 ${i + 1}">
              <textarea name="p-desc-${i}" rows="2" aria-label="원칙 ${i + 1} 설명">${esc(x.desc)}</textarea>
              <label class="field"><span>행동</span><textarea name="p-action-${i}" rows="3">${esc(x.action)}</textarea></label>
            </div>`).join('')}

          <label class="field"><span>그림자</span><textarea name="shadows" rows="3">${esc(p.shadows)}</textarea></label>

          <h3 class="group">모습</h3>
          <label class="field"><span>자세</span><textarea name="posture" rows="2" placeholder="예: 어깨를 펴고, 등을 세우고, 발을 땅에 단단히">${esc(p.look.posture)}</textarea></label>
          <label class="field"><span>목소리</span><textarea name="voice" rows="2">${esc(p.look.voice)}</textarea></label>
          <label class="field"><span>웃음</span><textarea name="laugh" rows="2">${esc(p.look.laugh)}</textarea></label>
          <label class="field"><span>말투</span><textarea name="speech" rows="2">${esc(p.look.speech)}</textarea></label>

          <label class="field"><span>큰 뜻</span><textarea name="aim" rows="2" placeholder="아직 없으면 &quot;찾는 중&quot;">${esc(p.aim)}</textarea></label>
          <label class="field"><span>고정 상황 (매일)</span><textarea name="situation" rows="2" placeholder="예: 회의, 수업">${esc(p.situation)}</textarea></label>

          <fieldset class="field chips">
            <legend>모임 요일 (관계 실험)</legend>
            ${WEEKDAY_NAMES.map((n, i) => `
              <label class="chip"><input type="checkbox" name="meet" value="${i}" ${p.meetingDays.includes(i) ? 'checked' : ''}><span>${n}</span></label>`).join('')}
          </fieldset>

          <label class="field"><span>시작일</span><input type="date" name="startDate" value="${esc(p.startDate)}" required></label>

          <div class="actions"><button type="submit" class="primary">저장</button></div>
        </form>
      </main>`;
  }

  function profileView() {
    return `
      ${head('나의 대협')}
      <main class="flow">
        <pre class="preview">${esc(formatDaehyupProfile(profile))}</pre>
        <div class="actions">
          <button class="ghost" data-act="profile-download">텍스트로 내려받기</button>
          <button class="primary" data-act="to" data-to="setup">수정</button>
        </div>
      </main>`;
  }

  // ---------- 허브 ----------
  function hubView() {
    const c = ctxFor(today);
    const isSunday = dayOfWeek(today) === 0;
    const past = keys(DAY_PREFIX).map((k) => k.slice(DAY_PREFIX.length)).filter((d) => d !== today).sort().reverse();
    const item = (to, label, sub, done = false, highlight = false) => `
      <li><button class="flow-btn ${highlight ? 'hl' : ''}" data-act="to" data-to="${to}">
        <span class="name">${label}</span><span class="state">${done ? '완료' : sub}</span>
      </button></li>`;
    return `
      ${head('대협 훈련', 'home')}
      <main class="flow">
        ${weekCard(c)}
        <ol class="flow-list plain">
          ${item('morning', '아침 출진', '3분', day.morning)}
          ${c.isMeeting ? item('predict', '모임 전 예측', '관계 실험', !!day.predict.text.trim(), true) : ''}
          ${item('evening', '저녁 회고', '10분')}
          ${item('weekly', '주간 점검', isSunday ? '오늘' : '일요일', false, isSunday)}
        </ol>
        <div class="actions">
          <button class="ghost" data-act="to" data-to="profile">인물 설명서</button>
          <button class="primary" data-act="day-download" data-date="${today}">오늘 기록 다운로드</button>
        </div>
        <p class="muted" aria-live="polite">${esc(message)}</p>
        ${past.length ? `
          <h3 class="group">브라우저에 남은 지난 기록</h3>
          <ul class="traces">
            ${past.map((d) => `
              <li class="trace"><span>${esc(d)} (${weekday(d)})</span>
                <span class="trace-acts">
                  <button class="link" data-act="day-download" data-date="${d}">다운로드</button>
                  <button class="link" data-act="day-delete" data-date="${d}">지우기</button>
                </span></li>`).join('')}
          </ul>` : ''}
      </main>`;
  }

  // ---------- 아침 출진 ----------
  function morningView() {
    const c = ctxFor(today);
    const l = profile.look;
    const v = (s) => (s ? esc(s) : '<span class="muted">(적지 않음)</span>');
    return `
      ${head('아침 출진')}
      <main class="flow">
        ${timerHtml()}
        ${weekCard(c)}
        <ol class="guide">
          <li>인물 설명서를 읽어요.
            <dl class="self-dl">
              <dt>자세</dt><dd>${v(l.posture)}</dd>
              <dt>목소리</dt><dd>${v(l.voice)}</dd>
              <dt>웃음</dt><dd>${v(l.laugh)}</dd>
              <dt>말투</dt><dd>${v(l.speech)}</dd>
              <dt>큰 뜻</dt><dd>${v(profile.aim)}</dd>
              <dt>그림자</dt><dd>${v(profile.shadows).replace(/\n/g, '<br>')}</dd>
            </dl>
          </li>
          <li>이번 주의 원칙을 소리 내어 한 번 말해요. <strong>"${esc(c.principle.title)}"</strong></li>
          <li>대협의 자세를 잡고 깊게 세 번 호흡해요.</li>
          <li>오늘 ${profile.situation ? `<strong>${esc(profile.situation)}</strong>에서` : '고정 상황에서'} 할 행동을 확인해요.</li>
        </ol>
        <div class="actions"><button class="primary" data-act="morning-done">출진</button></div>
      </main>`;
  }

  // ---------- 모임 전 예측 ----------
  function predictView() {
    const c = ctxFor(today);
    return `
      ${head('모임 전 예측')}
      <main class="flow">
        ${weekCard(c)}
        <p class="lead">이 행동을 하면 상대가 어떻게 반응할지 예측해요.</p>
        ${field('예측', text('day', 'predict.text', day.predict.text, { rows: 3, placeholder: '예: 작은 질문을 하면 대화가 어색해질 것이다' }))}
        <label class="range">
          <span>확신도 <output id="conf-out">${day.predict.confidence}%</output></span>
          <input type="range" min="0" max="100" step="10" data-scope="day" data-bind="predict.confidence" value="${day.predict.confidence}">
        </label>
        <div class="actions"><button class="primary" data-act="to" data-to="hub">저장</button></div>
      </main>`;
  }

  // ---------- 저녁 회고 ----------
  function eveningView() {
    const c = ctxFor(today);
    const e = day.evening;
    const verdict = c.isVerdictWeek ? `
      <h3 class="group">판결 연습</h3>
      ${c.problems.map((p, i) => `
        <div class="card">
          <p><strong>문제 ${i + 1}.</strong> ${esc(p)}</p>
          ${field('내가 읽기 쉬운 판결', `<span class="muted">이건 내가 ___라는 뜻이다.</span>${text('day', `problems.${i}.verdict`, day.problems[i].verdict)}`)}
          ${field('상황으로 설명하면', text('day', `problems.${i}.situ`, day.problems[i].situ))}
          ${field('상대의 상태로 설명하면', text('day', `problems.${i}.state`, day.problems[i].state))}
          ${field('상대의 성향으로 설명하면', text('day', `problems.${i}.trait`, day.problems[i].trait))}
          ${field('대협이라면', text('day', `problems.${i}.hero`, day.problems[i].hero))}
        </div>`).join('')}
      <div class="card">
        <p><strong>오늘의 판결</strong></p>
        ${field('1. 남의 행동', text('day', 'real.behavior', day.real.behavior), '해석 말고 사실만 써요.')}
        ${field('2. 내가 읽은 판결', `<span class="muted">이건 내가 ___라는 뜻이다.</span>${text('day', 'real.verdict', day.real.verdict)}`)}
        ${field('3. 다른 가설: 상황', text('day', 'real.situ', day.real.situ))}
        ${field('3. 다른 가설: 상대의 상태', text('day', 'real.state', day.real.state))}
        ${field('3. 다른 가설: 상대의 성향', text('day', 'real.trait', day.real.trait))}
        ${field('4. 판결이 맞다고 해도, 그게 내 가치를 결정하나?', text('day', 'real.worth', day.real.worth))}
        ${field('5. 확인 행동', chips('day', 'real.checked', CHECK_OPTIONS, day.real.checked))}
      </div>` : '';
    const experiment = c.isMeeting ? `
      <h3 class="group">관계 실험</h3>
      <div class="card">
        <p class="muted">예측: ${day.predict.text.trim() ? `${esc(day.predict.text)} (확신도 ${day.predict.confidence}%)` : '(적지 않음)'}</p>
        ${field('실제 반응', text('day', 'evening.expActual', e.expActual), '해석 말고 사실만 써요.')}
        ${field('예측과의 차이', text('day', 'evening.expDiff', e.expDiff))}
      </div>` : '';
    return `
      ${head('저녁 회고')}
      <main class="flow">
        ${timerHtml()}
        ${weekCard(c)}
        ${field('1. 이번 주 행동', chips('day', 'evening.action', ACTION_OPTIONS, e.action), '판단하지 않고 체크만 해요.')}
        ${field('2. 대협이었던 순간', text('day', 'evening.hero', e.hero))}
        ${field('3. 떠밀린 순간', text('day', 'evening.pushed', e.pushed), '흥분, 서두름, 확인하기')}
        ${field('4. 그때 대협이라면', text('day', 'evening.ifHero', e.ifHero))}
        ${field('5. 그림자', chips('day', 'evening.shadow', SHADOW_OPTIONS, e.shadow))}
        ${field('6. 오늘 높이 본 사람', text('day', 'evening.admired', e.admired, { rows: 1 }))}
        ${field('그 이유', text('day', 'evening.admiredWhy', e.admiredWhy))}
        ${experiment}
        ${verdict}
        <div class="actions"><button class="primary" data-act="to" data-to="day-save">다음</button></div>
      </main>`;
  }

  function daySaveView() {
    return `
      ${head('오늘의 기록')}
      <main class="flow">
        <pre class="preview">${esc(formatDaehyupDay(day, ctxFor(today)))}</pre>
        <div class="actions stack">
          <button class="primary" data-act="day-download" data-date="${today}">텍스트 파일 다운로드</button>
          <button class="ghost" data-act="to" data-to="hub">대협 훈련으로</button>
        </div>
        <p class="muted" aria-live="polite">${esc(message)}</p>
      </main>`;
  }

  // ---------- 주간 점검 ----------
  function weeklyView() {
    const c = ctxFor(today);
    const days = Array.from({ length: 8 }, (_, i) => ({ id: String(i), label: String(i) }));
    return `
      ${head('주간 점검')}
      <main class="flow">
        ${weekCard(c)}
        ${field('이번 주 행동을 한 날', chips('week', 'days', days, week.days === null ? null : String(week.days)), '판단하지 않고 숫자만 봐요.')}
        ${field('저녁 회고의 "떠밀린 순간"에서 반복된 것', text('week', 'pattern', week.pattern, { rows: 3 }))}
        ${field('메모', text('week', 'note', week.note, { rows: 2 }))}
        <div class="card"><p class="muted">다음 주</p><h2>${esc(c.next.title)}</h2><p><strong>행동:</strong> ${esc(c.next.action)}</p></div>
        <pre class="preview">${esc(formatDaehyupWeek(week, c))}</pre>
        <div class="actions">
          <button class="ghost" data-act="to" data-to="hub">대협 훈련으로</button>
          <button class="primary" data-act="week-download">텍스트 파일 다운로드</button>
        </div>
        <p class="muted" aria-live="polite">${esc(message)}</p>
      </main>`;
  }

  function runTimer(key) {
    if (!timerStart[key]) timerStart[key] = Date.now();
    const el = root.querySelector('#timer');
    const banner = root.querySelector('#timeup');
    stopTimer = startTimer({
      startedAt: timerStart[key],
      durationMs: MS[key],
      onTick: (ms) => { el.textContent = `남은 시간 ${formatRemaining(ms)}`; },
      onEnd: () => { banner.hidden = false; },
    });
  }

  function render() {
    if (stopTimer) { stopTimer(); stopTimer = null; }
    const views = {
      setup: setupView, profile: profileView, hub: hubView, morning: morningView,
      predict: predictView, evening: eveningView, 'day-save': daySaveView, weekly: weeklyView,
    };
    root.innerHTML = views[view]();
    if (view === 'morning') runTimer('morning');
    if (view === 'evening') runTimer('evening');
  }

  function setPath(obj, path, value) {
    const ks = path.split('.');
    let o = obj;
    for (const k of ks.slice(0, -1)) o = o[k];
    o[ks.at(-1)] = value;
  }

  root.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.dataset.bind) return;
    let v = el.value;
    if (el.type === 'range') v = Number(v);
    if (el.dataset.scope === 'week' && el.dataset.bind === 'days') v = Number(v);
    if (el.dataset.scope === 'week') {
      setPath(week, el.dataset.bind, v);
      saveWeek();
      const pre = root.querySelector('.preview');
      if (pre) pre.textContent = formatDaehyupWeek(week, ctxFor(today));
    } else {
      setPath(day, el.dataset.bind, v);
      saveDay();
      if (el.type === 'range') root.querySelector('#conf-out').textContent = `${v}%`;
    }
  });

  root.addEventListener('submit', (e) => {
    if (e.target.id !== 'profile-form') return;
    e.preventDefault();
    const f = new FormData(e.target);
    const g = (k) => String(f.get(k) ?? '').trim();
    const base = profile ?? newProfile(today);
    profile = {
      ...base,
      principles: base.principles.map((p, i) => ({
        ...p, title: g(`p-title-${i}`) || p.title, desc: g(`p-desc-${i}`), action: g(`p-action-${i}`),
      })),
      shadows: g('shadows'),
      look: { posture: g('posture'), voice: g('voice'), laugh: g('laugh'), speech: g('speech') },
      aim: g('aim'),
      situation: g('situation'),
      meetingDays: f.getAll('meet').map(Number),
      startDate: g('startDate') || base.startDate,
    };
    save(PROFILE_KEY, profile);
    go('hub');
  });

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'back') return btn.dataset.to === 'home' ? exit() : go(btn.dataset.to);
    if (act === 'to') return go(btn.dataset.to);
    if (act === 'morning-done') {
      day.morning = true;
      saveDay();
      return go('hub');
    }
    if (act === 'day-download') {
      const date = btn.dataset.date;
      const d = date === today ? day : load(DAY_PREFIX + date);
      if (!d) return;
      downloadText(`daehyup-${date}.txt`, formatDaehyupDay(d, ctxFor(date)));
      message = `daehyup-${date}.txt 파일을 내려받았어요.`;
      return render();
    }
    if (act === 'day-delete') {
      remove(DAY_PREFIX + btn.dataset.date);
      return render();
    }
    if (act === 'week-download') {
      downloadText(`daehyup-week-${today}.txt`, formatDaehyupWeek(week, ctxFor(today)));
      message = `daehyup-week-${today}.txt 파일을 내려받았어요.`;
      return render();
    }
    if (act === 'profile-download') {
      downloadText('my-daehyup.txt', formatDaehyupProfile(profile));
    }
  });

  render();
  return () => { if (stopTimer) stopTimer(); };
}
