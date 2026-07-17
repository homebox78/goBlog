<?php
// 연합뉴스 RSS 헤드라인 수집 — 아침(06시)·저녁(18시) 버킷 단위로 갱신되는 파일 캐시.
// ⚠️ 저작권: 본문은 가져오지 않는다. 제목·원문 링크만 인용하고 출처(연합뉴스)를 명시,
//    클릭 시 연합뉴스 원문으로 이동한다 (뉴스스탠드식 큐레이션).
declare(strict_types=1);

const YNA_FEEDS = [
    'news' => ['주요뉴스', 'https://www.yna.co.kr/rss/news.xml'],
    'politics' => ['정치', 'https://www.yna.co.kr/rss/politics.xml'],
    'economy' => ['경제', 'https://www.yna.co.kr/rss/economy.xml'],
    'industry' => ['산업', 'https://www.yna.co.kr/rss/industry.xml'],
    'society' => ['사회', 'https://www.yna.co.kr/rss/society.xml'],
    'local' => ['지역', 'https://www.yna.co.kr/rss/local.xml'],
    'international' => ['국제', 'https://www.yna.co.kr/rss/international.xml'],
    'culture' => ['문화', 'https://www.yna.co.kr/rss/culture.xml'],
    'health' => ['건강', 'https://www.yna.co.kr/rss/health.xml'],
    'entertainment' => ['연예', 'https://www.yna.co.kr/rss/entertainment.xml'],
    'sports' => ['스포츠', 'https://www.yna.co.kr/rss/sports.xml'],
    'opinion' => ['오피니언', 'https://www.yna.co.kr/rss/opinion.xml'],
];

/** 현재 갱신 버킷 — 06~18시(KST)는 아침판, 그 외는 저녁판(자정 넘으면 전날 저녁판 유지) */
function yna_bucket(): string
{
    $h = (int) date('G', time() + 9 * 3600);
    $d = date('Y-m-d', time() + 9 * 3600);
    if ($h < 6) {
        $d = date('Y-m-d', time() + 9 * 3600 - 86400);
        return $d . ':pm';
    }
    return $d . ($h < 18 ? ':am' : ':pm');
}

/**
 * 분야별 헤드라인 [key => ['label'=>, 'items'=>[{title,link,pubDate}] ]].
 * 버킷이 바뀌면 재수집, 수집 실패 분야는 이전 캐시 유지(stale-if-error).
 */
function yna_headlines(int $perCategory = 5): array
{
    $cacheFile = sys_get_temp_dir() . '/goblog_yna_headlines.json';
    $bucket = yna_bucket();
    $cache = null;
    if (is_file($cacheFile)) {
        $cache = json_decode((string) file_get_contents($cacheFile), true);
        if (is_array($cache) && ($cache['bucket'] ?? '') === $bucket && !empty($cache['data'])) {
            return $cache['data'];
        }
    }

    $ctx = stream_context_create([
        'http' => ['timeout' => 6, 'user_agent' => 'Mozilla/5.0 (compatible; hom2box-news/1.0)'],
    ]);
    $data = [];
    $failed = 0;
    foreach (YNA_FEEDS as $key => [$label, $url]) {
        $items = [];
        $xmlRaw = @file_get_contents($url, false, $ctx);
        if ($xmlRaw !== false) {
            $xml = @simplexml_load_string($xmlRaw, SimpleXMLElement::class, LIBXML_NOCDATA);
            if ($xml && isset($xml->channel->item)) {
                foreach ($xml->channel->item as $it) {
                    $title = trim((string) $it->title);
                    $link = trim((string) $it->link);
                    if ($title === '' || $link === '' || !str_contains($link, 'yna.co.kr')) continue;
                    $items[] = ['title' => $title, 'link' => $link, 'pubDate' => (string) $it->pubDate];
                    if (count($items) >= $perCategory) break;
                }
            }
        }
        if ($items) {
            $data[$key] = ['label' => $label, 'items' => $items];
        } else {
            $failed += 1;
            // 이번에 못 가져온 분야는 이전 캐시로 폴백
            if (isset($cache['data'][$key])) $data[$key] = $cache['data'][$key];
        }
    }

    // 전부 실패면 이전 캐시 전체 반환(버킷 미갱신 → 다음 방문 때 재시도)
    if (count($data) === 0) return $cache['data'] ?? [];
    // 일부 실패 시에도 저장은 하되, 절반 이상 실패면 버킷을 확정하지 않아 곧 재시도된다
    $save = ['bucket' => $failed <= count(YNA_FEEDS) / 2 ? $bucket : 'retry', 'data' => $data];
    file_put_contents($cacheFile, json_encode($save, JSON_UNESCAPED_UNICODE), LOCK_EX);
    return $data;
}
