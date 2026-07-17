<?php
// goBlog DB 읽기 — 뉴스 홈(index.php)·기사(article.php) 공용 헬퍼.
// goBlog 파이프라인이 발행에 성공한 글(publish_jobs.publishedUrl)만 기사로 노출한다.
declare(strict_types=1);

function goblog_db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=127.0.0.1;dbname=goBlog;charset=utf8mb4',
            'goblog',
            'dlRW49D2rBIwhpX7L1VPYvxjgJ8k',
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ],
        );
    }
    return $pdo;
}

function nh(?string $v): string
{
    return htmlspecialchars($v ?? '', ENT_QUOTES, 'UTF-8');
}

/** 키워드 분류(자유 텍스트)를 신문 섹션으로 정규화 */
function news_section(?string $category): string
{
    $c = $category ?? '';
    if (preg_match('/금융|재테크|투자|증시|경제|부동산|보험|유통|주식|소비/u', $c)) return '경제·금융';
    if (preg_match('/IT|게임|테크|스마트폰|가전|웨어러블|미디어|크리에이터/iu', $c)) return 'IT·게임';
    if (preg_match('/생활|날씨|정책|건강|식품|음식|의약|외식|직업/u', $c)) return '생활·건강';
    if (preg_match('/여행|교통|취미|카메라|패션|스포츠|문화|안전|자동차/u', $c)) return '여행·문화';
    return '종합';
}

const NEWS_SECTIONS = ['경제·금융', 'IT·게임', '생활·건강', '여행·문화', '종합'];

// 발행처 뱃지 표기 (원문 링크용)
const NEWS_PLATFORMS = [
    'WORDPRESS'  => ['워드프레스', '#21759b'],
    'TISTORY'    => ['티스토리', '#eb5350'],
    'NAVER_BLOG' => ['네이버', '#03c75a'],
    'BLOGGER'    => ['블로거', '#f57d00'],
];

// 내부 기사 링크가 기본이므로, 원문 표기는 자체 도메인(워드프레스) 우선
const NEWS_PLATFORM_PRIORITY = ['WORDPRESS', 'TISTORY', 'NAVER_BLOG', 'BLOGGER'];

/**
 * 발행 성공 글 전체를 기사 목록으로 집계 (180초 파일 캐시).
 * 반환: [{id,title,excerpt,section,kwText,publishedAt,quality,image,platforms:{P:url}}...] 최신순
 */
function news_articles(): array
{
    $cacheFile = sys_get_temp_dir() . '/goblog_news_front.json';
    if (is_file($cacheFile) && time() - filemtime($cacheFile) < 180) {
        $cached = json_decode((string) file_get_contents($cacheFile), true);
        if (is_array($cached)) return $cached;
    }

    $db = goblog_db();
    // 홈박스 뉴스는 자체 발행 채널 — goBlog가 '릴리즈'(publishAt 설정, 품질 통과)한 글이면
    // 외부 플랫폼(WP·블로거) 발행 성공을 기다리지 않고 즉시 노출한다.
    $rows = $db->query(
        "SELECT a.id, a.title, a.excerpt, a.qualityScore, a.publishAt, k.category kwCategory, k.text kwText,
                pj.platform, pj.publishedUrl, pj.finishedAt
         FROM articles a
         LEFT JOIN keywords k ON k.id = a.keywordId
         LEFT JOIN publish_jobs pj
                ON pj.articleId = a.id AND pj.status = 'SUCCEEDED' AND pj.publishedUrl IS NOT NULL
         WHERE a.contentHtml IS NOT NULL
           AND (pj.id IS NOT NULL
                OR (a.publishAt IS NOT NULL AND a.status IN ('SCHEDULED', 'PUBLISHED')))",
    )->fetchAll();

    $byId = [];
    foreach ($rows as $r) {
        $id = (int) $r['id'];
        if (!isset($byId[$id])) {
            $byId[$id] = [
                'id' => $id,
                'title' => $r['title'],
                'excerpt' => $r['excerpt'],
                'quality' => (int) ($r['qualityScore'] ?? 0),
                'section' => news_section($r['kwCategory']),
                'kwText' => $r['kwText'],
                'publishedAt' => $r['finishedAt'] ?? $r['publishAt'],
                'image' => null,
                'platforms' => [],
            ];
        }
        if (!empty($r['platform'])) {
            $byId[$id]['platforms'][$r['platform']] = $r['publishedUrl'];
            if ($r['finishedAt'] > $byId[$id]['publishedAt']) $byId[$id]['publishedAt'] = $r['finishedAt'];
        }
    }

    if ($byId) {
        $ids = implode(',', array_keys($byId));
        // 대표 이미지: FEATURED 우선, 없으면 본문 첫 이미지
        $imgs = $db->query(
            "SELECT articleId, webpUrl, originalUrl
             FROM media_assets
             WHERE articleId IN ($ids) AND (webpUrl IS NOT NULL OR originalUrl IS NOT NULL)
             ORDER BY articleId, (kind = 'FEATURED') DESC, COALESCE(position, 99), id",
        )->fetchAll();
        foreach ($imgs as $m) {
            $aid = (int) $m['articleId'];
            if (isset($byId[$aid]) && $byId[$aid]['image'] === null) {
                $byId[$aid]['image'] = $m['webpUrl'] ?: $m['originalUrl'];
            }
        }
    }

    $list = array_values($byId);
    usort($list, fn($a, $b) => strcmp($b['publishedAt'], $a['publishedAt']));

    // 사실상 같은 제목(재생성 글 등)은 최신 1건만 노출
    $seenTitle = [];
    $deduped = [];
    foreach ($list as $a) {
        $norm = preg_replace('/[^0-9a-z가-힣]+/u', '', mb_strtolower($a['title']));
        if (isset($seenTitle[$norm])) continue;
        $seenTitle[$norm] = true;
        $deduped[] = $a;
    }
    $list = $deduped;

    file_put_contents($cacheFile, json_encode($list, JSON_UNESCAPED_UNICODE), LOCK_EX);
    return $list;
}

/**
 * 본문에서 외부 핫링크 이미지 제거 — 나무위키 등은 핫링크를 차단해 엑박이 뜨고 저작권 문제도 있다.
 * 우리 도메인(hom2box.com) 이미지만 남긴다. figure로 감싼 경우 캡션까지 통째로 제거.
 */
function strip_external_images(string $html): string
{
    // ① 외부 이미지를 담은 <figure> 블록 통째 제거 (캡션 포함)
    $html = preg_replace_callback('/<figure\b[^>]*>.*?<\/figure>/is', static function ($m) {
        if (preg_match('/<img[^>]+src="([^"]+)"/i', $m[0], $im)) {
            $src = $im[1];
            if (preg_match('#^https?://#i', $src) && strpos($src, 'hom2box.com') === false) {
                return '';
            }
        }
        return $m[0];
    }, $html) ?? $html;
    // ② figure 밖의 외부 <img> 단독 태그 제거
    $html = preg_replace('/<img\b[^>]*\bsrc="https?:\/\/(?![^"]*hom2box\.com)[^"]*"[^>]*>/i', '', $html) ?? $html;
    return $html;
}

function news_date(string $dt): string
{
    $t = strtotime($dt . ' UTC') ?: strtotime($dt);
    return date('Y.m.d H:i', $t + 9 * 3600); // KST
}
