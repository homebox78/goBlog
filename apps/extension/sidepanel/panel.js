const $ = (selector) => document.querySelector(selector);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let config = { apiBase: "", token: "" };
let currentArticle = null;
let currentPlatform = null;
let currentRestricted = null; // 쇼핑 커넥트 활동 제한 채널명(있으면 발행 차단)

init();

async function init() {
  const stored = await chrome.storage.local.get(["apiBase", "token", "tistoryBlog"]);
  config.apiBase = stored.apiBase || "https://hom2box.com/goBlog";
  config.token = stored.token || "";
  config.tistoryBlog = stored.tistoryBlog || "hom2box";
  $("#apiBase").value = config.apiBase;
  $("#token").value = config.token;
  $("#tistoryBlog").value = config.tistoryBlog;

  $("#version").textContent = "v" + chrome.runtime.getManifest().version;

  // background가 발행 성공을 감지해 자동 기록하면 목록을 새로고침한다
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "PUBLISHED") {
      const li = document.createElement("li");
      li.textContent = "발행 완료가 자동 기록되었습니다.";
      $("#notes").appendChild(li);
      loadArticles();
    }
  });

  $("#saveSetup").addEventListener("click", saveSetup);
  $("#openSetup").addEventListener("click", () => $("#setup").classList.toggle("hidden"));
  $("#refresh").addEventListener("click", loadArticles);
  // 플랫폼별 글쓰기 바로가기 — 네이버·티스토리는 자동 입력, 인스타는 캐러셀 캡션 복사 지원
  $("#openNaverWrite").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://blog.naver.com/GoBlogWrite.naver" }); // 내 블로그 글쓰기로 리다이렉트
  });
  $("#openTistoryWrite").addEventListener("click", () => {
    chrome.tabs.create({ url: `https://${config.tistoryBlog || "hom2box"}.tistory.com/manage/newpost` });
  });
  $("#openInstagram").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.instagram.com/" });
  });
  $("#applyBtn").addEventListener("click", applyToForm);
  $("#copyBtn").addEventListener("click", copyBody);
  $("#doneBtn").addEventListener("click", markPublished);
  $("#igCopyBtn").addEventListener("click", async () => {
    await copyIgCaption();
    const li = document.createElement("li");
    li.textContent = "인스타 캡션+해시태그를 복사했습니다. 문구칸에 Ctrl+V 하세요.";
    $("#notes").appendChild(li);
  });

  // 사이드패널은 계속 떠 있으므로 탭을 바꾸면 플랫폼을 다시 감지해야 한다.
  // (안 하면 티스토리 탭에서 열어둔 상태가 네이버 탭으로 옮겨도 "티스토리"로 남는다)
  const resync = async () => {
    const before = currentPlatform;
    await detectPlatform();
    if (currentPlatform !== before && config.token) loadArticles();
  };
  chrome.tabs.onActivated.addListener(resync);
  chrome.tabs.onUpdated.addListener((_id, info, tab) => {
    if (info.status === "complete" && tab.active) resync();
  });

  await detectPlatform();
  if (!config.token) {
    $("#setup").classList.remove("hidden");
    $("#list").innerHTML = '<p class="muted">설정에서 서버 주소와 토큰을 입력해주세요.</p>';
  } else {
    loadArticles();
  }
}

async function saveSetup() {
  config.apiBase = $("#apiBase").value.trim().replace(/\/+$/, "");
  config.token = $("#token").value.trim();
  config.tistoryBlog = $("#tistoryBlog").value.trim().replace(/\.tistory\.com.*$/i, "") || "hom2box";
  await chrome.storage.local.set(config);
  $("#setup").classList.add("hidden");
  loadArticles();
}

async function api(path) {
  const res = await fetch(config.apiBase + path, {
    headers: { "X-Extension-Token": config.token },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function detectPlatform() {
  const response = await chrome.runtime.sendMessage({ relay: true, payload: { type: "DETECT" } });
  currentPlatform = response?.platform ?? null;
  currentRestricted = response?.restricted ?? null;
  const chip = $("#platform");
  if (currentPlatform === "NAVER_BLOG") {
    chip.textContent = "네이버 블로그";
    chip.classList.add("on");
  } else if (currentPlatform === "TISTORY") {
    chip.textContent = "티스토리";
    chip.classList.add("on");
  } else if (currentPlatform === "INSTAGRAM") {
    chip.textContent = "인스타그램";
    chip.classList.add("on");
  } else {
    chip.textContent = "작성폼 아님";
    chip.classList.remove("on");
  }
  // 플랫폼이 확정된 뒤 인스타 카드 표시 여부 갱신 (인스타 탭에서만)
  if (currentArticle) renderInstagram(currentArticle);

  // 쇼핑 커넥트 활동 제한 채널이면 붉은 경고 + 발행 차단
  const warn = $("#restrictedWarn");
  if (warn) {
    if (currentRestricted) {
      warn.textContent = `⚠ 활동 제한 채널(${currentRestricted}) — 쇼핑 커넥트 링크 게시 금지(실적 미인정·이용 제재). 여기서는 발행하지 마세요.`;
      warn.classList.remove("hidden");
    } else {
      warn.classList.add("hidden");
    }
  }
}

async function loadCategories() {
  try {
    const { categories } = await api("/api/extension/categories");
    if (categories?.length) {
      $("#catList").textContent = categories.join(" · ");
    }
  } catch {
    // 카테고리 안내는 실패해도 무시
  }
}

async function loadArticles() {
  loadCategories();
  $("#list").innerHTML = '<p class="muted">불러오는 중...</p>';
  try {
    // 플랫폼별로 아직 발행 안 한 글만 받는다 — 티스토리에 올린 글이 네이버 목록에서 사라지면 안 된다.
    const q = currentPlatform === "NAVER_BLOG" || currentPlatform === "TISTORY" ? `?platform=${currentPlatform}` : "";
    const { articles } = await api("/api/extension/articles" + q);
    if (articles.length === 0) {
      const where = currentPlatform === "TISTORY" ? "티스토리" : currentPlatform === "NAVER_BLOG" ? "네이버" : "";
      $("#list").innerHTML = `<p class="muted">${where ? where + "에 " : ""}발행할 글이 없습니다.</p>`;
      return;
    }
    $("#list").innerHTML = "";
    for (const article of articles) {
      const row = document.createElement("div");
      row.className = "item";
      row.dataset.articleId = article.id;
      if (currentArticle && currentArticle.id === article.id) row.classList.add("selected");
      const main = document.createElement("div");
      main.className = "item-main";
      main.innerHTML = `<p></p><small><span class="cat"></span> ${article.qualityScore ?? "—"}점 · ${article.language} · ${article.status}</small>`;
      main.querySelector("p").textContent = article.title;
      main.querySelector(".cat").textContent = article.category ? `📁 ${article.category}` : "";
      main.addEventListener("click", () => {
        // 선택 표시 지속 (호버가 아니라 선택된 글에 표시)
        document.querySelectorAll("#list .item.selected").forEach((el) => el.classList.remove("selected"));
        row.classList.add("selected");
        openArticle(article.id);
      });
      const done = document.createElement("button");
      done.className = "done-mini ghost";
      done.textContent = "발행완료";
      done.title = "이 글을 발행 대기 목록에서 숨깁니다";
      done.addEventListener("click", (e) => {
        e.stopPropagation();
        markDone(article.id);
      });
      row.appendChild(main);
      row.appendChild(done);
      $("#list").appendChild(row);
    }
  } catch (error) {
    $("#list").innerHTML = `<p class="muted">오류: ${error.message}</p>`;
  }
}

async function openArticle(id) {
  const { article } = await api(`/api/extension/articles/${id}`);
  currentArticle = article;
  $("#detailTitle").textContent = article.title;
  $("#detailCategory").textContent = article.category ? `📁 ${article.category} 카테고리에 발행` : "";
  $("#detail").classList.remove("hidden");
  $("#actionBar").classList.remove("hidden");
  $("#notes").innerHTML = "";
  detectPlatform(); // 플랫폼 감지 후 인스타 카드 표시 여부까지 renderInstagram이 갱신
}

// 인스타그램 캐러셀 카드 렌더 — 인스타그램 탭에서만, 캐러셀 데이터가 있을 때 표시
function renderInstagram(article) {
  const ig = article?.instagram;
  const section = $("#igSection");
  // 인스타그램 작성 화면이 아니면 숨긴다 (티스토리·네이버에서 뜨던 문제)
  if (currentPlatform !== "INSTAGRAM" || !ig || (!ig.slides?.length && !ig.caption)) {
    section.classList.add("hidden");
    return;
  }
  const images = article.images || [];
  const slidesEl = $("#igSlides");
  slidesEl.innerHTML = "";
  (ig.slides || []).forEach((s, i) => {
    const img = images[i];
    const card = document.createElement("div");
    card.className = "ig-slide";
    card.innerHTML =
      (img?.url ? `<img src="${img.url}" alt="" />` : `<div class="ig-noimg">이미지 없음</div>`) +
      `<div class="ig-slide-body"><b></b><span></span>` +
      (img?.url ? `<a href="${img.url}" download target="_blank" class="ig-dl">이미지 저장</a>` : "") +
      `</div>`;
    card.querySelector("b").textContent = `${i + 1}. ${s.title || ""}`;
    card.querySelector("span").textContent = s.summary || "";
    slidesEl.appendChild(card);
  });
  $("#igCaption").value = igFullCaption(ig);
  $("#igHashtags").textContent = (ig.hashtags || []).join(" ");
  section.classList.remove("hidden");
}

// 캡션 + 해시태그 합본 (인스타 붙여넣기용)
function igFullCaption(ig) {
  const tags = (ig.hashtags || []).join(" ");
  return [ig.caption || "", tags].filter(Boolean).join("\n\n");
}

function plainText(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.innerText;
}

function showNotes(items) {
  const notes = $("#notes");
  notes.innerHTML = "";
  for (const note of items) {
    const li = document.createElement("li");
    li.textContent = note;
    notes.appendChild(li);
  }
}

function naverTitle() {
  return currentPlatform === "NAVER_BLOG" && currentArticle.titleForNaver
    ? currentArticle.titleForNaver
    : currentArticle.title;
}

// 네이버·티스토리 SEO: 본문 끝에 해시태그 라인 추가
function buildBodyHtml() {
  let html = currentArticle.contentHtml || "";
  if (currentArticle.hashtags) {
    html += `<p style="margin-top:28px;color:#5a7edc;font-size:14px;">${currentArticle.hashtags}</p>`;
  }
  return html;
}

async function applyToForm() {
  if (!currentArticle) return;
  await detectPlatform();

  // 활동 제한 채널이면 커넥트 링크 게시 금지 → 삽입 차단
  if (currentRestricted) {
    showNotes([
      `⛔ '${currentRestricted}'는 네이버 쇼핑 커넥트 활동 제한 채널입니다.`,
      "이 채널에 커넥트 링크를 게시하면 실적이 인정되지 않고 서비스 이용 제재 대상이 됩니다.",
      "본인 소유의 일반 블로그 등 허용 채널에서 발행해주세요.",
    ]);
    return;
  }

  // 발행 완료를 백엔드가 자동 기록하도록, '어떤 글을 어느 플랫폼에 올리는 중'인지 저장해둔다.
  // background가 발행 성공(게시글 URL 이동)을 감지하면 이 정보로 자동 기록한다.
  if (currentPlatform === "NAVER_BLOG" || currentPlatform === "TISTORY") {
    await chrome.storage.local.set({
      pendingPublish: { articleId: currentArticle.id, platform: currentPlatform },
    });
  }

  // 인스타그램: 이미지는 파일 업로더라 자동 삽입 불가 → 캡션+해시태그를 클립보드에 담고 안내
  if (currentPlatform === "INSTAGRAM") {
    await copyIgCaption();
    showNotes([
      "인스타그램 캡션(요약+해시태그)을 클립보드에 복사했습니다.",
      "① 캐러셀 이미지는 아래 '인스타그램 캐러셀' 카드에서 3장을 저장해 순서대로 올리세요.",
      "② 문구칸을 클릭하고 Ctrl+V로 캡션을 붙여넣으세요.",
      "③ 슬라이드 제목은 이미지 위 텍스트로 활용하세요.",
    ]);
    return;
  }

  const title = naverTitle();
  const html = buildBodyHtml();

  // 네이버 스마트에디터: debugger(CDP) 신뢰 이벤트로 완전 자동 입력. 실패하면 기존 2단계 수동 폴백.
  if (currentPlatform === "NAVER_BLOG") {
    try {
      showNotes(["⏳ 자동 입력 중... (탭 상단 '디버깅' 표시줄은 정상이며 곧 사라집니다)"]);
      // 본문 HTML을 미리 클립보드에 담는다 — 패널이 포커스를 잃기 전에 해야 함
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plainText(html)], { type: "text/plain" }),
        }),
      ]);
      const rects = await chrome.runtime.sendMessage({ relay: true, payload: { type: "GET_RECTS" } });
      if (!rects?.ok) throw new Error(rects?.error || "작성폼 좌표를 찾지 못했습니다");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("활성 탭 없음");
      const res = await chrome.runtime.sendMessage({ type: "NAVER_AUTO", tabId: tab.id, title, rects });
      if (!res?.ok) throw new Error(res?.error || "자동 입력 실패");
      showNotes(["✅ 제목·본문 자동 입력 완료!", "⏳ 발행 진행 중..."]);

      // 발행 → 발행 레이어 → 최종 발행 (완전 자동). 카테고리는 블로그 기본값 사용.
      await sleep(500); // 에디터 반영 대기
      const pub = await chrome.runtime.sendMessage({ type: "NAVER_PUBLISH", tabId: tab.id });
      if (pub?.ok) {
        showNotes(["✅ 네이버 발행 완료! ⏳ 발행완료 기록 중..."]);
        const url = await recordPublished(tab.id, currentArticle.id, "NAVER_BLOG", title);
        showNotes([url ? "✅ 네이버 발행 완료 (목록에 링크 기록됨)" : "✅ 네이버 발행 완료 (URL 미확인 — 기록만)"]);
        loadArticles();
      } else {
        showNotes([
          "✅ 제목·본문 자동 입력 완료!",
          `⚠ 발행 자동화 실패(${pub?.error || "?"}) — 우측 상단 '발행' → '발행'을 눌러 마무리하세요.`,
        ]);
      }
    } catch (error) {
      // 수동 폴백 — 기존 2단계 클립보드 방식
      await navigator.clipboard.writeText(title);
      showNotes([
        `⚠ 자동 입력 실패(${error.message}) — 수동 모드로 전환합니다.`,
        "제목을 클립보드에 복사했습니다.",
        "① 네이버 제목칸을 클릭하고 Ctrl+V로 붙여넣으세요.",
        "② 아래 '본문 복사'를 누른 뒤 본문칸을 클릭하고 Ctrl+V로 붙여넣으세요.",
      ]);
    }
    return;
  }

  // 티스토리: MAIN 월드에서 TinyMCE API 직접 호출 — 제목·본문(모델 동기화)·태그까지 완전 자동
  if (currentPlatform === "TISTORY") {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("활성 탭 없음");
      const res = await chrome.runtime.sendMessage({
        type: "TISTORY_AUTO",
        tabId: tab.id,
        title,
        html,
        tags: currentArticle.tags || [],
        category: currentArticle.category || "",
      });
      if (!res?.ok) throw new Error(res?.error || "자동 입력 실패");
      showNotes([`✅ 자동 입력 완료: ${res.done.join(" · ")}`, "⏳ 홈주제 선택 + 공개 발행 진행 중..."]);

      // 발행 완료 자동 기록용 (background가 발행 게시글 URL 이동을 감지)
      await chrome.storage.local.set({ pendingPublish: { articleId: currentArticle.id, platform: "TISTORY" } });

      // 완료 → 홈주제 자동 선택 → 공개 발행 (원클릭 완전 자동)
      const pub = await chrome.runtime.sendMessage({
        type: "TISTORY_PUBLISH",
        tabId: tab.id,
        category: currentArticle.category || "",
      });
      if (pub?.ok && pub.done?.includes("공개 발행")) {
        showNotes([`✅ 티스토리 발행 완료: ${pub.done.join(" · ")} ⏳ 기록 중...`]);
        const url = await recordPublished(tab.id, currentArticle.id, "TISTORY", title);
        showNotes([url ? "✅ 티스토리 발행 완료 (목록에 링크 기록됨)" : "✅ 티스토리 발행 완료 (기록됨)"]);
        loadArticles();
      } else {
        showNotes([
          `✅ 자동 입력 완료: ${res.done.join(" · ")}`,
          `⚠ 발행 자동화 일부 실패(${pub?.error || pub?.done?.join(",") || "?"}).`,
          "우측 상단 '완료' → 홈주제 선택 → '공개 발행'을 눌러 마무리하세요.",
        ]);
      }
    } catch (error) {
      // 폴백 — 기존 콘텐츠 스크립트 APPLY(iframe DOM 주입)
      const response = await chrome.runtime.sendMessage({
        relay: true,
        payload: { type: "APPLY", title, html, plainText: plainText(html), tags: currentArticle.tags || [] },
      });
      showNotes(
        response?.ok
          ? [`⚠ 자동 입력 폴백(${error.message}):`, ...response.notes]
          : [response?.error || "적용 실패"],
      );
    }
    return;
  }

  // 기타 플랫폼 — 콘텐츠 스크립트 APPLY
  const response = await chrome.runtime.sendMessage({
    relay: true,
    payload: {
      type: "APPLY",
      title,
      html,
      plainText: plainText(html),
      tags: currentArticle.tags || [],
    },
  });
  showNotes(response?.ok ? response.notes : [response?.error || "적용 실패"]);
}

// 발행 완료를 패널에서 직접 기록 — background 서비스워커가 잠들어 URL 감지를 놓치는 문제 방지.
// 발행 후 탭이 게시글 URL로 이동할 때까지 폴링해서 URL을 잡고 /published에 기록한다.
async function recordPublished(tabId, articleId, platform, title) {
  const re =
    platform === "NAVER_BLOG"
      ? /^https:\/\/blog\.naver\.com\/[^/?#]+\/(\d{6,})/
      : /^https:\/\/[^/]+\.tistory\.com\/(\d+)/;
  let url = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const t = await chrome.tabs.get(tabId);
      if (t?.url && re.test(t.url)) {
        url = t.url;
        break;
      }
    } catch {
      /* 탭 접근 실패 무시 */
    }
  }

  // 티스토리는 발행 후 게시글이 아니라 관리 목록(/manage/posts)으로 이동한다 → 탭 URL 폴링으론 못 잡는다.
  // 블로그 RSS 에서 방금 올린 글(제목 일치, 없으면 최신 글)의 주소를 가져온다.
  if (!url && platform === "TISTORY") {
    url = await findTistoryUrlByTitle(title);
  }

  try {
    await fetch(`${config.apiBase}/api/extension/articles/${articleId}/published`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Extension-Token": config.token },
      body: JSON.stringify({ platform, url, hide: true }),
    });
    await chrome.storage.local.remove("pendingPublish"); // background 중복 기록 방지
  } catch {
    /* 기록 실패 시 background 폴백에 맡김 */
  }
  return url;
}

/** 티스토리 RSS 에서 제목이 일치하는 글의 주소를 찾는다 (발행 반영까지 몇 초 걸려 재시도). */
async function findTistoryUrlByTitle(title) {
  const blog = config.tistoryBlog || "hom2box";
  const norm = (s) => String(s || "").replace(/\s+/g, "").toLowerCase();
  const want = norm(title);

  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(`https://${blog}.tistory.com/rss`, { cache: "no-store" });
      if (res.ok) {
        const xml = await res.text();
        const doc = new DOMParser().parseFromString(xml, "text/xml");
        const items = [...doc.querySelectorAll("item")].map((it) => ({
          title: it.querySelector("title")?.textContent ?? "",
          link: it.querySelector("link")?.textContent ?? "",
        }));
        const hit = want ? items.find((it) => norm(it.title) === want) : null;
        const link = (hit ?? items[0])?.link;
        if (link && /\.tistory\.com\/\d+/.test(link)) return link;
      }
    } catch {
      /* RSS 실패 무시 — 다음 시도 */
    }
    await sleep(2000); // 발행 직후엔 RSS 반영이 늦다
  }
  return null;
}

async function copyIgCaption() {
  if (!currentArticle?.instagram) return;
  await navigator.clipboard.writeText(igFullCaption(currentArticle.instagram));
}

async function copyBody() {
  if (!currentArticle) return;
  const html = buildBodyHtml();
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([plainText(html)], { type: "text/plain" }),
    }),
  ]);
  const li = document.createElement("li");
  li.textContent = "본문을 클립보드에 복사했습니다 — 본문칸을 클릭하고 Ctrl+V로 붙여넣으세요.";
  $("#notes").appendChild(li);
}

// 발행완료 버튼 — 이 글을 발행 대기 목록에서 숨긴다(hide=true). 반자동 운영의 수동 체크.
async function markDone(id) {
  await fetch(`${config.apiBase}/api/extension/articles/${id}/published`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Extension-Token": config.token },
    body: JSON.stringify({ platform: currentPlatform ?? "NAVER_BLOG", hide: true }),
  });
  loadArticles();
}

// 발행 완료는 background가 발행 게시글 URL 이동을 감지해 자동 기록한다.
// 이 함수는 자동 감지가 실패했을 때를 위한 수동 폴백(URL 입력 없이 현재 글을 발행 완료 처리).
async function markPublished() {
  if (!currentArticle) return;
  await fetch(`${config.apiBase}/api/extension/articles/${currentArticle.id}/published`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Extension-Token": config.token },
    body: JSON.stringify({ platform: currentPlatform ?? "NAVER_BLOG", url: null }),
  });
  const li = document.createElement("li");
  li.textContent = "발행 완료로 기록했습니다.";
  $("#notes").appendChild(li);
  loadArticles();
}
