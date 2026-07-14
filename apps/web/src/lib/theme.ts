/**
 * 다크 모드 — index.css 에 .dark 변수는 처음부터 있었는데 켤 스위치가 없었다.
 * 선택은 localStorage에 남기고, 미선택이면 OS 설정을 따른다.
 *
 * ⚠️ localStorage 접근은 **반드시 try/catch로 감싼다.**
 *    시크릿 모드·스토리지 차단·프로필 손상(NS_ERROR_STORAGE_IOERR)에서 예외가 던져지는데,
 *    이걸 안 막으면 렌더 전에 터져 **앱 전체가 백지**가 된다 (실제로 그랬다).
 *    테마 하나 때문에 관리자 화면 전체를 못 쓰게 되는 건 말이 안 된다.
 */

const KEY = "goblog-theme";

export type Theme = "light" | "dark";

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null; // 스토리지를 못 읽어도 앱은 떠야 한다
  }
}

function prefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function currentTheme(): Theme {
  return readStored() ?? (prefersDark() ? "dark" : "light");
}

export function applyStoredTheme(): void {
  try {
    document.documentElement.classList.toggle("dark", currentTheme() === "dark");
  } catch {
    // 테마 적용 실패가 앱 기동을 막아선 안 된다
  }
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // 저장은 실패해도 이번 세션 동안은 적용된다
  }
  document.documentElement.classList.toggle("dark", next === "dark");
  return next;
}
