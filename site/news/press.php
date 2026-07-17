<?php
// 언론사 헤드라인 — 연합·JTBC·SBS·증권 RSS 큐레이션 별도 페이지
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/press-rss.php';
require_once __DIR__ . '/includes/layout.php';

$press = [];
try {
    $press = press_headlines(8);
} catch (Throwable) {
}
$ticker = [];
try { $ticker = array_slice(news_articles(), 0, 6); } catch (Throwable) {}
$P = NEWS_PRIMARY;

render_head('언론사 헤드라인 — HOM2BOX 뉴스', '연합뉴스·JTBC·SBS·증권 등 주요 언론사 헤드라인을 분야별로 모아봅니다. 제목을 누르면 각 언론사 원문으로 이동합니다.');
render_ticker($ticker);
render_topbar();
render_masthead();
render_nav('언론사', [], true);
?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-[1399px] px-6 py-8">
    <div class="border-b-2 border-zinc-900 pb-3 mb-6">
      <h1 class="text-[24px] font-extrabold">언론사 헤드라인</h1>
      <p class="mt-1.5 text-sm text-zinc-500">아침·저녁 갱신 · 제목을 누르면 각 언론사 원문으로 이동합니다. (RSS 제공 콘텐츠)</p>
    </div>

    <?php if (!$press): ?>
      <div class="py-16 text-center text-zinc-400">헤드라인을 불러오지 못했습니다.</div>
    <?php else: ?>
      <div class="flex flex-wrap gap-2 mb-6">
        <?php $first = true; foreach ($press as $key => $tab): ?>
          <button type="button" data-ptab="<?= nh($key) ?>" class="ptab rounded-full border px-4 py-1.5 text-[14px] font-bold <?= $first ? 'on border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 text-zinc-500' ?>"><?= nh($tab['label']) ?></button>
        <?php $first = false; endforeach; ?>
      </div>
      <?php $first = true; foreach ($press as $key => $tab): ?>
        <div class="press-panel grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" id="press-<?= nh($key) ?>" <?= $first ? '' : 'style="display:none"' ?>>
          <?php foreach ($tab['boxes'] as $boxLabel => $links): ?>
            <div class="min-w-0 rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div class="px-4 py-2.5 text-sm font-extrabold text-[<?= $P ?>] bg-zinc-50 border-b-2 border-[<?= $P ?>]"><?= nh((string) $boxLabel) ?></div>
              <div class="px-4 py-1.5">
                <?php foreach ($links as $l): ?>
                  <a href="<?= nh($l['link']) ?>" target="_blank" rel="noopener nofollow" title="<?= nh($l['title']) ?>" class="block truncate py-2 text-[13.5px] leading-normal border-b border-zinc-50 last:border-0 hover:text-[<?= $P ?>]"><?= nh($l['title']) ?></a>
                <?php endforeach; ?>
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      <?php $first = false; endforeach; ?>
    <?php endif; ?>
  </div>
  <?php render_footer(); ?>
</div>
<script>
document.querySelectorAll('.ptab').forEach(function(b){b.addEventListener('click',function(){
  document.querySelectorAll('.ptab').forEach(function(x){x.classList.remove('on','border-zinc-900','bg-zinc-900','text-white');x.classList.add('border-zinc-200','text-zinc-500');});
  document.querySelectorAll('.press-panel').forEach(function(p){p.style.display='none';});
  b.classList.add('on','border-zinc-900','bg-zinc-900','text-white');b.classList.remove('border-zinc-200','text-zinc-500');
  var el=document.getElementById('press-'+b.dataset.ptab); if(el) el.style.display='';
});});
</script>
<?php render_foot();
