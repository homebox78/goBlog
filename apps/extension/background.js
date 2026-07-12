// 액션 아이콘 클릭 시 사이드 패널 열기 + 이미 열려 있는 goBlog 탭에 다리 재주입
// (확장을 새로고침해도 기존 탭엔 콘텐츠 스크립트가 자동 주입되지 않아 '확장 미감지'가 나던 문제)
chrome.runtime.onInstalled.addListener(async () => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  try {
    const tabs = await chrome.tabs.query({ url: ["https://hom2box.com/*", "http://localhost:5173/*"] });
    for (const tab of tabs) {
      if (!tab.id) continue;
      chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content/bridge.js"] }).catch(() => {});
    }
  } catch (_) {
    // 권한/쿼리 실패는 무시 — 페이지 새로고침으로도 해결됨
  }
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
    // 맨몸 fetch는 네이버가 429로 막으므로, 백그라운드 탭으로 실제 렌더 후 og 태그를 읽는다.
    let tabId = null;
    try {
      const tab = await chrome.tabs.create({ url: message.url, active: false });
      tabId = tab.id;
      // 로딩 완료 대기 (최대 10초)
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }, 10000);
        const listener = (id, info) => {
          if (id === tabId && info.status === "complete") {
            clearTimeout(timer);
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
      // 렌더된 DOM에서 상품 정보 추출
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const meta = (p) =>
            document.querySelector(`meta[property="${p}"], meta[name="${p}"]`)?.getAttribute("content") ?? null;
          return {
            title: meta("og:title") || document.title || null,
            image: meta("og:image"),
            html: document.documentElement.outerHTML.slice(0, 300000),
          };
        },
      });
      const info = res?.result ?? {};
      sendResponse({ ok: true, status: 200, title: info.title, image: info.image, html: info.html });
    } catch (error) {
      sendResponse({ ok: false, error: String(error?.message || error) });
    } finally {
      if (tabId != null) chrome.tabs.remove(tabId).catch(() => {});
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

// 티스토리 완전 자동 입력 — MAIN 월드에서 TinyMCE API를 직접 호출(모델 동기화)
// + 제목(React 네이티브 세터) + 태그(#tagText Enter 이벤트) 자동 입력
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "TISTORY_AUTO") return false;
  (async () => {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: message.tabId },
        world: "MAIN", // 페이지 컨텍스트 — window.tinymce 접근 가능
        func: (title, html, tags, category) => {
          const done = [];
          const nativeSet = (input, value) => {
            const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(input, value);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          };
          // ① 제목
          const titleEl = document.querySelector("#post-title-inp, textarea.textarea_tit");
          if (titleEl) {
            nativeSet(titleEl, title);
            done.push("제목");
          }
          // ② 본문 — TinyMCE API로 모델까지 동기화 (기본모드)
          const ed =
            (window.tinymce && (window.tinymce.get("editor-tistory") || window.tinymce.activeEditor)) || null;
          if (ed) {
            ed.setContent(html);
            ed.undoManager && ed.undoManager.add();
            ed.fire && ed.fire("change");
            ed.save && ed.save();
            done.push("본문(TinyMCE)");
          } else {
            const frame = document.querySelector("#editor-tistory_ifr");
            if (frame && frame.contentDocument && frame.contentDocument.body) {
              frame.contentDocument.body.innerHTML = html;
              done.push("본문(iframe)");
            }
          }
          // ③ 태그 — 입력 후 Enter로 하나씩 확정 (React 핸들러는 합성 이벤트도 처리)
          const tagInput = document.querySelector("#tagText");
          if (tagInput && Array.isArray(tags) && tags.length) {
            for (const tag of tags.slice(0, 10)) {
              nativeSet(tagInput, String(tag).replace(/^#/, ""));
              tagInput.dispatchEvent(
                new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }),
              );
            }
            nativeSet(tagInput, "");
            done.push(`태그 ${Math.min(tags.length, 10)}개`);
          }
          // ④ 카테고리 — 드롭다운 열고 글 카테고리명과 일치하는 옵션 클릭 (TinyMCE 메뉴)
          if (category) {
            const norm = (s) => (s || "").replace(/\s+/g, "").replace(/[·ㆍ・]/g, "·").trim();
            const want = norm(category);
            const catBtn = document.querySelector("#category-btn");
            if (catBtn) catBtn.click(); // 목록 렌더/핸들러 활성화
            const options = document.querySelectorAll('#category-list [role="option"]');
            let picked = null;
            for (const opt of options) {
              const label = norm(opt.getAttribute("aria-label") || opt.textContent);
              if (label === want || (want && label.includes(want))) {
                picked = opt;
                break;
              }
            }
            if (picked) {
              for (const type of ["mousedown", "mouseup", "click"]) {
                picked.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
              }
              done.push(`카테고리(${category})`);
            } else if (catBtn) {
              catBtn.click(); // 못 찾으면 열었던 드롭다운 닫기
            }
          }
          return done;
        },
        args: [message.title, message.html, message.tags ?? [], message.category ?? ""],
      });
      const done = result?.result ?? [];
      if (done.length === 0) {
        sendResponse({ ok: false, error: "작성폼 요소를 찾지 못했습니다. 글쓰기 화면인지 확인해주세요." });
      } else {
        sendResponse({ ok: true, done });
      }
    } catch (error) {
      sendResponse({ ok: false, error: String(error?.message ?? error) });
    }
  })();
  return true;
});

// 티스토리 발행 마무리 — 완료 다이얼로그 열고 홈주제 자동 선택 후 공개 발행 (MAIN 월드, async)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "TISTORY_PUBLISH") return false;
  (async () => {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: message.tabId },
        world: "MAIN",
        func: async (category) => {
          const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
          const done = [];
          // goBlog 카테고리 → 티스토리 홈주제(리프) 매핑
          const MAP = {
            "it·디지털": "IT 인터넷",
            "재테크·금융": "경제",
            "건강·헬스": "건강",
            "생활·살림": "생활정보",
            "쇼핑·리뷰": "IT 제품리뷰",
            "여행·맛집": "맛집",
            "뷰티·패션": "패션·뷰티",
            "트렌드·이슈": "사회",
          };
          const normCat = (s) => (s || "").toLowerCase().replace(/\s+/g, "").replace(/[ㆍ・]/g, "·").trim();
          const subject = MAP[normCat(category)] || null;

          // ① 완료 → 발행 다이얼로그 오픈
          const layerBtn = document.querySelector("#publish-layer-btn");
          if (layerBtn) layerBtn.click();
          // ② 다이얼로그(#home_subject) 렌더 대기
          let tries = 0;
          while (!document.querySelector("#home_subject") && tries++ < 50) await sleep(150);
          if (!document.querySelector("#publish-btn")) return ["발행 다이얼로그를 열지 못했습니다"];

          // ③ 홈주제 선택
          if (subject) {
            const wrap = document.querySelector("#home_subject");
            const btn = wrap && wrap.querySelector(".select_btn");
            if (btn) {
              btn.click();
              await sleep(250);
            }
            const norm = (s) => (s || "").replace(/^[-\s·ㆍ]+/, "").replace(/\s+/g, "").replace(/[ㆍ・]/g, "·").trim();
            const items = wrap ? wrap.querySelectorAll('[role="menuitem"]') : [];
            let picked = null;
            for (const it of items) {
              if (it.classList.contains("disabled")) continue; // 상위(대분류)는 선택 불가
              const t = (it.querySelector(".mce-text") || {}).textContent || "";
              if (norm(t) === norm(subject)) {
                picked = it;
                break;
              }
            }
            if (picked) {
              for (const type of ["mousedown", "mouseup", "click"]) {
                picked.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
              }
              done.push(`홈주제(${subject})`);
              await sleep(350);
            }
          }

          // ④ 공개 발행
          const pub = document.querySelector("#publish-btn");
          if (pub) {
            pub.click();
            done.push("공개 발행");
          }
          return done;
        },
        args: [message.category ?? ""],
      });
      sendResponse({ ok: true, done: result?.result ?? [] });
    } catch (error) {
      sendResponse({ ok: false, error: String(error?.message ?? error) });
    }
  })();
  return true;
});

// 네이버 발행 마무리 — 발행 버튼 → 발행 레이어 → 최종 발행 (SmartEditor는 #mainFrame iframe → allFrames)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "NAVER_PUBLISH") return false;
  (async () => {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: message.tabId, allFrames: true },
        world: "MAIN",
        func: async () => {
          const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
          const fire = (el) => {
            for (const t of ["pointerdown", "mousedown", "mouseup", "click"]) {
              el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
            }
          };
          // 1차 발행 버튼(발행 레이어 열기) — 이 프레임에 없으면 발행 UI 프레임이 아님
          const openBtn = document.querySelector('[data-click-area="tpb.publish"]');
          if (!openBtn) return null;
          fire(openBtn);
          // 발행 레이어의 최종 발행 버튼 대기
          let tries = 0;
          while (!document.querySelector('[data-testid="seOnePublishBtn"]') && tries++ < 50) await sleep(150);
          const finalBtn = document.querySelector('[data-testid="seOnePublishBtn"]');
          if (!finalBtn) return ["발행 레이어를 열지 못했습니다"];
          await sleep(500); // 레이어 애니메이션·기본값 로드 대기
          fire(finalBtn);
          return ["발행"];
        },
      });
      const done = results.map((r) => r && r.result).find((x) => x);
      sendResponse({ ok: !!(done && done.includes("발행")), done: done || [], error: done ? null : "발행 버튼을 찾지 못했습니다" });
    } catch (error) {
      sendResponse({ ok: false, error: String(error?.message ?? error) });
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
