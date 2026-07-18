<?php
// 오피니언 — 편집국 칼럼(자체 기사 품질순 상위) + 제휴 매체 오피니언 RSS 헤드라인.
// 시안: Hom2box디자인개편/HOM2BOX 오피니언.dc.html (Tailwind, primary #134a9c, accent #e0392b)
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

$P = NEWS_PRIMARY;

$all = [];
try {
    $all = news_articles();
} catch (Throwable) {
}

// 편집국 칼럼 = 품질점수 상위 (동점이면 최신순) — 기존 로직 유지
$items = $all;
usort($items, fn($a, $b) => ($b['quality'] <=> $a['quality']) ?: strcmp($b['publishedAt'], $a['publishedAt']));
$items = array_slice($items, 0, 30);

$lead = $items[0] ?? null;
$rest = $lead ? array_slice($items, 1) : [];
$popular = array_slice($items, 0, 5);

// 제휴 매체 오피니언 — RSS에 '오피니언' 분류가 있는 매체만 제목 인용(원문 링크)
$pressItems = [];
try {
    require_once __DIR__ . '/includes/press-rss.php';
    foreach (press_headlines() as $tab) {
        foreach (($tab['boxes'] ?? []) as $boxLabel => $list) {
            if ($boxLabel !== '오피니언') continue;
            foreach ($list as $it) {
                $pressItems[] = ['title' => $it['title'], 'link' => $it['link'], 'source' => $tab['label']];
            }
        }
    }
} catch (Throwable) {
}
$hasPress = count($pressItems) > 0;

render_head('오피니언 — HOM2BOX 뉴스', 'HOM2BOX 편집국 칼럼과 제휴 매체 오피니언을 함께 전합니다. 매일 아침·저녁 갱신.');
render_ticker(array_slice($all, 0, 6));
render_topbar();
render_masthead();
render_nav('오피니언', [], true);
render_util_hero('OPINION', '오피니언', 'HOM2BOX 편집국 칼럼과 제휴 매체 오피니언을 함께 · 매일 아침·저녁 갱신', ['사설·칼럼', '경제', '시사', 'IT'], '/assets/hero/opinion.jpg');
?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-[1399px] px-4 sm:px-6">

    <!-- 오피니언 필터 -->
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pt-6 pb-4">
      <h2 class="text-[17px] font-extrabold tracking-tight sm:text-[19px]">전체 칼럼</h2>
      <div class="flex flex-wrap gap-2">
        <button type="button" data-filter="all" class="cursor-pointer inline-flex whitespace-nowrap items-center rounded-full px-3.5 py-1.5 text-[13px] font-semibold border shadow-sm bg-[<?= $P ?>] text-white border-[<?= $P ?>]">전체</button>
        <button type="button" data-filter="own" class="cursor-pointer inline-flex whitespace-nowrap items-center rounded-full px-3.5 py-1.5 text-[13px] font-semibold border shadow-sm bg-white text-zinc-600 border-zinc-200 hover:border-[<?= $P ?>] hover:text-[<?= $P ?>]">편집국 칼럼</button>
        <?php if ($hasPress): ?>
        <button type="button" data-filter="press" class="cursor-pointer inline-flex whitespace-nowrap items-center rounded-full px-3.5 py-1.5 text-[13px] font-semibold border shadow-sm bg-white text-zinc-600 border-zinc-200 hover:border-[<?= $P ?>] hover:text-[<?= $P ?>]">제휴 매체</button>
        <?php endif; ?>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 lg:gap-10 py-7">
      <!-- 오피니언 리스트 -->
      <div id="op-list">
        <?php if (!$lead && !$hasPress): ?>
          <div class="py-20 text-center text-zinc-400">아직 기사가 없습니다.</div>
        <?php endif; ?>

        <?php if ($lead): ?>
        <!-- 리드 히어로: 오늘의 칼럼 -->
        <a href="/article.php?id=<?= (int) $lead['id'] ?>" data-optype="own" class="block group border-b border-zinc-200 pb-7 mb-2">
          <div class="flex items-center gap-2.5 mb-3">
            <span class="text-[11.5px] font-extrabold uppercase tracking-wide text-[<?= $P ?>]">오늘의 칼럼</span>
            <span class="text-[11.5px] font-medium text-zinc-400">편집국 칼럼</span>
          </div>
          <h2 class="m-0 text-[22px] sm:text-[30px] font-extrabold leading-snug tracking-tight group-hover:text-[<?= $P ?>]"><?= nh($lead['title']) ?></h2>
          <?php if (!empty($lead['excerpt'])): ?><p class="mt-3 mb-4 max-w-3xl text-[15px] leading-relaxed text-zinc-500"><?= nh($lead['excerpt']) ?></p><?php endif; ?>
          <div class="<?= empty($lead['excerpt']) ? 'mt-4 ' : '' ?>flex items-center gap-3">
            <div class="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[<?= $P ?>] text-sm font-extrabold text-white">H</div>
            <div>
              <div class="text-[13.5px] font-bold">HOM2BOX 편집국</div>
              <div class="text-xs text-zinc-400">편집국 칼럼 · <?= nh(news_date($lead['publishedAt'])) ?></div>
            </div>
          </div>
        </a>
        <?php endif; ?>

        <?php foreach ($rest as $a): ?>
        <a href="/article.php?id=<?= (int) $a['id'] ?>" data-optype="own" class="flex items-center gap-3.5 sm:gap-5 border-b border-zinc-100 py-5 group">
          <div class="h-[101px] w-[135px] sm:h-[135px] sm:w-[180px] flex-none overflow-hidden rounded-lg bg-cover bg-center bg-[repeating-linear-gradient(45deg,#f4f4f5,#f4f4f5_8px,#e4e4e7_8px,#e4e4e7_16px)]"<?php if (!empty($a['image'])): ?> style="background-image:url('<?= nh($a['image']) ?>')"<?php endif; ?>></div>
          <div class="min-w-0 flex-1">
            <div class="mb-1 flex items-center gap-2">
              <span class="text-[11.5px] font-bold text-[<?= $P ?>]">편집국 칼럼</span>
              <span class="text-zinc-300">·</span>
              <span class="text-[11.5px] text-zinc-400"><?= nh(news_date($a['publishedAt'])) ?></span>
            </div>
            <div class="text-[15.5px] sm:text-[18px] font-bold leading-snug group-hover:text-[<?= $P ?>]"><?= nh($a['title']) ?></div>
            <?php if (!empty($a['excerpt'])): ?><div class="mt-1 hidden sm:block text-[13px] leading-relaxed text-zinc-500 line-clamp-2"><?= nh($a['excerpt']) ?></div><?php endif; ?>
            <div class="mt-1.5 text-xs font-semibold text-zinc-400">HOM2BOX 편집국 · <?= nh($a['section']) ?></div>
          </div>
          <span class="material-symbols-outlined hidden sm:inline-flex flex-none text-[20px] text-zinc-300 group-hover:text-[<?= $P ?>]">chevron_right</span>
        </a>
        <?php endforeach; ?>

        <?php foreach ($pressItems as $pi): ?>
        <a href="<?= nh($pi['link']) ?>" target="_blank" rel="noopener" data-optype="press" class="flex items-center gap-3.5 sm:gap-5 border-b border-zinc-100 py-5 group">
          <div class="min-w-0 flex-1">
            <div class="mb-1 flex items-center gap-2">
              <span class="text-[11.5px] font-bold text-zinc-500"><?= nh($pi['source']) ?></span>
            </div>
            <div class="text-[15.5px] sm:text-[18px] font-bold leading-snug group-hover:text-[<?= $P ?>]"><?= nh($pi['title']) ?></div>
            <div class="mt-1 hidden sm:block text-[13px] leading-relaxed text-zinc-500 line-clamp-2">제휴 매체 오피니언 · 원문에서 전문을 읽을 수 있습니다.</div>
            <div class="mt-1.5 text-xs font-semibold text-zinc-400"><?= nh($pi['source']) ?> · 오피니언</div>
          </div>
          <span class="material-symbols-outlined hidden sm:inline-flex flex-none text-[20px] text-zinc-300 group-hover:text-[<?= $P ?>]">chevron_right</span>
        </a>
        <?php endforeach; ?>

        <?php render_ad('home-infeed'); ?>
      </div>

      <!-- 사이드바 -->
      <div class="flex flex-col gap-5 self-start lg:sticky lg:top-16">
        <div class="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div class="border-b border-zinc-100 px-4 pt-3.5 pb-2.5 text-[15.5px] font-extrabold">바로가기</div>
          <div class="flex flex-col p-2">
            <a href="/docs.php" class="group flex items-center gap-3 rounded-lg px-2.5 py-2.5 hover:bg-zinc-50"><span class="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[<?= $P ?>]/10 text-[<?= $P ?>]"><span class="material-symbols-outlined text-[19px]">draft</span></span><span class="min-w-0 flex-1"><span class="block text-[13.5px] font-bold text-zinc-700 group-hover:text-[<?= $P ?>]">문서 도구</span><span class="block text-[11.5px] text-zinc-400">각서·위임장 등 10종 서식</span></span><span class="material-symbols-outlined flex-none text-[18px] text-zinc-300 group-hover:text-[<?= $P ?>]">chevron_right</span></a>
            <a href="/tools.php" class="group flex items-center gap-3 rounded-lg px-2.5 py-2.5 hover:bg-zinc-50"><span class="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[<?= $P ?>]/10 text-[<?= $P ?>]"><span class="material-symbols-outlined text-[19px]">calculate</span></span><span class="min-w-0 flex-1"><span class="block text-[13.5px] font-bold text-zinc-700 group-hover:text-[<?= $P ?>]">계산기</span><span class="block text-[11.5px] text-zinc-400">연봉·세금·대출 등 27종</span></span><span class="material-symbols-outlined flex-none text-[18px] text-zinc-300 group-hover:text-[<?= $P ?>]">chevron_right</span></a>
          </div>
        </div>

        <?php if ($popular): ?>
        <div class="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div class="border-b border-zinc-100 px-4 pt-3.5 pb-2.5 text-[15.5px] font-extrabold">많이 본 오피니언</div>
          <div class="px-4 py-1.5">
            <?php foreach ($popular as $i => $a): ?>
            <a href="/article.php?id=<?= (int) $a['id'] ?>" class="flex items-baseline gap-3 border-b border-zinc-50 py-2.5 last:border-0 group">
              <span class="w-4 flex-none text-[15px] font-extrabold text-[<?= $P ?>]"><?= $i + 1 ?></span>
              <span class="flex-1 text-[13px] font-semibold leading-normal group-hover:text-[<?= $P ?>]"><?= nh($a['title']) ?></span>
            </a>
            <?php endforeach; ?>
          </div>
        </div>
        <?php endif; ?>

        <div class="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div class="mb-3 text-[13px] font-extrabold text-[<?= $P ?>]">필진 소개</div>
          <div class="flex items-center gap-3 border-b border-zinc-50 py-2.5 last:border-0">
            <div class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[<?= $P ?>] text-xs font-extrabold text-white">H</div>
            <div>
              <div class="text-[13px] font-bold">HOM2BOX 편집국</div>
              <div class="text-[11.5px] text-zinc-400">경제·IT·생활 칼럼</div>
            </div>
          </div>
          <?php if ($hasPress): ?>
          <div class="flex items-center gap-3 border-b border-zinc-50 py-2.5 last:border-0">
            <div class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-zinc-600 text-xs font-extrabold text-white"><?= nh(mb_substr($pressItems[0]['source'], 0, 1)) ?></div>
            <div>
              <div class="text-[13px] font-bold">제휴 매체 오피니언</div>
              <div class="text-[11.5px] text-zinc-400">사설·칼럼 (RSS 제공)</div>
            </div>
          </div>
          <?php endif; ?>
        </div>

        <?php render_ad('home-sidebar'); ?>

        <div class="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
          <div class="mb-2 text-[13px] font-extrabold text-[<?= $P ?>]">제휴 매체 오피니언 RSS</div>
          <div class="text-[13px] leading-relaxed text-zinc-500">제휴 매체 오피니언 헤드라인은 매일 아침·저녁 자동 수집되어 제목만 노출한 뒤 원문으로 연결됩니다.</div>
        </div>
      </div>
    </div>
  </div>
  <?php render_footer(); ?>
</div>
<script>
(function(){
  var ACTIVE='bg-[<?= $P ?>] text-white border-[<?= $P ?>]';
  var IDLE='bg-white text-zinc-600 border-zinc-200 hover:border-[<?= $P ?>] hover:text-[<?= $P ?>]';
  var chips=document.querySelectorAll('[data-filter]');
  var rows=document.querySelectorAll('#op-list [data-optype]');
  function apply(f){
    chips.forEach(function(c){
      var on=c.dataset.filter===f;
      (on?IDLE:ACTIVE).split(' ').forEach(function(k){c.classList.remove(k);});
      (on?ACTIVE:IDLE).split(' ').forEach(function(k){c.classList.add(k);});
    });
    rows.forEach(function(r){
      r.classList.toggle('hidden',f!=='all'&&r.dataset.optype!==f);
    });
  }
  chips.forEach(function(c){c.addEventListener('click',function(){apply(c.dataset.filter);});});
})();
</script>
<?php render_foot();
