<?php
// 주식 커뮤니티 — 종목 페이지 (무료·지연 종가). /stock.php?code=005930
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

$code = preg_replace('/[^0-9]/', '', (string) ($_GET['code'] ?? ''));
$db = goblog_db();

$stock = null;
$prices = [];
$articles = [];
if ($code !== '') {
    try {
        $st = $db->prepare('SELECT ticker, name, market, sector FROM stocks WHERE ticker = ?');
        $st->execute([$code]);
        $stock = $st->fetch() ?: null;
    } catch (Throwable) { $stock = null; }

    if ($stock) {
        try {
            $st = $db->prepare('SELECT date, open, high, low, close, volume FROM stock_prices WHERE ticker = ? ORDER BY date DESC LIMIT 60');
            $st->execute([$code]);
            $prices = array_reverse($st->fetchAll()); // 오래된→최신
        } catch (Throwable) { $prices = []; }

        try {
            $st = $db->prepare(
                "SELECT a.id, a.title, a.excerpt, a.publishAt, k.category kwCategory
                 FROM article_stocks ast
                 JOIN articles a ON a.id = ast.articleId
                 LEFT JOIN keywords k ON k.id = a.keywordId
                 WHERE ast.ticker = ? AND a.contentHtml IS NOT NULL
                   AND (a.publishAt IS NOT NULL AND a.status IN ('SCHEDULED','PUBLISHED'))
                 ORDER BY a.publishAt DESC LIMIT 20"
            );
            $st->execute([$code]);
            $articles = $st->fetchAll();
        } catch (Throwable) { $articles = []; }
    }
}

$ticker = [];
try { $ticker = array_slice(news_articles(), 0, 6); } catch (Throwable) {}

// 최신·전일 종가 → 전일대비
$last = $prices ? end($prices) : null;
$prev = (count($prices) >= 2) ? $prices[count($prices) - 2] : null;
$close = $last ? (int) $last['close'] : 0;
$prevClose = $prev ? (int) $prev['close'] : $close;
$diff = $close - $prevClose;
$rate = $prevClose > 0 ? ($diff / $prevClose) * 100 : 0;
// 한국식: 상승=빨강, 하락=파랑
$upColor = '#d60000';
$downColor = '#1263e0';
$sign = $diff > 0 ? $upColor : ($diff < 0 ? $downColor : '#666');
$arrow = $diff > 0 ? '▲' : ($diff < 0 ? '▼' : '−');

$title = $stock ? ($stock['name'] . ' (' . $code . ') 주가·분석 — HOM2BOX') : '종목을 찾을 수 없습니다 — HOM2BOX';
render_head($title, $stock ? ($stock['name'] . ' 주가(지연 종가)와 AI 분석·토론.') : '');
render_ticker($ticker);
render_topbar();
render_masthead();
render_nav('종목', [], true);

// 일봉 라인 차트 (SVG, 의존성 0)
$chart = '';
if (count($prices) >= 2) {
    $closes = array_map(fn($p) => (int) $p['close'], $prices);
    $min = min($closes); $max = max($closes); $span = max(1, $max - $min);
    $w = 680; $h = 200; $pad = 6;
    $n = count($closes);
    $pts = [];
    foreach ($closes as $i => $c) {
        $x = $pad + ($i / max(1, $n - 1)) * ($w - 2 * $pad);
        $y = $pad + (1 - ($c - $min) / $span) * ($h - 2 * $pad);
        $pts[] = round($x, 1) . ',' . round($y, 1);
    }
    $line = implode(' ', $pts);
    $lineColor = ($closes[$n - 1] >= $closes[0]) ? $upColor : $downColor;
    $areaFill = ($closes[$n - 1] >= $closes[0]) ? 'rgba(214,0,0,0.06)' : 'rgba(18,99,224,0.06)';
    $areaPts = $pad . ',' . ($h - $pad) . ' ' . $line . ' ' . ($w - $pad) . ',' . ($h - $pad);
    $chart =
        '<svg viewBox="0 0 ' . $w . ' ' . $h . '" class="w-full" style="height:200px" preserveAspectRatio="none">'
        . '<polygon points="' . $areaPts . '" fill="' . $areaFill . '"/>'
        . '<polyline points="' . $line . '" fill="none" stroke="' . $lineColor . '" stroke-width="1.6"/>'
        . '</svg>';
}
?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-[1399px] px-4 sm:px-6 py-6">
  <?php if (!$stock): ?>
    <div class="py-24 text-center text-zinc-400">종목을 찾을 수 없습니다. (예: <a href="/stock.php?code=005930" class="text-[#134a9c] underline">삼성전자</a>)</div>
  <?php else: ?>
    <!-- 종목 헤더 -->
    <div class="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-[26px] font-extrabold tracking-tight"><?= nh($stock['name']) ?></h1>
          <span class="rounded bg-zinc-100 px-2 py-0.5 text-[12px] font-bold text-zinc-500"><?= nh($stock['market']) ?> · <?= nh($code) ?></span>
        </div>
        <div class="mt-2 flex items-baseline gap-3">
          <span class="text-[30px] font-extrabold" style="color:<?= $sign ?>"><?= number_format($close) ?></span>
          <span class="text-[16px] font-bold" style="color:<?= $sign ?>"><?= $arrow ?> <?= number_format(abs($diff)) ?> (<?= number_format($rate, 2) ?>%)</span>
        </div>
        <div class="mt-1 text-[12px] text-zinc-400"><?= $last ? nh($last['date']) . ' 종가 기준 (지연 시세)' : '시세 준비 중' ?></div>
      </div>
      <a href="/" class="text-[13px] font-bold text-zinc-400 hover:text-[#134a9c]">← 홈</a>
    </div>

    <!-- 일봉 차트 -->
    <?php if ($chart): ?>
      <div class="mt-4 rounded-lg border border-zinc-200 bg-white p-3">
        <div class="mb-1 text-[12px] font-bold text-zinc-500">최근 <?= count($prices) ?>거래일 (종가)</div>
        <?= $chart ?>
      </div>
    <?php else: ?>
      <div class="mt-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-[13px] text-zinc-400">시세 데이터를 불러오는 중입니다. 잠시 후 다시 확인해 주세요.</div>
    <?php endif; ?>

    <!-- AI 분석글 -->
    <div class="mt-8">
      <div class="mb-3 flex items-center gap-2.5 border-b-2 border-zinc-900 pb-2.5">
        <span class="h-[17px] w-[3px] rounded-full bg-[#e0392b]"></span>
        <h2 class="text-[18px] font-bold tracking-tight"><?= nh($stock['name']) ?> AI 분석</h2>
      </div>
      <?php if (!$articles): ?>
        <div class="py-10 text-center text-[13px] text-zinc-400">이 종목의 분석글이 아직 없습니다. 곧 채워집니다.</div>
      <?php else: ?>
        <div class="divide-y divide-zinc-100">
          <?php foreach ($articles as $a): ?>
            <a href="/article.php?id=<?= (int) $a['id'] ?>" class="group flex flex-col gap-1 py-3.5">
              <div class="text-[16px] font-bold leading-snug group-hover:text-[#134a9c]"><?= nh($a['title']) ?></div>
              <?php if (!empty($a['excerpt'])): ?><div class="text-[13px] leading-relaxed text-zinc-500 line-clamp-2"><?= nh($a['excerpt']) ?></div><?php endif; ?>
              <div class="text-[11.5px] text-zinc-400"><?= nh(news_date($a['publishAt'])) ?></div>
            </a>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>

    <!-- 토론방 (2차 — 로그인 붙이면 활성화) -->
    <div class="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-center">
      <div class="text-[14px] font-bold text-zinc-700">💬 종목 토론방 준비 중</div>
      <div class="mt-1 text-[12.5px] text-zinc-500">로그인·글쓰기·투자의견 투표가 곧 열립니다.</div>
    </div>

    <!-- 면책 고지 (필수) -->
    <div class="mt-6 rounded-md border border-zinc-200 bg-white p-3 text-[11.5px] leading-relaxed text-zinc-400">
      ⚠️ 본 페이지의 시세는 <b>지연 종가</b>이며, 분석·정보는 참고용입니다. 특정 종목의 매수·매도를 권유하지 않으며, <b>투자 판단과 책임은 이용자 본인</b>에게 있습니다. HOM2BOX는 투자 결과에 대해 책임지지 않습니다.
    </div>
  <?php endif; ?>
  </div>
  <?php render_footer(); ?>
</div>
</body></html>
