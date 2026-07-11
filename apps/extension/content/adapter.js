// goBlog 콘텐츠 스크립트 — 네이버 블로그·티스토리 작성폼 감지 및 입력
// 편집기 DOM은 수시로 바뀌므로 후보 셀렉터 + 클립보드 폴백 전략을 쓴다.

function detectPlatform() {
  const host = location.host;
  if (host.includes("tistory.com") && /\/manage\/(newpost|post)/.test(location.pathname)) {
    return "TISTORY";
  }
  if (host === "blog.naver.com" || host.includes("blog.editor.naver.com")) {
    // 스마트에디터 ONE 존재 확인
    if (document.querySelector(".se-title-text, .se-container, [data-a11y-title]")) return "NAVER_BLOG";
    if (/PostWriteForm|GoBlogWrite/.test(location.href)) return "NAVER_BLOG";
  }
  return null;
}

function firstElement(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return null;
}

function setNativeValue(input, value) {
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function copyHtmlToClipboard(html, plain) {
  const item = new ClipboardItem({
    "text/html": new Blob([html], { type: "text/html" }),
    "text/plain": new Blob([plain], { type: "text/plain" }),
  });
  await navigator.clipboard.write([item]);
}

/** 티스토리: 제목 직접 입력 + 본문은 에디터 iframe(TinyMCE)에 삽입 시도 → 실패 시 클립보드 */
async function applyTistory({ title, html, plainText }) {
  const notes = [];

  const titleInput = firstElement(["#post-title-inp", "textarea.textarea_tit", "input[name='title']", "textarea[placeholder*='제목']"]);
  if (titleInput) {
    setNativeValue(titleInput, title);
    notes.push("제목 입력 완료");
  } else {
    notes.push("제목 입력란을 찾지 못했습니다 — 직접 입력해주세요");
  }

  let bodyDone = false;
  const editorFrame = firstElement(["#editor-tistory_ifr", "iframe.tox-edit-area__iframe"]);
  if (editorFrame?.contentDocument?.body) {
    editorFrame.contentDocument.body.innerHTML = html;
    editorFrame.contentDocument.body.dispatchEvent(new Event("input", { bubbles: true }));
    bodyDone = true;
    notes.push("본문 입력 완료 (에디터 반영 확인 필요)");
  }

  if (!bodyDone) {
    await copyHtmlToClipboard(html, plainText);
    notes.push("본문을 클립보드에 복사했습니다 — 에디터에 Ctrl+V로 붙여넣으세요 (HTML 모드 권장)");
  }

  return { ok: true, notes };
}

/**
 * 네이버 스마트에디터 ONE.
 * 제목·본문 문단(.se-text-paragraph)은 contenteditable이 아니고, 에디터가 화면 밖 숨은
 * contenteditable DIV로 입력을 받아 내부 모델로 렌더한다 → execCommand/DOM 직접 입력이 반영되지 않는다.
 * 따라서 붙여넣기(클립보드)만 안정적이며, 제목은 사이드패널의 2단계 복사로 처리한다.
 */
async function applyNaver({ html, plainText }) {
  await copyHtmlToClipboard(html, plainText);
  return {
    ok: true,
    notes: [
      "본문을 클립보드에 복사했습니다 — 본문 영역을 클릭하고 Ctrl+V로 붙여넣으세요",
      "제목은 사이드패널 '작성폼에 넣기'가 따로 복사합니다 — 제목칸 클릭 후 Ctrl+V",
      "쇼핑커넥트 글은 대가성 문구가 제목 앞·본문 최상단에 있어야 합니다",
    ],
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === "DETECT") {
        sendResponse({ ok: true, platform: detectPlatform() });
        return;
      }
      if (message?.type === "APPLY") {
        const platform = detectPlatform();
        if (platform === "TISTORY") {
          sendResponse(await applyTistory(message));
        } else if (platform === "NAVER_BLOG") {
          sendResponse(await applyNaver(message));
        } else {
          sendResponse({ ok: false, error: "지원하는 작성폼이 아닙니다. 네이버/티스토리 글쓰기 화면을 열어주세요." });
        }
        return;
      }
      sendResponse({ ok: false, error: "알 수 없는 명령" });
    } catch (error) {
      sendResponse({ ok: false, error: String(error?.message ?? error) });
    }
  })();
  return true;
});
