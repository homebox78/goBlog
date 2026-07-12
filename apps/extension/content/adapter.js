// goBlog 콘텐츠 스크립트 — 네이버 블로그·티스토리 작성폼 감지 및 입력
// 편집기 DOM은 수시로 바뀌므로 후보 셀렉터 + 클립보드 폴백 전략을 쓴다.

// 네이버 쇼핑 커넥트 「활동 제한 채널」 — 여기에 커넥트 링크를 게시하면 실적 미인정 + 이용 제재.
// (2026.06.26 기준. 서비스 판단에 따라 상시 변경될 수 있음)
const RESTRICTED_CHANNELS = [
  { host: "ilbe.com", name: "일베저장소" },
  { host: "todayhumor.co.kr", name: "오늘의유머" },
  { host: "womad.life", name: "워마드" },
  { host: "damoang.net", name: "다모앙" },
  { host: "cafe.naver.com/brownu12nn", name: "소소하지만 확실한 행복(카페)" },
  { host: "cafe.naver.com/engmstudy", name: "짠돌이카페" },
  { host: "cafe.naver.com/skybluezw4rh", name: "맘이베베(카페)" },
  { host: "cafe.naver.com/twinklestarbucks", name: "트윙클 스타벅스(카페)" },
];

/** 현재 페이지가 쇼핑 커넥트 활동 제한 채널이면 채널명을, 아니면 null 반환. */
function restrictedChannel() {
  const url = (location.host + location.pathname).toLowerCase().replace(/^www\./, "");
  const hit = RESTRICTED_CHANNELS.find((c) => url.includes(c.host));
  return hit ? hit.name : null;
}

function detectPlatform() {
  const host = location.host;
  if (host.includes("instagram.com")) {
    // 새 게시물 만들기 다이얼로그(문구 입력칸) 또는 create 경로
    if (
      /\/create\//.test(location.pathname) ||
      document.querySelector('textarea[aria-label*="문구"], textarea[aria-label*="caption" i], div[aria-label="새 게시물 만들기"]')
    ) {
      return "INSTAGRAM";
    }
    return "INSTAGRAM"; // 인스타 탭이면 캡션 복사 흐름을 열어준다
  }
  if (host.includes("tistory.com") && /\/manage\/(newpost|post)/.test(location.pathname)) {
    return "TISTORY";
  }
  if (host === "blog.naver.com" || host.includes("blog.editor.naver.com")) {
    // 에디터(스마트에디터 ONE)는 #mainFrame 안에만 있어 프레임마다 감지 결과가 다르다.
    // 콘텐츠 스크립트는 all_frames로 최상위+에디터 프레임 양쪽에서 실행되고, background 릴레이는
    // frameId 없이 모든 프레임에 보내 '먼저 응답한' 프레임 결과를 쓴다 → 최상위가 null을 반환하면
    // 에디터 프레임이 NAVER_BLOG를 반환해도 경합에서 져 '작성폼 아님'이 된다.
    // 따라서 최상위 프레임도 글쓰기 URL(Redirect=Write / PostWriteForm)로 NAVER_BLOG를 반환해 경합을 없앤다.
    if (document.querySelector(".se-title-text, .se-container, [data-a11y-title]")) return "NAVER_BLOG";
    if (/PostWriteForm|GoBlogWrite/.test(location.href) || /[?&]Redirect=Write/i.test(location.href)) return "NAVER_BLOG";
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

// background가 재시도용으로 executeScript로 다시 주입할 수 있어, 리스너 중복 등록을 막는다
// (중복이면 sendResponse가 두 번 호출돼 응답이 꼬인다).
if (!window.__goblogAdapterListener) {
  window.__goblogAdapterListener = true;
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === "DETECT") {
        sendResponse({ ok: true, platform: detectPlatform(), restricted: restrictedChannel() });
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
}
