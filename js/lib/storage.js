// localStorage 래퍼. 저장소를 쓸 수 없어도 앱은 동작해야 하므로 모든 접근을 감싼다.

export function load(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패는 무시한다. 작성 중인 내용은 화면에 그대로 남아 있다.
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // 무시
  }
}

export function keys(prefix) {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith(prefix));
  } catch {
    return [];
  }
}
