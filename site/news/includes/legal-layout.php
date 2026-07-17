<?php
// 정적 페이지(소개·개인정보·문의) 공용 렌더 — 새 디자인 시스템(layout.php) 기반.
declare(strict_types=1);
require_once __DIR__ . '/layout.php';

function le(?string $v): string
{
    return htmlspecialchars($v ?? '', ENT_QUOTES, 'UTF-8');
}

/** $title: 제목, $bodyHtml: 본문 HTML(신뢰 콘텐츠), $desc: 메타 설명 */
function render_legal_page(string $title, string $bodyHtml, string $desc = ''): void
{
    render_head($title . ' — HOM2BOX 뉴스', $desc);
    render_topbar();
    render_masthead();
    render_nav('', [], true);
    $P = NEWS_PRIMARY;
    ?>
<style>
.legal-body h1 { font-size:28px; font-weight:800; margin-bottom:8px; }
.legal-body .updated { color:#888; font-size:13px; margin-bottom:24px; }
.legal-body h2 { font-size:19px; font-weight:700; margin:28px 0 10px; }
.legal-body p { margin:10px 0; color:#333; line-height:1.75; }
.legal-body ul { margin:10px 0 10px 20px; color:#333; line-height:1.75; }
.legal-body li { margin:5px 0; }
.legal-body a { color:<?= $P ?>; text-decoration:underline; }
.legal-body .box { background:#f7f8fa; border:1px solid #e5e7eb; border-radius:8px; padding:16px 18px; margin:16px 0; }
</style>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-3xl px-6 py-10 legal-body">
    <?= $bodyHtml ?>
  </div>
  <?php render_footer(); ?>
</div>
<?php
    render_foot();
}
