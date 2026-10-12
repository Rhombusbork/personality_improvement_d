// 단계 타이머. 시작 시각 기준으로 계산하므로 새로고침해도 이어진다. 안내만 하고 입력은 막지 않는다.

export function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function startTimer({ startedAt, durationMs, onTick, onEnd }) {
  let ended = false;
  const tick = () => {
    const remaining = startedAt + durationMs - Date.now();
    onTick(remaining);
    if (remaining <= 0 && !ended) {
      ended = true;
      onEnd();
    }
  };
  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}
