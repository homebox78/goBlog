<?php
// 기사 검색 — 검색 히어로 + 인기 검색어 칩 + 카테고리 필터 + 결과 리스트 + 320px 사이드바.
// 시안: Hom2box디자인개편/HOM2BOX 검색.dc.html (Tailwind, primary #134a9c, accent #e0392b)
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

$P = NEWS_PRIMARY;

$q = trim((string) ($_GET['q'] ?? ''));
$all = [];
try {
    $all = news_articles();
} catch (Throwable) {
}

// 검색: 제목·요약·키워드 부분 일치(대소문자 무시) — q 없으면 전체 기사(시안과 동일)
$items = $all;
if ($q !== '') {
    $items = [];
    foreach ($all as $a) {
        $hay = $a['title'] . ' ' . ($a['excerpt'] ?? '') . ' ' . ($a['kwText'] ?? '');
        if (mb_stripos($hay, $q) !== false) $items[] = $a;
    }
}
$total = count($items);

// 인기 검색어 — 최근 기사들의 키워드에서 고유 6개
$hotKeywords = [];
foreach ($all as $a) {
    $kw = trim((string) ($a['kwText'] ?? ''));
    if ($kw === '' || in_array($kw, $hotKeywords, true)) continue;
    $hotKeywords[] = $kw;
    if (count($hotKeywords) >= 6) break;
}

// 카테고리별 건수 (현재 검색 결과 기준 — 클라이언트 필터 칩에 표기)
$catCounts = array_fill_keys(NEWS_SECTIONS, 0);
foreach ($items as $a) {
    $s = $a['section'] ?? '종합';
    if (isset($catCounts[$s])) $catCounts[$s]++;
}

// 많이 본 뉴스 1~5 — 최근 7일 조회수 상위, 부족하면 최신 기사로 채움
$byId = [];
foreach ($all as $a) $byId[(int) $a['id']] = $a;
$popular = [];
try {
    $rows = goblog_db()->query(
        "SELECT articleId, COUNT(*) c FROM article_views
         WHERE viewedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         GROUP BY articleId ORDER BY c DESC LIMIT 20",
    )->fetchAll();
    foreach ($rows as $r) {
        $aid = (int) $r['articleId'];
        if (isset($byId[$aid])) {
            $popular[] = $byId[$aid];
            if (count($popular) >= 5) break;
        }
    }
} catch (Throwable) {
}
if (count($popular) < 5) {
    $seen = array_column($popular, 'id');
    foreach ($all as $a) {
        if (count($popular) >= 5) break;
        if (in_array($a['id'], $seen, true)) continue;
        $popular[] = $a;
    }
}

render_head(
    ($q !== '' ? "'$q' 검색" : '뉴스 검색') . ' — HOM2BOX 뉴스',
    'HOM2BOX 뉴스 기사 검색 — 제목·요약·키워드로 전체 기사를 검색합니다.',
);
render_ticker(array_slice($all, 0, 6));
render_topbar();
render_masthead($q);
render_nav('', [], true);
?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-[1399px] px-4 sm:px-6">

    <!-- 검색 히어로 -->
    <div class="py-10 border-b border-zinc-200">
      <div class="mx-auto max-w-2xl">
        <form action="/search.php" method="get" class="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 h-14 shadow-sm focus-within:ring-2 focus-within:ring-[#134a9c]/30">
          <span class="material-symbols-outlined text-[22px] text-zinc-400">search</span>
          <input name="q" value="<?= nh($q) ?>" autofocus placeholder="뉴스 검색" class="min-w-0 flex-1 border-0 outline-none bg-transparent text-base placeholder:text-zinc-400">
          <?php if ($q !== ''): ?>
            <a href="/search.php" title="검색어 지우기" class="flex flex-none items-center"><span class="material-symbols-outlined text-[20px] text-zinc-400 hover:text-zinc-600">close</span></a>
          <?php endif; ?>
          <button type="submit" class="flex-none cursor-pointer rounded-lg border-0 bg-[#134a9c] px-4 py-2 text-sm font-bold text-white hover:bg-[#0f3d82]">검색</button>
        </form>
        <?php if ($hotKeywords): ?>
        <?php // 인기 검색어 — 뱃지 없이 미니멀 텍스트, 최대 6개 ?>
        <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
          <span class="font-bold text-zinc-400">인기 검색어</span>
          <?php foreach (array_slice($hotKeywords, 0, 6) as $kw): ?>
            <a href="/search.php?q=<?= urlencode($kw) ?>" class="font-medium text-zinc-500 hover:text-[#134a9c] hover:underline"><?= nh($kw) ?></a>
          <?php endforeach; ?>
        </div>
        <?php endif; ?>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 lg:gap-10 py-7">

      <!-- 검색 결과 -->
      <div>
        <?php if ($q !== ''): ?>
          <div class="mb-1 text-lg font-extrabold">'<?= nh($q) ?>' 검색 결과 <span class="text-[#134a9c]"><?= $total ?></span>건</div>
        <?php else: ?>
          <div class="mb-1 text-lg font-extrabold">전체 기사 <span class="text-[#134a9c]"><?= $total ?></span>건</div>
        <?php endif; ?>

        <?php if ($items): ?>
          <div id="h2b-catchips" class="mb-5 flex flex-wrap gap-2 border-b border-zinc-100 pb-4 pt-3">
            <button type="button" data-cat="" class="cursor-pointer inline-flex whitespace-nowrap items-center rounded-full px-3.5 py-1.5 text-[13px] font-semibold border shadow-sm bg-[#134a9c] text-white border-[#134a9c]">전체 <?= $total ?></button>
            <?php foreach (NEWS_SECTIONS as $s): ?>
              <button type="button" data-cat="<?= nh($s) ?>" class="cursor-pointer inline-flex whitespace-nowrap items-center rounded-full px-3.5 py-1.5 text-[13px] font-semibold border shadow-sm bg-white text-zinc-600 border-zinc-200 hover:border-[#134a9c] hover:text-[#134a9c]"><?= nh($s) ?> <?= $catCounts[$s] ?></button>
            <?php endforeach; ?>
          </div>

          <div id="h2b-results">
            <?php foreach ($items as $a): ?>
              <a href="/article.php?id=<?= (int) $a['id'] ?>" data-cat="<?= nh($a['section'] ?? '종합') ?>" class="flex gap-4 sm:gap-5 items-center py-4 border-b border-zinc-100 group">
                <?php if (!empty($a['image'])): ?>
                  <div class="w-[138px] h-[92px] sm:w-[165px] sm:h-[110px] flex-none rounded-md bg-cover bg-center bg-zinc-100" style="background-image:url('<?= nh($a['image']) ?>')"></div>
                <?php else: ?>
                  <div class="w-[138px] h-[92px] sm:w-[165px] sm:h-[110px] flex-none rounded-md bg-zinc-100 flex items-center justify-center"><span class="material-symbols-outlined text-[24px] text-zinc-300">imagesmode</span></div>
                <?php endif; ?>
                <div class="min-w-0 flex-1">
                  <div class="mb-1.5 flex items-center gap-2">
                    <span class="inline-flex items-center rounded-md bg-[#134a9c]/10 px-2 py-0.5 text-[11px] font-bold text-[#134a9c]"><?= nh($a['section'] ?? '종합') ?></span>
                    <span class="text-[11.5px] text-zinc-400"><?= nh(news_date((string) $a['publishedAt'])) ?></span>
                  </div>
                  <div class="text-[15.5px] sm:text-[17px] font-bold leading-snug group-hover:text-[#134a9c]"><?= nh($a['title']) ?></div>
                  <?php if (!empty($a['excerpt'])): ?>
                    <div class="mt-1.5 text-[12.5px] sm:text-[13.5px] leading-relaxed text-zinc-500 line-clamp-2"><?= nh($a['excerpt']) ?></div>
                  <?php endif; ?>
                </div>
              </a>
            <?php endforeach; ?>
          </div>

          <!-- 클라이언트 카테고리 필터로 0건이 될 때 (JS 토글) -->
          <div id="h2b-cat-empty" class="hidden flex-col items-center gap-3 py-16 text-center">
            <span class="material-symbols-outlined text-[44px] text-zinc-300">search_off</span>
            <div class="text-[15px] font-bold text-zinc-500">이 카테고리에는 결과가 없습니다</div>
            <div class="text-[13px] text-zinc-400">다른 카테고리를 선택하거나 '전체'를 눌러 모든 결과를 확인하세요.</div>
          </div>
        <?php else: ?>
          <div class="flex flex-col items-center gap-3 py-20 text-center">
            <span class="material-symbols-outlined text-[44px] text-zinc-300">search_off</span>
            <?php if ($q !== ''): ?>
              <div class="text-[15px] font-bold text-zinc-500">'<?= nh($q) ?>'에 대한 검색 결과가 없습니다</div>
              <div class="text-[13px] text-zinc-400">단어의 철자를 확인하거나, 더 짧고 일반적인 검색어로 다시 시도해 보세요.</div>
            <?php else: ?>
              <div class="text-[15px] font-bold text-zinc-500">표시할 기사가 없습니다</div>
              <div class="text-[13px] text-zinc-400">잠시 후 다시 시도해 주세요.</div>
            <?php endif; ?>
          </div>
        <?php endif; ?>

        <?php render_ad('home-infeed'); ?>
      </div>

      <!-- 사이드바 -->
      <div class="flex flex-col gap-5 self-start lg:sticky lg:top-16">
        <div class="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div class="border-b border-zinc-100 px-4 pt-3.5 pb-2.5 text-[15.5px] font-extrabold">바로가기</div>
          <div class="flex flex-col p-2">
            <a href="/docs.php" class="group flex items-center gap-3 rounded-lg px-2.5 py-2.5 hover:bg-zinc-50"><span class="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#134a9c]/10 text-[#134a9c]"><span class="material-symbols-outlined text-[19px]">draft</span></span><span class="min-w-0 flex-1"><span class="block text-[13.5px] font-bold text-zinc-700 group-hover:text-[#134a9c]">문서 도구</span><span class="block text-[11.5px] text-zinc-400">각서·위임장 등 10종 서식</span></span><span class="material-symbols-outlined flex-none text-[18px] text-zinc-300 group-hover:text-[#134a9c]">chevron_right</span></a>
            <a href="/tools.php" class="group flex items-center gap-3 rounded-lg px-2.5 py-2.5 hover:bg-zinc-50"><span class="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#134a9c]/10 text-[#134a9c]"><span class="material-symbols-outlined text-[19px]">calculate</span></span><span class="min-w-0 flex-1"><span class="block text-[13.5px] font-bold text-zinc-700 group-hover:text-[#134a9c]">계산기</span><span class="block text-[11.5px] text-zinc-400">연봉·세금·대출 등 27종</span></span><span class="material-symbols-outlined flex-none text-[18px] text-zinc-300 group-hover:text-[#134a9c]">chevron_right</span></a>
          </div>
        </div>

        <?php if ($popular): ?>
        <div class="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div class="border-b border-zinc-100 px-4 pt-3.5 pb-2.5 text-[15.5px] font-extrabold">많이 본 뉴스</div>
          <div class="px-4 py-1.5">
            <?php foreach ($popular as $i => $a): ?>
            <a href="/article.php?id=<?= (int) $a['id'] ?>" class="flex items-baseline gap-3 border-b border-zinc-50 py-2.5 last:border-0 group">
              <span class="w-4 flex-none text-[15px] font-extrabold text-[#134a9c]"><?= $i + 1 ?></span>
              <span class="flex-1 text-[13px] font-semibold leading-normal group-hover:text-[#134a9c]"><?= nh($a['title']) ?></span>
            </a>
            <?php endforeach; ?>
          </div>
        </div>
        <?php endif; ?>

        <?php render_ad('home-sidebar'); ?>
      </div>
    </div>
  </div>

  <?php render_footer(); ?>
</div>

<script>
(function(){
  var ACTIVE='bg-[#134a9c] text-white border-[#134a9c]';
  var IDLE='bg-white text-zinc-600 border-zinc-200 hover:border-[#134a9c] hover:text-[#134a9c]';
  var chips=document.querySelectorAll('#h2b-catchips [data-cat]');
  if(!chips.length) return;
  var rows=document.querySelectorAll('#h2b-results [data-cat]');
  var empty=document.getElementById('h2b-cat-empty');
  function apply(cat){
    chips.forEach(function(c){
      var on=c.dataset.cat===cat;
      (on?IDLE:ACTIVE).split(' ').forEach(function(k){c.classList.remove(k);});
      (on?ACTIVE:IDLE).split(' ').forEach(function(k){c.classList.add(k);});
    });
    var visible=0;
    rows.forEach(function(r){
      var show=cat===''||r.dataset.cat===cat;
      r.classList.toggle('hidden',!show);
      if(show) visible++;
    });
    if(empty){
      empty.classList.toggle('hidden',visible>0);
      empty.classList.toggle('flex',visible===0);
    }
  }
  chips.forEach(function(c){ c.addEventListener('click',function(){ apply(c.dataset.cat); }); });
})();
</script>
<?php render_foot();
