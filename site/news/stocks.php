<?php
// 주식 커뮤니티 — 국내/해외 탭, 급등·급락·거래대금 이슈종목(네이버 실시간). /stocks.php
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

$db = goblog_db();

/* ===== 국내: 관리자 등록 종목 + 네이버 랭킹 풀 병합 ===== */
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

$domMovers = [];
try { $domMovers = stock_movers(); } catch (Throwable) {}
$rtReg = [];
try { $rtReg = stock_realtime(array_map(fn($r) => (string) $r['ticker'], $regRows)); } catch (Throwable) {}

$domMap = [];
foreach ($regRows as $r) {
    $tk = (string) $r['ticker'];
    $prev = (int) ($r['prevClose'] ?? 0);
    $close = (int) ($r['close'] ?? 0);
    $vol = (int) ($r['volume'] ?? 0);
    $diff = $close - $prev;
    $rate = $prev > 0 ? ($diff / $prev) * 100 : 0.0;
    if (isset($rtReg[$tk])) {
        $close = (int) round($rtReg[$tk]['close']);
        $rate = $rtReg[$tk]['ratio'] ?? ($prev > 0 ? (($close - $prev) / $prev) * 100 : 0.0);
        $diff = $rtReg[$tk]['diff'] !== null ? (int) round($rtReg[$tk]['diff']) : ($close - $prev);
        if (!empty($rtReg[$tk]['volume'])) $vol = (int) $rtReg[$tk]['volume'];
    }
    $domMap[$tk] = ['ticker' => $tk, 'name' => (string) $r['name'], 'market' => (string) $r['market'],
        'close' => $close, 'diff' => $diff, 'rate' => (float) $rate, 'vol' => $vol, 'amount' => (float) $close * $vol, 'usd' => false];
}
foreach ($domMovers as $tk => $m) {
    $tk = (string) $tk;
    if (isset($domMap[$tk])) {
        $domMap[$tk]['vol'] = $m['volume'];
        if ($m['amount'] > 0) $domMap[$tk]['amount'] = $m['amount'];
    } else {
        $domMap[$tk] = ['ticker' => $tk, 'name' => $m['name'], 'market' => $m['market'],
            'close' => (int) round($m['close']), 'diff' => (int) round($m['diff']), 'rate' => (float) $m['ratio'],
            'vol' => (int) $m['volume'], 'amount' => (float) $m['amount'], 'usd' => false];
    }
}
$domItems = array_values(array_filter($domMap, fn($it) => $it['close'] > 0));

/* ===== 해외: 네이버 미국 랭킹 풀 ===== */
$ovMovers = [];
try { $ovMovers = stock_movers_overseas(); } catch (Throwable) {}
$ovItems = [];
foreach ($ovMovers as $m) {
    if (($m['close'] ?? 0) <= 0) continue;
    $ovItems[] = ['ticker' => $m['ticker'], 'name' => $m['name'], 'market' => $m['market'],
        'close' => (float) $m['close'], 'diff' => (float) $m['diff'], 'rate' => (float) $m['ratio'],
        'vol' => (int) $m['volume'], 'amount' => (float) $m['amount'], 'usd' => true];
}

$isLive = !empty($domMovers) || !empty($rtReg) || !empty($ovMovers);

/* 토론량(국내 등록종목 위주) */
$discuss = [];
try {
    $dr = $db->query("SELECT ticker, COUNT(*) c FROM community_posts WHERE hidden=0 GROUP BY ticker")->fetchAll();
    foreach ($dr as $d) $discuss[$d['ticker']] = (int) $d['c'];
} catch (Throwable) { $discuss = []; }

// 최근 종목 토론 피드 + 종목명 맵(등록+국내/해외 랭킹)
$talk = [];
try {
    $talk = $db->query(
        "SELECT p.ticker, p.body, p.stance, p.createdAt, u.name authorName
         FROM community_posts p JOIN community_users u ON u.id=p.userId
         WHERE p.hidden=0 ORDER BY p.id DESC LIMIT 10"
    )->fetchAll();
} catch (Throwable) { $talk = []; }
$nameMap = [];
foreach ($domItems as $it) $nameMap[$it['ticker']] = $it['name'];
foreach ($ovItems as $it) $nameMap[$it['ticker']] = $it['name'];
try { foreach ($db->query('SELECT ticker,name FROM stocks')->fetchAll() as $s) $nameMap[$s['ticker']] = $s['name']; } catch (Throwable) {}

/* 랭킹 분할 */
function rank_split(array $items): array {
    $byRate = $items;  usort($byRate, fn($a, $b) => $b['rate'] <=> $a['rate']);
    $byVal = $items;   usort($byVal, fn($a, $b) => $b['amount'] <=> $a['amount']);
    return ['up' => array_slice($byRate, 0, 5), 'down' => array_slice(array_reverse($byRate), 0, 5),
            'active' => array_slice($byVal, 0, 5), 'grid' => array_slice($byVal, 0, 60), 'count' => count($items)];
}
$dom = rank_split($domItems);
$ov = rank_split($ovItems);

/* ===== 렌더 헬퍼 ===== */
function sgn(float $r): string { return $r > 0 ? '#d60000' : ($r < 0 ? '#1263e0' : '#666'); }
function arr(float $r): string { return $r > 0 ? '▲' : ($r < 0 ? '▼' : '−'); }
function amt_short(float $won): string {
    if ($won >= 1e12) return number_format($won / 1e12, 1) . '조';
    if ($won >= 1e8)  return number_format($won / 1e8, 0) . '억';
    if ($won >= 1e4)  return number_format($won / 1e4, 0) . '만';
    return $won > 0 ? number_format($won) : '—';
}
function price_str(array $it): string {
    return !empty($it['usd']) ? '$' . number_format((float) $it['close'], 2) : number_format((int) round($it['close']));
}

function rank_card(string $title, string $emoji, array $list): string {
    $money = str_contains($title, '거래대금');
    $h = '<div class="rounded-lg border border-zinc-200 bg-white p-4">'
       . '<div class="mb-2 flex items-center gap-1.5 text-[14px] font-bold text-zinc-800">' . $emoji . ' ' . nh($title) . '</div>'
       . '<div class="divide-y divide-zinc-100">';
    $i = 1;
    foreach ($list as $it) {
        $right = $money
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
function rank_cards_html(array $r): string {
    return rank_card('급등', '🔺', $r['up']) . rank_card('급락', '🔻', $r['down']) . rank_card('거래대금 상위', '💰', $r['active']);
}
function grid_html(array $list, array $discuss): string {
    $h = '';
    foreach ($list as $it) {
        $disc = !empty($discuss[$it['ticker']])
            ? '<span class="flex-none rounded-full bg-[#134a9c]/10 px-1.5 py-0.5 text-[10.5px] font-bold text-[#134a9c]">💬 ' . (int) $discuss[$it['ticker']] . '</span>' : '';
        $h .= '<a href="/stock.php?code=' . nh($it['ticker']) . '" class="group flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:border-[#134a9c]/40 hover:shadow-sm">'
            . '<div class="min-w-0"><div class="flex items-center gap-1.5">'
            . '<span class="truncate text-[15px] font-bold text-zinc-900 group-hover:text-[#134a9c]">' . nh($it['name']) . '</span>'
            . '<span class="flex-none rounded bg-zinc-100 px-1 py-0.5 text-[10px] font-bold text-zinc-400">' . nh($it['market']) . '</span>' . $disc
            . '</div><div class="mt-0.5 text-[11px] text-zinc-400">거래대금 ' . nh(amt_short((float) $it['amount'])) . '</div></div>'
            . '<div class="flex flex-none flex-col items-end">'
            . '<span class="text-[15px] font-extrabold" style="color:' . sgn($it['rate']) . '">' . nh(price_str($it)) . '</span>'
            . '<span class="text-[11.5px] font-bold" style="color:' . sgn($it['rate']) . '">' . arr($it['rate']) . ' ' . number_format($it['rate'], 2) . '%</span>'
            . '</div></a>';
    }
    return $h;
}

/* ===== 자동 갱신 JSON ===== */
if (($_GET['format'] ?? '') === 'json') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode([
        'isLive' => $isLive,
        'open' => market_is_open() || market_is_open_us(),
        'asof' => (new DateTime('now', new DateTimeZone('Asia/Seoul')))->format('H:i:s'),
        'dom' => ['ranks' => rank_cards_html($dom), 'grid' => grid_html($dom['grid'], $discuss), 'count' => $dom['count']],
        'ov' => ['ranks' => rank_cards_html($ov), 'grid' => grid_html($ov['grid'], $discuss), 'count' => $ov['count']],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$ticker = [];
try { $ticker = array_slice(news_articles(), 0, 6); } catch (Throwable) {}

render_head('종목 시세·랭킹 — HOM2BOX 주식', '국내·해외 실시간 급등·급락·거래대금 이슈 종목, 종목별 AI 분석·토론.');
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
          <span><?= $isLive ? '네이버 실시간' : '지연 시세' ?> · <span id="asof"></span> 급등·급락·거래대금 이슈 종목</span>
        </p>
      </div>
    </div>

    <!-- 실시간 종목 토론 (커뮤니티 코멘트 추출) -->
    <?php if ($talk): ?>
    <section class="mt-5 rounded-xl border border-zinc-200 bg-gradient-to-br from-blue-50/40 to-white p-4">
      <div class="mb-2.5 flex items-center justify-between">
        <h2 class="flex items-center gap-1.5 text-[15px] font-extrabold text-zinc-800">💬 실시간 종목 토론 <span class="rounded-full bg-[#d60000] px-1.5 py-0.5 text-[9px] font-bold text-white">LIVE</span></h2>
        <span class="text-[12px] text-zinc-400">투자자 코멘트</span>
      </div>
      <div class="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        <?php foreach ($talk as $t):
          $snm = $nameMap[$t['ticker']] ?? $t['ticker'];
          $st = $t['stance'] === 'BUY' ? '<span class="flex-none text-[10px] font-bold text-[#d60000]">매수</span>' : ($t['stance'] === 'SELL' ? '<span class="flex-none text-[10px] font-bold text-[#1263e0]">매도</span>' : ($t['stance'] === 'HOLD' ? '<span class="flex-none text-[10px] font-bold text-zinc-400">보유</span>' : ''));
        ?>
        <a href="/stock.php?code=<?= nh($t['ticker']) ?>" class="group flex items-center gap-2 border-b border-zinc-100 py-1.5 text-[13px]">
          <span class="flex-none rounded bg-[#134a9c]/10 px-1.5 py-0.5 text-[11px] font-bold text-[#134a9c]"><?= nh($snm) ?></span>
          <?= $st ?>
          <span class="min-w-0 flex-1 truncate text-zinc-700 group-hover:text-[#134a9c]"><?= nh(mb_substr((string) $t['body'], 0, 40)) ?></span>
          <span class="flex-none text-[11px] text-zinc-400"><?= nh($t['authorName']) ?></span>
        </a>
        <?php endforeach; ?>
      </div>
    </section>
    <?php endif; ?>

    <!-- 국내/해외 탭 -->
    <div class="mt-5 flex items-center gap-1.5" id="stock-tabs">
      <button data-tab="dom" class="stab rounded-full px-5 py-2 text-[14px] font-bold">🇰🇷 국내</button>
      <button data-tab="ov" class="stab rounded-full px-5 py-2 text-[14px] font-bold">🇺🇸 해외</button>
    </div>

    <?php
    // 탭 패널 렌더 (dom/ov 공통 구조)
    function tab_panel(string $key, array $r, array $discuss, bool $hidden): void { ?>
      <div data-panel="<?= $key ?>" class="stock-panel mt-5<?= $hidden ? ' hidden' : '' ?>">
        <?php if (!$r['count']): ?>
          <div class="py-24 text-center text-zinc-400">시세 데이터를 준비 중입니다. 잠시 후 다시 확인해 주세요.</div>
        <?php else: ?>
          <div id="<?= $key ?>-ranks" class="grid grid-cols-1 gap-4 sm:grid-cols-3"><?= rank_cards_html($r) ?></div>
          <div class="mt-8">
            <div class="mb-3 flex items-center gap-2.5 border-b-2 border-zinc-900 pb-2.5">
              <span class="h-[17px] w-[3px] rounded-full bg-[#e0392b]"></span>
              <h2 class="text-[18px] font-bold tracking-tight">전체 종목 <span class="text-[13px] font-normal text-zinc-400"><?= $r['count'] ?></span></h2>
            </div>
            <div id="<?= $key ?>-grid" class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"><?= grid_html($r['grid'], $discuss) ?></div>
          </div>
        <?php endif; ?>
      </div>
    <?php }
    tab_panel('dom', $dom, $discuss, false);
    tab_panel('ov', $ov, $discuss, true);
    ?>

    <div class="mt-6 rounded-md border border-zinc-200 bg-white p-3 text-[11.5px] leading-relaxed text-zinc-400">
      ⚠️ 시세는 <?= $isLive ? '네이버 <b>실시간</b>(국내 장중 현재가·해외 지연 포함)' : '<b>지연 시세</b>' ?> 기준 정보 제공 목적이며, 해외 종목 가격은 USD·거래대금은 원화 환산입니다. 특정 종목의 매수·매도를 권유하지 않으며, <b>투자 판단과 책임은 이용자 본인</b>에게 있습니다.
    </div>
  </div>
  <?php render_footer(); ?>
</div>

<style>
  .stab { background:#fff; border:1px solid #d4d4d8; color:#52525b; }
  .stab.active { background:#18181b; border-color:#18181b; color:#fff; }
</style>
<script>
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var open = <?= (market_is_open() || market_is_open_us()) ? 'true' : 'false' ?>, timer = null;

  // 탭 전환 (localStorage 기억)
  var cur = localStorage.getItem('stockTab') || 'dom';
  function showTab(k) {
    cur = k; localStorage.setItem('stockTab', k);
    document.querySelectorAll('.stab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === k); });
    document.querySelectorAll('.stock-panel').forEach(function (p) { p.classList.toggle('hidden', p.dataset.panel !== k); });
  }
  document.querySelectorAll('.stab').forEach(function (b) { b.addEventListener('click', function () { showTab(b.dataset.tab); }); });
  showTab(cur);

  function paint(d) {
    ['dom', 'ov'].forEach(function (k) {
      var rk = $('#' + k + '-ranks'), gr = $('#' + k + '-grid');
      if (rk && d[k]) rk.innerHTML = d[k].ranks;
      if (gr && d[k]) gr.innerHTML = d[k].grid;
    });
    var a = $('#asof'); if (a) a.textContent = d.asof + ' 기준 ·';
    open = d.open;
  }
  async function refresh() {
    try { var r = await fetch(location.pathname + '?format=json&_=' + Date.now(), { cache: 'no-store' }); if (r.ok) paint(await r.json()); } catch (e) {}
  }
  function loop() { clearTimeout(timer); timer = setTimeout(function () { if (!document.hidden) refresh().then(loop); else loop(); }, open ? 30000 : 300000); }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
  refresh(); loop();
})();
</script>
</body></html>
