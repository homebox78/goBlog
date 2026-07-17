<?php
// 언론사 헤드라인 — 연합·JTBC·SBS·증권 RSS 큐레이션. 시안(HOM2BOX 언론사.dc.html) 스타일: 빨강 세로바 헤더+pill 탭+카테고리 카드.
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

render_head('언론사 헤드라인 — HOM2BOX 뉴스', '연합뉴스·JTBC·SBS·증권 등 주요 언론사 헤드라인을 분야별로 모아봅니다. 제목을 누르면 각 언론사 원문으로 이동합니다.');
render_ticker($ticker);
render_topbar();
render_masthead();
render_nav('언론사', [], true);
?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-[1399px] px-4 sm:px-6">
    <!-- 헤더: 빨강 세로바 + 제목 / 우측 탭 -->
    <div class="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pt-8 pb-4">
      <div>
        <div class="mb-1.5 flex items-center gap-2.5"><span class="h-[18px] w-[3px] rounded-full bg-[#e0392b]"></span><h1 class="m-0 text-[28px] sm:text-[32px] font-bold tracking-tight">언론사 헤드라인</h1></div>
        <div class="mt-1.5 text-[13px] text-zinc-400">아침·저녁 갱신 · 제목을 누르면 각 언론사 원문으로 이동합니다</div>
      </div>
      <?php if ($press): ?>
      <div class="flex flex-wrap gap-2">
        <?php $first = true; foreach ($press as $key => $tab): ?>
          <button type="button" data-ptab="<?= nh($key) ?>" class="ptab inline-flex whitespace-nowrap items-center rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold shadow-sm <?= $first ? 'on border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-900 hover:text-zinc-900' ?>"><?= nh($tab['label']) ?></button>
        <?php $first = false; endforeach; ?>
      </div>
      <?php endif; ?>
    </div>

    <?php if (!$press): ?>
      <div class="py-20 text-center">
        <span class="material-symbols-outlined text-[44px] text-zinc-300">rss_feed</span>
        <div class="mt-3 text-[15px] text-zinc-400">헤드라인을 불러오지 못했습니다. 잠시 후 다시 확인해주세요.</div>
      </div>
    <?php else: ?>
      <?php $first = true; foreach ($press as $key => $tab): ?>
        <div class="press-panel grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 py-7" id="press-<?= nh($key) ?>" <?= $first ? '' : 'style="display:none"' ?>>
          <?php foreach ($tab['boxes'] as $boxLabel => $links): ?>
            <div class="min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div class="flex items-center justify-between border-b-2 border-[#134a9c] bg-zinc-50 px-4 py-2.5 text-sm font-extrabold text-[#134a9c]"><?= nh((string) $boxLabel) ?><span class="material-symbols-outlined text-[16px]">chevron_right</span></div>
              <div class="px-4 py-1.5">
                <?php foreach ($links as $l): ?>
                  <a href="<?= nh($l['link']) ?>" target="_blank" rel="noopener nofollow" title="<?= nh($l['title']) ?>" class="block truncate border-b border-zinc-50 py-1.5 text-[13px] leading-normal last:border-0 hover:text-[#134a9c]"><?= nh($l['title']) ?></a>
                <?php endforeach; ?>
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      <?php $first = false; endforeach; ?>
    <?php endif; ?>

    <!-- RSS 저작권 고지 -->
    <div class="mb-8 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-[12px] leading-relaxed text-zinc-500">
      <span class="material-symbols-outlined mr-1 text-[15px] text-zinc-400">rss_feed</span>제휴 매체 헤드라인은 각 언론사가 RSS로 제공하는 콘텐츠이며, 제목을 클릭하면 해당 언론사 원문으로 연결됩니다. HOM2BOX는 원문의 저작권을 보유하지 않습니다.
    </div>

    <!-- 교차 프로모 -->
    <div class="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <a href="/docs.php" class="group flex items-center gap-3.5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md hover:border-[#134a9c]/40"><div class="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-[#134a9c]/10 text-[#134a9c]"><span class="material-symbols-outlined text-[26px]">draft</span></div><div class="min-w-0 flex-1"><div class="flex items-center gap-1.5 text-[15px] font-extrabold group-hover:text-[#134a9c]">문서 도구<span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10.5px] font-bold text-zinc-500">10종</span></div><div class="mt-0.5 truncate text-[12.5px] leading-snug text-zinc-500">각서·위임장 등 10종 서식 바로 작성</div></div><span class="material-symbols-outlined flex-none text-[20px] text-zinc-300 transition-colors group-hover:text-[#134a9c]">arrow_forward</span></a>
      <a href="/tools.php" class="group flex items-center gap-3.5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md hover:border-[#134a9c]/40"><div class="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-[#134a9c]/10 text-[#134a9c]"><span class="material-symbols-outlined text-[26px]">calculate</span></div><div class="min-w-0 flex-1"><div class="flex items-center gap-1.5 text-[15px] font-extrabold group-hover:text-[#134a9c]">계산기<span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10.5px] font-bold text-zinc-500">27종</span></div><div class="mt-0.5 truncate text-[12.5px] leading-snug text-zinc-500">연봉·세금·대출 등 27종 바로 계산</div></div><span class="material-symbols-outlined flex-none text-[20px] text-zinc-300 transition-colors group-hover:text-[#134a9c]">arrow_forward</span></a>
    </div>
    <?php render_ad('home-infeed'); ?>
  </div>
  <?php render_footer(); ?>
</div>
<script>
document.querySelectorAll('.ptab').forEach(function(b){b.addEventListener('click',function(){
  document.querySelectorAll('.ptab').forEach(function(x){x.classList.remove('on','border-zinc-900','bg-zinc-900','text-white');x.classList.add('border-zinc-200','bg-white','text-zinc-600','hover:border-zinc-900','hover:text-zinc-900');});
  document.querySelectorAll('.press-panel').forEach(function(p){p.style.display='none';});
  b.classList.add('on','border-zinc-900','bg-zinc-900','text-white');b.classList.remove('border-zinc-200','bg-white','text-zinc-600','hover:border-zinc-900','hover:text-zinc-900');
  var el=document.getElementById('press-'+b.dataset.ptab); if(el) el.style.display='';
});});
</script>
<?php render_foot();
