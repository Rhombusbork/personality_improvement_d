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
