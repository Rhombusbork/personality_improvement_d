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
