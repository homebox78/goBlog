<?php
// 기사 검색
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

$q = trim((string) ($_GET['q'] ?? ''));
$all = [];
try {
    $all = news_articles();
} catch (Throwable) {
}
$items = [];
if ($q !== '') {
    $needle = mb_strtolower($q);
    foreach ($all as $a) {
        $hay = mb_strtolower($a['title'] . ' ' . ($a['excerpt'] ?? '') . ' ' . ($a['kwText'] ?? ''));
        if (mb_strpos($hay, $needle) !== false) $items[] = $a;
    }
}

render_head(($q !== '' ? "'$q' 검색" : '뉴스 검색') . ' — HOM2BOX 뉴스', 'HOM2BOX 뉴스 기사 검색');
render_ticker(array_slice($all, 0, 6));
render_topbar();
render_masthead($q);
render_nav('', [], true);
?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-[1399px] px-6 py-7">
    <form action="/search.php" method="get" class="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 h-12 max-w-2xl mx-auto shadow-sm focus-within:ring-2 focus-within:ring-[<?= NEWS_PRIMARY ?>]/30 mb-7">
      <span class="material-symbols-outlined text-[22px] text-zinc-400">search</span>
      <input name="q" value="<?= nh($q) ?>" autofocus placeholder="기사 검색어를 입력하세요" class="flex-1 border-0 outline-none bg-transparent text-base placeholder:text-zinc-400">
      <button type="submit" class="rounded-md bg-[<?= NEWS_PRIMARY ?>] text-white px-4 py-1.5 text-sm font-bold">검색</button>
    </form>

    <?php if ($q === ''): ?>
      <div class="py-16 text-center text-zinc-400">검색어를 입력하세요.</div>
    <?php elseif (!$items): ?>
      <div class="py-16 text-center text-zinc-400">'<?= nh($q) ?>'에 대한 검색 결과가 없습니다.</div>
    <?php else: ?>
      <p class="text-sm text-zinc-500 mb-5"><b class="text-[<?= NEWS_PRIMARY ?>]"><?= count($items) ?>건</b>의 기사를 찾았습니다.</p>
      <div class="divide-y divide-zinc-100">
        <?php foreach ($items as $a): ?>
          <a href="/article.php?id=<?= (int) $a['id'] ?>" class="flex gap-4 py-4 group">
            <?php if (!empty($a['image'])): ?><div class="w-32 h-20 flex-none rounded-md bg-cover bg-center bg-zinc-100" style="background-image:url('<?= nh($a['image']) ?>')"></div><?php endif; ?>
            <div class="min-w-0">
              <div class="text-[17px] font-bold group-hover:text-[<?= NEWS_PRIMARY ?>]"><?= nh($a['title']) ?></div>
              <?php if (!empty($a['excerpt'])): ?><div class="mt-1 text-sm text-zinc-500 line-clamp-2"><?= nh($a['excerpt']) ?></div><?php endif; ?>
              <div class="mt-1.5 text-xs text-zinc-400"><?= nh($a['section']) ?> · <?= nh(news_date($a['publishedAt'])) ?></div>
            </div>
          </a>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
  <?php render_footer(); ?>
</div>
<?php render_foot();
