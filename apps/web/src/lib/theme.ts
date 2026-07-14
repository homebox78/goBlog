/**
 * 다크 모드 — index.css 에 .dark 변수는 처음부터 있었는데 켤 스위치가 없었다.
 * 선택은 localStorage에 남기고, 미선택이면 OS 설정을 따른다.
 * applyStoredTheme()는 React 렌더 전에 불러 첫 화면 깜빡임(밝게 떴다 어두워짐)을 막는다.
 */

const KEY = "goblog-theme";

export type Theme = "light" | "dark";

export function currentTheme(): Theme {
  const stored = localStorage.getItem(KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyStoredTheme(): void {
  document.documentElement.classList.toggle("dark", currentTheme() === "dark");
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === "dark" ? "light" : "dark";
  localStorage.setItem(KEY, next);
  document.documentElement.classList.toggle("dark", next === "dark");
  return next;
}
