<?php
// HOM2BOX 핫이슈 — 자체 신문사 홈 (디자인 개편: Tailwind + 속보 티커 + 사이드바 + 언론사 헤드라인).
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/press-rss.php';
require_once __DIR__ . '/includes/layout.php';
require_once __DIR__ . '/includes/tools-data.php';
require_once __DIR__ . '/includes/docs-data.php'; // DOC_DEFS · DOC_CATS (홈 문서 바로가기 셀렉트)
require_once __DIR__ . '/includes/senuri.php';

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
    $press = press_headlines(6); // 홈 언론사 헤드라인 = 탭(분야)마다 6건
} catch (Throwable) {
}

// 사이드바 '주요 기사' = 연예·엔터 최신 기사(엔터 중심 개편)
$mainHeads = [];
foreach ($articles as $a) {
    if (in_array($a['section'] ?? '', ['연예·스포츠', '연예 속보'], true)) {
        $mainHeads[] = ['title' => $a['title'], 'href' => '/article.php?id=' . (int) $a['id'], 'ext' => false];
        if (count($mainHeads) >= 8) break;
    }
}
if (!$mainHeads) {
    foreach ($ranked as $r) {
        $mainHeads[] = ['title' => $r['title'], 'href' => '/article.php?id=' . (int) $r['id'], 'ext' => false];
        if (count($mainHeads) >= 8) break;
    }
}

// 노인일자리 '원클릭' 위젯 — 접수중 구인정보(캐시만 읽음, 홈에서 네트워크 페치 금지). 최신 5건.
$seniorJobs = [];
try { $seniorJobs = array_slice(senuri_jobs_cached(), 0, 5); } catch (Throwable) {}

// 종목 이슈 위젯(급등·급락·거래대금 국내) + 종목 커뮤니티 추출 (stock_movers는 60초 캐시)
$stockRanks = null;
$stockNames = [];
try {
    $mv = stock_movers();
    $sit = [];
    foreach ($mv as $tk => $m) { if (($m['close'] ?? 0) > 0) { $sit[] = $m; $stockNames[$tk] = $m['name']; } }
    try { foreach (goblog_db()->query('SELECT ticker,name FROM stocks')->fetchAll() as $s) $stockNames[$s['ticker']] = $s['name']; } catch (Throwable) {}
    if ($sit) {
        $byR = $sit; usort($byR, fn($a, $b) => $b['ratio'] <=> $a['ratio']);
        $byV = $sit; usort($byV, fn($a, $b) => $b['amount'] <=> $a['amount']);
        $stockRanks = ['up' => array_slice($byR, 0, 4), 'down' => array_slice(array_reverse($byR), 0, 4), 'active' => array_slice($byV, 0, 4)];
    }
} catch (Throwable) {}
$stockTalk = [];
try {
    $stockTalk = goblog_db()->query(
        'SELECT p.ticker, p.body, p.stance, u.name authorName
         FROM community_posts p JOIN community_users u ON u.id=p.userId
         WHERE p.hidden=0 ORDER BY p.id DESC LIMIT 5'
    )->fetchAll();
} catch (Throwable) { $stockTalk = []; }

// 최근 7일 많이 본 기사 (article_views) — 발행된 기사만(news_articles로 제목 해석)
$popular = [];
try {
    $amap = [];
    foreach ($articles as $a) $amap[(int) $a['id']] = $a;
    $isEnt = fn($a) => in_array($a['section'] ?? '', ['연예·스포츠', '연예 속보'], true);
    $pr = goblog_db()->query('SELECT articleId, COUNT(*) v FROM article_views WHERE viewedAt>=NOW()-INTERVAL 7 DAY GROUP BY articleId ORDER BY v DESC LIMIT 40')->fetchAll();
    foreach ($pr as $r) { if (count($popular) >= 6) break; $aid = (int) $r['articleId']; if (isset($amap[$aid]) && $isEnt($amap[$aid])) $popular[] = $amap[$aid]; }
    if (count($popular) < 6) { // 연예 기사로 보충
        $have = array_flip(array_map(fn($a) => (int) $a['id'], $popular));
        foreach ($articles as $a) { if (count($popular) >= 6) break; if ($isEnt($a) && !isset($have[(int) $a['id']])) $popular[] = $a; }
    }
} catch (Throwable) { $popular = []; }

$P = '#134a9c';
render_head('HOM2BOX 핫이슈 — 연예·드라마·영화·스포츠 실시간 이슈', '연예·드라마·영화·예능·K팝·스포츠 실시간 핫이슈를 한눈에. 지금 가장 뜨거운 엔터 소식.');
?>
<script type="application/ld+json"><?= json_encode([
    '@context' => 'https://schema.org',
    '@graph' => [
        [
            '@type' => 'NewsMediaOrganization',
            '@id' => 'https://hom2box.com/#org',
            'name' => 'HOM2BOX 핫이슈',
            'url' => 'https://hom2box.com/',
            'logo' => ['@type' => 'ImageObject', 'url' => 'https://hom2box.com/favicon/favicon-32.png'],
        ],
        [
            '@type' => 'WebSite',
            '@id' => 'https://hom2box.com/#website',
            'url' => 'https://hom2box.com/',
            'name' => 'HOM2BOX 핫이슈',
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
    <h1 class="sr-only">HOM2BOX 핫이슈 — 매일 아침·저녁 발행하는 이슈·경제·IT·생활 뉴스</h1>


    <!-- 언론사 헤드라인 제거(엔터 개편 — 정치·경제 off-brand) -->
    <?php if (false): $ynaBoxes = $press['yna']['boxes'] ?? []; ?>
    <div class="pt-5 pb-2 mb-4">
      <div class="mb-3 flex items-center gap-3 border-b-2 border-zinc-900 pb-3">
        <span class="h-[19px] w-[3px] rounded-full bg-[#e0392b]"></span>
        <h2 class="text-[19px] font-extrabold tracking-tight sm:text-[21px]">언론사 헤드라인</h2>
        <a href="/press.php" class="ml-auto inline-flex items-center text-[13px] font-bold text-zinc-400 hover:text-[<?= $P ?>]">전체 보기<span class="material-symbols-outlined text-[16px]">chevron_right</span></a>
      </div>
      <?php // 카테고리 탭 (분야) ?>
      <div class="flex flex-nowrap gap-4 overflow-x-auto border-b border-zinc-100 pb-1" style="scrollbar-width:none">
        <?php $first = true; foreach ($ynaBoxes as $cat => $links): ?>
          <button type="button" data-ycat="<?= nh((string) $cat) ?>" class="yctab shrink-0 border-b-2 pb-2 text-[14px] font-bold <?= $first ? 'border-[#134a9c] text-[#134a9c]' : 'border-transparent text-zinc-500 hover:text-zinc-900' ?>"><?= nh((string) $cat) ?></button>
        <?php $first = false; endforeach; ?>
      </div>
      <?php // 2컬럼 헤드라인 리스트 (열 우선 배치) ?>
      <?php $first = true; foreach ($ynaBoxes as $cat => $links): $mid = (int) ceil(count($links) / 2); ?>
        <div class="ypanel grid grid-cols-1 gap-x-12 pt-2 md:grid-cols-2" id="ycat-<?= nh((string) $cat) ?>" <?= $first ? '' : 'style="display:none"' ?>>
          <?php foreach ([array_slice($links, 0, $mid), array_slice($links, $mid)] as $col): ?>
            <div>
              <?php foreach ($col as $l): ?>
                <a href="<?= nh($l['link']) ?>" target="_blank" rel="noopener nofollow" title="<?= nh($l['title']) ?>" class="flex items-center gap-2 border-b border-zinc-100 py-2.5 last:border-0 group">
                  <span class="h-1 w-1 flex-none rounded-full bg-[#e0392b]"></span>
                  <span class="truncate text-[14px] font-semibold text-zinc-800 group-hover:text-[<?= $P ?>]"><?= nh($l['title']) ?></span>
                </a>
              <?php endforeach; ?>
            </div>
          <?php endforeach; ?>
        </div>
      <?php $first = false; endforeach; ?>
    </div>
    <script>
    document.querySelectorAll('.yctab').forEach(function(b){b.addEventListener('click',function(){
      document.querySelectorAll('.yctab').forEach(function(x){x.classList.remove('border-[#134a9c]','text-[#134a9c]');x.classList.add('border-transparent','text-zinc-500');});
      b.classList.add('border-[#134a9c]','text-[#134a9c]');b.classList.remove('border-transparent','text-zinc-500');
      document.querySelectorAll('.ypanel').forEach(function(p){p.style.display='none';});
      var el=document.getElementById('ycat-'+b.dataset.ycat); if(el) el.style.display='';
    });});
    </script>
    <?php endif; ?>

    <?php if (!$articles): ?>
      <div class="py-24 text-center text-zinc-400">아직 발행된 기사가 없습니다.</div>
    <?php else: ?>

    <style>
      .h2b-rk{display:flex;gap:14px;overflow-x:auto;padding-bottom:10px;scrollbar-width:none;}
      .h2b-rk::-webkit-scrollbar{display:none;}
      .h2b-rk-hd{display:flex;align-items:center;justify-content:space-between;margin:22px 0 14px;}
      .h2b-rk-hd h2{display:flex;align-items:center;gap:7px;font-size:20px;font-weight:800;letter-spacing:-.02em;margin:0;}
      @media(min-width:640px){.h2b-rk-hd h2{font-size:22px;}}
      .h2b-rk-more{font-size:13px;color:#a1a1aa;text-decoration:none;white-space:nowrap;}
      .h2b-rk-more:hover{color:#134a9c;}
      .h2b-rk-card{width:150px;flex:0 0 auto;text-decoration:none;color:inherit;}
      @media(min-width:640px){.h2b-rk-card{width:172px;}}
      .h2b-rk-poster{position:relative;width:100%;aspect-ratio:3/4;border-radius:13px;overflow:hidden;background:#e4e4e7 50%/cover no-repeat;box-shadow:0 1px 5px rgba(0,0,0,.13);}
      .h2b-rk-poster::after{content:"";position:absolute;left:0;right:0;bottom:0;height:44%;background:linear-gradient(to top,rgba(0,0,0,.82),rgba(0,0,0,0));}
      .h2b-rk-poster>img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s ease;}
      .h2b-rk-card:hover .h2b-rk-poster>img{transform:scale(1.06);}
      .h2b-rk-num{position:absolute;bottom:-4px;left:9px;z-index:2;font-size:56px;font-weight:900;font-style:italic;color:#fff;line-height:1;text-shadow:0 2px 7px rgba(0,0,0,.6);}
      .h2b-rk-title{margin-top:9px;font-size:14.5px;font-weight:700;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
      .h2b-rk-card:hover .h2b-rk-title{color:#134a9c;}
      .h2b-rk-meta{margin-top:5px;font-size:11.5px;color:#a1a1aa;}
    </style>
    <?php
    // 네이버 연예 스타일 순위 카드 — 마켓 아래·헤드라인 위
    $rankRow = function (string $title, string $emoji, string $section, array $items) {
        $items = array_slice(array_values(array_filter($items, fn($a) => !empty($a['image']))), 0, 12);
        if (count($items) < 3) return;
        ?>
      <section>
        <div class="h2b-rk-hd">
          <h2><span style="font-size:23px"><?= $emoji ?></span> <?= nh($title) ?></h2>
          <a class="h2b-rk-more" href="/category.php?cat=<?= urlencode($section) ?>">전체보기 ›</a>
        </div>
        <div class="h2b-rk">
          <?php $i = 1; foreach ($items as $a): ?>
          <a class="h2b-rk-card" href="/article.php?id=<?= (int) $a['id'] ?>">
            <div class="h2b-rk-poster">
              <img src="<?= nh($a['image']) ?>" alt="" loading="lazy" referrerpolicy="no-referrer">
              <span class="h2b-rk-num"><?= $i++ ?></span>
            </div>
            <div class="h2b-rk-title"><?= nh($a['title']) ?></div>
            <div class="h2b-rk-meta"><?= nh($a['section']) ?> · <?= nh(news_date($a['publishedAt'])) ?></div>
          </a>
          <?php endforeach; ?>
        </div>
      </section>
        <?php
    };
    $rankRow('지금 뜨는 드라마·예능', '📺', '방송·가요', array_merge($bySection['방송·가요'] ?? [], $bySection['아이돌365'] ?? []));
    ?>

    <!-- 헤드라인 (시안: 좌 대표기사 이미지 위+제목 아래 / 우 헤드라인 리스트) -->
    <div class="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 lg:gap-9 py-6 border-b border-zinc-200">
      <a href="/article.php?id=<?= (int) $headline['id'] ?>" class="block group">
        <?php if (!empty($headline['image'])): ?>
          <div class="aspect-video w-full overflow-hidden rounded-lg bg-zinc-100"><img src="<?= nh($headline['image']) ?>" alt="" class="h-full w-full object-cover"></div>
        <?php endif; ?>
        <h2 class="mt-4 mb-2 text-[22px] sm:text-[27px] font-extrabold leading-snug tracking-tight group-hover:text-[<?= $P ?>]"><?= nh($headline['title']) ?></h2>
        <?php if (!empty($headline['excerpt'])): ?><p class="mb-2 text-sm leading-relaxed text-zinc-500 line-clamp-3"><?= nh($headline['excerpt']) ?></p><?php endif; ?>
        <div class="flex items-center gap-2 text-xs text-zinc-400"><?= nh($headline['section']) ?> · <?= nh(news_date($headline['publishedAt'])) ?></div>
      </a>
      <div class="flex flex-col pb-2">
        <?php foreach ($subLeads as $h): ?>
          <a href="/article.php?id=<?= (int) $h['id'] ?>" class="flex gap-3.5 items-center py-3 border-b border-zinc-100 group">
            <div class="flex-1 min-w-0">
              <div class="text-[15px] font-bold leading-normal group-hover:text-[<?= $P ?>]"><?= nh($h['title']) ?></div>
              <?php if (!empty($h['excerpt'])): ?><div class="mt-1 text-[13px] text-zinc-500 line-clamp-1"><?= nh($h['excerpt']) ?></div><?php endif; ?>
            </div>
            <?php if (!empty($h['image'])): ?><div class="w-[88px] h-[60px] rounded-md flex-none bg-cover bg-center bg-zinc-100" style="background-image:url('<?= nh($h['image']) ?>')"></div><?php endif; ?>
          </a>
        <?php endforeach; ?>
        <?php if ($moreLeads): ?>
          <div id="h2b-more-leads" class="hidden flex-col">
            <?php foreach ($moreLeads as $h): ?>
              <a href="/article.php?id=<?= (int) $h['id'] ?>" class="flex gap-3.5 items-center py-3 border-b border-zinc-100 group">
                <div class="flex-1 min-w-0">
                  <div class="text-[15px] font-bold leading-normal group-hover:text-[<?= $P ?>]"><?= nh($h['title']) ?></div>
                  <?php if (!empty($h['excerpt'])): ?><div class="mt-1 text-[13px] text-zinc-500 line-clamp-1"><?= nh($h['excerpt']) ?></div><?php endif; ?>
                </div>
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

    <?php
    // 헤드라인 아래 순위 모듈 (드라마·예능은 헤드라인 위)
    $rankRow('지금 뜨는 영화', '🎬', '영화', $bySection['영화'] ?? []);
    ?>

    <!-- 종목 이슈 위젯 제거(엔터 중심 개편) -->
    <?php if (false): ?>
    <section class="mt-8">
      <div class="mb-3 flex items-center justify-between border-b-2 border-zinc-900 pb-2.5">
        <h2 class="flex items-center gap-2 text-[20px] font-extrabold tracking-tight sm:text-[23px]"><span class="material-symbols-outlined text-[24px] text-[#d60000]">trending_up</span>실시간 종목 이슈</h2>
        <a href="/stocks.php" class="inline-flex items-center text-[13px] text-zinc-400 hover:text-[#134a9c]">종목 전체보기<span class="material-symbols-outlined text-[14px]">chevron_right</span></a>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <?php
        function home_rank(string $title, string $emoji, array $list, bool $money = false): void {
          $up = fn($r) => $r > 0 ? '#d60000' : ($r < 0 ? '#1263e0' : '#666');
          $ar = fn($r) => $r > 0 ? '▲' : ($r < 0 ? '▼' : '−');
          $short = function ($w) { if ($w >= 1e12) return number_format($w / 1e12, 1) . '조'; if ($w >= 1e8) return number_format($w / 1e8, 0) . '억'; return $w > 0 ? number_format($w / 1e4, 0) . '만' : '—'; };
          ?>
          <div class="rounded-lg border border-zinc-200 bg-white p-3.5">
            <div class="mb-1.5 text-[13.5px] font-bold text-zinc-800"><?= $emoji ?> <?= nh($title) ?></div>
            <div class="divide-y divide-zinc-100">
              <?php $i = 1; foreach ($list as $it): ?>
              <a href="/stock.php?code=<?= nh($it['ticker']) ?>" class="flex items-center gap-2 py-1.5 group">
                <span class="w-3.5 flex-none text-[11px] font-bold text-zinc-400"><?= $i++ ?></span>
                <span class="min-w-0 flex-1 truncate text-[13px] font-semibold text-zinc-800 group-hover:text-[#134a9c]"><?= nh($it['name']) ?></span>
                <?php if ($money): ?>
                  <span class="flex-none text-[12px] font-bold text-zinc-600"><?= nh($short($it['amount'])) ?></span>
                <?php else: ?>
                  <span class="flex-none text-[12px] font-bold" style="color:<?= $up($it['ratio']) ?>"><?= $ar($it['ratio']) ?> <?= number_format($it['ratio'], 2) ?>%</span>
                <?php endif; ?>
              </a>
              <?php endforeach; ?>
            </div>
          </div>
        <?php }
        home_rank('급등', '🔺', $stockRanks['up']);
        home_rank('급락', '🔻', $stockRanks['down']);
        home_rank('거래대금', '💰', $stockRanks['active'], true);
        ?>
        <!-- 4번째 열: 종목 토론 -->
        <div class="rounded-lg border border-zinc-200 bg-white p-3.5">
          <div class="mb-1.5 text-[13.5px] font-bold text-zinc-800">💬 종목 토론</div>
          <?php if ($stockTalk): ?>
            <div class="divide-y divide-zinc-100">
              <?php foreach (array_slice($stockTalk, 0, 4) as $t):
                $snm = $stockNames[$t['ticker']] ?? $t['ticker'];
                $stanceLbl = $t['stance'] === 'BUY' ? '<span class="font-bold text-[#d60000]">매수</span> ' : ($t['stance'] === 'SELL' ? '<span class="font-bold text-[#1263e0]">매도</span> ' : '');
              ?>
              <a href="/stock.php?code=<?= nh($t['ticker']) ?>" class="block py-1.5 group">
                <div class="flex items-center gap-1.5">
                  <span class="flex-none rounded bg-[#134a9c]/10 px-1 text-[10.5px] font-bold text-[#134a9c]"><?= nh($snm) ?></span>
                  <span class="min-w-0 flex-1 truncate text-[12.5px] text-zinc-700 group-hover:text-[#134a9c]"><?= $stanceLbl ?><?= nh(mb_substr((string) $t['body'], 0, 20)) ?></span>
                </div>
              </a>
              <?php endforeach; ?>
            </div>
          <?php else: ?>
            <p class="py-1.5 text-[12.5px] text-zinc-400"><a href="/stocks.php" class="text-[#134a9c] underline">종목</a>에서 첫 의견을 남겨보세요.</p>
          <?php endif; ?>
        </div>
      </div>
    </section>
    <?php endif; ?>

    <?php ob_start(); // 도구 위젯을 캡처해 페이지 최하단에 출력(엔터 개편 — 도구는 하단으로) ?>
    <!-- 문서도구·계산기 바로가기 (서식/계산기 선택 → 바로 이동) -->
    <?php
      $calcByCat = [];
      foreach (TOOLS as $tid => $tv) { $calcByCat[$tv['category']][$tid] = $tv; }
      $calcCatOrder = ['급여·노무', '세금', '금융·부동산', '크리에이터 수익', '생활·건강'];
    ?>
    <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <!-- 문서 도구 -->
      <div class="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div class="flex items-center gap-3">
          <span class="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-[<?= $P ?>]/10 text-[<?= $P ?>]"><span class="material-symbols-outlined text-[24px]">draft</span></span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 text-[14.5px] font-extrabold">문서 도구<span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10.5px] font-bold text-zinc-500"><?= count(DOC_DEFS) ?>종</span></div>
            <div class="mt-0.5 text-[12px] leading-snug text-zinc-500">각서·위임장 등 서식 바로 작성</div>
          </div>
          <a href="/docs.php" class="flex flex-none items-center gap-0.5 text-[12px] font-medium text-zinc-400 hover:text-[<?= $P ?>]">전체<span class="material-symbols-outlined text-[15px]">chevron_right</span></a>
        </div>
        <div class="relative mt-3" data-dd>
          <button type="button" class="dd-btn flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 text-[13.5px] font-bold text-zinc-600 outline-none focus:ring-2 focus:ring-[<?= $P ?>]/30">
            <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[18px] text-[<?= $P ?>]">edit_document</span>서식 선택해서 바로 작성</span>
            <span class="material-symbols-outlined text-[20px] text-zinc-400">expand_more</span>
          </button>
          <div class="dd-menu absolute left-0 right-0 z-30 mt-1 hidden max-h-[320px] overflow-auto rounded-xl border border-zinc-200 bg-white py-1.5 shadow-xl">
            <?php foreach (DOC_CATS as [$dct, $dkeys]): ?>
              <div class="px-3.5 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400"><?= nh($dct) ?></div>
              <?php foreach ($dkeys as $dk): $dv = DOC_DEFS[$dk]; ?>
                <button type="button" class="dd-opt flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13.5px] hover:bg-zinc-50" data-url="/docs.php?doc=<?= nh($dk) ?>"><span class="material-symbols-outlined text-[18px] text-[<?= $P ?>]"><?= nh($dv['icon']) ?></span><?= nh($dv['title']) ?></button>
              <?php endforeach; ?>
            <?php endforeach; ?>
          </div>
        </div>
      </div>
      <!-- 계산기 -->
      <div class="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div class="flex items-center gap-3">
          <span class="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-[<?= $P ?>]/10 text-[<?= $P ?>]"><span class="material-symbols-outlined text-[24px]">calculate</span></span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 text-[14.5px] font-extrabold">계산기<span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10.5px] font-bold text-zinc-500"><?= count(TOOLS) ?>종</span></div>
            <div class="mt-0.5 text-[12px] leading-snug text-zinc-500">연봉·세금·대출 등 바로 계산</div>
          </div>
          <a href="/tools.php" class="flex flex-none items-center gap-0.5 text-[12px] font-medium text-zinc-400 hover:text-[<?= $P ?>]">전체<span class="material-symbols-outlined text-[15px]">chevron_right</span></a>
        </div>
        <div class="relative mt-3" data-dd>
          <button type="button" class="dd-btn flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 text-[13.5px] font-bold text-zinc-600 outline-none focus:ring-2 focus:ring-[<?= $P ?>]/30">
            <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[18px] text-[<?= $P ?>]">function</span>계산기 선택해서 바로 계산</span>
            <span class="material-symbols-outlined text-[20px] text-zinc-400">expand_more</span>
          </button>
          <div class="dd-menu absolute left-0 right-0 z-30 mt-1 hidden max-h-[320px] overflow-auto rounded-xl border border-zinc-200 bg-white py-1.5 shadow-xl">
            <?php foreach ($calcCatOrder as $cc): if (empty($calcByCat[$cc])) continue; ?>
              <div class="px-3.5 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400"><?= nh($cc) ?></div>
              <?php foreach ($calcByCat[$cc] as $tid => $tv): ?>
                <button type="button" class="dd-opt flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13.5px] hover:bg-zinc-50" data-url="/tool.php?id=<?= nh($tid) ?>"><span class="material-symbols-outlined text-[18px] text-[<?= $P ?>]"><?= nh($tv['icon']) ?></span><?= nh($tv['name']) ?></button>
              <?php endforeach; ?>
            <?php endforeach; ?>
          </div>
        </div>
      </div>
    </div>
    <script>
    (function(){
      function closeAll(except){ document.querySelectorAll('.dd-menu').forEach(function(m){ if(m!==except) m.classList.add('hidden'); }); }
      document.querySelectorAll('[data-dd]').forEach(function(dd){
        var btn=dd.querySelector('.dd-btn'), menu=dd.querySelector('.dd-menu');
        btn.addEventListener('click',function(e){ e.stopPropagation(); var open=menu.classList.contains('hidden'); closeAll(menu); menu.classList.toggle('hidden', !open); });
        menu.querySelectorAll('.dd-opt').forEach(function(o){ o.addEventListener('click',function(){ location.href=o.getAttribute('data-url'); }); });
      });
      document.addEventListener('click',function(){ closeAll(null); });
      document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeAll(null); });
    })();
    </script>

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
    <div class="mt-7 overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div class="flex items-center justify-between border-b border-zinc-100 px-4 sm:px-5 py-3">
        <div class="flex items-center gap-2.5">
          <span class="h-[17px] w-[3px] rounded-full bg-[#e0392b]"></span>
          <span class="material-symbols-outlined text-[19px] text-[<?= $P ?>]">calculate</span>
          <span class="whitespace-nowrap text-[15.5px] font-bold tracking-tight">자주 쓰는 계산기</span>
          <span class="flex-none whitespace-nowrap rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-bold text-zinc-500"><?= count(TOOLS) ?>종</span>
        </div>
        <a href="/tools.php" class="flex-none inline-flex items-center gap-0.5 whitespace-nowrap text-[12px] font-medium text-zinc-400 hover:text-[<?= $P ?>]">전체보기<span class="material-symbols-outlined text-[15px]">chevron_right</span></a>
      </div>
      <div class="relative overflow-hidden py-3.5">
        <div class="h2b-mq">
          <span class="inline-flex items-center"><?php $renderMq(); ?></span>
          <span class="inline-flex items-center" aria-hidden="true"><?php $renderMq(); ?></span>
        </div>
      </div>
    </div>

    <!-- 정부 지원금·복지 소식 제거(엔터 중심 개편) -->
    <?php $welfare = []; if (false): ?>
    <div class="mt-6">
      <div class="flex items-center gap-2 mb-3">
        <span class="h-[17px] w-[3px] rounded-full bg-[#e0392b]"></span>
        <span class="material-symbols-outlined text-[20px] text-[#134a9c]">volunteer_activism</span>
        <span class="text-[16px] font-bold tracking-tight">정부 지원금·복지 소식</span>
        <div class="ml-auto flex items-center gap-1.5">
          <button type="button" id="h2b-wf-prev" class="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 text-zinc-400 hover:border-[#134a9c] hover:text-[#134a9c] disabled:opacity-30 disabled:cursor-default disabled:hover:border-zinc-200 disabled:hover:text-zinc-400"><span class="material-symbols-outlined text-[16px]">chevron_left</span></button>
          <button type="button" id="h2b-wf-next" class="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 text-zinc-400 hover:border-[#134a9c] hover:text-[#134a9c] disabled:opacity-30 disabled:cursor-default disabled:hover:border-zinc-200 disabled:hover:text-zinc-400"><span class="material-symbols-outlined text-[16px]">chevron_right</span></button>
          <a href="/welfare.php" class="ml-1 text-xs text-zinc-400 hover:text-[#134a9c] inline-flex items-center">전체보기<span class="material-symbols-outlined text-[14px]">chevron_right</span></a>
        </div>
      </div>
      <div id="h2b-wf" class="overflow-hidden">
        <div id="h2b-wf-track" class="h2b-wf-track">
          <?php foreach ($welfare as $w):
            $wlink = !empty($w['detailLink']) ? $w['detailLink'] : '/welfare.php';
            $wext = !empty($w['detailLink']);
            $central = ($w['source'] ?? '') === 'CENTRAL';
            $org = $central ? (string) ($w['dept'] ?? '') : (string) ($w['region'] ?? '');
            if ($org === '') $org = $central ? '중앙부처' : '지자체';
            $targets = preg_split('/\s*[·,\/]\s*/u', (string) ($w['lifeCycle'] ?? ''), -1, PREG_SPLIT_NO_EMPTY) ?: [];
            $targets = array_slice(array_filter(array_map('trim', $targets), fn($t) => $t !== ''), 0, 5);
          ?>
            <a href="<?= nh($wlink) ?>"<?= $wext ? ' target="_blank" rel="noopener"' : '' ?> class="h2b-wf-item group flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
              <div class="mb-2.5 flex items-center gap-2">
                <span class="inline-flex items-center gap-1 rounded-md bg-[#134a9c]/10 px-2 py-0.5 text-[11px] font-bold text-[#134a9c]"><span class="material-symbols-outlined text-[13px]">account_balance</span><?= nh($org) ?></span>
              </div>
              <div class="mb-2 text-[15.5px] sm:text-[16.5px] font-bold leading-snug text-zinc-900 group-hover:text-[#134a9c] line-clamp-2"><?= nh($w['name']) ?></div>
              <?php if (!empty($w['summary'])): ?><div class="mb-4 flex-1 text-[13px] leading-relaxed text-zinc-500 line-clamp-3"><?= nh($w['summary']) ?></div><?php else: ?><div class="mb-4 flex-1"></div><?php endif; ?>
              <?php if ($targets): ?>
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-[11.5px] font-bold text-zinc-400">대상</span>
                <?php foreach ($targets as $t): ?>
                  <span class="rounded-md bg-zinc-100 px-2 py-0.5 text-[11.5px] font-semibold text-zinc-600"><?= nh($t) ?></span>
                <?php endforeach; ?>
              </div>
              <?php endif; ?>
              <?php if ($wext): ?>
              <div class="mt-4 inline-flex items-center gap-1 text-[13px] font-bold text-[#134a9c]">복지로에서 자세히<span class="material-symbols-outlined text-[16px]">arrow_forward</span></div>
              <?php endif; ?>
            </a>
          <?php endforeach; ?>
        </div>
      </div>
    </div>
    <style>
      /* per-view: 모바일 1개(100%) / sm 3개 / lg 4개 — gap 12px 반영한 calc basis */
      /* 가로만 클리핑(오프스크린 카드 숨김), 세로는 visible → 카드 하단 테두리·그림자 안 잘림 */
      #h2b-wf{overflow-x:clip;overflow-y:visible;}
      .h2b-wf-track{display:flex;gap:12px;align-items:stretch;transition:transform .35s ease;will-change:transform;}
      .h2b-wf-item{flex:0 0 100%;min-width:0;}
      @media (min-width:640px){.h2b-wf-item{flex:0 0 calc((100% - 24px) / 3);}}
      @media (min-width:1024px){.h2b-wf-item{flex:0 0 calc((100% - 36px) / 4);}}
    </style>
    <script>
    (function(){
      var vp=document.getElementById('h2b-wf'),track=document.getElementById('h2b-wf-track');
      if(!vp||!track) return;
      var prev=document.getElementById('h2b-wf-prev'),next=document.getElementById('h2b-wf-next');
      var total=track.children.length,gap=12,page=0;
      function perView(){var w=window.innerWidth;return w<640?1:(w<1024?3:4);}
      function pages(){return Math.max(1,Math.ceil(total/perView()));}
      function render(){
        var maxPage=pages()-1;
        if(page>maxPage)page=maxPage;
        if(page<0)page=0;
        var x=page*(vp.clientWidth+gap);
        track.style.transform='translateX(-'+x+'px)';
        if(prev)prev.disabled=(page<=0);
        if(next)next.disabled=(page>=maxPage);
      }
      if(prev)prev.addEventListener('click',function(){page--;render();});
      if(next)next.addEventListener('click',function(){page++;render();});
      var rt;
      window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(render,120);});
      render();
    })();
    </script>
    <?php endif; ?>

    <?php $toolsHtml = ob_get_clean(); // 도구 위젯 캡처 끝 — 하단에서 출력 ?>

    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-9 pt-7 pb-2">
      <!-- 분야별 섹션 -->
      <div>
        <?php $secIdx = 0; foreach (NEWS_SECTIONS as $s): $list = $bySection[$s] ?? []; if (!$list) continue; $secIdx++; ?>
          <?php if ($secIdx === 2) adsense_display(); /* 섹션 사이 배너 */ ?>
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
        <?php if ($popular): ?>
        <div class="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div class="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-zinc-100">
            <span class="h-[15px] w-[3px] rounded-full bg-[#e0392b]"></span>
            <span class="text-[15.5px] font-extrabold">🔥 많이 본 기사</span>
            <span class="ml-auto text-[10.5px] font-medium text-zinc-400">최근 7일</span>
          </div>
          <div class="px-4 py-1">
            <?php $i = 1; foreach ($popular as $a): ?>
            <a href="/article.php?id=<?= (int) $a['id'] ?>" class="flex items-start gap-2.5 border-b border-zinc-100 py-2.5 last:border-0 group">
              <span class="flex-none text-[15px] font-extrabold <?= $i <= 3 ? 'text-[#e0392b]' : 'text-zinc-300' ?>"><?= $i++ ?></span>
              <span class="line-clamp-2 text-[13.5px] font-semibold leading-snug text-zinc-800 group-hover:text-[#134a9c]"><?= nh($a['title']) ?></span>
            </a>
            <?php endforeach; ?>
          </div>
        </div>
        <?php endif; ?>
        <div class="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div class="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-zinc-100">
            <span class="h-[15px] w-[3px] rounded-full bg-[#b3925c]"></span>
            <span class="text-[15.5px] font-extrabold">주요 기사</span>
            <span class="ml-auto inline-flex items-center gap-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-[#e0392b]"><span class="material-symbols-outlined text-[13px]">local_fire_department</span>연예</span>
          </div>
          <div class="px-4 py-1.5">
            <?php foreach ($mainHeads as $r): ?>
              <a href="<?= nh($r['href']) ?>"<?= $r['ext'] ? ' target="_blank" rel="noopener nofollow"' : '' ?> class="flex py-2 border-b border-zinc-50 last:border-0 group">
                <span class="flex-1 text-[13.5px] font-normal leading-normal text-zinc-800 group-hover:text-[<?= $P ?>] line-clamp-2"><?= nh($r['title']) ?></span>
              </a>
            <?php endforeach; ?>
          </div>
        </div>

        <?php // ── 원클릭 노인일자리 위젯 제거(엔터 중심 개편) ── ?>
        <?php if (false): ?>
        <div class="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <a href="/jobs.php" class="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-zinc-100 group">
            <span class="h-[15px] w-[3px] rounded-full bg-[#03c75a]"></span>
            <span class="text-[15.5px] font-extrabold group-hover:text-[<?= $P ?>]">원클릭 노인일자리</span>
            <span class="material-symbols-outlined ml-auto text-[18px] text-zinc-300 group-hover:text-[<?= $P ?>]">chevron_right</span>
          </a>
          <div class="divide-y divide-zinc-100">
            <?php foreach ($seniorJobs as $j):
              $place = trim((string) ($j['place'] ?? ''));
              $org = trim((string) ($j['org'] ?? ''));
              $region = $place !== '' ? (preg_split('/\s+/u', $place)[0] ?? '') : '';
              $method = trim((string) ($j['acptMthd'] ?? ''));
              $fr = preg_replace('/^(\d{4})(\d{2})(\d{2})$/', '$1.$2.$3', (string) ($j['frDd'] ?? ''));
              $to = preg_replace('/^(\d{4})(\d{2})(\d{2})$/', '$1.$2.$3', (string) ($j['toDd'] ?? ''));
            ?>
              <a href="/jobs.php?id=<?= nh($j['jobId']) ?>" class="block px-4 py-3 hover:bg-zinc-50 group">
                <div class="mb-1.5 flex items-center gap-1.5">
                  <span class="material-symbols-outlined flex-none text-[15px] text-[#03c75a]">business_center</span>
                  <?php if ($region !== ''): ?><span class="flex-none rounded bg-[#e0392b]/10 px-1.5 py-0.5 text-[11px] font-bold text-[#e0392b]"><?= nh($region) ?></span><?php endif; ?>
                  <span class="ml-auto flex flex-none items-center gap-1">
                    <span class="rounded bg-[#03c75a]/10 px-1.5 py-0.5 text-[10.5px] font-bold text-[#03c75a]">접수중</span>
                    <?php if ($method !== ''): ?><span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10.5px] font-bold text-zinc-500"><?= nh(mb_strimwidth($method, 0, 8, '', 'UTF-8')) ?></span><?php endif; ?>
                  </span>
                </div>
                <div class="line-clamp-2 text-[13.5px] font-bold leading-snug text-zinc-900 group-hover:text-[<?= $P ?>]"><?= nh($j['title']) ?></div>
                <div class="mt-1.5 space-y-0.5 text-[11.5px] text-zinc-500">
                  <?php if ($org !== ''): ?><div class="flex items-center gap-1 truncate"><span class="material-symbols-outlined flex-none text-[13px] text-zinc-400">apartment</span><span class="truncate"><?= nh($org) ?></span></div><?php endif; ?>
                  <?php if ($place !== ''): ?><div class="flex items-center gap-1 truncate"><span class="material-symbols-outlined flex-none text-[13px] text-zinc-400">location_on</span><span class="truncate"><?= nh($place) ?></span></div><?php endif; ?>
                  <?php if ($fr !== ''): ?><div class="flex items-center gap-1 truncate"><span class="material-symbols-outlined flex-none text-[13px] text-zinc-400">calendar_month</span><?= nh($fr) . ($to !== '' ? ' ~ ' . nh($to) : '') ?></div><?php endif; ?>
                </div>
              </a>
            <?php endforeach; ?>
          </div>
          <a href="/jobs.php" class="block border-t border-zinc-100 px-4 py-2.5 text-center text-[12.5px] font-bold text-zinc-500 hover:text-[<?= $P ?>]">전체 노인일자리 보기</a>
        </div>
        <?php endif; ?>

        <?php render_ad("home-sidebar"); ?>

        <?php
        // 실시간 이슈 — 썸네일 기사 리스트(파트너스·FAQ 대체). 상단 위젯과 겹치지 않게 뒤쪽 기사 사용.
        $sideIssue = [];
        foreach (array_slice($articles, 6) as $a) { if (!empty($a['image'])) { $sideIssue[] = $a; if (count($sideIssue) >= 10) break; } }
        ?>
        <?php if ($sideIssue): ?>
        <div class="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div class="flex items-center gap-2 border-b border-zinc-100 px-4 pt-3.5 pb-2.5">
            <span class="h-[15px] w-[3px] rounded-full bg-[#e0392b]"></span>
            <span class="text-[15.5px] font-extrabold">🔥 실시간 이슈</span>
          </div>
          <div class="px-3 py-1">
            <?php foreach ($sideIssue as $a): ?>
            <a href="/article.php?id=<?= (int) $a['id'] ?>" class="flex items-center gap-3 border-b border-zinc-100 py-2.5 last:border-0 group">
              <div class="h-[54px] w-[54px] flex-none rounded-md bg-cover bg-center bg-zinc-100" style="background-image:url('<?= nh($a['image']) ?>')"></div>
              <div class="min-w-0 flex-1">
                <div class="line-clamp-2 text-[13px] font-semibold leading-snug text-zinc-800 group-hover:text-[<?= $P ?>]"><?= nh($a['title']) ?></div>
                <div class="mt-0.5 text-[11px] text-zinc-400"><?= nh($a['section']) ?></div>
              </div>
            </a>
            <?php endforeach; ?>
          </div>
        </div>
        <?php endif; ?>

      </div>
    </div>
    <?php endif; ?>

  </div>

  <?php // ── 제휴 상품 특가 캐러셀 — 관리자 '광고 관리'에서 '홈 특가 상품'(home-deals)을 켜야 노출(기본 숨김) ── ?>
  <?php $shopProducts = ad_enabled('home-deals') ? news_shop_mixed(12) : []; if ($shopProducts): ?>
  <section class="border-t border-zinc-100">
    <div class="mx-auto max-w-[1399px] px-4 sm:px-6 py-9">
      <div class="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 class="flex items-center gap-2 text-[20px] font-extrabold tracking-tight sm:text-[23px]"><span class="material-symbols-outlined text-[24px] text-[#134a9c]">shopping_cart</span>지금 가장 많이 담는 특가</h2>
          <p class="mt-1 text-[13px] text-zinc-400">쿠팡·네이버 인기 상품을 골라 담았습니다 · 제휴 링크</p>
        </div>
        <a href="/shop.php" class="flex flex-none items-center gap-0.5 text-[13px] font-bold text-zinc-500 hover:text-[<?= $P ?>]">전체보기<span class="material-symbols-outlined text-[18px]">chevron_right</span></a>
      </div>
      <div class="grid grid-flow-col auto-cols-[45%] gap-3 overflow-x-auto pb-2 sm:auto-cols-[30%] sm:gap-4 lg:auto-cols-[15.6%]" style="scrollbar-width:none">
        <?php foreach ($shopProducts as $p) render_product_card($p); ?>
      </div>
      <p class="mt-3 text-[11px] text-zinc-400">※ 제휴 마케팅 링크가 포함되어 있으며, 구매 시 일정액의 수수료를 제공받을 수 있습니다.</p>
    </div>
  </section>
  <?php endif; ?>

  <?php // 도구 위젯(문서도구·계산기·자주 쓰는 계산기)을 최하단에 출력 ?>
  <?php if (!empty($toolsHtml)): ?>
  <div class="mx-auto max-w-[1399px] px-4 sm:px-6 border-t border-zinc-100 pt-2"><?= $toolsHtml ?></div>
  <?php endif; ?>

  <?php render_newsletter_inline(); ?>

  <?php render_footer(); ?>
</div>
<?php render_foot(); ?>
