<?php
// 구글 뉴스 전용 사이트맵 — 최근 48시간 발행 기사만(Google News News sitemap 규격).
// /sitemap-news.xml 로 접근(.htaccess rewrite). 신선 기사 빠른 색인용.
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';

header('Content-Type: application/xml; charset=utf-8');

const SN_BASE = 'https://hom2box.com';
function sn_x(string $s): string { return htmlspecialchars($s, ENT_XML1 | ENT_QUOTES, 'UTF-8'); }

$articles = [];
try { $articles = news_articles(); } catch (Throwable) {}

$cut = time() - 2 * 86400; // 최근 48시간
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">' . "\n";
$n = 0;
foreach ($articles as $a) {
    $ts = strtotime((string) ($a['publishedAt'] ?? ''));
    if (!$ts || $ts < $cut) continue;
    if (++$n > 1000) break; // 구글 뉴스 사이트맵 상한 여유
    $loc = SN_BASE . '/article.php?id=' . (int) $a['id'];
    echo "  <url>\n";
    echo "    <loc>" . sn_x($loc) . "</loc>\n";
    echo "    <news:news>\n";
    echo "      <news:publication><news:name>HOM2BOX 뉴스</news:name><news:language>ko</news:language></news:publication>\n";
    echo "      <news:publication_date>" . sn_x(date('c', $ts)) . "</news:publication_date>\n";
    echo "      <news:title>" . sn_x((string) $a['title']) . "</news:title>\n";
    echo "    </news:news>\n";
    echo "  </url>\n";
}
echo "</urlset>\n";
