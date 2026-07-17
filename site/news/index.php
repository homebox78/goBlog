<?php
// HOM2BOX 뉴스 — 자체 신문사 홈 (디자인 개편: Tailwind + 속보 티커 + 사이드바 + 언론사 헤드라인).
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/press-rss.php';
require_once __DIR__ . '/includes/layout.php';
require_once __DIR__ . '/includes/tools-data.php';

$articles = [];
try {
    $articles = news_articles();
} catch (Throwable $e) {
}

// 한 기사는 페이지 전체에서 한 번만 노출 (헤드라인 → 서브리드 → 주요기사 → 섹션 그리드)
$used = [];
$withImage = array_values(array_filter($articles, fn($a) => !empty($a['image'])));
$headline = $withImage[0] ?? ($articles[0] ?? null);
if ($headline) $used[$headline['id']] = true;

$subLeads = [];
foreach ($articles as $a) {
    if (isset($used[$a['id']])) continue;
    $subLeads[] = $a;
    $used[$a['id']] = true;
    if (count($subLeads) >= 6) break;
}
// '헤드라인 더보기' 접힘 목록(시안) — 추가 6건
$moreLeads = [];
foreach ($articles as $a) {
    if (isset($used[$a['id']])) continue;
    $moreLeads[] = $a;
    $used[$a['id']] = true;
    if (count($moreLeads) >= 6) break;
}

// 섹션별 카테고리 배지 색(시안)
$SECTION_BADGE = [
    '경제·금융' => 'bg-blue-50 text-blue-700',
    'IT·게임' => 'bg-violet-50 text-violet-700',
    '생활·건강' => 'bg-emerald-50 text-emerald-700',
    '여행·문화' => 'bg-amber-50 text-amber-700',
    '종합' => 'bg-zinc-100 text-zinc-600',
];

$byQuality = $articles;
usort($byQuality, fn($a, $b) => ($b['quality'] <=> $a['quality']) ?: strcmp($b['publishedAt'], $a['publishedAt']));
$ranked = [];
foreach ($byQuality as $a) {
    if (isset($used[$a['id']])) continue;
    $ranked[] = $a;
    $used[$a['id']] = true;
    if (count($ranked) >= 10) break;
}

$bySection = [];
foreach ($articles as $a) {
    if (isset($used[$a['id']])) continue;
    $bySection[$a['section']][] = $a;
}

// 속보 티커 — 최신 기사 제목 6개
$ticker = array_slice($articles, 0, 6);

// 사이드바 파트너스 추천 — 트래킹 링크 있는 상품 1건(최근 매칭)
$partner = null;
try {
    $st = goblog_db()->query(
        "SELECT name, imageUrl, productUrl, source FROM products
         WHERE status<>'DISABLED' AND (productUrl LIKE '%link.coupang.com%' OR productUrl LIKE '%coupa.ng%' OR productUrl LIKE '%naver.me%')
         ORDER BY matchedAt DESC, id DESC LIMIT 1",
    );
    $partner = $st->fetch() ?: null;
} catch (Throwable) {
}

$press = [];
try {
    $press = press_headlines(5);
} catch (Throwable) {
}

$P = '#134a9c';
render_head('HOM2BOX 뉴스 — 오늘의 이슈·경제·IT·생활', '매일 아침·저녁 발행하는 이슈·경제·IT·생활 뉴스와 가이드. HOM2BOX 편집국 자체 기사.');
?>
<script type="application/ld+json"><?= json_encode([
    '@context' => 'https://schema.org',
    '@graph' => [
        [
            '@type' => 'NewsMediaOrganization',
            '@id' => 'https://hom2box.com/#org',
            'name' => 'HOM2BOX 뉴스',
            'url' => 'https://hom2box.com/',
            'logo' => ['@type' => 'ImageObject', 'url' => 'https://hom2box.com/favicon/favicon-32.png'],
        ],
        [
            '@type' => 'WebSite',
            '@id' => 'https://hom2box.com/#website',
            'url' => 'https://hom2box.com/',
            'name' => 'HOM2BOX 뉴스',
            'publisher' => ['@id' => 'https://hom2box.com/#org'],
            'inLanguage' => 'ko',
            'potentialAction' => [
                '@type' => 'SearchAction',
                'target' => ['@type' => 'EntryPoint', 'urlTemplate' => 'https://hom2box.com/search.php?q={search_term_string}'],
                'query-input' => 'required name=search_term_string',
            ],
        ],
    ],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?></script>
<div class="min-h-screen bg-white">
  <?php render_ticker($ticker); ?>
  <?php render_topbar(); ?>
  <?php render_masthead(); ?>
  <?php render_nav('홈', $bySection, !empty($press)); ?>

  <div class="mx-auto max-w-[1399px] px-6">
    <h1 class="sr-only">HOM2BOX 뉴스 — 매일 아침·저녁 발행하는 이슈·경제·IT·생활 뉴스</h1>
    <?php render_ad("home-top"); ?>

    <?php if (!$articles): ?>
      <div class="py-24 text-center text-zinc-400">아직 발행된 기사가 없습니다.</div>
    <?php else: ?>

    <!-- 헤드라인 -->
    <div class="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-9 py-6 border-b-2 border-zinc-900">
      <a href="/article.php?id=<?= (int) $headline['id'] ?>" class="block group">
        <?php if (!empty($headline['image'])): ?>
          <div class="w-full aspect-video rounded-lg overflow-hidden bg-zinc-100"><img src="<?= nh($headline['image']) ?>" alt="" class="w-full h-full object-cover"></div>
        <?php endif; ?>
        <h2 class="mt-4 mb-2 text-[27px] font-extrabold leading-snug tracking-tight group-hover:text-[<?= $P ?>]"><?= nh($headline['title']) ?></h2>
        <?php if (!empty($headline['excerpt'])): ?><p class="mb-2 text-sm leading-relaxed text-zinc-500 line-clamp-2"><?= nh($headline['excerpt']) ?></p><?php endif; ?>
        <div class="flex items-center gap-2 text-xs text-zinc-400"><span class="inline-flex items-center rounded-md bg-[<?= $P ?>] px-2 py-0.5 text-[10.5px] font-bold text-white">자체기사</span> <?= nh($headline['section']) ?> · <?= nh(news_date($headline['publishedAt'])) ?></div>
      </a>
      <div class="flex flex-col pb-2">
        <?php foreach ($subLeads as $h): ?>
          <a href="/article.php?id=<?= (int) $h['id'] ?>" class="flex gap-3.5 items-center py-3 border-b border-zinc-100 group">
            <div class="flex-1 text-[15px] font-bold leading-normal group-hover:text-[<?= $P ?>]"><?= nh($h['title']) ?></div>
            <?php if (!empty($h['image'])): ?><div class="w-[88px] h-[60px] rounded-md flex-none bg-cover bg-center bg-zinc-100" style="background-image:url('<?= nh($h['image']) ?>')"></div><?php endif; ?>
          </a>
        <?php endforeach; ?>
        <?php if ($moreLeads): ?>
          <div id="h2b-more-leads" class="hidden flex-col">
            <?php foreach ($moreLeads as $h): ?>
              <a href="/article.php?id=<?= (int) $h['id'] ?>" class="flex gap-3.5 items-center py-3 border-b border-zinc-100 group">
                <div class="flex-1 text-[15px] font-bold leading-normal group-hover:text-[<?= $P ?>]"><?= nh($h['title']) ?></div>
                <?php if (!empty($h['image'])): ?><div class="w-[88px] h-[60px] rounded-md flex-none bg-cover bg-center bg-zinc-100" style="background-image:url('<?= nh($h['image']) ?>')"></div><?php endif; ?>
              </a>
            <?php endforeach; ?>
          </div>
          <button type="button" onclick="var m=document.getElementById('h2b-more-leads');var open=m.classList.toggle('hidden');m.classList.toggle('flex',open===false);this.querySelector('span:last-child').textContent=open?'expand_more':'expand_less';this.querySelector('b').textContent=open?'헤드라인 더보기':'접기';"
                  class="mt-3 inline-flex items-center justify-center gap-1 self-center rounded-full border border-zinc-200 px-4 py-1.5 text-[12.5px] font-bold text-zinc-500 hover:border-[<?= $P ?>] hover:text-[<?= $P ?>]">
            <b>헤드라인 더보기</b><span class="material-symbols-outlined text-[16px]">expand_more</span>
          </button>
        <?php endif; ?>
      </div>
    </div>

    <!-- 문서도구·계산기 프로모 카드 (시안) -->
    <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <a href="/docs.php" class="group flex items-center gap-3.5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md hover:border-[<?= $P ?>]/40">
        <span class="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-[<?= $P ?>]/10 text-[<?= $P ?>]"><span class="material-symbols-outlined text-[24px]">draft</span></span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-1.5 text-[14.5px] font-extrabold group-hover:text-[<?= $P ?>]">문서 도구<span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10.5px] font-bold text-zinc-500">10종</span></span>
          <span class="mt-0.5 block text-[12px] leading-snug text-zinc-500">각서 위임장 등 10종 서식 바로 작성</span>
        </span>
        <span class="material-symbols-outlined flex-none text-[18px] text-zinc-300 group-hover:text-[<?= $P ?>]">chevron_right</span>
      </a>
      <a href="/tools.php" class="group flex items-center gap-3.5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md hover:border-[<?= $P ?>]/40">
        <span class="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-[<?= $P ?>]/10 text-[<?= $P ?>]"><span class="material-symbols-outlined text-[24px]">calculate</span></span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-1.5 text-[14.5px] font-extrabold group-hover:text-[<?= $P ?>]">계산기<span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10.5px] font-bold text-zinc-500"><?= count(TOOLS) ?>종</span></span>
          <span class="mt-0.5 block text-[12px] leading-snug text-zinc-500">연봉 세금 대출 등 <?= count(TOOLS) ?>종 바로 계산</span>
        </span>
        <span class="material-symbols-outlined flex-none text-[18px] text-zinc-300 group-hover:text-[<?= $P ?>]">chevron_right</span>
      </a>
    </div>

    <!-- 계산기 도구 — 그룹별 가로 마퀴 -->
    <?php
    $toolGroups = [];
    foreach (TOOLS as $tid => $tt) { $toolGroups[$tt['category'] ?? '기타'][$tid] = $tt; }
    $catOrder = ['급여·노무', '세금', '금융·부동산', '크리에이터 수익', '생활·건강'];
    uksort($toolGroups, function ($a, $b) use ($catOrder) {
        $ia = array_search($a, $catOrder, true);
        $ib = array_search($b, $catOrder, true);
        return ($ia === false ? 99 : $ia) <=> ($ib === false ? 99 : $ib);
    });
    $renderMq = function () use ($toolGroups, $P) {
        foreach ($toolGroups as $cat => $tools): ?>
          <span class="mx-3 inline-flex items-center gap-1 rounded-md bg-[<?= $P ?>]/10 px-2.5 py-1 text-[12px] font-extrabold text-[<?= $P ?>] whitespace-nowrap"><?= nh($cat) ?></span>
          <?php foreach ($tools as $tid => $tt): ?>
            <a href="/tool.php?id=<?= nh($tid) ?>" class="mx-1 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-bold text-zinc-700 hover:border-[<?= $P ?>] hover:text-[<?= $P ?>] whitespace-nowrap">
              <span class="material-symbols-outlined text-[16px] text-[<?= $P ?>]"><?= nh($tt['icon']) ?></span><?= nh(str_replace([' 계산기', ' ↔ ㎡ 변환기'], ['', ' 변환'], $tt['name'])) ?>
            </a>
          <?php endforeach;
        endforeach;
    };
    ?>
    <div class="mt-6 rounded-xl border border-zinc-200 bg-gradient-to-r from-[<?= $P ?>]/[0.04] to-[#0a8f5b]/[0.04] py-3">
      <div class="flex items-center gap-2 px-4 mb-2.5">
        <span class="h-[17px] w-[3px] rounded-full bg-[#e0392b]"></span>
        <span class="material-symbols-outlined text-[20px] text-[<?= $P ?>]">calculate</span>
        <span class="text-[16px] font-bold tracking-tight">자주 쓰는 계산기 <span class="text-xs font-medium text-zinc-400"><?= count(TOOLS) ?>종</span></span>
        <a href="/tools.php" class="ml-auto text-xs text-zinc-400 hover:text-[<?= $P ?>] inline-flex items-center">전체보기<span class="material-symbols-outlined text-[14px]">chevron_right</span></a>
      </div>
      <div class="overflow-hidden">
        <div class="h2b-mq py-0.5">
          <span class="inline-flex items-center"><?php $renderMq(); ?></span>
          <span class="inline-flex items-center" aria-hidden="true"><?php $renderMq(); ?></span>
        </div>
      </div>
    </div>

    <!-- 정부 지원금·복지 최근 소식 -->
    <?php $welfare = welfare_recent(4); if ($welfare): ?>
    <div class="mt-6">
      <div class="flex items-center gap-2 mb-3">
        <span class="h-[17px] w-[3px] rounded-full bg-[#e0392b]"></span>
        <span class="material-symbols-outlined text-[20px] text-[#0a8f5b]">volunteer_activism</span>
        <span class="text-[16px] font-bold tracking-tight">정부 지원금·복지 소식</span>
        <div class="ml-auto flex items-center gap-1.5">
          <button type="button" onclick="document.getElementById('h2b-wf').scrollBy({left:-320,behavior:'smooth'})" class="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 text-zinc-400 hover:border-[#0a8f5b] hover:text-[#0a8f5b]"><span class="material-symbols-outlined text-[16px]">chevron_left</span></button>
          <button type="button" onclick="document.getElementById('h2b-wf').scrollBy({left:320,behavior:'smooth'})" class="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 text-zinc-400 hover:border-[#0a8f5b] hover:text-[#0a8f5b]"><span class="material-symbols-outlined text-[16px]">chevron_right</span></button>
          <a href="/welfare.php" class="ml-1 text-xs text-zinc-400 hover:text-[#0a8f5b] inline-flex items-center">전체보기<span class="material-symbols-outlined text-[14px]">chevron_right</span></a>
        </div>
      </div>
      <div id="h2b-wf" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <?php foreach ($welfare as $w):
          $wlink = !empty($w['detailLink']) ? $w['detailLink'] : '/welfare.php';
          $wext = !empty($w['detailLink']); ?>
          <a href="<?= nh($wlink) ?>"<?= $wext ? ' target="_blank" rel="noopener"' : '' ?> class="block rounded-lg border border-zinc-200 bg-white p-3.5 shadow-sm hover:shadow-md hover:border-[#0a8f5b] transition-all group">
            <div class="mb-1.5 flex items-center gap-1.5">
              <span class="inline-flex items-center rounded bg-[#0a8f5b]/10 px-1.5 py-0.5 text-[10.5px] font-bold text-[#0a8f5b]"><?= $w['source'] === 'CENTRAL' ? '중앙부처' : '지자체' ?></span>
              <?php if (!empty($w['lifeCycle'])): ?><span class="text-[10.5px] text-zinc-400"><?= nh($w['lifeCycle']) ?></span><?php endif; ?>
            </div>
            <div class="text-[14px] font-bold leading-snug text-zinc-900 group-hover:text-[#0a8f5b] line-clamp-2"><?= nh($w['name']) ?></div>
            <?php if (!empty($w['summary'])): ?><div class="mt-1.5 text-[12px] leading-relaxed text-zinc-500 line-clamp-2"><?= nh($w['summary']) ?></div><?php endif; ?>
            <?php if (!empty($w['dept'])): ?><div class="mt-2 text-[11px] text-zinc-400 truncate"><?= nh($w['dept']) ?></div><?php endif; ?>
          </a>
        <?php endforeach; ?>
      </div>
    </div>
    <?php endif; ?>

    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-9 pt-7 pb-2">
      <!-- 분야별 섹션 -->
      <div>
        <?php foreach (NEWS_SECTIONS as $s): $list = $bySection[$s] ?? []; if (!$list) continue; ?>
          <div id="sec-<?= nh(preg_replace('/[^0-9a-z가-힣]/u', '', $s)) ?>" class="mb-9">
            <div class="flex items-center gap-2.5 border-b border-zinc-200 pb-2.5 mb-5">
              <span class="h-[17px] w-[3px] rounded-full bg-[#e0392b]"></span>
              <span class="text-[18px] font-bold tracking-tight text-zinc-900"><?= nh($s) ?></span>
              <a href="/category.php?cat=<?= urlencode($s) ?>" class="ml-auto inline-flex items-center gap-0.5 text-xs text-zinc-400 hover:text-[<?= $P ?>]">더보기<span class="material-symbols-outlined text-[14px]">chevron_right</span></a>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              <?php foreach (array_slice($list, 0, 6) as $c): $bcls = $SECTION_BADGE[$s] ?? 'bg-zinc-100 text-zinc-600'; ?>
                <a href="/article.php?id=<?= (int) $c['id'] ?>" class="block group rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <?php if (!empty($c['image'])): ?><div class="w-full aspect-[16/10] bg-cover bg-center bg-zinc-100" style="background-image:url('<?= nh($c['image']) ?>')"></div><?php endif; ?>
                  <div class="p-3.5">
                    <span class="inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-bold <?= $bcls ?>"><?= nh($s) ?></span>
                    <div class="mt-1.5 text-[15.5px] font-bold leading-normal group-hover:text-[<?= $P ?>]"><?= nh($c['title']) ?></div>
                    <?php if (!empty($c['excerpt'])): ?><div class="mt-1.5 text-xs leading-relaxed text-zinc-500 line-clamp-2"><?= nh($c['excerpt']) ?></div><?php endif; ?>
                    <div class="mt-2 text-[11.5px] text-zinc-400"><?= nh(news_date($c['publishedAt'])) ?></div>
                  </div>
                </a>
              <?php endforeach; ?>
            </div>
          </div>
        <?php endforeach; ?>
        <?php render_ad("home-infeed"); ?>
      </div>

      <!-- 사이드바 -->
      <div class="flex flex-col gap-5 self-start lg:sticky lg:top-16">
        <div class="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div class="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-zinc-100">
            <span class="h-[15px] w-[3px] rounded-full bg-[#b3925c]"></span>
            <span class="text-[15.5px] font-extrabold">주요 기사</span>
            <span class="ml-auto inline-flex items-center gap-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-[#b3925c]"><span class="material-symbols-outlined text-[13px]">trending_up</span>Trending</span>
          </div>
          <div class="px-4 py-1.5">
            <?php foreach ($ranked as $i => $r): ?>
              <a href="/article.php?id=<?= (int) $r['id'] ?>" class="flex gap-3 items-baseline py-2 border-b border-zinc-50 last:border-0 group">
                <span class="w-4 flex-none text-[15px] font-extrabold text-[#b3925c]"><?= $i + 1 ?></span>
                <span class="flex-1 text-[13.5px] font-semibold leading-normal group-hover:text-[<?= $P ?>]"><?= nh($r['title']) ?></span>
              </a>
            <?php endforeach; ?>
          </div>
        </div>

        <?php render_ad("home-sidebar"); ?>

        <a href="/welfare.php" class="block rounded-lg border border-[#0a8f5b] bg-[#0a8f5b] p-4 text-white transition-colors hover:bg-[#087a4d]">
          <div class="flex items-center gap-2 text-[15px] font-extrabold"><span class="material-symbols-outlined text-[20px]">payments</span>정부 지원금 찾기</div>
          <div class="mt-1.5 text-[12.5px] leading-relaxed text-white/85">생애주기·지역별 신청 가능한 정부·지자체 지원금을 한 번에.</div>
          <div class="mt-3 inline-flex items-center gap-1 rounded-md bg-white px-3 py-1.5 text-[13px] font-bold text-[#0a8f5b]">지원금 보기 <span class="material-symbols-outlined text-[16px]">arrow_forward</span></div>
        </a>

        <?php if ($partner): ?>
        <a href="<?= nh($partner['productUrl']) ?>" target="_blank" rel="sponsored nofollow noopener" class="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
          <div class="flex justify-between items-center mb-2.5"><span class="text-[13px] font-extrabold text-[<?= $P ?>]">파트너스 추천</span><span class="inline-flex items-center rounded border border-zinc-200 px-1.5 text-[10.5px] text-zinc-400">AD</span></div>
          <?php if (!empty($partner['imageUrl'])): ?><div class="w-full h-32 rounded-md bg-white flex items-center justify-center overflow-hidden"><img src="<?= nh($partner['imageUrl']) ?>" alt="" referrerpolicy="no-referrer" class="h-full object-contain"></div><?php endif; ?>
          <div class="mt-2.5 text-sm font-bold leading-normal line-clamp-2"><?= nh($partner['name']) ?></div>
          <div class="mt-1.5 flex items-center gap-1 text-[11px] text-zinc-400"><span class="material-symbols-outlined text-[13px]">info</span>구매 시 운영자가 수수료를 제공받을 수 있습니다</div>
        </a>
        <?php endif; ?>

        <!-- 자주 묻는 질문 (시안) -->
        <div class="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div class="flex items-center gap-2 border-b border-zinc-100 px-4 pt-3.5 pb-2.5">
            <span class="material-symbols-outlined text-[18px] text-[<?= $P ?>]">quiz</span>
            <span class="text-[15px] font-extrabold">자주 묻는 질문</span>
          </div>
          <div class="divide-y divide-zinc-50 px-1.5 py-1">
            <?php $homeFaq = [
                ['기사는 얼마나 자주 발행되나요?', '매일 아침·저녁 2회, 편집국이 이슈·경제·IT·생활 분야 기사를 선별해 발행합니다.'],
                ['뉴스레터는 무엇인가요?', '분야별 핵심 기사 5건씩을 매일 오전 7시·오후 6시에 메일로 보내드리는 무료 서비스입니다.'],
                ['계산기·지원금 정보는 무료인가요?', '네. 계산기 ' . count(TOOLS) . '종과 정부 지원금 검색, 문서도구 모두 로그인 없이 무료로 사용할 수 있습니다.'],
                ['제휴 링크는 무엇인가요?', '일부 기사에는 제휴 링크가 포함되며, 이를 통해 구매 시 운영자가 일정 수수료를 제공받을 수 있습니다.'],
            ]; foreach ($homeFaq as $f): ?>
              <details class="group px-2.5">
                <summary class="flex cursor-pointer list-none items-center gap-2 py-2.5 text-[13px] font-bold">
                  <span class="text-[<?= $P ?>]">Q</span><span class="min-w-0 flex-1"><?= nh($f[0]) ?></span>
                  <span class="material-symbols-outlined text-[18px] text-zinc-400 transition-transform group-open:rotate-180">expand_more</span>
                </summary>
                <div class="pb-3 pl-6 text-[12.5px] leading-relaxed text-zinc-500"><?= nh($f[1]) ?></div>
              </details>
            <?php endforeach; ?>
          </div>
        </div>

        <a href="/subscribe.php" class="block rounded-lg border border-[<?= $P ?>] bg-[<?= $P ?>] p-4 text-white transition-colors hover:bg-[#0f3d82]">
          <div class="flex items-center gap-2 text-[15px] font-extrabold"><span class="material-symbols-outlined text-[20px]">mail</span>무료 뉴스레터 구독</div>
          <div class="mt-1.5 text-[12.5px] leading-relaxed text-white/80">매일 아침·저녁, 분야별 핵심 기사를 메일함에서 받아보세요.</div>
          <div class="mt-3 inline-flex items-center gap-1 rounded-md bg-white px-3 py-1.5 text-[13px] font-bold text-[<?= $P ?>]">구독하기 <span class="material-symbols-outlined text-[16px]">arrow_forward</span></div>
        </a>
      </div>
    </div>
    <?php endif; ?>

    <!-- 언론사 헤드라인 -->
    <?php if ($press): ?>
    <div id="sec-yna" class="border-t border-zinc-200 pt-5 pb-2 mb-5">
      <div class="mb-5 flex flex-wrap items-center gap-3">
        <span class="h-[17px] w-[3px] rounded-full bg-[#e0392b]"></span>
        <span class="text-[18px] font-bold tracking-tight">언론사 헤드라인</span>
        <a href="/press.php" class="text-xs text-zinc-400 hover:text-[<?= $P ?>] inline-flex items-center">전체보기<span class="material-symbols-outlined text-[14px]">chevron_right</span></a>
        <div class="ml-auto flex flex-nowrap gap-2 overflow-x-auto max-w-full">
          <?php $first = true; foreach ($press as $key => $tab): ?>
            <button type="button" data-ptab="<?= nh($key) ?>" class="ptab shrink-0 rounded-full border px-3 py-1 text-[13px] font-bold <?= $first ? 'on border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 text-zinc-500' ?>"><?= nh($tab['label']) ?></button>
          <?php $first = false; endforeach; ?>
        </div>
      </div>
      <?php $first = true; foreach ($press as $key => $tab): ?>
        <div class="press-panel flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 -mx-6 px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0" id="press-<?= nh($key) ?>" <?= $first ? '' : 'style="display:none"' ?>>
          <?php foreach ($tab['boxes'] as $boxLabel => $links): ?>
            <div class="w-[80%] shrink-0 snap-start sm:w-[46%] lg:w-auto lg:min-w-0 rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div class="px-4 py-2.5 text-sm font-extrabold text-[<?= $P ?>] bg-zinc-50 border-b-2 border-[<?= $P ?>]"><?= nh((string) $boxLabel) ?></div>
              <div class="px-4 py-1.5">
                <?php foreach ($links as $l): ?>
                  <a href="<?= nh($l['link']) ?>" target="_blank" rel="noopener nofollow" title="<?= nh($l['title']) ?>" class="block truncate py-1.5 text-[13px] leading-normal border-b border-zinc-50 last:border-0 hover:text-[<?= $P ?>]"><?= nh($l['title']) ?></a>
                <?php endforeach; ?>
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      <?php $first = false; endforeach; ?>
    </div>
    <script>
    document.querySelectorAll('.ptab').forEach(function(b){b.addEventListener('click',function(){
      document.querySelectorAll('.ptab').forEach(function(x){x.classList.remove('on','border-zinc-900','bg-zinc-900','text-white');x.classList.add('border-zinc-200','text-zinc-500');});
      document.querySelectorAll('.press-panel').forEach(function(p){p.style.display='none';});
      b.classList.add('on','border-zinc-900','bg-zinc-900','text-white');b.classList.remove('border-zinc-200','text-zinc-500');
      var el=document.getElementById('press-'+b.dataset.ptab); if(el) el.style.display='';
    });});
    </script>
    <?php endif; ?>
  </div>

  <?php render_footer(); ?>
</div>
<?php render_foot(); ?>
