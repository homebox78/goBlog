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

// ⚠️ 대기 슬롯이 **하나뿐이면 연속 발행에서 앞 건이 덮어써진다.**
//    실측: 티스토리 47건 중 4건 URL 누락 — 성공/누락이 번갈아 났다(뒤 발행이 앞 발행의 대기를 지웠다).
//    그래서 목록(pendingPublishes)으로 들고, 맞는 것만 골라 지운다.
//    구버전 단일 슬롯(pendingPublish)도 함께 읽어 확장 갱신 직후를 넘긴다.
async function readPending() {
  const s = await chrome.storage.local.get(["pendingPublishes", "pendingPublish"]);
  const list = Array.isArray(s.pendingPublishes) ? s.pendingPublishes : [];
  if (s.pendingPublish?.articleId) list.push(s.pendingPublish); // 구버전 잔여분 흡수
  return list;
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  chrome.storage.local.get(["apiBase", "token"]).then(async (s) => {
    if (!s.apiBase || !s.token) return;
    const pendings = await readPending();
    if (pendings.length === 0) return;

    // 지금 열린 주소가 어느 발행의 결과인지 고른다 (플랫폼별 글 주소 형태로 판별)
    const pending = pendings.find((p) => {
      const re = PUBLISHED_URL[p?.platform];
      return re && re.test(tab.url);
    });
    if (!pending) return;

    try {
      const res = await fetch(`${s.apiBase}/api/extension/articles/${pending.articleId}/published`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Extension-Token": s.token },
        body: JSON.stringify({ platform: pending.platform, url: tab.url }),
      });
      if (res.ok) {
        // **처리한 것만** 지운다 — 통째로 지우면 아직 발행 중인 다른 글의 대기가 날아간다
        const rest = (await readPending()).filter((p) => p.articleId !== pending.articleId);
        await chrome.storage.local.set({ pendingPublishes: rest });
        await chrome.storage.local.remove("pendingPublish");
        chrome.runtime.sendMessage({ type: "PUBLISHED", articleId: pending.articleId, url: tab.url }).catch(() => {});
      }
    } catch (_) {
      // 네트워크 실패 시 대기 유지 → 다음 기회에 재시도 또는 서버의 RSS 자기치유가 채운다
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

/**
 * 네이버 글쓰기 화면에 떠 있는 팝업을 닫는다.
 * ⚠️ 이걸 안 하면 '작성 중이던 글이 있습니다(임시저장 복구)' 레이어가 좌표 클릭을 가로채,
 * 제목 입력이 통째로 실패하고 **복구된 초안의 제목이 그대로 발행된다**
 * (실제로 글 하나가 제목 "🔥" 로 발행됨 — logNo 224345223842).
 */
async function seDismissPopups(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const closed = [];
      // 임시저장 복구 레이어는 '취소'(= 새로 작성)를 눌러야 빈 문서로 시작한다.
      for (const pop of document.querySelectorAll('.se-popup, .se-popup-container, [class*="popup"]')) {
        if (!visible(pop)) continue;
        const btn = [...pop.querySelectorAll("button, a")].find(
          (b) => visible(b) && /취소|닫기|새로\s*작성/.test(b.textContent || ""),
        );
        if (btn) {
          btn.click();
          closed.push((btn.textContent || "").trim());
        }
      }
      return closed;
    },
  });
  return results.flatMap((r) => r.result ?? []);
}

/** 제목·본문의 최상위 뷰포트 좌표 (팝업을 닫아 레이아웃이 바뀐 뒤 다시 재는 게 중요하다) */
async function seRects(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () => {
      const titleEl = document.querySelector(".se-title-text");
      const bodyEl = document.querySelector(".se-component.se-text .se-module-text");
      if (!titleEl || !bodyEl) return null;
      titleEl.scrollIntoView({ block: "center" });
      const absCenter = (el) => {
        const r = el.getBoundingClientRect();
        let x = r.left + r.width / 2;
        let y = r.top + r.height / 2;
        let win = window;
        while (win !== win.top) {
          try {
            const fe = win.frameElement;
            if (!fe) break;
            const fr = fe.getBoundingClientRect();
            x += fr.left;
            y += fr.top;
            win = win.parent;
          } catch {
            break;
          }
        }
        return { x: Math.round(x), y: Math.round(y) };
      };
      return { title: absCenter(titleEl), body: absCenter(bodyEl) };
    },
  });
  return results.map((r) => r.result).find(Boolean) ?? null;
}

/** 제목칸에 실제로 들어간 텍스트를 읽는다 (placeholder '제목'은 제외). */
async function seReadTitle(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () => {
      const el = document.querySelector(".se-title-text");
      if (!el) return null;
      const clone = el.cloneNode(true);
      clone.querySelectorAll(".se-placeholder").forEach((n) => n.remove());
      return (clone.innerText || "").replace(/​/g, "").trim();
    },
  });
  return results.map((r) => r.result).find((v) => v !== null && v !== undefined) ?? null;
}

const normTitle = (s) => String(s || "").replace(/\s+/g, " ").trim();

// 네이버 스마트에디터 완전 자동 입력 — chrome.debugger(CDP)로 '신뢰된' 입력 이벤트를 만든다.
// SE ONE은 모델 기반이라 DOM 주입·합성 이벤트는 무시하지만, CDP 입력은 실제 키보드/마우스와 동일.
// 흐름: 팝업 닫기 → 좌표 재측정 → 제목 클릭·전체선택·삭제·insertText → **제목 검증** → 본문 클릭 → Ctrl+V
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
    // 제목칸 전체선택 — 이어지는 insertText가 선택 영역을 '덮어쓴다'(별도 삭제키 불필요)
    const selectAll = async () => {
      await send("Input.dispatchKeyEvent", {
        type: "keyDown", modifiers: 2, key: "a", code: "KeyA",
        windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65, commands: ["selectAll"],
      });
      await send("Input.dispatchKeyEvent", {
        type: "keyUp", modifiers: 2, key: "a", code: "KeyA",
        windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65,
      });
      await sleep(120);
    };
    try {
      try {
        await chrome.debugger.attach(dbg, "1.3");
      } catch (e) {
        if (!String(e?.message ?? e).includes("attached")) throw e;
      }

      // ⓪ 임시저장 복구 등 팝업 제거 후 좌표를 다시 잰다 (팝업이 열려 있으면 클릭이 먹히지 않는다)
      await seDismissPopups(message.tabId);
      await sleep(300);
      const rects = (await seRects(message.tabId)) ?? message.rects;

      // ① 제목: 클릭 → (찌꺼기가 있으면 전체선택해 덮어쓰기) → 텍스트 삽입
      //    빈 제목이면 전체선택을 하지 않는다 — 문서 전체가 잡히는 사고를 피한다.
      const before = await seReadTitle(message.tabId);
      await click(rects.title.x, rects.title.y);
      await sleep(350);
      if (before) await selectAll();
      await send("Input.insertText", { text: message.title });
      await sleep(400);

      // ② 제목 검증 — 여기서 막지 않으면 엉뚱한 제목(빈칸·이전 초안 찌꺼기)으로 발행된다.
      let actual = await seReadTitle(message.tabId);
      for (let retry = 0; retry < 2 && normTitle(actual) !== normTitle(message.title); retry++) {
        await click(rects.title.x, rects.title.y);
        await sleep(250);
        if (actual) await selectAll();
        await send("Input.insertText", { text: message.title });
        await sleep(450);
        actual = await seReadTitle(message.tabId);
      }
      if (normTitle(actual) !== normTitle(message.title)) {
        // 발행하지 않고 멈춘다 — 잘못된 제목으로 발행되는 것보다 수동 전환이 낫다.
        sendResponse({
          ok: false,
          titleMismatch: true,
          titleActual: actual,
          error: `제목 입력 검증 실패 (에디터 제목: "${actual ?? "(읽기 실패)"}") — 발행을 중단했습니다.`,
        });
        return;
      }

      // ③ 본문: 클릭 → 붙여넣기 (keyDown에 편집명령 paste 동봉 — 단축키+명령 이중 보장)
      await click(rects.body.x, rects.body.y);
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
      sendResponse({ ok: true, titleActual: actual });
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
      // 2차 안전망 — 제목에 글자(한글·영문·숫자)가 하나도 없으면 발행하지 않는다.
      // 이모지만 남은 제목("🔥")으로 발행된 사고가 실제로 있었다. 발행은 되돌리기 어렵다.
      const titleNow = await seReadTitle(message.tabId);
      if (!/[0-9A-Za-z가-힣]/.test(titleNow || "")) {
        sendResponse({
          ok: false,
          error: `제목이 비어 있거나 이모지뿐입니다("${titleNow ?? ""}") — 발행을 중단했습니다. 제목을 확인하세요.`,
        });
        return;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: message.tabId, allFrames: true },
        world: "MAIN",
        func: async (category) => {
          const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
          const fire = (el) => {
            for (const t of ["pointerdown", "mousedown", "mouseup", "click"]) {
              el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
            }
          };
          const norm = (s) => String(s || "").replace(/\s|·|\.|\//g, "").toLowerCase();

          // 1차 발행 버튼(발행 레이어 열기) — 이 프레임에 없으면 발행 UI 프레임이 아님
          const openBtn = document.querySelector('[data-click-area="tpb.publish"]');
          if (!openBtn) return null;
          fire(openBtn);
          // 발행 레이어의 최종 발행 버튼 대기
          let tries = 0;
          while (!document.querySelector('[data-testid="seOnePublishBtn"]') && tries++ < 50) await sleep(150);
          const finalBtn = document.querySelector('[data-testid="seOnePublishBtn"]');
          if (!finalBtn) return ["발행 레이어를 열지 못했습니다"];
          await sleep(600); // 레이어 애니메이션·카테고리 목록 로드 대기

          const done = [];

          // ── 카테고리 선택 ─────────────────────────────────────────────────
          // 이 단계가 없어서 **모든 글이 네이버 기본 카테고리(첫 항목)로 발행**되고 있었다.
          // SE ONE 발행 레이어의 카테고리 UI는 셀렉터가 자주 바뀌므로, 특정 셀렉터에 의존하지 않고
          // "레이어 안에서 원하는 카테고리 '글자'를 가진 클릭 가능한 요소"를 찾아 누른다.
          if (category) {
            const want = norm(category);
            const layer =
              document.querySelector('[class*="publish"], [class*="Publish"]') || document.body;

            const clickableWithText = (text) =>
              [...layer.querySelectorAll('button, a, li, [role="option"], [role="button"], label, span, div')].filter(
                (el) => {
                  if (el.offsetParent === null) return false; // 화면에 없는 요소 제외
                  // 자식이 많은 컨테이너 말고 '잎' 요소만 (텍스트가 그 요소 자체의 것)
                  const own = [...el.childNodes]
                    .filter((n) => n.nodeType === 3)
                    .map((n) => n.textContent)
                    .join("");
                  return norm(own) === text;
                },
              );

            // 이미 원하는 카테고리가 선택돼 있는지 먼저 확인 (선택된 항목은 보통 aria-selected/checked)
            let picked = false;
            const direct = clickableWithText(want);
            if (direct.length > 0) {
              fire(direct[direct.length - 1]); // 목록이 열려 있으면 바로 선택
              await sleep(400);
              picked = true;
            } else {
              // 목록이 접혀 있다 → 카테고리 드롭다운을 연다.
              // 현재 선택된 카테고리 이름(= 우리 8개 중 하나)을 가진 버튼이 곧 드롭다운 트리거다.
              const CATS = ["IT·디지털", "재테크·금융", "건강·헬스", "생활·살림", "쇼핑·리뷰", "여행·맛집", "뷰티·패션", "트렌드·이슈"];
              let opener = null;
              for (const c of CATS) {
                const hits = clickableWithText(norm(c));
                if (hits.length > 0) {
                  opener = hits[0];
                  break;
                }
              }
              // 이름으로 못 찾으면 '카테고리' 라벨 옆 버튼을 시도
              if (!opener) {
                opener = layer.querySelector('[class*="category"] button, button[class*="category"], #category-btn');
              }
              if (opener) {
                fire(opener);
                await sleep(500);
                const after = clickableWithText(want);
                if (after.length > 0) {
                  fire(after[after.length - 1]);
                  await sleep(400);
                  picked = true;
                }
              }
            }

            if (!picked) {
              // ⚠️ 잘못된 카테고리로 발행하느니 멈춘다. 사용자가 직접 고르고 '발행'을 누르면 된다.
              return ["카테고리선택실패", category];
            }
            done.push(`카테고리(${category})`);
          }

          fire(finalBtn);
          done.push("발행");
          return done;
        },
        args: [message.category ?? ""],
      });
      const done = results.map((r) => r && r.result).find((x) => x);
      if (done && done[0] === "카테고리선택실패") {
        sendResponse({
          ok: false,
          done,
          needsManualCategory: true,
          error: `'${done[1]}' 카테고리를 자동 선택하지 못했습니다. 발행 레이어에서 카테고리를 직접 고르고 '발행'을 눌러주세요. (잘못된 카테고리로 발행되지 않도록 자동 발행을 멈췄습니다)`,
        });
        return;
      }
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
      // DETECT 는 프레임 경합이 나면 안 된다 — 에디터 없는 보조 iframe 이 null 로 먼저 응답하면
      // 정상 작성폼인데도 "작성폼 아님"이 된다. 전 프레임 결과를 모아 하나라도 감지되면 그걸 쓴다.
      if (message.payload?.type === "DETECT") {
        sendResponse(await detectAcrossFrames(tab.id));
        return;
      }
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
/**
 * 탭의 모든 프레임에서 감지를 실행해 결과를 취합한다.
 * chrome.tabs.sendMessage 는 '먼저 응답한' 프레임 하나만 쓰므로, 에디터가 없는 보조 iframe 이
 * null 로 이겨 "작성폼 아님"이 되는 경합이 있었다. executeScript 는 프레임별 결과를 전부 돌려준다.
 */
async function detectAcrossFrames(tabId) {
  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => (window.__goblogDetect ? window.__goblogDetect() : null),
    });
  } catch (_) {
    return { ok: false, platform: null, restricted: null };
  }
  // 콘텐츠 스크립트가 아직 없는 프레임이 있으면(확장 재로드 등) 주입 후 한 번 더
  if (!results.some((r) => r?.result)) {
    try {
      await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["content/adapter.js"] });
      results = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: () => (window.__goblogDetect ? window.__goblogDetect() : null),
      });
    } catch (_) {
      /* 주입 불가 도메인 — 감지 실패로 둔다 */
    }
  }
  const hits = results.map((r) => r?.result).filter(Boolean);
  const platform = hits.find((h) => h.platform)?.platform ?? null;
  const restricted = hits.find((h) => h.restricted)?.restricted ?? null;
  return { ok: true, platform, restricted };
}

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

// ── 제휴 실적 수집 (네이버 커넥트 · 쿠팡 파트너스) ──────────────────────────
//
// ⚠️ **확장 출신(chrome-extension://)으로 부르면 CORS에 막힌다.** 쿠키가 있어도 소용없다.
//    네이버 게이트웨이는 origin 이 brandconnect.naver.com 일 때만 응답한다.
//    → 그래서 **대시보드 탭 안에서(페이지 출신으로) 부른다.** 화면이 스스로 부르는 것과 똑같아진다.
//    (첫 구현은 이걸 몰라서 '수집 실패'만 떴다.)
//
// 두 곳 다 공개 API가 없다: 커넥트는 아예 없고, 쿠팡은 Open API 키 발급이 중지됐다.

const COUPANG_REPORT_URL = "https://partners.coupang.com/#affiliate/ws/report/trend/daily";

const AFFILIATE_TABS = {
  NAVER_CONNECT: {
    match: "https://brandconnect.naver.com/*",
    open: (id) => `https://brandconnect.naver.com/${id}/affiliate/sales-dashboard`,
  },
  COUPANG: {
    match: "https://partners.coupang.com/*",
    // 홈이 아니라 **일별 리포트 화면**을 연다 — 여기서만 일별 실적 요청이 나간다.
    open: () => COUPANG_REPORT_URL,
  },
};

/** 해당 사이트 탭을 찾는다. 없으면 백그라운드로 연다(로그인 세션이 필요하므로 반드시 실제 탭이어야 한다). */
async function ensureAffiliateTab(source, memberId) {
  const spec = AFFILIATE_TABS[source];
  const [found] = await chrome.tabs.query({ url: spec.match });
  if (found?.id) return { tabId: found.id, opened: false };

  const tab = await chrome.tabs.create({ url: spec.open(memberId), active: false });
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 20000);
    const listener = (id, info) => {
      if (id === tab.id && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 3000); // SPA가 데이터를 마저 불러올 시간
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
  return { tabId: tab.id, opened: true };
}

/** 커넥트 — 대시보드가 스스로 부르는 JSON을 **페이지 출신으로** 그대로 부른다 (화면을 긁지 않는다). */
async function scrapeConnect(tabId, memberId, days) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (spaceId, dayCount) => {
      const iso = (d) => d.toISOString().slice(0, 10);
      // 종료일을 **오늘**로 보내면 HTTP 400 이다 — 커넥트는 어제까지만 집계한다
      // (대시보드도 endDate 를 어제로 보낸다. 오늘을 넣으면 집계 안 된 날이라 거부한다.)
      const end = new Date(Date.now() - 86400000);
      const start = new Date(end.getTime() - (dayCount - 1) * 86400000);
      const gw = "https://gw-brandconnect.naver.com/affiliate/query/sales-performances";
      const headers = { accept: "application/json", "x-space-id": String(spaceId) };
      try {
        const [chartRes, sumRes] = await Promise.all([
          fetch(gw + "/summary/chart?startDate=" + iso(start) + "&endDate=" + iso(end) + "&chartPeriod=DAY", {
            headers,
            credentials: "include",
          }),
          fetch(gw + "/summary?startDate=" + iso(start) + "&endDate=" + iso(end), {
            headers,
            credentials: "include",
          }),
        ]);
        if (!chartRes.ok) {
          return { ok: false, error: "커넥트 HTTP " + chartRes.status + " — 네이버 로그인을 확인하세요." };
        }
        const chart = await chartRes.json();
        const summary = sumRes.ok ? await sumRes.json() : null;
        const rows = (chart?.chart ?? []).map((r) => ({
          date: r.startDate,
          clicks: r.accessCnt ?? 0,
          salesAmount: r.salesAmount ?? 0,
          orders: 0,
          commission: 0,
          raw: { periodSummary: summary },
        }));
        return { ok: rows.length > 0, rows, summary, error: rows.length ? null : "커넥트 실적이 0건입니다." };
      } catch (e) {
        return { ok: false, error: String(e?.message || e) };
      }
    },
    args: [String(memberId), days],
  });
  return res?.result ?? { ok: false, error: "커넥트 페이지에서 응답이 없습니다." };
}

/**
 * 쿠팡 — 리포트 화면이 **자기 API를 부르고 있다.** 그 주소를 performance 기록에서 찾아
 * **페이지 출신으로** 다시 불러 일별 실적을 얻는다.
 *
 * (쿠팡은 Open API 키 발급이 중지됐고, 자동화 브라우저는 403으로 막는다.
 *  하지만 로그인된 실제 크롬 안에서는 화면과 똑같이 부를 수 있다.)
 *
 * 못 찾으면 후보 주소를 그대로 돌려준다 — 추측으로 잘못된 숫자를 저장하느니
 * "못 찾았다"고 말하고 주소를 보여주는 편이 낫다.
 */
async function scrapeCoupang(tabId) {
  // 열려 있는 탭이 홈일 수 있다 → **일별 리포트 화면으로 보낸 뒤** 새로고침한다.
  // 새로고침을 해야 tap(content/coupang-tap.js, MAIN world, document_start)이 **첫 요청부터** 기록한다.
  // (해시 라우트만 바꾸면 SPA가 페이지를 새로 안 띄워서 tap이 안 걸린다 → update 후 reload)
  await chrome.tabs.update(tabId, { url: COUPANG_REPORT_URL });
  await new Promise((r) => setTimeout(r, 1500));
  await chrome.tabs.reload(tabId);
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 25000);
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 6000); // 차트가 데이터를 불러올 시간
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });

  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    // async — 아래에서 날짜 범위로 직접 조회한다(await 필요)
    func: async () => {
      const calls = window.__goblogTap || [];
      const pickDate = (row) => {
        const raw = String(row.date ?? row.reportDate ?? row.statDate ?? row.day ?? row.dt ?? row.baseDate ?? "");
        const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/); // 20260713 형태도 받는다
        if (compact) return compact[1] + "-" + compact[2] + "-" + compact[3];
        const dashed = raw.match(/^\d{4}-\d{2}-\d{2}/);
        return dashed ? dashed[0] : null;
      };

      // 쿠팡 필드명 — clickCount / orderCount / gmv / commission
      const toRow = (item, date) => ({
        date,
        clicks: Number(item.clickCount ?? item.click ?? item.clicks ?? 0) || 0,
        orders: Number(item.orderCount ?? item.order ?? item.orders ?? 0) || 0,
        salesAmount: Number(item.gmv ?? item.salesAmount ?? item.amount ?? 0) || 0,
        commission: Number(item.commission ?? item.revenue ?? item.earning ?? 0) || 0,
      });

      // 기록된 응답 중 **일별 실적**을 찾는다. 배열일 수도, **하루치 객체**일 수도 있다.
      // (실측: POST /api/v1/report/daily → {"data":{"key":"2026-07-13","clickCount":3,...}} — 배열이 아니다)
      const findRows = (value) => {
        if (!value || typeof value !== "object") return null;

        // 하루치 객체: key 가 날짜이고 clickCount 가 있다
        if (!Array.isArray(value) && "clickCount" in value) {
          const date = pickDate(value) ?? (String(value.key ?? "").match(/^\d{4}-\d{2}-\d{2}$/) ? String(value.key) : null);
          if (date) return [toRow(value, date)];
        }

        if (Array.isArray(value)) {
          const rows = [];
          for (const item of value) {
            if (!item || typeof item !== "object") continue;
            const date =
              pickDate(item) ?? (String(item.key ?? "").match(/^\d{4}-\d{2}-\d{2}$/) ? String(item.key) : null);
            const hasMetric =
              "click" in item || "clicks" in item || "clickCount" in item || "commission" in item || "revenue" in item;
            if (!date || !hasMetric) continue;
            rows.push(toRow(item, date));
          }
          return rows.length > 0 ? rows : null;
        }
        for (const key of Object.keys(value)) {
          const found = findRows(value[key]); // data.rows.list … 어디에 있든 찾는다
          if (found) return found;
        }
        return null;
      };

      for (const call of calls) {
        let body;
        try {
          body = JSON.parse(call.body);
        } catch (_) {
          continue;
        }
        const rows = findRows(body);
        if (rows) {
          return {
            ok: true,
            rows: rows.map((r) => ({ ...r, raw: { from: call.url } })),
            endpoint: call.url,
            // 성공해도 기록을 남긴다 — 지금은 하루치만 온다. 30일치를 받으려면
            // 이 화면이 날짜 범위를 **어떻게 넘기는지**(요청 본문) 봐야 한다.
            calls: calls.map((c) => c.method + " " + c.url + (c.req ? "  [요청] " + c.req : "")),
          };
        }
      }

      // ── 30일치 직접 조회 ────────────────────────────────────────────
      // tap 으로 잡힌 report/daily 는 화면의 "어제 요약" 카드다(하루치 객체).
      // 차트는 **날짜 범위**로 조회한다(화면 표기: 2026.07.01-2026.07.13).
      // 그래서 범위를 넣어 직접 물어본다.
      //
      // ⚠️ 요청 모양을 **추측**하지만, 응답이 날짜+클릭을 가진 일별 데이터일 때만 저장한다.
      //    모양이 안 맞으면 버린다 — 틀린 숫자를 실적으로 넣느니 빈칸이 낫다.
      const pad = (n) => String(n).padStart(2, "0");
      const ymd = (d, sep) => d.getFullYear() + sep + pad(d.getMonth() + 1) + sep + pad(d.getDate());
      const endDay = new Date(Date.now() - 86400000); // 전일자 데이터가 오후 4시 전후 반영 → 어제까지
      const startDay = new Date(endDay.getTime() - 29 * 86400000);

      const paths = ["/api/v1/report/daily", "/api/v1/report/trend/daily", "/api/v1/report/trend"];
      const bodies = [
        { startDate: ymd(startDay, "-"), endDate: ymd(endDay, "-") },
        { startDate: ymd(startDay, ""), endDate: ymd(endDay, "") },
        { startDate: ymd(startDay, "-"), endDate: ymd(endDay, "-"), subIds: [] },
      ];

      const collected = new Map();
      for (const path of paths) {
        for (const payload of bodies) {
          try {
            const r = await fetch(path, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json", accept: "application/json" },
              body: JSON.stringify(payload),
            });
            if (!r.ok) continue;
            const json = await r.json();
            const rows = findRows(json);
            if (!rows) continue;
            for (const row of rows) collected.set(row.date, { ...row, raw: { from: path } });
          } catch (_) {
            // 이 모양은 아니었다 — 다음 후보
          }
        }
        if (collected.size > 1) break; // 여러 날이 왔다 = 범위 조회가 먹혔다
      }

      if (collected.size > 0) {
        return {
          ok: true,
          rows: [...collected.values()],
          endpoint: "range-probe",
          calls: calls.map((c) => c.method + " " + c.url + (c.req ? "  [요청] " + c.req : "")),
        };
      }

      // 못 찾았다 — 기록된 것들을 그대로 보고한다 (추측으로 파싱하지 않는다)
      return {
        ok: false,
        error:
          calls.length === 0
            ? "쿠팡 페이지 요청을 잡지 못했습니다. 확장을 새로고침한 뒤 다시 시도하세요."
            : "쿠팡 응답에서 일별 실적을 못 찾았습니다. 기록을 서버에 보고했습니다.",
        endpoints: calls.map(
          (c) => c.method + " " + c.url + (c.req ? "  [요청] " + c.req : "") + "  =>  " + c.body.slice(0, 700),
        ),
      };
    },
  });
  return res?.result ?? { ok: false, error: "쿠팡 페이지에서 응답이 없습니다." };
}

/** 커넥트 회원번호 — **서버 설정이 정답이다.** 관리자에 넣은 값을 확장에 또 넣게 하지 않는다. */
async function connectMemberId(s) {
  try {
    const res = await fetch(s.apiBase + "/api/extension/config", {
      headers: { "X-Extension-Token": s.token },
    });
    if (res.ok) {
      const cfg = await res.json();
      if (cfg.connectMemberId) return cfg.connectMemberId;
    }
  } catch (_) {
    // 서버를 못 읽으면 확장에 저장된 값으로 폴백
  }
  return (s.connectMemberId || "").replace(/\D/g, "");
}

async function collectAffiliate(source, days = 30) {
  const s = await chrome.storage.local.get(["apiBase", "token", "connectMemberId"]);
  if (!s.apiBase || !s.token) return { source, ok: false, error: "서버 연결 설정이 필요합니다." };

  const memberId = source === "NAVER_CONNECT" ? await connectMemberId(s) : "";
  if (source === "NAVER_CONNECT" && !memberId) {
    return { source, ok: false, error: "관리자 설정 → 네이버 → 브랜드커넥트 회원 ID 를 입력하세요." };
  }

  let tab;
  try {
    tab = await ensureAffiliateTab(source, memberId);
  } catch (e) {
    return { source, ok: false, error: "탭을 열지 못했습니다: " + String(e?.message || e) };
  }

  let result;
  try {
    result =
      source === "NAVER_CONNECT"
        ? await scrapeConnect(tab.tabId, memberId, days)
        : await scrapeCoupang(tab.tabId);
  } catch (e) {
    result = { ok: false, error: String(e?.message || e) };
  } finally {
    // 우리가 연 탭만 닫는다 (사용자가 보던 탭은 건드리지 않는다)
    if (tab.opened) chrome.tabs.remove(tab.tabId).catch(() => {});
  }

  // 성공/실패와 무관하게 기록을 서버에 남긴다 — 사용자에게 콘솔을 읽어 오라고 할 순 없다.
  const trace = result.endpoints ?? result.calls;
  if (trace?.length) {
    fetch(s.apiBase + "/api/extension/affiliate/debug", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Extension-Token": s.token },
      body: JSON.stringify({ source, endpoints: trace }),
    }).catch(() => {});
  }

  if (!result.ok) {
    return { source, ok: false, error: result.error, endpoints: result.endpoints };
  }

  const res = await fetch(s.apiBase + "/api/extension/affiliate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Extension-Token": s.token },
    body: JSON.stringify({ source, rows: result.rows }),
  });
  if (!res.ok) return { source, ok: false, error: "서버 저장 실패 (HTTP " + res.status + ")" };
  const saved = await res.json();
  return { source, ok: true, saved: saved.saved, summary: result.summary ?? null };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "COLLECT_AFFILIATE") return false;
  (async () => {
    const days = message.days || 30;
    const results = [];
    // 한쪽이 실패해도 다른 쪽은 저장되게 따로 돌린다
    for (const source of ["NAVER_CONNECT", "COUPANG"]) {
      try {
        results.push(await collectAffiliate(source, days));
      } catch (e) {
        results.push({ source, ok: false, error: String(e?.message || e) });
      }
    }
    sendResponse({ ok: results.some((r) => r.ok), results });
  })();
  return true; // 비동기 응답
});

// 12시간마다 자동 수집 — 실적은 소급 정정되므로(주문 취소·정산 확정) 최근 30일을 통째로 다시 받아 덮어쓴다.
chrome.alarms.create("affiliate-daily", { periodInMinutes: 720 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "affiliate-daily") return;
  for (const source of ["NAVER_CONNECT", "COUPANG"]) {
    const result = await collectAffiliate(source, 30).catch((e) => ({ ok: false, error: String(e) }));
    if (!result.ok) console.warn("[goBlog] " + source + " 실적 자동 수집 실패:", result.error);
  }
});
