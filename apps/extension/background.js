// 액션 아이콘 클릭 시 사이드 패널 열기
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// 사이드 패널 ↔ 활성 탭 콘텐츠 스크립트 메시지 중계
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.relay !== true) return false;

  (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      sendResponse({ ok: false, error: "활성 탭을 찾을 수 없습니다." });
      return;
    }
    try {
      const response = await chrome.tabs.sendMessage(tab.id, message.payload);
      sendResponse(response ?? { ok: false, error: "응답 없음" });
    } catch (error) {
      sendResponse({
        ok: false,
        error: "이 탭에서 작성폼을 찾을 수 없습니다. 네이버 블로그/티스토리 글쓰기 화면을 열어주세요.",
      });
    }
  })();

  return true; // async sendResponse
});
