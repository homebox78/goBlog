<?php
// 계산기·도구 허브 — 카테고리별 그룹
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';
require_once __DIR__ . '/includes/tools-data.php';

$ticker = [];
try { $ticker = array_slice(news_articles(), 0, 6); } catch (Throwable) {}
$P = NEWS_PRIMARY;

// 카테고리별 그룹화 (정의 순서 유지)
$groups = [];
foreach (TOOLS as $id => $t) {
    $groups[$t['category'] ?? '기타'][$id] = $t;
}
$catOrder = ['급여·노무', '금융·부동산', '크리에이터 수익', '생활·건강'];
uksort($groups, function ($a, $b) use ($catOrder) {
    $ia = array_search($a, $catOrder, true);
    $ib = array_search($b, $catOrder, true);
    return ($ia === false ? 99 : $ia) <=> ($ib === false ? 99 : $ib);
});

render_head('실용 계산기 모음 — HOM2BOX 뉴스', '연봉 실수령액·4대보험·퇴직금·대출·양도세·유튜브/애드센스 수익 등 자주 쓰는 계산기 ' . count(TOOLS) . '종을 무료로 제공합니다.');
news_breadcrumb_ld([
    ['name' => '홈', 'url' => 'https://hom2box.com/'],
    ['name' => '계산기'],
]);
$toolIds = array_keys(TOOLS);
news_jsonld([
    '@context' => 'https://schema.org',
    '@type' => 'CollectionPage',
    'name' => '실용 계산기 모음',
    'url' => 'https://hom2box.com/tools.php',
    'inLanguage' => 'ko',
    'isPartOf' => ['@type' => 'WebSite', 'name' => 'HOM2BOX 뉴스', 'url' => 'https://hom2box.com/'],
    'mainEntity' => [
        '@type' => 'ItemList',
        'numberOfItems' => count($toolIds),
        'itemListElement' => array_map(fn($id, $i) => [
            '@type' => 'ListItem',
            'position' => $i + 1,
            'url' => 'https://hom2box.com/tool.php?id=' . urlencode((string) $id),
            'name' => TOOLS[$id]['name'],
        ], $toolIds, array_keys($toolIds)),
    ],
]);
render_ticker($ticker);
render_topbar();
render_masthead();
render_nav('계산기', [], true);
?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-[1399px] px-6 py-9">
    <div class="border-b-2 border-zinc-900 pb-4 mb-7">
      <h1 class="text-[26px] font-extrabold">실용 계산기 모음</h1>
      <p class="mt-1.5 text-sm text-zinc-500">급여·세금·부동산·크리에이터 수익까지 자주 쓰는 계산기 <b class="text-[<?= $P ?>]"><?= count(TOOLS) ?>종</b>. 설치 없이 바로 사용하세요.</p>
    </div>

    <?php foreach ($groups as $cat => $tools): ?>
      <section class="mb-9">
        <h2 class="text-[19px] font-extrabold text-[<?= $P ?>] border-b border-zinc-200 pb-2 mb-4"><?= nh($cat) ?></h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <?php foreach ($tools as $id => $t): ?>
            <a href="/tool.php?id=<?= nh($id) ?>" class="group rounded-xl border border-zinc-200 bg-white shadow-sm p-4 hover:shadow-md hover:border-[<?= $P ?>] transition-all">
              <div class="flex items-center gap-3 mb-1.5">
                <span class="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[<?= $P ?>]/10 text-[<?= $P ?>]"><span class="material-symbols-outlined text-[22px]"><?= nh($t['icon']) ?></span></span>
                <div class="text-[16px] font-extrabold group-hover:text-[<?= $P ?>]"><?= nh($t['name']) ?></div>
              </div>
              <p class="text-[13px] text-zinc-500 leading-relaxed line-clamp-2"><?= nh($t['desc']) ?></p>
            </a>
          <?php endforeach; ?>
        </div>
      </section>
    <?php endforeach; ?>
  </div>
  <?php render_footer(); ?>
</div>
<?php render_foot();
