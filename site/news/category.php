<?php
// 카테고리별 기사 목록 — 시안 개편: 가로 행 리스트 + 320px 사이드바.
// 12개 기본 + 무한 스크롤(AJAX). ?ajax=1&offset=N 이면 JSON 반환. ?sort=name 이면 가나다순.
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

const CAT_DESCS = [
    '경제·금융' => '시장·금리·투자 가이드',
    'IT·게임'  => '테크·게임·디지털 트렌드',
    '생활·건강' => '생활 정보와 건강 가이드',
    '여행·문화' => '여행·문화·라이프',
    '종합'     => '이슈 종합',
];

$cat = trim((string) ($_GET['cat'] ?? ''));
if ($cat === '' || !in_array($cat, NEWS_SECTIONS, true)) $cat = NEWS_SECTIONS[0];
$sort = (($_GET['sort'] ?? '') === 'name') ? 'name' : 'latest';

$PER = 12;
$everything = [];
try {
    $everything = news_articles();
} catch (Throwable) {
}
$all = array_values(array_filter($everything, fn($a) => $a['section'] === $cat));
if ($sort === 'name') {
    usort($all, fn($a, $b) => strcmp($a['title'], $b['title'])); // UTF-8 코드포인트 정렬 = 가나다순
}

/** 기사 1건 — 가로 행(썸네일 + 배지·날짜 + 제목 + 요약 + chevron). 초기 렌더·AJAX 조각 공용 */
function category_row(array $c): void
{
    ?>
    <a href="/article.php?id=<?= (int) $c['id'] ?>" class="h2b-art group flex items-center gap-4 border-b border-zinc-100 py-4 transition-colors hover:bg-zinc-50 sm:gap-5">
      <?php if (!empty($c['image'])): ?>
        <div class="h2b-art-thumb h-[101px] w-[135px] flex-none rounded-md bg-zinc-100 bg-cover bg-center sm:h-[135px] sm:w-[180px]" style="background-image:url('<?= nh($c['image']) ?>')"></div>
      <?php else: ?>
        <div class="h2b-art-thumb flex h-[101px] w-[135px] flex-none items-center justify-center rounded-md bg-[repeating-linear-gradient(45deg,#f4f4f5,#f4f4f5_8px,#e4e4e7_8px,#e4e4e7_16px)] font-mono text-[10px] text-zinc-400 sm:h-[135px] sm:w-[180px]">기사 썸네일</div>
      <?php endif; ?>
      <div class="h2b-art-body min-w-0 flex-1">
        <div class="mb-1.5 flex items-center gap-2">
          <span class="inline-flex items-center whitespace-nowrap rounded-md bg-[#134a9c]/10 px-2 py-0.5 text-[11px] font-bold text-[#134a9c]"><?= nh($c['section']) ?></span>
          <span class="whitespace-nowrap text-[11.5px] text-zinc-400"><?= nh(news_date($c['publishedAt'])) ?></span>
        </div>
        <div class="text-[15.5px] font-bold leading-snug group-hover:text-[#134a9c]"><?= nh($c['title']) ?></div>
        <?php if (!empty($c['excerpt'])): ?><div class="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500 line-clamp-2"><?= nh($c['excerpt']) ?></div><?php endif; ?>
      </div>
      <span class="h2b-art-chev material-symbols-outlined flex-none text-[20px] text-zinc-300 group-hover:text-[#134a9c]">chevron_right</span>
    </a>
    <?php
}

// AJAX: 다음 페이지 행 HTML 조각 반환
if (isset($_GET['ajax'])) {
    header('Content-Type: application/json; charset=utf-8');
    $offset = max(0, (int) ($_GET['offset'] ?? 0));
    $slice = array_slice($all, $offset, $PER);
    ob_start();
    foreach ($slice as $c) category_row($c);
    echo json_encode([
        'html' => ob_get_clean(),
        'nextOffset' => ($offset + $PER < count($all)) ? $offset + $PER : null,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 여기부터는 전체 페이지 렌더 — 사이드바 계산기 종수에만 TOOLS가 필요(AJAX 조각에서는 로드 안 함)
require_once __DIR__ . '/includes/tools-data.php';

$items = array_slice($all, 0, $PER);
$nextOffset = count($all) > $PER ? $PER : null;

// 사이드바: 카테고리별 건수
$secCounts = array_fill_keys(NEWS_SECTIONS, 0);
foreach ($everything as $a) {
    if (isset($secCounts[$a['section']])) $secCounts[$a['section']]++;
}

// 사이드바: 이 카테고리 많이 본 기사 1~5 (조회 기록 기준, 부족하면 최신 기사로 보충)
$popular = [];
try {
    $ids = array_map(fn($a) => (int) $a['id'], $all);
    if ($ids) {
        $in = implode(',', $ids);
        $byId = [];
        foreach ($all as $a) $byId[(int) $a['id']] = $a;
        $rows = goblog_db()->query(
            "SELECT articleId, COUNT(*) c FROM article_views WHERE articleId IN ($in) GROUP BY articleId ORDER BY c DESC LIMIT 5",
        )->fetchAll();
        foreach ($rows as $r) {
            if (isset($byId[(int) $r['articleId']])) $popular[] = $byId[(int) $r['articleId']];
        }
    }
} catch (Throwable) {
}
if (count($popular) < 5) {
    $have = array_map(fn($a) => (int) $a['id'], $popular);
    foreach ($all as $a) {
        if (count($popular) >= 5) break;
        if (!in_array((int) $a['id'], $have, true)) $popular[] = $a;
    }
}

$catDesc = CAT_DESCS[$cat] ?? '';
$base = '/category.php?cat=' . urlencode($cat);

render_head("$cat 기사 — HOM2BOX 뉴스", "$cat 분야 최신 기사 모음 — HOM2BOX 편집국 자체 기사.");
news_breadcrumb_ld([
    ['name' => '홈', 'url' => 'https://hom2box.com/'],
    ['name' => $cat],
]);
news_jsonld([
    '@context' => 'https://schema.org',
    '@type' => 'CollectionPage',
    'name' => "$cat 기사",
    'url' => 'https://hom2box.com/category.php?cat=' . urlencode($cat),
    'inLanguage' => 'ko',
    'isPartOf' => ['@type' => 'WebSite', 'name' => 'HOM2BOX 뉴스', 'url' => 'https://hom2box.com/'],
    'mainEntity' => [
        '@type' => 'ItemList',
        'numberOfItems' => count($items),
        'itemListElement' => array_map(fn($c, $i) => [
            '@type' => 'ListItem',
            'position' => $i + 1,
            'url' => 'https://hom2box.com/article.php?id=' . (int) $c['id'],
            'name' => $c['title'],
        ], $items, array_keys($items)),
    ],
]);
render_ticker(array_slice($all, 0, 6));
render_topbar();
render_masthead();
render_nav($cat, [], true);
render_section_subscribe($cat);

$sortOn = 'inline-flex cursor-pointer items-center whitespace-nowrap rounded-full border border-[#134a9c] bg-[#134a9c] px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm';
$sortOff = 'inline-flex cursor-pointer items-center whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-zinc-600 shadow-sm hover:border-[#134a9c] hover:text-[#134a9c]';

// 뷰 전환 토글(리스트/그리드) — 공통 베이스 + 상태 클래스(JS가 토글). sortOn/Off와 동일 룩.
$viewBase = 'h2b-vbtn inline-flex cursor-pointer items-center whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold shadow-sm transition-colors';
$viewOn = 'border-[#134a9c] bg-[#134a9c] text-white';
$viewOff = 'border-zinc-200 bg-white text-zinc-600';
?>
<style>
  /* 그리드형 뷰 — 같은 마크업을 CSS로 카드 그리드로 전환(ID 스코프로 Tailwind 임의값과 충돌 방지) */
  #h2b-artlist.h2b-view-grid{display:grid;grid-template-columns:repeat(1,minmax(0,1fr));gap:1.25rem;}
  @media (min-width:640px){#h2b-artlist.h2b-view-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
  @media (min-width:1024px){#h2b-artlist.h2b-view-grid{grid-template-columns:repeat(3,minmax(0,1fr));}}
  #h2b-artlist.h2b-view-grid .h2b-art{flex-direction:column;align-items:stretch;gap:0;padding:0;border:1px solid #e4e4e7;border-radius:.6rem;overflow:hidden;}
  #h2b-artlist.h2b-view-grid .h2b-art:hover{background:#fafafa;}
  #h2b-artlist.h2b-view-grid .h2b-art-thumb{width:100%!important;height:auto!important;aspect-ratio:16/9;border-radius:0;}
  #h2b-artlist.h2b-view-grid .h2b-art-body{padding:.85rem 1rem 1.05rem;}
  #h2b-artlist.h2b-view-grid .h2b-art-chev{display:none;}
</style>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-[1399px] px-4 sm:px-6">
    <div class="flex flex-col gap-3 border-b border-zinc-200 pt-8 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div class="mb-1.5 flex items-center gap-2.5"><span class="h-[18px] w-[3px] rounded-full bg-[#e0392b]"></span><h1 class="m-0 text-[24px] font-bold tracking-tight text-zinc-900 sm:text-[30px]"><?= nh($cat) ?></h1></div>
        <div class="mt-1.5 text-[13px] text-zinc-400"><?= nh($catDesc) ?> · 전체 <?= count($all) ?>건</div>
      </div>
      <div class="flex flex-wrap items-center gap-2 pb-1">
        <a href="<?= nh($base) ?>" class="<?= $sort === 'latest' ? $sortOn : $sortOff ?>">최신순</a>
        <a href="<?= nh($base . '&sort=name') ?>" class="<?= $sort === 'name' ? $sortOn : $sortOff ?>">가나다순</a>
        <div id="h2b-viewtoggle" class="flex gap-2 ml-1">
          <button type="button" data-view="list" title="리스트형" aria-label="리스트형으로 보기" class="<?= $viewBase . ' ' . $viewOn ?>"><span class="material-symbols-outlined text-[18px]">view_list</span></button>
          <button type="button" data-view="grid" title="그리드형" aria-label="그리드형으로 보기" class="<?= $viewBase . ' ' . $viewOff ?>"><span class="material-symbols-outlined text-[18px]">grid_view</span></button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-8 py-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
      <div>
        <?php render_ad('category-top'); ?>
        <?php if (!$items): ?>
          <div class="py-20 text-center text-zinc-400">아직 이 분야 기사가 없습니다.</div>
        <?php else: ?>
          <div id="h2b-artlist" class="h2b-view-list">
            <?php foreach ($items as $c) category_row($c); ?>
          </div>
          <div id="sentinel" class="h-10"></div>
          <div id="loadingMore" class="hidden py-6 text-center text-sm text-zinc-400">불러오는 중…</div>
          <script>
          (function(){
            var offset = <?= json_encode($nextOffset) ?>;
            var cat = <?= json_encode($cat) ?>;
            var sort = <?= json_encode($sort) ?>;
            var loading = false;
            var list = document.getElementById('h2b-artlist');
            var sentinel = document.getElementById('sentinel');
            var spinner = document.getElementById('loadingMore');
            function load(){
              if(loading || offset===null) return;
              loading = true; spinner.classList.remove('hidden');
              fetch('/category.php?ajax=1&cat='+encodeURIComponent(cat)+'&sort='+encodeURIComponent(sort)+'&offset='+offset)
                .then(function(r){return r.json();})
                .then(function(d){
                  list.insertAdjacentHTML('beforeend', d.html);
                  offset = d.nextOffset;
                  loading = false; spinner.classList.add('hidden');
                  if(offset===null && io){io.disconnect();}
                }).catch(function(){loading=false;spinner.classList.add('hidden');});
            }
            var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function(e){ if(e[0].isIntersecting) load(); }, {rootMargin:'400px'}) : null;
            if(io && offset!==null) io.observe(sentinel);
          })();
          </script>
        <?php endif; ?>
      </div>

      <aside class="flex flex-col gap-5 self-start lg:sticky lg:top-16">
        <div class="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div class="border-b border-zinc-100 px-4 pt-3.5 pb-2.5 text-[15.5px] font-extrabold">바로가기</div>
          <div class="flex flex-col p-2">
            <a href="/docs.php" class="group flex items-center gap-3 rounded-lg px-2.5 py-2.5 hover:bg-zinc-50"><span class="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#134a9c]/10 text-[#134a9c]"><span class="material-symbols-outlined text-[19px]">draft</span></span><span class="min-w-0 flex-1"><span class="block text-[13.5px] font-bold text-zinc-700 group-hover:text-[#134a9c]">문서 도구</span><span class="block text-[11.5px] text-zinc-400">각서·위임장 등 10종 서식</span></span><span class="material-symbols-outlined flex-none text-[18px] text-zinc-300 group-hover:text-[#134a9c]">chevron_right</span></a>
            <a href="/tools.php" class="group flex items-center gap-3 rounded-lg px-2.5 py-2.5 hover:bg-zinc-50"><span class="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#134a9c]/10 text-[#134a9c]"><span class="material-symbols-outlined text-[19px]">calculate</span></span><span class="min-w-0 flex-1"><span class="block text-[13.5px] font-bold text-zinc-700 group-hover:text-[#134a9c]">계산기</span><span class="block text-[11.5px] text-zinc-400">연봉·세금·대출 등 <?= count(TOOLS) ?>종</span></span><span class="material-symbols-outlined flex-none text-[18px] text-zinc-300 group-hover:text-[#134a9c]">chevron_right</span></a>
          </div>
        </div>

        <div class="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div class="border-b border-zinc-100 px-4 pt-3.5 pb-2.5 text-[15.5px] font-extrabold">카테고리</div>
          <div class="px-4 py-1.5">
            <?php foreach (NEWS_SECTIONS as $s): $on = $s === $cat; ?>
              <a href="/category.php?cat=<?= urlencode($s) ?>" class="flex w-full items-center justify-between border-b border-zinc-50 py-2.5 text-[13.5px] font-semibold last:border-0 <?= $on ? 'text-[#134a9c]' : 'text-zinc-700 hover:text-[#134a9c]' ?>">
                <span class="whitespace-nowrap"><?= nh($s) ?></span>
                <span class="whitespace-nowrap text-[12px] font-semibold text-zinc-400"><?= (int) ($secCounts[$s] ?? 0) ?>건</span>
              </a>
            <?php endforeach; ?>
          </div>
        </div>

        <?php if ($popular): ?>
        <div class="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div class="border-b border-zinc-100 px-4 pt-3.5 pb-2.5 text-[15.5px] font-extrabold"><?= nh($cat) ?> 많이 본 기사</div>
          <div class="px-4 py-1.5">
            <?php foreach ($popular as $i => $p): ?>
              <a href="/article.php?id=<?= (int) $p['id'] ?>" class="group flex items-baseline gap-3 border-b border-zinc-50 py-2.5 last:border-0">
                <span class="w-4 flex-none text-[15px] font-extrabold text-[#134a9c]"><?= $i + 1 ?></span>
                <span class="flex-1 text-[13px] font-semibold leading-normal group-hover:text-[#134a9c]"><?= nh($p['title']) ?></span>
              </a>
            <?php endforeach; ?>
          </div>
        </div>
        <?php endif; ?>

        <?php render_ad('home-sidebar'); ?>
      </aside>
    </div>
  </div>
  <?php render_footer(); ?>
</div>
<script>
(function(){
  var KEY = 'h2b_artview';
  var list = document.getElementById('h2b-artlist');
  var btns = document.querySelectorAll('#h2b-viewtoggle .h2b-vbtn');
  var ON = ['border-[#134a9c]','bg-[#134a9c]','text-white'];
  var OFF = ['border-zinc-200','bg-white','text-zinc-600'];
  function apply(v){
    v = (v === 'grid') ? 'grid' : 'list';
    if (list){
      list.classList.remove('h2b-view-list','h2b-view-grid');
      list.classList.add('h2b-view-' + v);
    }
    for (var i = 0; i < btns.length; i++){
      var on = btns[i].getAttribute('data-view') === v;
      var add = on ? ON : OFF, del = on ? OFF : ON;
      for (var j = 0; j < add.length; j++) btns[i].classList.add(add[j]);
      for (var k = 0; k < del.length; k++) btns[i].classList.remove(del[k]);
    }
  }
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch(e){}
  apply(saved || 'list');
  for (var i = 0; i < btns.length; i++){
    btns[i].addEventListener('click', function(){
      var v = this.getAttribute('data-view');
      try { localStorage.setItem(KEY, v); } catch(e){}
      apply(v);
    });
  }
})();
</script>
<?php render_foot();
