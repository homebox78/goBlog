<?php
// 계산기·도구 허브 — 시안 개편: 히어로 밴드 + 빨강 세로바 섹션 헤더 + 2/3열 카드 그리드 + 구독 CTA.
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';
require_once __DIR__ . '/includes/tools-data.php';

$ticker = [];
try { $ticker = array_slice(news_articles(), 0, 6); } catch (Throwable) {}

// 카테고리별 그룹화 (정의 순서 유지)
$groups = [];
foreach (TOOLS as $id => $t) {
    $groups[$t['category'] ?? '기타'][$id] = $t;
}
$catOrder = ['급여·노무', '세금', '금융·부동산', '크리에이터 수익', '생활·건강'];
uksort($groups, function ($a, $b) use ($catOrder) {
    $ia = array_search($a, $catOrder, true);
    $ib = array_search($b, $catOrder, true);
    return ($ia === false ? 99 : $ia) <=> ($ib === false ? 99 : $ib);
});

render_head('실용 계산기 모음 — HOM2BOX 핫이슈', '연봉 실수령액·4대보험·퇴직금·대출·양도세·유튜브/애드센스 수익 등 자주 쓰는 계산기 ' . count(TOOLS) . '종을 무료로 제공합니다.');
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
    'isPartOf' => ['@type' => 'WebSite', 'name' => 'HOM2BOX 핫이슈', 'url' => 'https://hom2box.com/'],
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
  <?php render_util_hero('CALCULATOR', '실용 계산기 모음', '급여·세금·부동산·크리에이터 수익까지 자주 쓰는 계산기 ' . count(TOOLS) . '종. 설치 없이 바로 사용하세요.', ['연봉실수령액', '4대보험', '퇴직금', '대출이자', '부동산세금'], '/assets/hero/tools.jpg'); ?>

  <div class="mx-auto max-w-[1399px] px-4 sm:px-6 py-9">
    <?php foreach ($groups as $cat => $tools): ?>
      <div class="mb-4 mt-10 first:mt-0 flex items-center gap-2.5 border-b border-zinc-200 pb-2.5">
        <span class="h-[17px] w-[3px] rounded-full bg-[#e0392b]"></span>
        <span class="text-[18px] font-bold tracking-tight"><?= nh($cat) ?></span>
        <span class="text-[12px] font-medium text-zinc-400"><?= count($tools) ?>개</span>
      </div>
      <div class="grid grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-4">
        <?php foreach ($tools as $id => $t): ?>
          <a href="/tool.php?id=<?= nh((string) $id) ?>" class="group flex flex-col rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-shadow hover:border-[#134a9c]/40 hover:shadow-md sm:p-6">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-[#134a9c]/10 text-[#134a9c] sm:h-11 sm:w-11"><span class="material-symbols-outlined text-[22px] sm:text-[24px]"><?= nh($t['icon']) ?></span></div>
              <div class="min-w-0 flex-1 text-[13.5px] font-bold leading-snug group-hover:text-[#134a9c] sm:text-[17px] sm:font-extrabold"><?= nh($t['name']) ?></div>
            </div>
            <div class="mt-2.5 text-[12.5px] leading-relaxed text-zinc-500 sm:text-[13px]"><?= nh($t['desc']) ?></div>
          </a>
        <?php endforeach; ?>
      </div>
    <?php endforeach; ?>


    <?php render_ad('home-infeed'); ?>
    <?php adsense_display(); ?>
  </div>
  <?php render_footer(); ?>
</div>
<?php render_foot();
