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

// goBlog 웹앱 → 네이버 상품 페이지 대리 요청 (서버는 네이버가 429로 차단하므로,
// 사용자 브라우저 IP로 스마트스토어 HTML을 가져와 상품명·이미지·가격 og 태그를 읽는다)
const NAVER_FETCH_ALLOWED = /^https:\/\/(smartstore|shopping|brand|m\.smartstore)\.naver\.com\//;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "NAVER_FETCH" || typeof message.url !== "string") return false;
  (async () => {
    if (!NAVER_FETCH_ALLOWED.test(message.url)) {
      sendResponse({ ok: false, error: "허용되지 않은 URL입니다." });
      return;
    }
    try {
      const res = await fetch(message.url, { credentials: "omit" });
      const html = (await res.text()).slice(0, 400_000); // og 태그는 head에 있음 — 크기 제한
      sendResponse({ ok: res.ok, status: res.status, html });
    } catch (error) {
      sendResponse({ ok: false, error: String(error?.message || error) });
    }
  })();
  return true;
});

// 네이버 스마트에디터 완전 자동 입력 — chrome.debugger(CDP)로 '신뢰된' 입력 이벤트를 만든다.
// SE ONE은 모델 기반이라 DOM 주입·합성 이벤트는 무시하지만, CDP 입력은 실제 키보드/마우스와 동일.
// 흐름: 제목 클릭 → Input.insertText(클립보드 불사용) → 본문 클릭 → Ctrl+V(클립보드의 HTML — 패널이 미리 담음)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "NAVER_AUTO") return false;
  (async () => {
    const dbg = { tabId: message.tabId };
    const send = (method, params) => chrome.debugger.sendCommand(dbg, method, params);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const click = async (x, y) => {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    };
    try {
      try {
        await chrome.debugger.attach(dbg, "1.3");
      } catch (e) {
        if (!String(e?.message ?? e).includes("attached")) throw e;
      }
      // ① 제목: 클릭 → 텍스트 삽입
      await click(message.rects.title.x, message.rects.title.y);
      await sleep(350);
      await send("Input.insertText", { text: message.title });
      await sleep(350);
      // ② 본문: 클릭 → 붙여넣기 (keyDown에 편집명령 paste 동봉 — 단축키+명령 이중 보장)
      await click(message.rects.body.x, message.rects.body.y);
      await sleep(350);
      await send("Input.dispatchKeyEvent", {
        type: "keyDown", modifiers: 2, key: "v", code: "KeyV",
        windowsVirtualKeyCode: 86, nativeVirtualKeyCode: 86, commands: ["paste"],
      });
      await send("Input.dispatchKeyEvent", {
        type: "keyUp", modifiers: 2, key: "v", code: "KeyV",
        windowsVirtualKeyCode: 86, nativeVirtualKeyCode: 86,
      });
      await sleep(600);
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({ ok: false, error: String(error?.message ?? error) });
    } finally {
      try { await chrome.debugger.detach(dbg); } catch (_) { /* 이미 해제됨 */ }
    }
  })();
  return true;
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
