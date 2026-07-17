<?php
// 시장 시세 스트립 — 서버측 fetch + 60초 캐시(CORS 회피). 시안: 필박스 + 등락 배지.
// 소스: 네이버 폴링(지수·국내주식), open.er-api(원/달러), 업비트(비트코인).
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

/** 시세 목록 — [['label','value','ratio'(float|null),'up'(bool|null)], ...] */
function market_quotes(): array
{
    $cacheFile = sys_get_temp_dir() . '/goblog_market2.json';
    if (is_file($cacheFile) && time() - filemtime($cacheFile) < 60) {
        $c = json_decode((string) file_get_contents($cacheFile), true);
        if (is_array($c) && $c) return $c;
    }

    $out = [];
    $push = function (string $label, $value, $ratio) use (&$out) {
        $out[] = [
            'label' => $label,
            'value' => (string) $value,
            'ratio' => $ratio === null ? null : (float) $ratio,
            'up' => $ratio === null ? null : ((float) $ratio >= 0),
        ];
    };

    // 지수 (코스피·코스닥)
    $dom = mkt_fetch('https://polling.finance.naver.com/api/realtime/domestic/index/KOSPI,KOSDAQ');
    foreach (($dom['datas'] ?? []) as $d) {
        if (!empty($d['closePrice'])) $push($d['stockName'] ?? '지수', $d['closePrice'], $d['fluctuationsRatio'] ?? null);
    }
    // 원/달러
    $usdkrw = null;
    $fx = mkt_fetch('https://open.er-api.com/v6/latest/USD');
    if (!empty($fx['rates']['KRW'])) {
        $usdkrw = (float) $fx['rates']['KRW'];
        $push('원/달러', number_format($usdkrw, 2), null);
    }
    // 나스닥
    $world = mkt_fetch('https://polling.finance.naver.com/api/realtime/worldstock/index/.IXIC');
    foreach (($world['datas'] ?? []) as $d) {
        if (!empty($d['closePrice'])) $push('나스닥', $d['closePrice'], $d['fluctuationsRatio'] ?? null);
    }
    // 비트코인 (업비트 KRW, 백만 단위 축약)
    $btc = mkt_fetch('https://api.upbit.com/v1/ticker?markets=KRW-BTC');
    if (!empty($btc[0]['trade_price'])) {
        $p = (float) $btc[0]['trade_price'];
        $push('비트코인', number_format($p / 1_000_000, 1) . 'M', isset($btc[0]['signed_change_rate']) ? round((float) $btc[0]['signed_change_rate'] * 100, 2) : null);
    }
    // 국내 주식 — 삼성전자·SK하이닉스
    $hynixKrw = null;
    $hynixRatio = null;
    $stocks = mkt_fetch('https://polling.finance.naver.com/api/realtime/domestic/stock/005930,000660');
    foreach (($stocks['datas'] ?? []) as $d) {
        if (empty($d['closePrice'])) continue;
        $name = $d['stockName'] ?? '';
        $label = $name === '삼성전자' ? '삼성전자' : ($name === 'SK하이닉스' ? '하이닉스' : $name);
        $push($label, $d['closePrice'], $d['fluctuationsRatio'] ?? null);
        if ($name === 'SK하이닉스') {
            $hynixKrw = (float) str_replace(',', '', (string) $d['closePrice']);
            $hynixRatio = $d['fluctuationsRatio'] ?? null;
        }
    }
    // 하이닉스 ADR — 공개 실시간 소스가 없어 원화가÷환율 환산 지표(등락률은 원주와 동일 근사)
    if ($hynixKrw && $usdkrw) {
        $push('하이닉스ADR', '$' . number_format($hynixKrw / $usdkrw, 2), $hynixRatio);
    }

    if ($out) @file_put_contents($cacheFile, json_encode($out, JSON_UNESCAPED_UNICODE), LOCK_EX);
    return $out;
}

/** 시세 스트립 렌더 — 시안: 흰 배경 필박스 + 등락 배지(상승 빨강/하락 파랑) */
function render_market_strip(): void
{
    $q = [];
    try { $q = market_quotes(); } catch (Throwable) {}
    if (!$q) return;
    ?>
<div class="border-b border-zinc-200 bg-white">
  <div class="mx-auto flex max-w-[1399px] items-center gap-2 overflow-x-auto px-4 sm:px-6 py-2">
    <span class="mr-1 flex flex-none items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-zinc-400"><span class="inline-block h-1.5 w-1.5 rounded-full bg-[#e0392b]"></span>Market</span>
    <?php foreach ($q as $it):
        $up = $it['up'];
        $badge = '';
        if ($it['ratio'] !== null) {
            $cls = $up ? 'bg-red-50 text-[#e0392b]' : 'bg-blue-50 text-[#1d4ed8]';
            $arrow = $up ? '▲' : '▼';
            $badge = '<span class="rounded px-1.5 py-0.5 text-[10.5px] font-bold ' . $cls . '">' . $arrow . ' ' . number_format(abs((float) $it['ratio']), 2) . '%</span>';
        } ?>
      <span class="flex flex-none items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-2.5 py-1">
        <span class="text-[12px] font-bold text-zinc-600"><?= nh($it['label']) ?></span>
        <span class="text-[12.5px] font-extrabold text-zinc-900"><?= nh($it['value']) ?></span>
        <?= $badge ?>
      </span>
    <?php endforeach; ?>
  </div>
</div>
    <?php
}
