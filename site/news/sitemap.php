<?php
// 동적 XML 사이트맵 — 검색엔진 크롤링용. /sitemap.xml 로도 접근(.htaccess rewrite).
// 기사 전체 + 카테고리 + 계산기 + 정적 페이지. 최근 48시간 기사엔 Google News 태그 부착.
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/tools-data.php';

header('Content-Type: application/xml; charset=utf-8');

const SM_BASE = 'https://hom2box.com';

function sm_iso(?string $dt): string
{
    if (!$dt) return date('c');
    $t = strtotime($dt);
    return $t ? date('c', $t) : date('c');
}
function sm_x(string $s): string
{
    return htmlspecialchars($s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

$articles = [];
try { $articles = news_articles(); } catch (Throwable) {}

// 가장 최근 기사 시각을 홈 lastmod로 사용
$homeLast = null;
foreach ($articles as $a) {
    if ($homeLast === null || strcmp((string) $a['publishedAt'], $homeLast) > 0) $homeLast = (string) $a['publishedAt'];
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
    . ' xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"'
    . ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";

$out = function (string $loc, ?string $lastmod, string $freq, string $priority, string $inner = '') {
    echo "  <url>\n";
    echo '    <loc>' . sm_x(SM_BASE . $loc) . "</loc>\n";
    if ($lastmod) echo '    <lastmod>' . sm_x(sm_iso($lastmod)) . "</lastmod>\n";
    if ($freq) echo '    <changefreq>' . $freq . "</changefreq>\n";
    if ($priority) echo '    <priority>' . $priority . "</priority>\n";
    if ($inner) echo $inner;
    echo "  </url>\n";
};

// 1) 정적 페이지
$out('/', $homeLast, 'hourly', '1.0');
$out('/tools.php', null, 'weekly', '0.8');
$out('/press.php', $homeLast, 'daily', '0.6');
$out('/opinion.php', $homeLast, 'daily', '0.6');
$out('/welfare.php', null, 'weekly', '0.6');
$out('/about.php', null, 'monthly', '0.3');
$out('/subscribe.php', null, 'monthly', '0.4');
$out('/contact.php', null, 'monthly', '0.3');
$out('/privacy.php', null, 'yearly', '0.2');

// 2) 카테고리
foreach (NEWS_SECTIONS as $s) {
    $out('/category.php?cat=' . urlencode($s), $homeLast, 'daily', '0.7');
}

// 3) 계산기 상세
foreach (TOOLS as $id => $t) {
    $out('/tool.php?id=' . urlencode((string) $id), null, 'monthly', '0.6');
}

// 3-1) 문서도구 허브·서식 10종
$out('/docs.php', null, 'weekly', '0.8');
foreach (['pledge','poa','loan','settle','resign','incident','empcert','labor','quote','receipt'] as $dk) {
    $out('/docs.php?doc=' . $dk, null, 'monthly', '0.6');
}

// 4) 기사 (최근 48시간이면 news 태그, 대표 이미지 있으면 image 태그)
$newsCutoff = time() - 48 * 3600;
foreach ($articles as $a) {
    $loc = '/article.php?id=' . (int) $a['id'];
    $pub = (string) $a['publishedAt'];
    $inner = '';

    $pubTs = $pub ? strtotime($pub) : 0;
    if ($pubTs && $pubTs >= $newsCutoff) {
        $inner .= "    <news:news>\n"
            . "      <news:publication>\n"
            . "        <news:name>HOM2BOX 뉴스</news:name>\n"
            . "        <news:language>ko</news:language>\n"
            . "      </news:publication>\n"
            . '      <news:publication_date>' . sm_x(sm_iso($pub)) . "</news:publication_date>\n"
            . '      <news:title>' . sm_x((string) $a['title']) . "</news:title>\n"
            . "    </news:news>\n";
    }
    if (!empty($a['image'])) {
        $img = (string) $a['image'];
        if (str_starts_with($img, '/')) $img = SM_BASE . $img;
        $inner .= "    <image:image>\n      <image:loc>" . sm_x($img) . "</image:loc>\n    </image:image>\n";
    }

    $out($loc, $pub, 'weekly', '0.7', $inner);
}

echo "</urlset>\n";
