// 액션 아이콘 클릭 시 사이드 패널 열기
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// 발행 성공 자동 감지 → 백엔드에 발행 완료 자동 기록 (사용자가 버튼 안 눌러도 됨)
// 네이버: blog.naver.com/{blogId}/{logNo 숫자} 로 이동 / 티스토리: {blog}.tistory.com/{글번호}
const PUBLISHED_URL = {
  NAVER_BLOG: /^https:\/\/blog\.naver\.com\/[^/?#]+\/(\d{6,})(?:[/?#]|$)/,
  TISTORY: /^https:\/\/[^/]+\.tistory\.com\/(\d+)(?:[/?#]|$)/,
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  chrome.storage.local.get(["pendingPublish", "apiBase", "token"]).then(async (s) => {
    const pending = s.pendingPublish;
    if (!pending?.articleId || !s.apiBase || !s.token) return;
    const re = PUBLISHED_URL[pending.platform];
    if (!re || !re.test(tab.url)) return; // 발행 게시글 URL이 아니면 무시

    try {
      const res = await fetch(`${s.apiBase}/api/extension/articles/${pending.articleId}/published`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Extension-Token": s.token },
        body: JSON.stringify({ platform: pending.platform, url: tab.url }),
      });
      if (res.ok) {
        await chrome.storage.local.remove("pendingPublish");
        // 사이드 패널이 열려 있으면 목록 새로고침하도록 알림
        chrome.runtime.sendMessage({ type: "PUBLISHED", articleId: pending.articleId, url: tab.url }).catch(() => {});
      }
    } catch (_) {
      // 네트워크 실패 시 pending 유지 → 다음 기회에 재시도 또는 수동 기록
    }
  });
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
      sendResponse(await sendToTab(tab.id, message.payload));
    } catch (error) {
      sendResponse({
        ok: false,
        error: "이 탭에서 작성폼을 찾을 수 없습니다. 네이버 블로그/티스토리 글쓰기 화면을 열어주세요.",
      });
    }
  })();

  return true; // async sendResponse
});

/**
 * 콘텐츠 스크립트에 메시지를 보낸다. 확장 재로드로 콘텐츠 스크립트가 끊긴(orphaned) 탭에서는
 * sendMessage가 "Receiving end does not exist"로 실패하므로, 그때 adapter를 모든 프레임에
 * 즉시 주입한 뒤 한 번 더 시도한다(이미 열려 있던 탭도 새로고침 없이 동작).
 */
async function sendToTab(tabId, payload) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, payload);
    if (res) return res;
  } catch (_) {
    // 연결 없음 → 주입 후 재시도
  }
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["content/adapter.js"],
  });
  const res = await chrome.tabs.sendMessage(tabId, payload);
  return res ?? { ok: false, error: "응답 없음" };
}
