<?php
// HOM2BOX 뉴스 — goBlog가 발행한 글을 자체 신문사 스타일로 노출하는 메인.
// 기존 이미지샵 홈은 /imgshop.php 로 보존되어 있다.
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';

$articles = [];
$loadError = null;
try {
    $articles = news_articles();
} catch (Throwable $e) {
    $loadError = $e->getMessage();
}

// 한 기사는 페이지 전체에서 한 번만 노출한다 (중복 노출 방지).
// 우선순위: 헤드라인 → 서브리드(최신) → 주요기사(품질 상위) → 섹션 그리드(나머지)
$used = [];

$withImage = array_values(array_filter($articles, fn($a) => !empty($a['image'])));
$headline = $withImage[0] ?? ($articles[0] ?? null);
if ($headline) $used[$headline['id']] = true;

$subLeads = [];
foreach ($articles as $a) {
    if (isset($used[$a['id']])) continue;
    $subLeads[] = $a;
    $used[$a['id']] = true;
    if (count($subLeads) >= 6) break;
}

$ranked = [];
$byQuality = $articles;
usort($byQuality, fn($a, $b) => ($b['quality'] <=> $a['quality']) ?: strcmp($b['publishedAt'], $a['publishedAt']));
foreach ($byQuality as $a) {
    if (isset($used[$a['id']])) continue;
    $ranked[] = $a;
    $used[$a['id']] = true;
    if (count($ranked) >= 10) break;
}

$bySection = [];
foreach ($articles as $a) {
    if (isset($used[$a['id']])) continue;
    $bySection[$a['section']][] = $a;
}

$todayKst = date('Y년 n월 j일', time() + 9 * 3600);
$weekKo = ['일', '월', '화', '수', '목', '금', '토'];
$todayKst .= ' (' . $weekKo[(int) date('w', time() + 9 * 3600)] . ')';
?>
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HOM2BOX 뉴스 — 오늘의 이슈·경제·IT·생활</title>
<meta name="description" content="매일 갱신되는 이슈·경제·IT·생활 뉴스와 가이드. HOM2BOX 편집국이 발행하는 자체 기사.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600;800&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root { --ink:#111; --sub:#666; --line:#e5e5e5; --accent:#0b5fd9; --red:#c0392b; }
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',-apple-system,'Malgun Gothic',sans-serif; color:var(--ink); background:#fff; }
a { color:inherit; text-decoration:none; }
a:hover .t, a:hover.t { text-decoration:underline; }
img { max-width:100%; display:block; }
.wrap { max-width:1140px; margin:0 auto; padding:0 16px; }
.topbar { border-bottom:1px solid var(--line); font-size:12px; color:var(--sub); }
.topbar .wrap { display:flex; justify-content:space-between; padding-top:8px; padding-bottom:8px; }
.topbar a { margin-left:14px; color:var(--sub); }
.topbar a:hover { color:var(--ink); }
.masthead { text-align:center; padding:26px 0 18px; }
.masthead h1 { font-family:'Noto Serif KR',serif; font-weight:800; font-size:42px; letter-spacing:2px; }
.masthead h1 .b { color:var(--accent); }
.masthead p { margin-top:6px; font-size:12.5px; color:var(--sub); letter-spacing:.4px; }
nav.sections { border-top:2px solid var(--ink); border-bottom:1px solid var(--line); position:sticky; top:0; background:#fff; z-index:20; }
nav.sections .wrap { display:flex; gap:4px; overflow-x:auto; }
nav.sections a { padding:12px 16px; font-size:15px; font-weight:700; white-space:nowrap; }
nav.sections a:hover { color:var(--accent); }
.grid-lead { display:grid; grid-template-columns:1.6fr 1fr; gap:28px; padding:24px 0; border-bottom:1px solid var(--line); }
.lead .thumb { aspect-ratio:16/10; overflow:hidden; background:#f4f4f4; }
.lead .thumb img { width:100%; height:100%; object-fit:cover; }
.lead h2 { font-family:'Noto Serif KR',serif; font-size:30px; line-height:1.35; margin-top:14px; font-weight:800; }
.lead p.x { margin-top:10px; color:#444; font-size:15px; line-height:1.7; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
.lead .meta, .card .meta, .list .meta { margin-top:8px; font-size:12px; color:var(--sub); }
.badge { display:inline-block; font-size:11px; font-weight:700; color:var(--accent); border:1px solid currentColor; border-radius:3px; padding:1px 6px; margin-right:6px; vertical-align:1px; }
.subleads { display:flex; flex-direction:column; }
.subleads a { display:flex; gap:12px; padding:12px 0; border-bottom:1px solid var(--line); }
.subleads a:last-child { border-bottom:0; }
.subleads .t { font-size:15.5px; font-weight:600; line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; flex:1; }
.subleads .thumb { width:96px; height:64px; flex:none; overflow:hidden; background:#f4f4f4; border-radius:4px; }
.subleads .thumb img { width:100%; height:100%; object-fit:cover; }
.section-block { padding:26px 0 8px; }
.section-block .head { display:flex; align-items:baseline; justify-content:space-between; border-bottom:2px solid var(--ink); padding-bottom:8px; margin-bottom:18px; }
.section-block .head h3 { font-family:'Noto Serif KR',serif; font-size:22px; font-weight:800; }
.cards { display:grid; grid-template-columns:repeat(3,1fr); gap:22px; }
.card .thumb { aspect-ratio:16/10; overflow:hidden; background:#f4f4f4; border-radius:4px; }
.card .thumb img { width:100%; height:100%; object-fit:cover; transition:transform .25s; }
.card:hover .thumb img { transform:scale(1.04); }
.card .t { margin-top:10px; font-size:16.5px; font-weight:700; line-height:1.45; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.card p.x { margin-top:6px; font-size:13.5px; color:var(--sub); line-height:1.6; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.two-col { display:grid; grid-template-columns:2.2fr 1fr; gap:32px; align-items:start; padding-bottom:30px; }
aside.rank { border:1px solid var(--line); border-top:2px solid var(--ink); padding:16px; position:sticky; top:56px; }
aside.rank h3 { font-family:'Noto Serif KR',serif; font-size:18px; font-weight:800; margin-bottom:4px; }
aside.rank ol { list-style:none; counter-reset:rk; }
aside.rank li { counter-increment:rk; border-bottom:1px solid var(--line); }
aside.rank li:last-child { border-bottom:0; }
aside.rank a { display:flex; gap:10px; padding:10px 0; font-size:14px; line-height:1.5; }
aside.rank a::before { content:counter(rk); font-family:'Noto Serif KR',serif; font-weight:800; font-size:17px; color:var(--accent); min-width:18px; }
aside.rank .t { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
footer { border-top:2px solid var(--ink); margin-top:20px; padding:22px 0 40px; font-size:12.5px; color:var(--sub); }
footer .links { margin-bottom:10px; }
footer .links a { margin-right:16px; color:var(--ink); font-weight:600; }
.empty { padding:60px 0; text-align:center; color:var(--sub); }
@media (max-width:860px){
  .grid-lead { grid-template-columns:1fr; }
  .cards { grid-template-columns:repeat(2,1fr); }
  .two-col { grid-template-columns:1fr; }
  .masthead h1 { font-size:32px; }
  aside.rank { position:static; }
}
@media (max-width:520px){ .cards { grid-template-columns:1fr; } }
</style>
</head>
<body>

<div class="topbar">
  <div class="wrap">
    <span><?= nh($todayKst) ?></span>
    <span>
      <a href="/imgshop.php">AI 이미지샵</a>
      <a href="https://hom2box.tistory.com" target="_blank" rel="noopener">티스토리</a>
      <a href="https://blog.naver.com/coreselect" target="_blank" rel="noopener">네이버 블로그</a>
    </span>
  </div>
</div>

<header class="masthead wrap">
  <h1><a href="/">HOM2BOX <span class="b">뉴스</span></a></h1>
  <p>매일 갱신되는 이슈 · 경제 · IT · 생활 가이드</p>
</header>

<nav class="sections">
  <div class="wrap">
    <a href="/">홈</a>
    <?php foreach (NEWS_SECTIONS as $s): if (empty($bySection[$s])) continue; ?>
      <a href="#sec-<?= nh($s) ?>"><?= nh($s) ?></a>
    <?php endforeach; ?>
  </div>
</nav>

<main class="wrap">
<?php if (!$articles): ?>
  <div class="empty"><?= $loadError ? '기사를 불러오지 못했습니다.' : '아직 발행된 기사가 없습니다.' ?></div>
<?php else: ?>

  <!-- 헤드라인 -->
  <div class="grid-lead">
    <a class="lead" href="/article.php?id=<?= (int) $headline['id'] ?>">
      <?php if (!empty($headline['image'])): ?>
        <div class="thumb"><img src="<?= nh($headline['image']) ?>" alt="<?= nh($headline['title']) ?>"></div>
      <?php endif; ?>
      <h2 class="t"><?= nh($headline['title']) ?></h2>
      <?php if (!empty($headline['excerpt'])): ?><p class="x"><?= nh($headline['excerpt']) ?></p><?php endif; ?>
      <div class="meta"><span class="badge"><?= nh($headline['section']) ?></span><?= nh(news_date($headline['publishedAt'])) ?></div>
    </a>
    <div class="subleads">
      <?php foreach ($subLeads as $a): ?>
        <a href="/article.php?id=<?= (int) $a['id'] ?>">
          <span class="t"><?= nh($a['title']) ?></span>
          <?php if (!empty($a['image'])): ?><span class="thumb"><img src="<?= nh($a['image']) ?>" alt="" loading="lazy"></span><?php endif; ?>
        </a>
      <?php endforeach; ?>
    </div>
  </div>

  <div class="two-col">
    <div>
      <?php foreach (NEWS_SECTIONS as $s): $list = $bySection[$s] ?? []; if (!$list) continue; ?>
        <section class="section-block" id="sec-<?= nh($s) ?>">
          <div class="head"><h3><?= nh($s) ?></h3></div>
          <div class="cards">
            <?php foreach (array_slice($list, 0, 6) as $a): ?>
              <a class="card" href="/article.php?id=<?= (int) $a['id'] ?>">
                <?php if (!empty($a['image'])): ?>
                  <div class="thumb"><img src="<?= nh($a['image']) ?>" alt="" loading="lazy"></div>
                <?php endif; ?>
                <div class="t"><?= nh($a['title']) ?></div>
                <?php if (!empty($a['excerpt'])): ?><p class="x"><?= nh($a['excerpt']) ?></p><?php endif; ?>
                <div class="meta"><?= nh(news_date($a['publishedAt'])) ?></div>
              </a>
            <?php endforeach; ?>
          </div>
        </section>
      <?php endforeach; ?>
    </div>

    <aside class="rank">
      <h3>주요 기사</h3>
      <ol>
        <?php foreach ($ranked as $a): ?>
          <li><a href="/article.php?id=<?= (int) $a['id'] ?>"><span class="t"><?= nh($a['title']) ?></span></a></li>
        <?php endforeach; ?>
      </ol>
      <!-- adsense-slot: front-sidebar -->
    </aside>
  </div>

<?php endif; ?>
</main>

<footer>
  <div class="wrap">
    <div class="links">
      <a href="/">HOM2BOX 뉴스</a>
      <a href="/imgshop.php">AI 이미지샵</a>
    </div>
    <p>일부 기사에는 제휴 링크가 포함되어 있으며, 이를 통해 구매 시 운영자가 일정 수수료를 제공받을 수 있습니다.</p>
    <p>© <?= date('Y') ?> HOM2BOX. All rights reserved.</p>
  </div>
</footer>

</body>
</html>
