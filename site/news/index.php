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
<div class="min-h-screen bg-white">
  <?php render_ticker($ticker); ?>
  <?php render_topbar(); ?>
  <?php render_masthead(); ?>
  <?php render_nav('홈', $bySection, !empty($press)); ?>

  <div class="mx-auto max-w-[1399px] px-6">
    <!-- adsense-slot: 상단 970x90 -->

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
      </div>
    </div>

    <!-- 계산기 도구 배너 -->
    <div class="mt-6 rounded-xl border border-zinc-200 bg-gradient-to-r from-[<?= $P ?>]/[0.04] to-[#0a8f5b]/[0.04] p-4">
      <div class="flex items-center gap-2 mb-3">
        <span class="material-symbols-outlined text-[20px] text-[<?= $P ?>]">calculate</span>
        <span class="text-[15px] font-extrabold">자주 쓰는 계산기</span>
        <a href="/tools.php" class="ml-auto text-xs text-zinc-400 hover:text-[<?= $P ?>] inline-flex items-center">전체보기<span class="material-symbols-outlined text-[14px]">chevron_right</span></a>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <?php foreach (TOOLS as $tid => $tt): ?>
          <a href="/tool.php?id=<?= nh($tid) ?>" class="flex flex-col items-center gap-1.5 rounded-lg border border-zinc-200 bg-white py-3 hover:border-[<?= $P ?>] hover:shadow-sm transition-all group">
            <span class="material-symbols-outlined text-[24px] text-[<?= $P ?>]"><?= nh($tt['icon']) ?></span>
            <span class="text-[12px] font-bold text-zinc-700 group-hover:text-[<?= $P ?>] text-center px-1 leading-tight"><?= nh(str_replace([' 계산기', ' ↔ ㎡ 변환기'], ['', ' 변환'], $tt['name'])) ?></span>
          </a>
        <?php endforeach; ?>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-9 pt-7 pb-2">
      <!-- 분야별 섹션 -->
      <div>
        <?php foreach (NEWS_SECTIONS as $s): $list = $bySection[$s] ?? []; if (!$list) continue; ?>
          <div id="sec-<?= nh(preg_replace('/[^0-9a-z가-힣]/u', '', $s)) ?>" class="mb-9">
            <div class="flex justify-between items-baseline border-b-2 border-zinc-900 pb-2.5 mb-5">
              <span class="text-[19px] font-extrabold text-[<?= $P ?>]"><?= nh($s) ?></span>
              <a href="/category.php?cat=<?= urlencode($s) ?>" class="inline-flex items-center gap-0.5 text-xs text-zinc-400 hover:text-[<?= $P ?>]">더보기<span class="material-symbols-outlined text-[14px]">chevron_right</span></a>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              <?php foreach (array_slice($list, 0, 6) as $c): ?>
                <a href="/article.php?id=<?= (int) $c['id'] ?>" class="block group rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <?php if (!empty($c['image'])): ?><div class="w-full aspect-[16/10] bg-cover bg-center bg-zinc-100" style="background-image:url('<?= nh($c['image']) ?>')"></div><?php endif; ?>
                  <div class="p-3.5">
                    <div class="text-[15.5px] font-bold leading-normal group-hover:text-[<?= $P ?>]"><?= nh($c['title']) ?></div>
                    <?php if (!empty($c['excerpt'])): ?><div class="mt-1.5 text-xs leading-relaxed text-zinc-500 line-clamp-2"><?= nh($c['excerpt']) ?></div><?php endif; ?>
                    <div class="mt-2 text-[11.5px] text-zinc-400"><?= nh(news_date($c['publishedAt'])) ?></div>
                  </div>
                </a>
              <?php endforeach; ?>
            </div>
          </div>
        <?php endforeach; ?>
        <!-- adsense-slot: 인피드 -->
      </div>

      <!-- 사이드바 -->
      <div class="flex flex-col gap-5 self-start lg:sticky lg:top-16">
        <div class="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div class="px-4 pt-3.5 pb-2.5 text-[15.5px] font-extrabold border-b border-zinc-100">주요 기사</div>
          <div class="px-4 py-1.5">
            <?php foreach ($ranked as $i => $r): ?>
              <a href="/article.php?id=<?= (int) $r['id'] ?>" class="flex gap-3 items-baseline py-2 border-b border-zinc-50 last:border-0 group">
                <span class="w-4 flex-none text-[15px] font-extrabold text-[<?= $P ?>]"><?= $i + 1 ?></span>
                <span class="flex-1 text-[13.5px] font-semibold leading-normal group-hover:text-[<?= $P ?>]"><?= nh($r['title']) ?></span>
              </a>
            <?php endforeach; ?>
          </div>
        </div>

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
    <div id="sec-yna" class="border-t-2 border-zinc-900 pt-5 pb-2 mb-5">
      <div class="mb-5 flex flex-wrap items-center gap-3">
        <span class="text-[19px] font-extrabold">언론사 헤드라인</span>
        <span class="text-xs text-zinc-400">아침·저녁 갱신 · 제목을 누르면 각 언론사 원문으로 이동합니다</span>
        <div class="ml-auto flex flex-wrap gap-2">
          <?php $first = true; foreach ($press as $key => $tab): ?>
            <button type="button" data-ptab="<?= nh($key) ?>" class="ptab rounded-full border px-3 py-1 text-[13px] font-bold <?= $first ? 'on border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 text-zinc-500' ?>"><?= nh($tab['label']) ?></button>
          <?php $first = false; endforeach; ?>
        </div>
      </div>
      <?php $first = true; foreach ($press as $key => $tab): ?>
        <div class="press-panel grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" id="press-<?= nh($key) ?>" <?= $first ? '' : 'style="display:none"' ?>>
          <?php foreach ($tab['boxes'] as $boxLabel => $links): ?>
            <div class="min-w-0 rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden">
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
