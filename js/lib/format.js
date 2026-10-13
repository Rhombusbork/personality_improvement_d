// 상태 → 출력 텍스트. 순수 함수만 둔다. 형식은 docs/design.md 5절과 같아야 한다.

export const SLOTS = [
  { id: 'morning', label: '아침' },
  { id: 'noon', label: '점심' },
  { id: 'afternoon', label: '오후' },
  { id: 'evening', label: '저녁' },
];

export const KINDS = [
  { id: 'action', label: '행동' },
  { id: 'thought', label: '생각' },
  { id: 'body', label: '몸' },
  { id: 'emotion', label: '감정' },
];

export const RESPONSES = [
  { id: 'stayed', label: '머물렀다' },
  { id: 'postponed', label: '미뤘다' },
  { id: 'sought', label: '확실성 추구를 했다' },
];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const EMPTY = '(비어 있음)';

const labelOf = (list, id) => list.find((x) => x.id === id)?.label ?? '';

export function todayString(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function weekday(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

// 받침 유무에 따라 '을'/'를'. 한글로 끝나지 않으면 '을(를)'.
export function objectParticle(word) {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (!last || code < 0 || code > 11171) return '을(를)';
  return code % 28 === 0 ? '를' : '을';
}

// 받침 유무에 따라 '이라는'/'라는'. 한글로 끝나지 않으면 '(이)라는'.
export function quoteParticle(word) {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (!last || code < 0 || code > 11171) return '(이)라는';
  return code % 28 === 0 ? '라는' : '이라는';
}

const verdictSentence = (v) => {
  const t = (v ?? '').trim();
  return t ? `이건 내가 ${t}${quoteParticle(t)} 뜻이다` : EMPTY;
};

export function unknownSentence(unknown) {
  const u = (unknown ?? '').trim();
  if (!u) return EMPTY;
  return `나는 ${u}${objectParticle(u)} 모르고, 그게 신경 쓰였다.`;
}

const orEmpty = (s) => ((s ?? '').trim() ? s.trim() : EMPTY);

function formatTraces(traces) {
  const order = SLOTS.map((s) => s.id);
  return [...traces]
    .sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot))
    .map(
      (t) =>
        `- ${labelOf(SLOTS, t.slot)} | ${labelOf(KINDS, t.kind)} | ${t.text.trim()}\n` +
        `  → ${unknownSentence(t.unknown)}`,
    )
    .join('\n');
}

function formatRecord(r) {
  const prediction = (r.prediction ?? '').trim()
    ? `${r.prediction.trim()} (확신도 ${r.confidence}%)`
    : EMPTY;
  const actual = r.actualUnknown ? '아직 모름' : orEmpty(r.actual);
  const response = labelOf(RESPONSES, r.response) || EMPTY;
  return [
    `1. 불확실했던 것: ${orEmpty(r.uncertain)}`,
    `2. 그때 예상: ${prediction}`,
    `3. 실제로 일어난 것: ${actual}`,
    `4. 나는: ${response}`,
    `5. 감당했다는 증거: ${orEmpty(r.evidence)}`,
  ].join('\n');
}

export function formatUncertainty(state) {
  const head = `[불확실성 돌아보기] ${state.date} (${weekday(state.date)})`;
  if (state.noneFound) {
    return [head, '', '■ 찾은 흔적', '못 찾음', '', '■ 지난 기록 업데이트', orEmpty(state.pastUpdate), ''].join('\n');
  }
  return [head, '', '■ 찾은 흔적', formatTraces(state.traces), '', '■ 기록', formatRecord(state.record), ''].join('\n');
}

export function fileName(state) {
  return `uncertainty-${state.date}.txt`;
}

// ---------- 신체 훈련 ----------

export const BODY_PLACES = ['머리', '얼굴·턱', '목·어깨', '가슴', '배', '팔·손', '다리', '전신', '잘 모르겠음'];
export const BODY_FEELS = ['조임', '두근거림', '열감', '떨림', '무거움', '답답함', '저림', '텅 빔'];

export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds ?? 0));
  if (!s) return '안 함';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? (r ? `${m}분 ${r}초` : `${m}분`) : `${r}초`;
}

const score = (v) => (v === null || v === undefined ? EMPTY : `${v}/10`);

export function formatBody(state) {
  const spots = state.spots.length
    ? state.spots.map((p) => `- ${p.place || EMPTY} | ${p.feel || EMPTY} | ${p.intensity}`).join('\n')
    : EMPTY;
  return [
    `[신체 훈련] ${state.date} (${weekday(state.date)})`,
    '',
    '■ 시작 점수',
    `불안: ${score(state.scores.anxiety)}`,
    `나를 향한 비난: ${score(state.scores.blame)}`,
    '',
    '■ 공명 호흡',
    formatDuration(state.breath.seconds),
    '',
    '■ 감정 위치 찾기',
    `떠올린 순간: ${orEmpty(state.moment)}`,
    spots,
    '',
    '■ 그냥 같이 있기',
    formatDuration(state.stay.seconds),
    '',
  ].join('\n');
}

export function bodyFileName(state) {
  return `body-${state.date}.txt`;
}

// ---------- 자기자비 ----------

export const SELF_FIELDS = [
  { id: 'wisdom', label: '지혜로움', hint: '그 사람은 무엇을 알고 있나?' },
  { id: 'strength', label: '강함', hint: '흔들려도 무너지지 않는 힘은 어떤 모습인가?' },
  { id: 'warmth', label: '따뜻함', hint: '나를 어떤 마음으로 바라보나?' },
  { id: 'face', label: '표정', hint: '' },
  { id: 'voice', label: '목소리 톤', hint: '' },
  { id: 'posture', label: '자세', hint: '' },
];

export const LETTER_PARTS = [
  { id: 'ack', label: '알아주기', starter: '그때 너는 ___ 때문에 힘들었구나.' },
  { id: 'common', label: '누구나', starter: '그런 상황에서 그렇게 느끼는 건 ___' },
  { id: 'toYou', label: '너에게', starter: '너에게 하고 싶은 말은 ___' },
];

export const RESONANCE = [
  { id: 'yes', label: '와닿음' },
  { id: 'some', label: '조금' },
  { id: 'empty', label: '공허함' },
];

export const CLOSING = '지금 이런 마음이 있구나. 누구나 그럴 때가 있다. 이대로도 괜찮다.';

export function formatSelf(profile) {
  return ['[나의 자비로운 나]', '', ...SELF_FIELDS.map((f) => `${f.label}: ${orEmpty(profile?.[f.id])}`), ''].join('\n');
}

export function formatCompassion(state) {
  const source = { uncertainty: '불확실성 기록에서', new: '새로 씀' }[state.scene.source] ?? '';
  const lines = [
    `[자기자비] ${state.date} (${weekday(state.date)})`,
    '',
    `■ 장면${source ? ` (${source})` : ''}`,
    orEmpty(state.scene.text),
    '',
    '■ 자비의 편지',
    ...LETTER_PARTS.map((p, i) => `${i + 1}. ${p.label}: ${orEmpty(state.letter[p.id])}`),
    '',
    '■ 와닿은 정도',
    RESONANCE.find((r) => r.id === state.resonance)?.label ?? EMPTY,
  ];
  if (state.handBreath) lines.push('대신 손을 가슴에 얹고 1분 호흡');
  if (state.switched) lines.push('', '■ 메모', '중간에 호흡으로 전환');
  lines.push('');
  return lines.join('\n');
}

export function compassionFileName(state) {
  return `compassion-${state.date}.txt`;
}

// ---------- 대협 훈련 ----------

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (dateString) => {
  const [y, m, d] = dateString.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
};

export function dayOfWeek(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

// 시작일 기준 주차 (1부터). 원칙은 목록을 순환한다.
export function weekInfo(startDate, today, principles) {
  const index = Math.floor((dayNumber(today) - dayNumber(startDate)) / 7);
  const n = principles.length;
  return { week: index + 1, principle: principles[((index % n) + n) % n], next: principles[(((index + 1) % n) + n) % n] };
}

// 날짜마다 정해진 두 문제. 같은 날에는 항상 같은 문제가 나온다.
export function problemsFor(dateString, bank) {
  const i = ((dayNumber(dateString) * 2) % bank.length + bank.length) % bank.length;
  return [bank[i], bank[(i + 1) % bank.length]];
}

const opt = (list, id) => list.find((x) => x.id === id)?.label ?? EMPTY;

export function formatDaehyupDay(day, ctx) {
  const { week, principle, isMeeting, isVerdictWeek, problems, shadowOptions, actionOptions, checkOptions } = ctx;
  const e = day.evening;
  const lines = [
    `[대협 훈련] ${day.date} (${weekday(day.date)})`,
    `이번 주: ${week}주차 · ${principle.title}`,
    `행동: ${principle.action}`,
    '',
    '■ 아침 출진',
    day.morning ? '했음' : '안 함',
  ];
  if (isMeeting) {
    lines.push('', '■ 모임 전 예측', `예측: ${orEmpty(day.predict.text)} (확신도 ${day.predict.confidence}%)`);
  }
  lines.push(
    '',
    '■ 저녁 회고',
    `1. 이번 주 행동: ${opt(actionOptions, e.action)}`,
    `2. 대협이었던 순간: ${orEmpty(e.hero)}`,
    `3. 떠밀린 순간: ${orEmpty(e.pushed)}`,
    `4. 그때 대협이라면: ${orEmpty(e.ifHero)}`,
    `5. 그림자: ${opt(shadowOptions, e.shadow)}`,
    `6. 오늘 높이 본 사람: ${orEmpty(e.admired)} / 이유: ${orEmpty(e.admiredWhy)}`,
  );
  if (isMeeting) {
    lines.push('', '■ 관계 실험 결과', `실제 반응: ${orEmpty(e.expActual)}`, `예측과의 차이: ${orEmpty(e.expDiff)}`);
  }
  if (isVerdictWeek) {
    lines.push('', '■ 판결 연습');
    problems.forEach((p, i) => {
      const a = day.problems[i] ?? {};
      lines.push(
        `[문제 ${i + 1}] ${p}`,
        `- 판결: ${verdictSentence(a.verdict)}`,
        `- 상황: ${orEmpty(a.situ)}`,
        `- 상대의 상태: ${orEmpty(a.state)}`,
        `- 상대의 성향: ${orEmpty(a.trait)}`,
        `- 대협이라면: ${orEmpty(a.hero)}`,
      );
    });
    const r = day.real;
    lines.push(
      '[오늘의 판결]',
      `1. 남의 행동: ${orEmpty(r.behavior)}`,
      `2. 내가 읽은 판결: ${verdictSentence(r.verdict)}`,
      `3. 다른 가설: 상황 - ${orEmpty(r.situ)} / 상대의 상태 - ${orEmpty(r.state)} / 상대의 성향 - ${orEmpty(r.trait)}`,
      `4. 판결이 맞다고 해도: ${orEmpty(r.worth)}`,
      `5. 확인 행동: ${opt(checkOptions, r.checked)}`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

export function formatDaehyupWeek(w, { week, principle, next }) {
  return [
    `[대협 주간 점검] ${w.date} (${weekday(w.date)})`,
    `이번 주: ${week}주차 · ${principle.title}`,
    `실행 일수: ${w.days === null ? EMPTY : `${w.days}/7`}`,
    `반복된 떠밀린 순간: ${orEmpty(w.pattern)}`,
    `메모: ${orEmpty(w.note)}`,
    `다음 주: ${week + 1}주차 · ${next.title}`,
    '',
  ].join('\n');
}

export function formatDaehyupProfile(p) {
  return [
    '[나의 대협]',
    '',
    '■ 원칙',
    ...p.principles.map((x, i) => `${i + 1}. ${x.title}\n   ${x.desc}\n   행동: ${x.action}`),
    '',
    '■ 그림자',
    orEmpty(p.shadows),
    '',
    '■ 모습',
    `자세: ${orEmpty(p.look.posture)}`,
    `목소리: ${orEmpty(p.look.voice)}`,
    `웃음: ${orEmpty(p.look.laugh)}`,
    `말투: ${orEmpty(p.look.speech)}`,
    '',
    `■ 큰 뜻\n${orEmpty(p.aim)}`,
    '',
    `■ 고정 상황\n${orEmpty(p.situation)}`,
    '',
    `시작일: ${p.startDate}`,
    '',
  ].join('\n');
}
