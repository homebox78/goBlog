import { useEffect } from "react";

/**
 * 편집 화면 공용 훅 — 미저장 이탈 방지 + Ctrl/Cmd+S 저장.
 * 수정하다 실수로 탭을 닫거나 새로고침하면 변경분이 소리 없이 사라진다.
 */

/** dirty 동안 탭 닫기·새로고침에 브라우저 확인창을 띄운다 */
export function useUnsavedGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Chrome은 returnValue가 있어야 확인창을 띄운다
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

/** Ctrl+S / Cmd+S 로 저장 — 브라우저 기본(페이지 저장) 대신 앱의 저장을 실행한다 */
export function useSaveShortcut(save: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save, enabled]);
}
