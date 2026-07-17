<?php
// 뉴스 사이트 정적 페이지(소개·개인정보·문의) 공용 레이아웃 — index/article과 같은 톤(에스코어드림).
declare(strict_types=1);

function le(?string $v): string
{
    return htmlspecialchars($v ?? '', ENT_QUOTES, 'UTF-8');
}

/** $title: 페이지 제목, $bodyHtml: 본문 HTML(신뢰 콘텐츠), $desc: 메타 설명 */
function render_legal_page(string $title, string $bodyHtml, string $desc = ''): void
{
    ?>
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= le($title) ?> — HOM2BOX 뉴스</title>
<meta name="description" content="<?= le($desc !== '' ? $desc : $title) ?>">
<style>
@font-face { font-family:'S-CoreDream'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-4Regular.woff') format('woff'); font-weight:400; font-display:swap; }
@font-face { font-family:'S-CoreDream'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-7ExtraBold.woff') format('woff'); font-weight:700; font-display:swap; }
@font-face { font-family:'S-CoreDream'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-8Heavy.woff') format('woff'); font-weight:800; font-display:swap; }
:root { --ink:#111; --sub:#666; --line:#e5e5e5; --accent:#0b5fd9; --title-font:'S-CoreDream',-apple-system,'Malgun Gothic',sans-serif; }
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'S-CoreDream',-apple-system,'Malgun Gothic',sans-serif; color:var(--ink); background:#fff; line-height:1.75; }
a { color:var(--accent); text-decoration:none; }
a:hover { text-decoration:underline; }
.wrap { max-width:820px; margin:0 auto; padding:0 16px; }
.masthead { text-align:center; padding:18px 0 12px; border-bottom:2px solid var(--ink); }
.masthead .logo { font-family:var(--title-font); font-weight:800; font-size:26px; letter-spacing:1px; color:var(--ink); }
.masthead .logo .b { color:var(--accent); }
nav.sub { border-bottom:1px solid var(--line); }
nav.sub .wrap { display:flex; gap:18px; padding:12px 16px; font-size:14px; }
nav.sub a { color:var(--sub); font-weight:700; }
main.legal { padding:32px 0 50px; }
main.legal h1 { font-family:var(--title-font); font-size:28px; font-weight:800; margin-bottom:8px; }
main.legal .updated { color:var(--sub); font-size:13px; margin-bottom:26px; }
main.legal h2 { font-family:var(--title-font); font-size:19px; font-weight:700; margin:28px 0 10px; }
main.legal p { margin:10px 0; color:#333; }
main.legal ul { margin:10px 0 10px 20px; color:#333; }
main.legal li { margin:5px 0; }
main.legal .box { background:#f7f8fa; border:1px solid var(--line); border-radius:8px; padding:16px 18px; margin:16px 0; }
footer { border-top:2px solid var(--ink); padding:22px 0 40px; font-size:12.5px; color:var(--sub); }
footer .links { margin-bottom:10px; }
footer .links a { margin-right:16px; color:var(--ink); font-weight:600; }
</style>
</head>
<body>
<header class="masthead"><a class="logo" href="/">HOM2BOX <span class="b">뉴스</span></a></header>
<nav class="sub"><div class="wrap">
  <a href="/">홈</a>
  <a href="/about.php">소개</a>
  <a href="/privacy.php">개인정보처리방침</a>
  <a href="/contact.php">문의</a>
</div></nav>
<main class="legal"><div class="wrap">
<?= $bodyHtml ?>
</div></main>
<footer><div class="wrap">
  <div class="links">
    <a href="/">HOM2BOX 뉴스</a>
    <a href="/about.php">소개</a>
    <a href="/privacy.php">개인정보처리방침</a>
    <a href="/contact.php">문의</a>
    <a href="/imgshop.php">AI 이미지샵</a>
  </div>
  <p>일부 기사에는 제휴 링크가 포함되어 있으며, 이를 통해 구매 시 운영자가 일정 수수료를 제공받을 수 있습니다.</p>
  <p>© <?= date('Y') ?> HOM2BOX. All rights reserved.</p>
</div></footer>
</body>
</html>
    <?php
}
