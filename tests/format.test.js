import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatUncertainty, fileName, objectParticle, weekday } from '../js/lib/format.js';

const base = {
  version: 1,
  date: '2026-10-13',
  step: 'save',
  noneFound: false,
  traces: [],
  pickedId: null,
  pastUpdate: '',
  record: {
    uncertain: '', prediction: '', confidence: 50,
    actual: '', actualUnknown: false, response: null, evidence: '',
  },
};

test('기본 형식 (design.md 5절 예시)', () => {
  const state = {
    ...base,
    traces: [
      { id: 'b', slot: 'afternoon', kind: 'emotion', text: '회의 뒤 후회', unknown: '' },
      { id: 'a', slot: 'morning', kind: 'action', text: '메시지를 몇 번 열어 봄', unknown: '친구의 반응' },
    ],
    pickedId: 'a',
    record: {
      uncertain: '친구가 내 메시지를 어떻게 받아들였는지',
      prediction: '내가 너무 진지하다고 생각했을 거야', confidence: 70,
      actual: '저녁에 평소처럼 답장이 왔다', actualUnknown: false,
      response: 'sought', evidence: '불편했지만 오후 일은 다 했다',
    },
  };
  assert.equal(formatUncertainty(state), `[불확실성 돌아보기] 2026-10-13 (화)

■ 찾은 흔적
- 아침 | 행동 | 메시지를 몇 번 열어 봄
  → 나는 친구의 반응을 모르고, 그게 신경 쓰였다.
- 오후 | 감정 | 회의 뒤 후회
  → (비어 있음)

■ 기록
1. 불확실했던 것: 친구가 내 메시지를 어떻게 받아들였는지
2. 그때 예상: 내가 너무 진지하다고 생각했을 거야 (확신도 70%)
3. 실제로 일어난 것: 저녁에 평소처럼 답장이 왔다
4. 나는: 확실성 추구를 했다
5. 감당했다는 증거: 불편했지만 오후 일은 다 했다
`);
});

test('못 찾음', () => {
  assert.equal(formatUncertainty({ ...base, noneFound: true }), `[불확실성 돌아보기] 2026-10-13 (화)

■ 찾은 흔적
못 찾음

■ 지난 기록 업데이트
(비어 있음)
`);
});

test('아직 모름과 빈 항목', () => {
  const state = {
    ...base,
    traces: [{ id: 'a', slot: 'noon', kind: 'body', text: '텐션 상승', unknown: '' }],
    record: { ...base.record, actual: '무시됨', actualUnknown: true },
  };
  const out = formatUncertainty(state);
  assert.match(out, /3\. 실제로 일어난 것: 아직 모름/);
  assert.match(out, /2\. 그때 예상: \(비어 있음\)/);
  assert.match(out, /4\. 나는: \(비어 있음\)/);
});

test('을/를', () => {
  assert.equal(objectParticle('반응'), '을');
  assert.equal(objectParticle('마음'), '을');
  assert.equal(objectParticle('의도'), '를');
  assert.equal(objectParticle('ABC'), '을(를)');
});

test('요일과 파일명', () => {
  assert.equal(weekday('2026-10-12'), '월');
  assert.equal(fileName(base), 'uncertainty-2026-10-13.txt');
});

import { formatBody, bodyFileName, formatDuration } from '../js/lib/format.js';

test('신체 훈련 형식', () => {
  const state = {
    date: '2026-10-13',
    scores: { anxiety: 4, blame: null },
    breath: { seconds: 300 },
    moment: '회의에서 말이 빨라졌을 때',
    spots: [
      { place: '가슴', feel: '조임', intensity: 3 },
      { place: '목·어깨', feel: '무거움', intensity: 5 },
    ],
    stay: { seconds: 0 },
  };
  assert.equal(formatBody(state), `[신체 훈련] 2026-10-13 (화)

■ 시작 점수
불안: 4/10
나를 향한 비난: (비어 있음)

■ 공명 호흡
5분

■ 감정 위치 찾기
떠올린 순간: 회의에서 말이 빨라졌을 때
- 가슴 | 조임 | 3
- 목·어깨 | 무거움 | 5

■ 그냥 같이 있기
안 함
`);
  assert.equal(bodyFileName(state), 'body-2026-10-13.txt');
});

test('시간 표기', () => {
  assert.equal(formatDuration(0), '안 함');
  assert.equal(formatDuration(45), '45초');
  assert.equal(formatDuration(150), '2분 30초');
});

import { formatCompassion, compassionFileName, formatSelf } from '../js/lib/format.js';

test('자기자비 형식', () => {
  const state = {
    date: '2026-10-13',
    scene: { source: 'uncertainty', text: '메시지를 몇 번 열어 봄' },
    letter: { ack: '그때 너는 답을 몰라서 힘들었구나.', common: '', toYou: '괜찮아.' },
    resonance: 'empty',
    handBreath: true,
    switched: true,
  };
  assert.equal(formatCompassion(state), `[자기자비] 2026-10-13 (화)

■ 장면 (불확실성 기록에서)
메시지를 몇 번 열어 봄

■ 자비의 편지
1. 알아주기: 그때 너는 답을 몰라서 힘들었구나.
2. 누구나: (비어 있음)
3. 너에게: 괜찮아.

■ 와닿은 정도
공허함
대신 손을 가슴에 얹고 1분 호흡

■ 메모
중간에 호흡으로 전환
`);
  assert.equal(compassionFileName(state), 'compassion-2026-10-13.txt');
});

test('자비로운 나 형식', () => {
  assert.match(formatSelf({ wisdom: '조급해도 된다는 걸 안다' }), /지혜로움: 조급해도 된다는 걸 안다\n강함: \(비어 있음\)/);
});

import { weekInfo, problemsFor, dayOfWeek, formatDaehyupDay, formatDaehyupWeek } from '../js/lib/format.js';
import {
  DEFAULT_PRINCIPLES, VERDICT_PROBLEMS, SHADOW_OPTIONS, ACTION_OPTIONS, CHECK_OPTIONS,
} from '../js/data/daehyup.js';

test('대협 주차 계산과 순환', () => {
  const p = DEFAULT_PRINCIPLES;
  assert.equal(weekInfo('2026-10-12', '2026-10-12', p).week, 1);
  assert.equal(weekInfo('2026-10-12', '2026-10-18', p).principle.id, 'beat');
  assert.equal(weekInfo('2026-10-12', '2026-10-19', p).principle.id, 'trust');
  const w8 = weekInfo('2026-10-12', '2026-10-12', p);
  assert.equal(w8.next.id, 'trust');
  assert.equal(weekInfo('2026-10-12', '2026-11-30', p).principle.id, 'beat'); // 8주차 = 다시 처음
  assert.equal(weekInfo('2026-10-12', '2026-10-05', p).week, 0); // 시작 전
});

test('판결 문제는 날짜마다 고정', () => {
  const a = problemsFor('2026-10-13', VERDICT_PROBLEMS);
  assert.deepEqual(a, problemsFor('2026-10-13', VERDICT_PROBLEMS));
  assert.equal(a.length, 2);
  assert.notEqual(a[0], a[1]);
  assert.equal(dayOfWeek('2026-10-16'), 5);
});

test('대협 하루 기록 형식', () => {
  const day = {
    date: '2026-10-16',
    morning: true,
    predict: { text: '어색해질 것이다', confidence: 60 },
    evening: { action: 'done', hero: '', pushed: '회의에서 반박', ifHero: '', shadow: 'rush', admired: '민수', admiredWhy: '정리를 잘함', expActual: '자연스러웠다', expDiff: '' },
    problems: [{ verdict: '재미없는 사람' }, {}],
    real: { behavior: '', verdict: '', situ: '', state: '', trait: '', worth: '', checked: 'postponed' },
  };
  const ctx = {
    ...weekInfo('2026-10-12', '2026-10-16', DEFAULT_PRINCIPLES),
    isMeeting: true, isVerdictWeek: true, problems: ['문제 A', '문제 B'],
    shadowOptions: SHADOW_OPTIONS, actionOptions: ACTION_OPTIONS, checkOptions: CHECK_OPTIONS,
  };
  const out = formatDaehyupDay(day, ctx);
  assert.match(out, /^\[대협 훈련\] 2026-10-16 \(금\)\n이번 주: 1주차 · 한 박자 뒤에 움직인다/);
  assert.match(out, /■ 아침 출진\n했음/);
  assert.match(out, /예측: 어색해질 것이다 \(확신도 60%\)/);
  assert.match(out, /1\. 이번 주 행동: 했다/);
  assert.match(out, /5\. 그림자: 떠밀린 서두름/);
  assert.match(out, /6\. 오늘 높이 본 사람: 민수 \/ 이유: 정리를 잘함/);
  assert.match(out, /실제 반응: 자연스러웠다\n예측과의 차이: \(비어 있음\)/);
  assert.match(out, /\[문제 1\] 문제 A\n- 판결: 이건 내가 재미없는 사람이라는 뜻이다/);
  assert.match(out, /5\. 확인 행동: 미뤘다/);
  assert.match(out, /\[문제 2\] 문제 B\n- 판결: \(비어 있음\)/);

  const plain = formatDaehyupDay(day, { ...ctx, isMeeting: false, isVerdictWeek: false });
  assert.doesNotMatch(plain, /관계 실험|판결 연습|모임 전 예측/);
});

test('대협 주간 점검 형식', () => {
  const info = weekInfo('2026-10-12', '2026-10-18', DEFAULT_PRINCIPLES);
  assert.equal(formatDaehyupWeek({ date: '2026-10-18', days: 5, pattern: '', note: '' }, info), `[대협 주간 점검] 2026-10-18 (일)
이번 주: 1주차 · 한 박자 뒤에 움직인다
실행 일수: 5/7
반복된 떠밀린 순간: (비어 있음)
메모: (비어 있음)
다음 주: 2주차 · 남을 믿고 높이 본다
`);
});
