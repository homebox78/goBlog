import { marked } from "marked";

/**
 * 마크다운 → HTML 변환 시 인라인 타이포그래피를 주입한다.
 * 블로그 스킨·에디터 기본 폰트에 좌우되지 않도록 모든 스타일을 인라인으로 넣는다.
 * 40대 이상 가독성 기준: 본문 18px, 넉넉한 행간, 제목·본문 크기 대비, 핵심 볼드.
 */
export async function renderContentHtml(markdown: string): Promise<string> {
  let html = await marked.parse(markdown);

  html = html
    // 본문 이미지는 항상 글 가로 폭 100%로 채운다 (기존 발행 글의 max-width 버전도 교체)
    .replace(
      /style="max-width:100%;border-radius:10px;"/g,
      'style="width:100%;height:auto;display:block;border-radius:10px;"',
    )
    .replace(/<h1>/g, '<h1 style="font-size:30px;font-weight:800;line-height:1.35;margin:36px 0 18px;color:#111;">')
    .replace(
      /<h2>/g,
      '<h2 style="font-size:26px;font-weight:800;line-height:1.4;margin:38px 0 16px;color:#151515;border-left:6px solid #1a1a1a;padding-left:14px;">',
    )
    .replace(/<h3>/g, '<h3 style="font-size:21px;font-weight:700;line-height:1.45;margin:28px 0 12px;color:#222;">')
    .replace(/<p>/g, '<p style="font-size:18px;line-height:1.9;margin:16px 0;color:#222;">')
    .replace(/<ul>/g, '<ul style="margin:16px 0;padding-left:24px;">')
    .replace(/<ol>/g, '<ol style="margin:16px 0;padding-left:24px;">')
    .replace(/<li>/g, '<li style="font-size:18px;line-height:1.85;margin:9px 0;color:#222;">')
    .replace(/<strong>/g, '<strong style="font-weight:700;color:#000;">')
    .replace(
      /<table>/g,
      '<table style="width:100%;border-collapse:collapse;margin:22px 0;font-size:17px;line-height:1.6;">',
    )
    .replace(/<th>/g, '<th style="border:1px solid #dde1e8;padding:11px 12px;background:#f4f5f7;font-weight:700;text-align:left;">')
    .replace(/<td>/g, '<td style="border:1px solid #dde1e8;padding:11px 12px;">')
    // 본문 링크(공식 사이트 안내 등) — 항상 새 창으로 연다. 독자가 글을 떠나지 않게.
    // marked가 뽑는 순수 <a href="..."> 만 대상으로 한다 — 상품 배너 <a>는 이미 target·rel을 갖고 있어 걸리지 않는다.
    .replace(
      /<a href="([^"]+)">/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#1a56db;text-decoration:underline;font-weight:600;">',
    )
    // 대가성 고지 문구 등 인용구 — 본문보다 25% 작게 (식별은 가능하되 눈에 덜 띄게)
    .replace(
      /<blockquote>/g,
      '<blockquote style="font-size:11px;color:#8a909b;background:#f7f7f8;border-left:3px solid #d5d9e0;margin:18px 0;padding:9px 13px;border-radius:6px;line-height:1.55;">',
    );

  // 외부 핫링크 이미지 제거 — 나무위키·위키 등 외부 이미지를 본문에 넣으면 핫링크 차단으로 엑박이 뜨고
  // 저작권 문제도 생긴다. 우리 이미지(Gemini 생성·재호스팅)만 남긴다. (2026-07-17)
  html = html
    // 외부 이미지를 담은 <figure> 블록 통째 제거(캡션 포함)
    .replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, (block) => {
      const m = /<img[^>]+src="([^"]+)"/i.exec(block);
      if (m && /^https?:\/\//i.test(m[1]) && !/hom2box\.com/i.test(m[1])) return "";
      return block;
    })
    // figure 밖의 외부 <img> 단독 태그 제거
    .replace(/<img\b[^>]*\bsrc="https?:\/\/(?![^"]*hom2box\.com)[^"]*"[^>]*>/gi, "");

  // 컨테이너로 감싸 기본 폰트·색·행간을 상속시킨다 (인라인 스타일이 없는 요소 대비)
  return `<div style="font-size:18px;line-height:1.9;color:#222;font-family:'Pretendard',-apple-system,'Malgun Gothic',sans-serif;word-break:keep-all;">${html}</div>`;
}
