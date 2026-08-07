<?php
// 주식 커뮤니티 — 종목 목록·랭킹. 네이버 실시간 시세(현재가·거래량·거래대금) + 랭킹 풀 동적 발굴. /stocks.php
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

$db = goblog_db();

// (1) 관리자 등록 종목(AI 분석·토론 연결) — DB 종가는 폴백, 실시간으로 덮어쓴다.
$regRows = [];
try {
    $regRows = $db->query(
        "SELECT s.ticker, s.name, s.market,
                (SELECT close  FROM stock_prices p WHERE p.ticker=s.ticker ORDER BY p.date DESC LIMIT 1)     AS close,
                (SELECT close  FROM stock_prices p WHERE p.ticker=s.ticker ORDER BY p.date DESC LIMIT 1 OFFSET 1) AS prevClose,
                (SELECT volume FROM stock_prices p WHERE p.ticker=s.ticker ORDER BY p.date DESC LIMIT 1)     AS volume
         FROM stocks s WHERE s.active=1"
    )->fetchAll();
} catch (Throwable) { $regRows = []; }

// (2) 네이버 랭킹 풀(동적 발굴) + 등록 종목 실시간 시세
$movers = [];
try { $movers = stock_movers(); } catch (Throwable) {}
$rtReg = [];
try { $rtReg = stock_realtime(array_map(fn($r) => (string) $r['ticker'], $regRows)); } catch (Throwable) {}
$isLive = !empty($movers) || !empty($rtReg);

// (3) 통합 종목맵 (ticker => item). 등록 종목 우선, movers로 거래량·거래대금 실측 보강.
$map = [];
foreach ($regRows as $r) {
    $tk = (string) $r['ticker'];
    $prev = (int) ($r['prevClose'] ?? 0);
    $close = (int) ($r['close'] ?? 0);
    $vol = (int) ($r['volume'] ?? 0);
    $diff = $close - $prev;
    $rate = $prev > 0 ? ($diff / $prev) * 100 : 0.0;
    if (isset($rtReg[$tk])) { // 실시간 현재가·등락률·전일대비·거래량
        $close = (int) round($rtReg[$tk]['close']);
        $rate = $rtReg[$tk]['ratio'] ?? ($prev > 0 ? (($close - $prev) / $prev) * 100 : 0.0);
        $diff = $rtReg[$tk]['diff'] !== null ? (int) round($rtReg[$tk]['diff']) : ($close - $prev);
        if (!empty($rtReg[$tk]['volume'])) $vol = (int) $rtReg[$tk]['volume'];
    }
    $map[$tk] = [
        'ticker' => $tk, 'name' => (string) $r['name'], 'market' => (string) $r['market'],
        'close' => $close, 'diff' => $diff, 'rate' => (float) $rate,
        'vol' => $vol, 'amount' => (float) $close * $vol,
    ];
}
foreach ($movers as $tk => $m) {
    $tk = (string) $tk;
    if (isset($map[$tk])) { // 등록 종목이 랭킹 풀에도 있으면 거래대금·거래량은 실측값으로
        $map[$tk]['vol'] = $m['volume'];
        if ($m['amount'] > 0) $map[$tk]['amount'] = $m['amount'];
    } else { // 미등록 종목 = 그날 랭킹에 뜬 종목 동적 노출
        $map[$tk] = [
            'ticker' => $tk, 'name' => $m['name'], 'market' => $m['market'],
            'close' => (int) round($m['close']), 'diff' => (int) round($m['diff']), 'rate' => (float) $m['ratio'],
            'vol' => (int) $m['volume'], 'amount' => (float) $m['amount'],
        ];
    }
}
$items = array_values(array_filter($map, fn($it) => $it['close'] > 0));

// (4) 토론량(인기) — community_posts 있으면 집계
$discuss = [];
try {
    $dr = $db->query("SELECT ticker, COUNT(*) c FROM community_posts WHERE hidden=0 GROUP BY ticker")->fetchAll();
    foreach ($dr as $d) $discuss[$d['ticker']] = (int) $d['c'];
} catch (Throwable) { $discuss = []; }

// (5) 랭킹 + 전체 목록(거래대금 순, 동적 발굴 포함 최대 60)
$byRate = $items;  usort($byRate, fn($a, $b) => $b['rate'] <=> $a['rate']);
$byValue = $items; usort($byValue, fn($a, $b) => $b['amount'] <=> $a['amount']);
$up = array_slice($byRate, 0, 5);
$down = array_slice(array_reverse($byRate), 0, 5);
$active = array_slice($byValue, 0, 5);
$grid = array_slice($byValue, 0, 60);

// ---- 렌더 헬퍼 ----
function sgn(float $r): string { return $r > 0 ? '#d60000' : ($r < 0 ? '#1263e0' : '#666'); }
function arr(float $r): string { return $r > 0 ? '▲' : ($r < 0 ? '▼' : '−'); }
function amt_short(float $won): string {
    if ($won >= 1e12) return number_format($won / 1e12, 1) . '조';
    if ($won >= 1e8)  return number_format($won / 1e8, 0) . '억';
    if ($won >= 1e4)  return number_format($won / 1e4, 0) . '만';
    return number_format($won);
}

function rank_card(string $title, string $emoji, array $list, array $discuss): string {
    $h = '<div class="rounded-lg border border-zinc-200 bg-white p-4">'
       . '<div class="mb-2 flex items-center gap-1.5 text-[14px] font-bold text-zinc-800">' . $emoji . ' ' . nh($title) . '</div>'
       . '<div class="divide-y divide-zinc-100">';
    $i = 1;
    $moneyRank = str_contains($title, '거래대금');
    foreach ($list as $it) {
        $right = $moneyRank
            ? '<span class="flex-none text-[13px] font-bold text-zinc-700">' . nh(amt_short((float) $it['amount'])) . '</span>'
            : '<span class="flex-none text-[13px] font-bold" style="color:' . sgn($it['rate']) . '">' . arr($it['rate']) . ' ' . number_format($it['rate'], 2) . '%</span>';
        $h .= '<a href="/stock.php?code=' . nh($it['ticker']) . '" class="flex items-center gap-2 py-2 group">'
            . '<span class="w-4 flex-none text-[12px] font-bold text-zinc-400">' . $i++ . '</span>'
            . '<span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-zinc-800 group-hover:text-[#134a9c]">' . nh($it['name']) . '</span>'
            . $right . '</a>';
    }
    $h .= '</div></div>';
    return $h;
}

function grid_html(array $list, array $discuss): string {
    $h = '';
    foreach ($list as $it) {
        $disc = !empty($discuss[$it['ticker']])
            ? '<span class="flex-none text-[11px] text-zinc-400">💬' . (int) $discuss[$it['ticker']] . '</span>' : '';
        $h .= '<a href="/stock.php?code=' . nh($it['ticker']) . '" class="group flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:border-[#134a9c]/40 hover:shadow-sm">'
            . '<div class="min-w-0"><div class="flex items-center gap-1.5">'
            . '<span class="truncate text-[15px] font-bold text-zinc-900 group-hover:text-[#134a9c]">' . nh($it['name']) . '</span>'
            . '<span class="flex-none rounded bg-zinc-100 px-1 py-0.5 text-[10px] font-bold text-zinc-400">' . nh($it['market']) . '</span>' . $disc
            . '</div><div class="mt-0.5 text-[11px] text-zinc-400">거래대금 ' . nh(amt_short((float) $it['amount'])) . '</div></div>'
            . '<div class="flex flex-none flex-col items-end">'
            . '<span class="text-[15px] font-extrabold" style="color:' . sgn($it['rate']) . '">' . number_format($it['close']) . '</span>'
            . '<span class="text-[11.5px] font-bold" style="color:' . sgn($it['rate']) . '">' . arr($it['rate']) . ' ' . number_format($it['rate'], 2) . '%</span>'
            . '</div></a>';
    }
    return $h;
}

// ---- 자동 갱신용 JSON 엔드포인트 (JS가 폴링) ----
if (($_GET['format'] ?? '') === 'json') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode([
        'isLive' => $isLive,
        'open' => market_is_open(),
        'asof' => (new DateTime('now', new DateTimeZone('Asia/Seoul')))->format('H:i:s'),
        'count' => count($items),
        'rankUp' => rank_card('급등', '🔺', $up, $discuss),
        'rankDown' => rank_card('급락', '🔻', $down, $discuss),
        'rankActive' => rank_card('거래대금 상위', '💰', $active, $discuss),
        'grid' => grid_html($grid, $discuss),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$ticker = [];
try { $ticker = array_slice(news_articles(), 0, 6); } catch (Throwable) {}

render_head('종목 시세·랭킹 — HOM2BOX 주식', '실시간 시세·거래대금과 급등·급락 상위 종목, 종목별 AI 분석·토론.');
render_ticker($ticker);
render_topbar();
render_masthead();
render_nav('종목', [], true);
?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-[1399px] px-4 sm:px-6 py-6">
    <div class="flex items-end justify-between border-b-2 border-zinc-900 pb-3">
      <div>
        <h1 class="text-[24px] font-extrabold tracking-tight">종목 시세 · 랭킹</h1>
        <p class="mt-1 flex items-center gap-1.5 text-[13px] text-zinc-500">
          <?php if ($isLive): ?><span class="inline-flex h-1.5 w-1.5 flex-none rounded-full bg-[#d60000] animate-pulse"></span><?php endif; ?>
          <span><?= $isLive ? '실시간 시세(네이버)' : '무료·지연 종가' ?> 기준 · <span id="asof"></span> AI가 매일 종목을 분석합니다</span>
        </p>
      </div>
    </div>

    <?php if (!$items): ?>
      <div class="py-24 text-center text-zinc-400">시세 데이터를 준비 중입니다. 잠시 후 다시 확인해 주세요.</div>
    <?php else: ?>
      <!-- 랭킹 3종 -->
      <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div id="rank-up"><?= rank_card('급등', '🔺', $up, $discuss) ?></div>
        <div id="rank-down"><?= rank_card('급락', '🔻', $down, $discuss) ?></div>
        <div id="rank-active"><?= rank_card('거래대금 상위', '💰', $active, $discuss) ?></div>
      </div>

      <!-- 전체 종목 (거래대금 순, 동적 발굴 포함) -->
      <div class="mt-8">
        <div class="mb-3 flex items-center gap-2.5 border-b-2 border-zinc-900 pb-2.5">
          <span class="h-[17px] w-[3px] rounded-full bg-[#e0392b]"></span>
          <h2 class="text-[18px] font-bold tracking-tight">전체 종목 <span class="text-[13px] font-normal text-zinc-400"><?= count($items) ?></span></h2>
        </div>
        <div id="stock-grid" class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"><?= grid_html($grid, $discuss) ?></div>
      </div>

      <div class="mt-6 rounded-md border border-zinc-200 bg-white p-3 text-[11.5px] leading-relaxed text-zinc-400">
        ⚠️ 시세는 <?= $isLive ? '네이버 <b>실시간(장중 현재가·거래대금, 장마감 후 종가)</b>' : '<b>지연 종가</b>' ?> 기준 정보 제공 목적입니다. 특정 종목의 매수·매도를 권유하지 않으며, <b>투자 판단과 책임은 이용자 본인</b>에게 있습니다.
      </div>

      <script>
      (function () {
        var $ = function (id) { return document.getElementById(id); };
        var open = <?= market_is_open() ? 'true' : 'false' ?>;
        var timer = null;
        function paint(d) {
          if ($('rank-up')) $('rank-up').innerHTML = d.rankUp;
          if ($('rank-down')) $('rank-down').innerHTML = d.rankDown;
          if ($('rank-active')) $('rank-active').innerHTML = d.rankActive;
          if ($('stock-grid')) $('stock-grid').innerHTML = d.grid;
          if ($('asof')) $('asof').textContent = d.asof + ' 기준 ·';
          open = d.open;
        }
        async function refresh() {
          try {
            var r = await fetch(location.pathname + '?format=json&_=' + Date.now(), { cache: 'no-store' });
            if (r.ok) paint(await r.json());
          } catch (e) {}
        }
        function loop() {
          clearTimeout(timer);
          // 장중 30초 / 장외 5분 폴링(서버 60초 캐시라 부담 적음)
          timer = setTimeout(function () { if (!document.hidden) refresh().then(loop); else loop(); }, open ? 30000 : 300000);
        }
        document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
        refresh(); // 로드 직후 1회(asof 표시)
        loop();
      })();
      </script>
    <?php endif; ?>
  </div>
  <?php render_footer(); ?>
</div>
</body></html>
