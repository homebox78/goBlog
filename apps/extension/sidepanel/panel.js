const $ = (selector) => document.querySelector(selector);

let config = { apiBase: "", token: "" };
let currentArticle = null;
let currentPlatform = null;

init();

async function init() {
  const stored = await chrome.storage.local.get(["apiBase", "token"]);
  config.apiBase = stored.apiBase || "https://hom2box.com/goBlog";
  config.token = stored.token || "";
  $("#apiBase").value = config.apiBase;
  $("#token").value = config.token;

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
  $("#applyBtn").addEventListener("click", applyToForm);
  $("#copyBtn").addEventListener("click", copyBody);
  $("#doneBtn").addEventListener("click", markPublished);

  detectPlatform();
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
  const chip = $("#platform");
  if (currentPlatform === "NAVER_BLOG") {
    chip.textContent = "네이버 블로그";
    chip.classList.add("on");
  } else if (currentPlatform === "TISTORY") {
    chip.textContent = "티스토리";
    chip.classList.add("on");
  } else {
    chip.textContent = "작성폼 아님";
    chip.classList.remove("on");
  }
}

async function loadCategories() {
  try {
    const { categories } = await api("/api/extension/categories");
    if (categories?.length) {
      $("#catList").textContent = `네이버에 만들 카테고리: ${categories.join(" · ")}`;
    }
  } catch {
    // 카테고리 안내는 실패해도 무시
  }
}

async function loadArticles() {
  loadCategories();
  $("#list").innerHTML = '<p class="muted">불러오는 중...</p>';
  try {
    const { articles } = await api("/api/extension/articles");
    if (articles.length === 0) {
      $("#list").innerHTML = '<p class="muted">발행 대기 글이 없습니다.</p>';
      return;
    }
    $("#list").innerHTML = "";
    for (const article of articles) {
      const row = document.createElement("div");
      row.className = "item";
      const main = document.createElement("div");
      main.className = "item-main";
      main.innerHTML = `<p></p><small><span class="cat"></span> ${article.qualityScore ?? "—"}점 · ${article.language} · ${article.status}</small>`;
      main.querySelector("p").textContent = article.title;
      main.querySelector(".cat").textContent = article.category ? `📁 ${article.category}` : "";
      main.addEventListener("click", () => openArticle(article.id));
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
  detectPlatform();
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

  // 발행 완료를 백엔드가 자동 기록하도록, '어떤 글을 어느 플랫폼에 올리는 중'인지 저장해둔다.
  // background가 발행 성공(게시글 URL 이동)을 감지하면 이 정보로 자동 기록한다.
  if (currentPlatform === "NAVER_BLOG" || currentPlatform === "TISTORY") {
    await chrome.storage.local.set({
      pendingPublish: { articleId: currentArticle.id, platform: currentPlatform },
    });
  }

  const title = naverTitle();
  const html = buildBodyHtml();

  // 스마트에디터 ONE은 내부 모델형 에디터라 DOM 직접 입력이 안 된다(제목/본문 문단이 contenteditable이 아님).
  // → 제목을 먼저 클립보드에 담고, 본문은 '본문 복사'로 이어서 붙여넣는 2단계 방식이 유일하게 안정적이다.
  if (currentPlatform === "NAVER_BLOG") {
    await navigator.clipboard.writeText(title);
    showNotes([
      "제목을 클립보드에 복사했습니다.",
      "① 네이버 제목칸을 클릭하고 Ctrl+V로 붙여넣으세요.",
      "② 아래 '본문 복사'를 누른 뒤 본문칸을 클릭하고 Ctrl+V로 붙여넣으세요.",
      "쇼핑커넥트 글은 대가성 문구가 제목 앞·본문 최상단에 있어야 합니다.",
    ]);
    return;
  }

  // 티스토리(TinyMCE)는 iframe 본문 DOM 직접 입력이 동작하므로 기존 APPLY 경로 유지
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
