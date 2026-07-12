// goBlog 웹앱(hom2box.com/goBlog) ↔ 확장 다리.
// 네이버는 서버 크롤링을 차단(429)하므로, 웹앱이 스마트스토어 상품 정보를 추출할 때
// 이 다리를 통해 사용자 브라우저(정상 IP)로 페이지를 대신 가져온다.
//
// 웹앱 → window.postMessage({ type:"GOBLOG_NAVER_FETCH", id, url })
// 다리 → background fetch → window.postMessage({ type:"GOBLOG_NAVER_FETCH_RESULT", id, ok, html|error })

window.addEventListener("message", (event) => {
  if (event.source !== window) return; // 같은 페이지에서 온 요청만
  const data = event.data;
  if (!data || data.type !== "GOBLOG_NAVER_FETCH" || typeof data.url !== "string") return;

  chrome.runtime.sendMessage({ type: "NAVER_FETCH", url: data.url }, (res) => {
    window.postMessage(
      {
        type: "GOBLOG_NAVER_FETCH_RESULT",
        id: data.id,
        ok: !!res?.ok,
        status: res?.status ?? 0,
        html: res?.html ?? null,
        error: res?.error ?? (chrome.runtime.lastError ? chrome.runtime.lastError.message : null),
      },
      "*",
    );
  });
});

// 웹앱이 '확장 있음'을 감지할 수 있게 마커를 심는다
document.documentElement.setAttribute("data-goblog-ext", chrome.runtime.getManifest().version);
