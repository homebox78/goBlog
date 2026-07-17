<?php
declare(strict_types=1);
http_response_code(404);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

$recent = [];
try { $recent = array_slice(news_articles(), 0, 6); } catch (Throwable) {}

render_head('페이지를 찾을 수 없습니다 (404) — HOM2BOX 뉴스', '요청하신 페이지를 찾을 수 없습니다.');
render_topbar();
render_masthead();
render_nav('', [], true);
$P = NEWS_PRIMARY;
?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-2xl px-6 py-20 text-center">
    <div class="text-[80px] font-extrabold text-[<?= $P ?>] leading-none">404</div>
    <h1 class="mt-3 text-[22px] font-extrabold">페이지를 찾을 수 없습니다</h1>
    <p class="mt-2 text-sm text-zinc-500">주소가 바뀌었거나 삭제된 페이지일 수 있습니다.</p>
    <div class="mt-6 flex justify-center gap-2">
      <a href="/" class="rounded-md bg-[<?= $P ?>] text-white px-5 py-2.5 text-sm font-bold hover:bg-[#0f3d82]">홈으로</a>
      <a href="/search.php" class="rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-bold text-zinc-700 hover:bg-zinc-50">기사 검색</a>
    </div>
    <?php if ($recent): ?>
    <div class="mt-12 text-left">
      <div class="text-sm font-extrabold text-zinc-900 border-b-2 border-zinc-900 pb-2 mb-3">최신 기사</div>
      <?php foreach ($recent as $a): ?>
        <a href="/article.php?id=<?= (int) $a['id'] ?>" class="block py-2 border-b border-zinc-100 text-[14.5px] font-semibold hover:text-[<?= $P ?>]"><?= nh($a['title']) ?></a>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>
  </div>
  <?php render_footer(); ?>
</div>
<?php render_foot();
