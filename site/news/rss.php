<?php
// RSS 2.0 피드 — 최근 기사 30건. /rss.xml 로 접근(.htaccess rewrite).
// 피드리더·뉴스 aggregator·자동공유(RSS→소셜) 신디케이션용.
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';

header('Content-Type: application/rss+xml; charset=utf-8');

const RSS_BASE = 'https://hom2box.com';
function rss_x(string $s): string { return htmlspecialchars($s, ENT_XML1 | ENT_QUOTES, 'UTF-8'); }

$articles = [];
try { $articles = array_slice(news_articles(), 0, 30); } catch (Throwable) {}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">' . "\n";
echo "<channel>\n";
echo '  <title>HOM2BOX 핫이슈</title>' . "\n";
echo '  <link>' . RSS_BASE . "/</link>\n";
echo '  <description>매일 아침·저녁 발행하는 이슈·경제·IT·생활 뉴스와 가이드 — HOM2BOX 편집국</description>' . "\n";
echo "  <language>ko</language>\n";
echo '  <lastBuildDate>' . date('r') . "</lastBuildDate>\n";
echo '  <atom:link href="' . RSS_BASE . '/rss.xml" rel="self" type="application/rss+xml"/>' . "\n";
foreach ($articles as $a) {
    $link = RSS_BASE . '/article.php?id=' . (int) $a['id'];
    $pub = strtotime((string) ($a['publishedAt'] ?? '')) ?: time();
    echo "  <item>\n";
    echo '    <title>' . rss_x((string) $a['title']) . "</title>\n";
    echo '    <link>' . rss_x($link) . "</link>\n";
    echo '    <guid isPermaLink="true">' . rss_x($link) . "</guid>\n";
    echo '    <pubDate>' . date('r', $pub) . "</pubDate>\n";
    if (!empty($a['section'])) echo '    <category>' . rss_x((string) $a['section']) . "</category>\n";
    if (!empty($a['excerpt'])) echo '    <description>' . rss_x((string) $a['excerpt']) . "</description>\n";
    if (!empty($a['image'])) {
        $img = (string) $a['image'];
        if (!preg_match('#^https?://#', $img)) $img = RSS_BASE . '/' . ltrim($img, '/');
        echo '    <enclosure url="' . rss_x($img) . '" type="image/webp"/>' . "\n";
    }
    echo "  </item>\n";
}
echo "</channel>\n</rss>\n";
