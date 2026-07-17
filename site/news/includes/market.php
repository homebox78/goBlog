<?php
// 시장 시세 스트립 데이터 — 서버측 fetch + 60초 캐시(CORS 회피, 안정성).
// 소스: 네이버 폴링(코스피·코스닥·나스닥), open.er-api(원/달러), 업비트(비트코인).
declare(strict_types=1);

function mkt_fetch(string $url, int $timeout = 4): ?array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_USERAGENT => 'Mozilla/5.0',
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ]);
    $body = curl_exec($ch);
    $ok = $body !== false && curl_getinfo($ch, CURLINFO_HTTP_CODE) === 200;
    curl_close($ch);
    if (!$ok) return null;
    $j = json_decode((string) $body, true);
    return is_array($j) ? $j : null;
}

/** 시세 목록 반환 — [['label','value','ratio'(float|null),'up'(bool|null)], ...] */
function market_quotes(): array
{
    $cacheFile = sys_get_temp_dir() . '/goblog_market.json';
    if (is_file($cacheFile) && time() - filemtime($cacheFile) < 60) {
        $c = json_decode((string) file_get_contents($cacheFile), true);
        if (is_array($c) && $c) return $c;
    }

    $out = [];
    $num = fn($s) => (float) str_replace(',', '', (string) $s);

    // 국내 지수 (코스피·코스닥)
    $dom = mkt_fetch('https://polling.finance.naver.com/api/realtime/domestic/index/KOSPI,KOSDAQ');
    foreach (($dom['datas'] ?? []) as $d) {
        if (empty($d['closePrice'])) continue;
        $out[] = [
            'label' => $d['stockName'] ?? '지수',
            'value' => $d['closePrice'],
            'ratio' => isset($d['fluctuationsRatio']) ? (float) $d['fluctuationsRatio'] : null,
            'up' => isset($d['fluctuationsRatio']) ? ((float) $d['fluctuationsRatio'] >= 0) : null,
        ];
    }
    // 해외 지수 (나스닥)
    $world = mkt_fetch('https://polling.finance.naver.com/api/realtime/worldstock/index/.IXIC');
    foreach (($world['datas'] ?? []) as $d) {
        if (empty($d['closePrice'])) continue;
        $out[] = [
            'label' => '나스닥',
            'value' => $d['closePrice'],
            'ratio' => isset($d['fluctuationsRatio']) ? (float) $d['fluctuationsRatio'] : null,
            'up' => isset($d['fluctuationsRatio']) ? ((float) $d['fluctuationsRatio'] >= 0) : null,
        ];
    }
    // 원/달러 (open.er-api)
    $fx = mkt_fetch('https://open.er-api.com/v6/latest/USD');
    if (!empty($fx['rates']['KRW'])) {
        $out[] = [
            'label' => '원/달러',
            'value' => number_format($num($fx['rates']['KRW']), 2),
            'ratio' => null,
            'up' => null,
        ];
    }
    // 비트코인 (업비트, KRW)
    $btc = mkt_fetch('https://api.upbit.com/v1/ticker?markets=KRW-BTC');
    if (!empty($btc[0]['trade_price'])) {
        $out[] = [
            'label' => '비트코인',
            'value' => number_format((float) $btc[0]['trade_price']),
            'ratio' => isset($btc[0]['signed_change_rate']) ? round((float) $btc[0]['signed_change_rate'] * 100, 2) : null,
            'up' => isset($btc[0]['signed_change_rate']) ? ((float) $btc[0]['signed_change_rate'] >= 0) : null,
        ];
    }

    if ($out) {
        @file_put_contents($cacheFile, json_encode($out, JSON_UNESCAPED_UNICODE), LOCK_EX);
    }
    return $out;
}

/** 시세 스트립 렌더 — 시안: 회색 밴드 + 'Market' 라벨 + 항목별 등락 색상 */
function render_market_strip(): void
{
    $q = [];
    try { $q = market_quotes(); } catch (Throwable) {}
    if (!$q) return;
    ?>
<div class="border-b border-zinc-200 bg-zinc-50">
  <div class="mx-auto flex max-w-[1399px] items-center gap-3 overflow-x-auto px-4 sm:px-6 py-2">
    <span class="flex flex-none items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-[#134a9c]"><span class="material-symbols-outlined text-[15px]">trending_up</span>Market</span>
    <?php foreach ($q as $it):
        $up = $it['up'];
        $color = $up === null ? 'text-zinc-500' : ($up ? 'text-[#e0392b]' : 'text-[#1d4ed8]');
        $arrow = $up === null ? '' : ($up ? '▲' : '▼'); ?>
      <span class="flex flex-none items-center gap-1.5 whitespace-nowrap text-[12px]">
        <span class="font-bold text-zinc-600"><?= nh($it['label']) ?></span>
        <span class="font-extrabold text-zinc-900"><?= nh((string) $it['value']) ?></span>
        <?php if ($it['ratio'] !== null): ?>
          <span class="<?= $color ?> font-bold"><?= $arrow ?> <?= number_format(abs((float) $it['ratio']), 2) ?>%</span>
        <?php endif; ?>
      </span>
      <span class="flex-none text-zinc-200">·</span>
    <?php endforeach; ?>
  </div>
</div>
    <?php
}
