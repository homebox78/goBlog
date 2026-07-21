<?php
// 주식 커뮤니티 — 종목 목록·랭킹 (무료·지연 종가). /stocks.php
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

$db = goblog_db();
$rows = [];
try {
    // 종목별 최신 종가·전일 종가·거래량 (서브쿼리 — 종목 수가 적어 충분)
    $rows = $db->query(
        "SELECT s.ticker, s.name, s.market,
                (SELECT close  FROM stock_prices p WHERE p.ticker=s.ticker ORDER BY p.date DESC LIMIT 1)     AS close,
                (SELECT close  FROM stock_prices p WHERE p.ticker=s.ticker ORDER BY p.date DESC LIMIT 1 OFFSET 1) AS prevClose,
                (SELECT volume FROM stock_prices p WHERE p.ticker=s.ticker ORDER BY p.date DESC LIMIT 1)     AS volume
         FROM stocks s WHERE s.active=1"
    )->fetchAll();
} catch (Throwable) { $rows = []; }

// 파생 지표 계산
$items = [];
foreach ($rows as $r) {
    $close = (int) ($r['close'] ?? 0);
    if ($close <= 0) continue;
    $prev = (int) ($r['prevClose'] ?? $close);
    $diff = $close - $prev;
    $rate = $prev > 0 ? ($diff / $prev) * 100 : 0;
    $vol = (int) ($r['volume'] ?? 0);
    $items[] = [
        'ticker' => $r['ticker'], 'name' => $r['name'], 'market' => $r['market'],
        'close' => $close, 'diff' => $diff, 'rate' => $rate, 'vol' => $vol, 'value' => $close * $vol,
    ];
}

// 토론량(인기) — article_stocks/community_posts 있으면 집계(없으면 0)
$discuss = [];
try {
    $dr = $db->query("SELECT ticker, COUNT(*) c FROM community_posts WHERE hidden=0 GROUP BY ticker")->fetchAll();
    foreach ($dr as $d) $discuss[$d['ticker']] = (int) $d['c'];
} catch (Throwable) { $discuss = []; }

$byRate = $items;   usort($byRate, fn($a, $b) => $b['rate'] <=> $a['rate']);
$byValue = $items;  usort($byValue, fn($a, $b) => $b['value'] <=> $a['value']);
$up = array_slice($byRate, 0, 5);
$down = array_slice(array_reverse($byRate), 0, 5);
$active = array_slice($byValue, 0, 5);

$ticker = [];
try { $ticker = array_slice(news_articles(), 0, 6); } catch (Throwable) {}

$UP = '#d60000'; $DOWN = '#1263e0';
function sgn(float $r): string { return $r > 0 ? '#d60000' : ($r < 0 ? '#1263e0' : '#666'); }
function arr(float $r): string { return $r > 0 ? '▲' : ($r < 0 ? '▼' : '−'); }

render_head('종목 시세·랭킹 — HOM2BOX 주식', '급등·급락·거래대금 상위 종목과 AI 분석. 무료·지연 종가.');
render_ticker($ticker);
render_topbar();
render_masthead();
render_nav('종목', [], true);

// 랭킹 카드 렌더 헬퍼
function rank_card(string $title, string $emoji, array $list, array $discuss): string {
    $h = '<div class="rounded-lg border border-zinc-200 bg-white p-4">'
       . '<div class="mb-2 flex items-center gap-1.5 text-[14px] font-bold text-zinc-800">' . $emoji . ' ' . nh($title) . '</div>'
       . '<div class="divide-y divide-zinc-100">';
    $i = 1;
    foreach ($list as $it) {
        $h .= '<a href="/stock.php?code=' . nh($it['ticker']) . '" class="flex items-center gap-2 py-2 group">'
            . '<span class="w-4 flex-none text-[12px] font-bold text-zinc-400">' . $i++ . '</span>'
            . '<span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-zinc-800 group-hover:text-[#134a9c]">' . nh($it['name']) . '</span>'
            . '<span class="flex-none text-[13px] font-bold" style="color:' . sgn($it['rate']) . '">' . arr($it['rate']) . ' ' . number_format($it['rate'], 2) . '%</span>'
            . '</a>';
    }
    $h .= '</div></div>';
    return $h;
}
?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-[1399px] px-4 sm:px-6 py-6">
    <div class="flex items-end justify-between border-b-2 border-zinc-900 pb-3">
      <div>
        <h1 class="text-[24px] font-extrabold tracking-tight">종목 시세 · 랭킹</h1>
        <p class="mt-1 text-[13px] text-zinc-500">무료·지연 종가 기준 · AI가 매일 종목을 분석합니다</p>
      </div>
    </div>

    <?php if (!$items): ?>
      <div class="py-24 text-center text-zinc-400">시세 데이터를 준비 중입니다. 잠시 후 다시 확인해 주세요.</div>
    <?php else: ?>
      <!-- 랭킹 3종 -->
      <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <?= rank_card('급등', '🔺', $up, $discuss) ?>
        <?= rank_card('급락', '🔻', $down, $discuss) ?>
        <?= rank_card('거래대금 상위', '💰', $active, $discuss) ?>
      </div>

      <!-- 전체 종목 -->
      <div class="mt-8">
        <div class="mb-3 flex items-center gap-2.5 border-b-2 border-zinc-900 pb-2.5">
          <span class="h-[17px] w-[3px] rounded-full bg-[#e0392b]"></span>
          <h2 class="text-[18px] font-bold tracking-tight">전체 종목 <span class="text-[13px] font-normal text-zinc-400"><?= count($items) ?></span></h2>
        </div>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <?php foreach ($byValue as $it): ?>
            <a href="/stock.php?code=<?= nh($it['ticker']) ?>" class="group flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:border-[#134a9c]/40 hover:shadow-sm">
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="truncate text-[15px] font-bold text-zinc-900 group-hover:text-[#134a9c]"><?= nh($it['name']) ?></span>
                  <span class="flex-none rounded bg-zinc-100 px-1 py-0.5 text-[10px] font-bold text-zinc-400"><?= nh($it['market']) ?></span>
                  <?php if (!empty($discuss[$it['ticker']])): ?><span class="flex-none text-[11px] text-zinc-400">💬<?= (int) $discuss[$it['ticker']] ?></span><?php endif; ?>
                </div>
              </div>
              <div class="flex flex-none flex-col items-end">
                <span class="text-[15px] font-extrabold" style="color:<?= sgn($it['rate']) ?>"><?= number_format($it['close']) ?></span>
                <span class="text-[11.5px] font-bold" style="color:<?= sgn($it['rate']) ?>"><?= arr($it['rate']) ?> <?= number_format($it['rate'], 2) ?>%</span>
              </div>
            </a>
          <?php endforeach; ?>
        </div>
      </div>

      <div class="mt-6 rounded-md border border-zinc-200 bg-white p-3 text-[11.5px] leading-relaxed text-zinc-400">
        ⚠️ 시세는 <b>지연 종가</b>이며 정보 제공 목적입니다. 특정 종목의 매수·매도를 권유하지 않으며, <b>투자 판단과 책임은 이용자 본인</b>에게 있습니다.
      </div>
    <?php endif; ?>
  </div>
  <?php render_footer(); ?>
</div>
</body></html>
