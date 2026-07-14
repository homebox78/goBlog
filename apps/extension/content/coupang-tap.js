// 쿠팡 파트너스 — 페이지가 부르는 요청을 **처음부터** 가로채 기록한다 (MAIN world).
//
// 왜 필요한가: `performance` 기록으로는 리포트 요청이 안 잡혔다.
// (거기서 잡힌 `/api/v1/dashboard` 는 카테고리 목록이었다 — 실적이 아니다.)
// 쿠팡은 Open API 키 발급이 중지됐고 자동화 브라우저는 403으로 막으니,
// **로그인된 이 브라우저에서 화면이 실제로 뭘 부르는지** 직접 보는 수밖에 없다.
//
// 추측으로 주소를 찍지 않는다 — 틀린 숫자를 실적으로 저장하면 없느니만 못하다.
(() => {
  if (window.__goblogTap) return;
  window.__goblogTap = [];

  const record = (url, method, body) => {
    try {
      if (!/partners\.coupang\.com|coupang\.com\/api/i.test(url)) return;
      if (/\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ico)(\?|$)/i.test(url)) return;
      // 응답이 커도 앞부분만 — 모양만 알면 된다
      window.__goblogTap.push({ url, method, body: String(body ?? "").slice(0, 1200) });
      if (window.__goblogTap.length > 60) window.__goblogTap.shift();
    } catch (_) {
      /* 기록 실패가 페이지를 깨선 안 된다 */
    }
  };

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await originalFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      const method = args[1]?.method || "GET";
      res
        .clone()
        .text()
        .then((text) => record(url, method, text))
        .catch(() => {});
    } catch (_) {
      /* 무시 */
    }
    return res;
  };

  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__goblogUrl = url;
    this.__goblogMethod = method;
    return open.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", () => {
      record(this.__goblogUrl, this.__goblogMethod, this.responseText);
    });
    return send.apply(this, args);
  };
})();
