<?php
// 오피니언·해설 — 심층 정리형 기사 모음 (품질점수 상위 최신)
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

$all = [];
try {
    $all = news_articles();
} catch (Throwable) {
}
// 해설·분석 성격 = 품질점수 상위. 최신순 유지하며 상위 품질 위주로.
$items = $all;
usort($items, fn($a, $b) => ($b['quality'] <=> $a['quality']) ?: strcmp($b['publishedAt'], $a['publishedAt']));
$items = array_slice($items, 0, 30);

render_head('오피니언·해설 — HOM2BOX 뉴스', '이슈를 깊이 있게 정리한 해설·분석 기사 모음.');
render_ticker(array_slice($all, 0, 6));
render_topbar();
render_masthead();
render_nav('오피니언', [], true);
?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-4xl px-6 py-7">
    <div class="border-b-2 border-zinc-900 pb-3 mb-6">
      <h1 class="text-[24px] font-extrabold text-[<?= NEWS_PRIMARY ?>]">오피니언 · 해설</h1>
      <p class="mt-1.5 text-sm text-zinc-500">복잡한 이슈를 조건·수치·절차 중심으로 깊이 있게 정리한 해설 기사입니다.</p>
    </div>
    <?php if (!$items): ?>
      <div class="py-20 text-center text-zinc-400">아직 기사가 없습니다.</div>
    <?php else: ?>
      <div class="divide-y divide-zinc-100">
        <?php foreach ($items as $a): ?>
          <a href="/article.php?id=<?= (int) $a['id'] ?>" class="flex gap-5 py-5 group">
            <?php if (!empty($a['image'])): ?><div class="w-40 h-24 flex-none rounded-lg bg-cover bg-center bg-zinc-100" style="background-image:url('<?= nh($a['image']) ?>')"></div><?php endif; ?>
            <div class="min-w-0">
              <div class="text-xs font-bold text-[<?= NEWS_PRIMARY ?>] mb-1"><?= nh($a['section']) ?></div>
              <div class="text-[19px] font-extrabold leading-snug group-hover:text-[<?= NEWS_PRIMARY ?>]"><?= nh($a['title']) ?></div>
              <?php if (!empty($a['excerpt'])): ?><div class="mt-1.5 text-sm text-zinc-500 line-clamp-2"><?= nh($a['excerpt']) ?></div><?php endif; ?>
              <div class="mt-2 text-xs text-zinc-400"><?= nh(news_date($a['publishedAt'])) ?></div>
            </div>
          </a>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
  <?php render_footer(); ?>
</div>
<?php render_foot();
