<?php
// 언론사 RSS 헤드라인 수집(연합·JTBC·SBS·증권) — 아침(06)·저녁(18) 버킷 파일 캐시.
// ⚠️ 저작권: 본문은 가져오지 않는다. 제목·원문 링크만 인용하고 출처를 명시, 클릭 시 원문으로 이동.
declare(strict_types=1);

const PRESS_TABS = [
    'yna' => ['연합뉴스', [
        '주요뉴스' => 'https://www.yna.co.kr/rss/news.xml',
        '정치' => 'https://www.yna.co.kr/rss/politics.xml',
        '경제' => 'https://www.yna.co.kr/rss/economy.xml',
        '산업' => 'https://www.yna.co.kr/rss/industry.xml',
        '사회' => 'https://www.yna.co.kr/rss/society.xml',
        '지역' => 'https://www.yna.co.kr/rss/local.xml',
        '국제' => 'https://www.yna.co.kr/rss/international.xml',
        '문화' => 'https://www.yna.co.kr/rss/culture.xml',
        '건강' => 'https://www.yna.co.kr/rss/health.xml',
        '연예' => 'https://www.yna.co.kr/rss/entertainment.xml',
        '스포츠' => 'https://www.yna.co.kr/rss/sports.xml',
        '오피니언' => 'https://www.yna.co.kr/rss/opinion.xml',
    ]],
    'jtbc' => ['JTBC', [
        '속보' => 'https://news-ex.jtbc.co.kr/v1/get/rss/newsflesh',
        '이슈 TOP10' => 'https://news-ex.jtbc.co.kr/v1/get/rss/issue',
        '정치' => 'https://news-ex.jtbc.co.kr/v1/get/rss/section/politics',
        '경제' => 'https://news-ex.jtbc.co.kr/v1/get/rss/section/economy',
        '사회' => 'https://news-ex.jtbc.co.kr/v1/get/rss/section/society',
        '국제' => 'https://news-ex.jtbc.co.kr/v1/get/rss/section/international',
        '문화' => 'https://news-ex.jtbc.co.kr/v1/get/rss/section/culture',
        '연예' => 'https://news-ex.jtbc.co.kr/v1/get/rss/section/entertainment',
        '스포츠' => 'https://news-ex.jtbc.co.kr/v1/get/rss/section/sports',
        '날씨' => 'https://news-ex.jtbc.co.kr/v1/get/rss/section/weather',
    ]],
    'sbs' => ['SBS', [
        '이 시각 이슈' => 'https://news.sbs.co.kr/news/headlineRssFeed.do?plink=RSSREADER',
        '이 시각 인기' => 'https://news.sbs.co.kr/news/TopicRssFeed.do?plink=RSSREADER',
        '최신' => 'https://news.sbs.co.kr/news/newsflashRssFeed.do?plink=RSSREADER',
        '정치' => 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01&plink=RSSREADER',
        '경제' => 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=02&plink=RSSREADER',
        '사회' => 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=03&plink=RSSREADER',
        '국제' => 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=07&plink=RSSREADER',
        '생활·문화' => 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=08&plink=RSSREADER',
        '연예' => 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=14&plink=RSSREADER',
        '스포츠' => 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=09&plink=RSSREADER',
    ]],
    'stock' => ['증권', [
        '한국경제' => 'https://www.hankyung.com/feed/finance',
        '서울경제' => 'https://www.sedaily.com/rss/finance',
        '매일경제' => 'https://www.mk.co.kr/rss/50200011/',
        '비즈워치' => 'https://news.bizwatch.co.kr/rss/service/market',
        '파이낸셜뉴스' => 'http://www.fnnews.com/rss/r20/fn_realnews_stock.xml',
        'MBN머니' => 'https://mbnmoney.mbn.co.kr/rss/news/stock',
    ]],
];

function press_bucket(): string
{
    $h = (int) date('G', time() + 9 * 3600);
    $d = date('Y-m-d', time() + 9 * 3600);
    if ($h < 6) return date('Y-m-d', time() + 9 * 3600 - 86400) . ':pm';
    return $d . ($h < 18 ? ':am' : ':pm');
}

/** 여러 URL을 병렬 fetch (curl_multi, 개당 5초 타임아웃) → [url => body|null] */
function press_fetch_all(array $urls): array
{
    $mh = curl_multi_init();
    $handles = [];
    foreach ($urls as $url) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[$url] = $ch;
    }
    do {
        $status = curl_multi_exec($mh, $running);
        if ($running) curl_multi_select($mh, 0.5);
    } while ($running && $status === CURLM_OK);

    $out = [];
    $failedUrls = [];
    foreach ($handles as $url => $ch) {
        $body = curl_multi_getcontent($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        if ($code === 200 && $body) {
            $out[$url] = $body;
        } else {
            $out[$url] = null;
            $failedUrls[] = $url;
        }
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }
    curl_multi_close($mh);

    // UA 취향이 반대인 매체들: 매경은 풀 브라우저 UA 필요, 한경(Cloudflare)은 축약 UA만 통과
    // → 실패분만 축약 UA로 1회 재시도
    foreach ($failedUrls as $url) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_USERAGENT => 'Mozilla/5.0',
        ]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($code === 200 && $body) $out[$url] = $body;
    }
    return $out;
}

/**
 * 탭별 헤드라인 [tabKey => ['label'=>, 'boxes'=>[분류 => [{title,link}]]]].
 * 버킷이 바뀌면 재수집, 실패 분류는 이전 캐시 유지(stale-if-error).
 */
function press_headlines(int $perBox = 5): array
{
    // 공유 캐시라 박스당 최대 STORE건을 저장하고 반환 시 $perBox로 슬라이스 — 첫 호출자의 perBox에 종속되지 않게.
    // (예: 티커=10건, 홈 목록=5건이 같은 캐시를 쓰는데 먼저 쓴 쪽 개수로 고정되던 문제 해결)
    $STORE = 10;
    $slice = function (array $data) use ($perBox): array {
        foreach ($data as &$tab) {
            if (empty($tab['boxes']) || !is_array($tab['boxes'])) continue;
            foreach ($tab['boxes'] as &$items) $items = array_slice($items, 0, $perBox);
        }
        unset($tab, $items);
        return $data;
    };
    // ⚠️ PHP-FPM은 PrivateTmp라 셸에서 /tmp를 지워도 이 파일은 안 지워진다 — 강제 갱신은 파일명 버전업으로
    $cacheFile = sys_get_temp_dir() . '/goblog_press_headlines_v4.json';
    $bucket = press_bucket();
    $cache = null;
    if (is_file($cacheFile)) {
        $cache = json_decode((string) file_get_contents($cacheFile), true);
        if (is_array($cache) && ($cache['bucket'] ?? '') === $bucket && !empty($cache['data'])) {
            return $slice($cache['data']);
        }
    }

    $allUrls = [];
    foreach (PRESS_TABS as [$label, $feeds]) foreach ($feeds as $url) $allUrls[] = $url;
    $bodies = press_fetch_all($allUrls);

    $data = [];
    $failed = 0;
    $total = 0;
    foreach (PRESS_TABS as $tabKey => [$label, $feeds]) {
        $boxes = [];
        foreach ($feeds as $boxLabel => $url) {
            $total += 1;
            $items = [];
            $xmlRaw = $bodies[$url] ?? null;
            if ($xmlRaw !== null) {
                $xml = @simplexml_load_string($xmlRaw, SimpleXMLElement::class, LIBXML_NOCDATA);
                if ($xml && isset($xml->channel->item)) {
                    foreach ($xml->channel->item as $it) {
                        $title = trim((string) $it->title);
                        $link = trim((string) $it->link);
                        if ($title === '' || $link === '') continue;
                        // pubDate 도 담는다 (속보 24시간 필터용) — 없으면 빈 문자열
                        $pub = trim((string) ($it->pubDate ?? ''));
                        $items[] = ['title' => $title, 'link' => $link, 'pubDate' => $pub];
                        if (count($items) >= $STORE) break;
                    }
                }
            }
            if ($items) {
                $boxes[$boxLabel] = $items;
            } else {
                $failed += 1;
                if (isset($cache['data'][$tabKey]['boxes'][$boxLabel])) {
                    $boxes[$boxLabel] = $cache['data'][$tabKey]['boxes'][$boxLabel];
                }
            }
        }
        if ($boxes) $data[$tabKey] = ['label' => $label, 'boxes' => $boxes];
    }

    if (count($data) === 0) return $slice($cache['data'] ?? []);
    $save = ['bucket' => $failed <= $total / 2 ? $bucket : 'retry', 'data' => $data];
    file_put_contents($cacheFile, json_encode($save, JSON_UNESCAPED_UNICODE), LOCK_EX);
    return $slice($data);
}

/**
 * JTBC 속보 — 24시간 이내 발행된 최신 속보 1건. 없으면 null.
 * 헤더 위 속보 바에 사용. (press_headlines 캐시의 jtbc/속보 박스에서 추출)
 */
function news_breaking(): ?array
{
    try {
        $data = press_headlines(5);
    } catch (Throwable) {
        return null;
    }
    $box = $data['jtbc']['boxes']['속보'] ?? [];
    foreach ($box as $it) {
        $pub = $it['pubDate'] ?? '';
        if ($pub === '') continue;
        $ts = strtotime($pub);
        if ($ts && $ts >= time() - 86400) {
            // 좌측에 '속보' 라벨이 이미 있으므로 제목 앞의 [속보]/(속보)/【속보】 접두어는 제거(중복 방지)
            $title = preg_replace('/^\s*[\[\(【]\s*속보\s*[\]\)】]\s*/u', '', $it['title']);
            // 닫기 상태 유지용 키(제목 해시) — 새 속보가 뜨면 다시 노출
            return ['title' => $title, 'link' => $it['link'], 'ts' => $ts, 'key' => substr(md5($it['title']), 0, 10)];
        }
    }
    return null;
}
