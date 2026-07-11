import { marked } from "marked";

/**
 * 마크다운 → HTML 변환 시 인라인 타이포그래피를 주입한다.
 * 블로그 스킨·에디터 기본 폰트에 좌우되지 않도록 모든 스타일을 인라인으로 넣는다.
 * 40대 이상 가독성 기준: 본문 18px, 넉넉한 행간, 제목·본문 크기 대비, 핵심 볼드.
 */
export async function renderContentHtml(markdown: string): Promise<string> {
  let html = await marked.parse(markdown);

  html = html
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
    .replace(
      /<blockquote>/g,
      '<blockquote style="font-size:14px;color:#667085;background:#f7f7f8;border-left:4px solid #cbd0d8;margin:20px 0;padding:12px 16px;border-radius:6px;line-height:1.6;">',
    );

  // 컨테이너로 감싸 기본 폰트·색·행간을 상속시킨다 (인라인 스타일이 없는 요소 대비)
  return `<div style="font-size:18px;line-height:1.9;color:#222;font-family:'Pretendard',-apple-system,'Malgun Gothic',sans-serif;word-break:keep-all;">${html}</div>`;
}
