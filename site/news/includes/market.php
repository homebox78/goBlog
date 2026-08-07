<?php
// 시장 시세 스트립 — 서버측 fetch + 60초 캐시(CORS 회피). 시안: 필박스 + 등락 배지.
// 소스: 네이버 폴링(지수·국내주식), open.er-api(환율 — 하이닉스 ADR 환산용, 스트립 미표시).
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

/**
 * 종목 실시간 시세 — 네이버 realtime 폴링(마켓 스트립과 동일 소스). 60초 캐시.
 * @return array ticker => ['close'=>float, 'ratio'=>float|null, 'diff'=>float|null]  (장중 현재가·장마감 후 종가)
 */
function stock_realtime(array $tickers): array
{
    $tickers = array_values(array_unique(array_filter(array_map('strval', $tickers))));
    if (!$tickers) return [];
    sort($tickers);
    $cacheFile = sys_get_temp_dir() . '/goblog_rt_' . md5(implode(',', $tickers)) . '.json';
    if (is_file($cacheFile) && time() - filemtime($cacheFile) < 60) {
        $c = json_decode((string) file_get_contents($cacheFile), true);
        if (is_array($c)) return $c;
    }
    $out = [];
    foreach (array_chunk($tickers, 30) as $chunk) {
        $j = mkt_fetch('https://polling.finance.naver.com/api/realtime/domestic/stock/' . implode(',', $chunk));
        foreach (($j['datas'] ?? []) as $d) {
            $code = (string) ($d['itemCode'] ?? '');
            if ($code === '' || empty($d['closePrice'])) continue;
            $out[$code] = [
                'close' => (float) str_replace(',', '', (string) $d['closePrice']),
                'ratio' => isset($d['fluctuationsRatio']) ? (float) $d['fluctuationsRatio'] : null,
                'diff'  => isset($d['compareToPreviousClosePrice']) ? (float) str_replace(',', '', (string) $d['compareToPreviousClosePrice']) : null,
                'volume' => isset($d['accumulatedTradingVolume']) ? (int) str_replace(',', '', (string) $d['accumulatedTradingVolume']) : 0,
            ];
        }
    }
    if ($out) @file_put_contents($cacheFile, json_encode($out), LOCK_EX);
    return $out;
}

/**
 * 네이버 랭킹 풀 — 급등/급락/시총상위(KOSPI+KOSDAQ)을 병합한 실시간 시세맵.
 * 종목 목록을 등록 없이 동적 구성 + 거래량·거래대금 실측(랭킹 API가 함께 내려준다). 60초 캐시.
 * @return array ticker => ['ticker','name','market','close','ratio','diff','volume','amount'(원),'amountText']
 */
function stock_movers(): array
{
    $cacheFile = sys_get_temp_dir() . '/goblog_movers.json';
    if (is_file($cacheFile) && time() - filemtime($cacheFile) < 60) {
        $c = json_decode((string) file_get_contents($cacheFile), true);
        if (is_array($c) && $c) return $c;
    }
    $out = [];
    foreach (['KOSPI' => '코스피', 'KOSDAQ' => '코스닥'] as $mk => $label) {
        // up=급등, down=급락, marketValue=시총상위(거래대금 상위 후보 풀). 값은 이미 부호 포함.
        foreach (['up' => 30, 'down' => 30, 'marketValue' => 60] as $cat => $size) {
            $j = mkt_fetch("https://m.stock.naver.com/api/stocks/$cat/$mk?page=1&pageSize=$size");
            foreach (($j['stocks'] ?? []) as $d) {
                $code = (string) ($d['itemCode'] ?? '');
                if ($code === '' || empty($d['closePrice']) || isset($out[$code])) continue;
                $num = fn(string $k): float => isset($d[$k]) ? (float) str_replace(',', '', (string) $d[$k]) : 0.0;
                $out[$code] = [
                    'ticker' => $code,
                    'name' => (string) ($d['stockName'] ?? $code),
                    'market' => $label,
                    'close' => $num('closePrice'),
                    'ratio' => isset($d['fluctuationsRatio']) ? (float) $d['fluctuationsRatio'] : 0.0,
                    'diff' => $num('compareToPreviousClosePrice'),
                    'volume' => (int) $num('accumulatedTradingVolume'),
                    'amount' => $num('accumulatedTradingValue') * 1000000.0, // 백만원 → 원
                    'amountText' => (string) ($d['accumulatedTradingValueKrwHangeul'] ?? ''),
                ];
            }
        }
    }
    if ($out) @file_put_contents($cacheFile, json_encode($out), LOCK_EX);
    return $out;
}

/** 한글 금액 문자열("1,887억원"·"1.33조원"·"5,120만원") → 원(float). 정렬·표시용. */
function parse_krw_hangeul(string $s): float
{
    $s = str_replace([',', ' ', '원'], '', $s);
    $won = 0.0;
    if (preg_match('/([0-9.]+)조/u', $s, $m)) $won += (float) $m[1] * 1e12;
    if (preg_match('/([0-9.]+)억/u', $s, $m)) $won += (float) $m[1] * 1e8;
    if (preg_match('/([0-9.]+)만/u', $s, $m)) $won += (float) $m[1] * 1e4;
    if ($won == 0.0 && is_numeric($s)) $won = (float) $s;
    return $won;
}

/**
 * 해외(미국) 랭킹 풀 — 나스닥·뉴욕 급등/급락/시총상위 병합. 60초 캐시.
 * 가격은 USD, 거래대금은 원화 환산(accumulatedTradingValueKrwHangeul). ticker=symbolCode.
 * @return array ticker => ['ticker','name','market','close'(USD),'ratio','diff','volume','amount'(원),'reuters','usd'=>true]
 */
function stock_movers_overseas(): array
{
    $cacheFile = sys_get_temp_dir() . '/goblog_movers_ov.json';
    if (is_file($cacheFile) && time() - filemtime($cacheFile) < 60) {
        $c = json_decode((string) file_get_contents($cacheFile), true);
        if (is_array($c) && $c) return $c;
    }
    $out = [];
    foreach (['NASDAQ' => '나스닥', 'NYSE' => '뉴욕'] as $ex => $label) {
        foreach (['up' => 30, 'down' => 30, 'marketValue' => 40] as $cat => $size) {
            $j = mkt_fetch("https://api.stock.naver.com/stock/exchange/$ex/$cat?page=1&pageSize=$size");
            foreach (($j['stocks'] ?? []) as $d) {
                $code = (string) ($d['symbolCode'] ?? '');
                if ($code === '' || empty($d['closePrice']) || isset($out[$code])) continue;
                $num = fn(string $k): float => isset($d[$k]) ? (float) str_replace(',', '', (string) $d[$k]) : 0.0;
                $out[$code] = [
                    'ticker' => $code,
                    'name' => (string) ($d['stockName'] ?? $code),
                    'market' => $label,
                    'close' => $num('closePrice'),
                    'ratio' => isset($d['fluctuationsRatio']) ? (float) $d['fluctuationsRatio'] : 0.0,
                    'diff' => $num('compareToPreviousClosePrice'),
                    'volume' => (int) $num('accumulatedTradingVolume'),
                    'amount' => parse_krw_hangeul((string) ($d['accumulatedTradingValueKrwHangeul'] ?? '')),
                    'reuters' => (string) ($d['reutersCode'] ?? ''),
                    'usd' => true,
                ];
            }
        }
    }
    if ($out) @file_put_contents($cacheFile, json_encode($out), LOCK_EX);
    return $out;
}

/** 미국 정규장 개장 여부(대략, ET 09:30~16:00 = KST 22:30~05:00). 자동 갱신 주기용. */
function market_is_open_us(): bool
{
    $now = new DateTime('now', new DateTimeZone('America/New_York'));
    $dow = (int) $now->format('N');
    if ($dow >= 6) return false;
    $hm = (int) $now->format('Hi');
    return $hm >= 930 && $hm <= 1600;
}

/** 국내 정규장 개장 여부(KST 평일 09:00~15:35) — 자동 갱신 주기 판단용. */
function market_is_open(): bool
{
    $now = new DateTime('now', new DateTimeZone('Asia/Seoul'));
    $dow = (int) $now->format('N'); // 1=월 … 7=일
    if ($dow >= 6) return false;
    $hm = (int) $now->format('Hi');
    return $hm >= 900 && $hm <= 1535;
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
    // 원/달러 — 스트립 출력에서는 제외하나, 하이닉스 ADR 환산에 환율값은 계속 사용
    $usdkrw = null;
    $fx = mkt_fetch('https://open.er-api.com/v6/latest/USD');
    if (!empty($fx['rates']['KRW'])) {
        $usdkrw = (float) $fx['rates']['KRW'];
    }
    // 나스닥
    $world = mkt_fetch('https://polling.finance.naver.com/api/realtime/worldstock/index/.IXIC');
    foreach (($world['datas'] ?? []) as $d) {
        if (!empty($d['closePrice'])) $push('나스닥', $d['closePrice'], $d['fluctuationsRatio'] ?? null);
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
/** 스트립 아이템 HTML(라벨·값·등락 배지) — 렌더와 라이브 갱신 엔드포인트 공용. */
function market_strip_items_html(): string
{
    $q = [];
    try { $q = market_quotes(); } catch (Throwable) {}
    $h = '';
    foreach ($q as $it) {
        $badge = '';
        if (($it['ratio'] ?? null) !== null) {
            $cls = $it['up'] ? 'bg-red-50 text-[#e0392b]' : 'bg-blue-50 text-[#1d4ed8]';
            $arrow = $it['up'] ? '▲' : '▼';
            $badge = '<span class="rounded px-1.5 py-0.5 text-[10.5px] font-bold ' . $cls . '">' . $arrow . ' ' . number_format(abs((float) $it['ratio']), 2) . '%</span>';
        }
        $h .= '<span class="flex flex-none items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-2.5 py-1">'
            . '<span class="text-[12px] font-bold text-zinc-600">' . nh($it['label']) . '</span>'
            . '<span class="text-[12.5px] font-extrabold text-zinc-900">' . nh($it['value']) . '</span>' . $badge . '</span>';
    }
    return $h;
}

function render_market_strip(): void
{
    $items = market_strip_items_html();
    if ($items === '') return;
    ?>
<div class="border-b border-zinc-200 bg-white">
  <div class="mx-auto flex max-w-[1399px] items-center gap-2 overflow-x-auto px-4 sm:px-6 py-2">
    <span class="mr-1 flex flex-none items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-zinc-400"><span class="inline-block h-1.5 w-1.5 rounded-full bg-[#e0392b] animate-pulse"></span>Market</span>
    <span id="market-strip-items" class="flex items-center gap-2"><?= $items ?></span>
  </div>
</div>
<script>
(function(){
  var open=<?= (market_is_open() || market_is_open_us()) ? 'true' : 'false' ?>;
  function tick(){ fetch('/market-data.php?_='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.text():'';}).then(function(h){ var el=document.getElementById('market-strip-items'); if(el && h) el.innerHTML=h; }).catch(function(){}); }
  // 장중 20초 / 장외 2분 라이브 갱신(서버 60초 캐시라 부담 적음), 탭 숨기면 정지
  setInterval(function(){ if(!document.hidden) tick(); }, open?20000:120000);
})();
</script>
    <?php
}
