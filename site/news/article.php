<?php
// HOM2BOX 뉴스 — 기사 본문. goBlog contentHtml을 그대로 렌더하고,
// 광고가 없는 글에는 글 키워드에 매칭된 제휴 상품 배너를 자동 삽입한다.
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) { http_response_code(404); exit('잘못된 요청입니다.'); }

$db = goblog_db();
$st = $db->prepare(
    "SELECT a.id, a.title, a.excerpt, a.contentHtml, a.adSource, a.keywordId, a.metaDescription,
            a.status, a.publishAt, k.category kwCategory, k.text kwText
     FROM articles a
     LEFT JOIN keywords k ON k.id = a.keywordId
     WHERE a.id = ?",
);
$st->execute([$id]);
$article = $st->fetch();

$jobs = [];
if ($article) {
    $st = $db->prepare(
        "SELECT platform, publishedUrl, finishedAt FROM publish_jobs
         WHERE articleId = ? AND publishedUrl IS NOT NULL AND status = 'SUCCEEDED'
         ORDER BY finishedAt DESC",
    );
    $st->execute([$id]);
    $jobs = $st->fetchAll();
}
// 릴리즈(자체 발행)됐거나 외부 발행에 성공한 글만 공개한다 (초안·검토중 글 노출 방지)
$released = $article
    && !empty($article['publishAt'])
    && in_array($article['status'], ['SCHEDULED', 'PUBLISHED'], true);
if (!$article || (!$jobs && !$released) || empty($article['contentHtml'])) {
    http_response_code(404);
    exit('기사를 찾을 수 없습니다.');
}

$publishedAt = $jobs[0]['finishedAt'] ?? $article['publishAt'];
foreach ($jobs as $j) if ($j['finishedAt'] > $publishedAt) $publishedAt = $j['finishedAt'];
$section = news_section($article['kwCategory']);

// 대표 이미지
$st = $db->prepare(
    "SELECT webpUrl, originalUrl FROM media_assets
     WHERE articleId = ? AND (webpUrl IS NOT NULL OR originalUrl IS NOT NULL)
     ORDER BY (kind = 'FEATURED') DESC, COALESCE(position, 99), id LIMIT 1",
);
$st->execute([$id]);
$imgRow = $st->fetch();
$image = $imgRow ? ($imgRow['webpUrl'] ?: $imgRow['originalUrl']) : null;

$html = $article['contentHtml'];

// 대표이미지는 목록 썸네일·og:image 용도 — 본문에 이미 들어있는 이미지면 상단에 다시 노출하지 않는다(중복 방지).
$showFigure = $image !== null && strpos($html, $image) === false;

// ── 제휴 배너 자동 삽입 ─────────────────────────────────────────────
// 생성 단계에서 광고가 안 들어간 글(adSource null)에만, 글 키워드에 매칭된 상품 중
// 제휴 트래킹 링크(link.coupang.com/coupa.ng/naver.me)가 있는 것을 골라 삽입한다.
$ad = null;
if (empty($article['adSource']) && !empty($article['keywordId'])) {
    $st = $db->prepare(
        "SELECT name, brand, price, originPrice, imageUrl, productUrl, source, isRocket
         FROM products
         WHERE matchedKeywordId = ? AND status <> 'DISABLED'
           AND (productUrl LIKE '%link.coupang.com%' OR productUrl LIKE '%coupa.ng%' OR productUrl LIKE '%naver.me%')
         ORDER BY COALESCE(ratingCount, 0) DESC LIMIT 1",
    );
    $st->execute([(int) $article['keywordId']]);
    $ad = $st->fetch() ?: null;
}

function ad_banner(array $p): string
{
    $isCoupang = $p['source'] === 'COUPANG';
    $accent = $isCoupang ? '#e52528' : '#03c75a';
    $tint = $isCoupang ? '#fff4f4' : '#f2fdf6';
    $cta = $isCoupang ? '쿠팡에서 최저가 확인하기' : '네이버에서 상품 보기';
    $url = nh($p['productUrl']);
    $name = nh($p['name']);
    $price = $p['price']
        ? '<span style="display:block;margin:0 0 12px;font-size:21px;font-weight:800;color:' . $accent . ';">'
          . number_format((int) $p['price']) . '원'
          . ($p['isRocket'] ? ' <span style="font-size:12px;color:#2c7fff;">🚀 로켓배송</span>' : '')
          . '</span>'
        : '';
    // 쿠팡·네이버 CDN은 referer 차단이 있어 no-referrer로 요청한다
    $img = $p['imageUrl']
        ? '<a href="' . $url . '" rel="sponsored nofollow noopener" target="_blank">'
          . '<img src="' . nh($p['imageUrl']) . '" alt="' . $name . '" referrerpolicy="no-referrer" loading="lazy"'
          . ' style="width:180px;height:180px;object-fit:contain;background:#fff;border:1px solid #f0f0f0;border-radius:12px;display:inline-block;"></a>'
        : '';
    return '<div style="text-align:center;border:2px solid ' . $accent . ';border-radius:14px;padding:20px 18px;margin:26px auto;max-width:440px;background:' . $tint . ';">'
        . '<span style="display:block;text-align:right;font-size:11px;color:#c4c4c4;margin-bottom:4px;">광고</span>'
        . $img
        . '<span style="display:block;margin:14px 0 8px;font-weight:700;font-size:17px;line-height:1.45;color:#1a1a1a;">' . $name . '</span>'
        . $price
        . '<a href="' . $url . '" rel="sponsored nofollow noopener" target="_blank" style="display:inline-block;background:' . $accent . ';color:#fff;padding:12px 26px;border-radius:10px;font-size:15px;font-weight:800;text-decoration:none;">' . $cta . ' →</a>'
        . '</div>';
}

if ($ad) {
    $banner = ad_banner($ad);
    $disclosure = '<p style="font-size:13px;color:#555;background:#f5f6f8;border:1px solid #e2e5ea;border-radius:6px;padding:10px 12px;margin:0 0 18px;line-height:1.6;"><strong style="color:#c0392b;">[광고]</strong> '
        . ($ad['source'] === 'COUPANG'
            ? '이 기사는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.'
            : '이 기사는 네이버 쇼핑 제휴 링크를 포함하며, 구매 시 일정 수수료를 제공받을 수 있습니다.')
        . '</p>';
    // 본문 중간(문단 절반 지점)과 끝에 배너, 최상단에 대가성 고지 (짧은 글은 끝 1곳만)
    $parts = explode('</p>', $html);
    $mid = (int) floor(count($parts) / 2);
    if (count($parts) > 6) {
        $parts[$mid] .= '</p>' . $banner;
        $html = implode('</p>', $parts);
    }
    $html = $disclosure . $html . $banner;
}

// 관련 기사 — 같은 섹션 최신 6 (자기 제외)
$related = [];
try {
    foreach (news_articles() as $a) {
        if ($a['id'] !== $id && $a['section'] === $section) $related[] = $a;
        if (count($related) >= 6) break;
    }
} catch (Throwable) {
}

$desc = $article['metaDescription'] ?: ($article['excerpt'] ?: mb_substr(strip_tags($html), 0, 120));
?>
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= nh($article['title']) ?> — HOM2BOX 뉴스</title>
<meta name="description" content="<?= nh($desc) ?>">
<link rel="canonical" href="https://hom2box.com/article.php?id=<?= $id ?>">
<meta property="og:type" content="article">
<meta property="og:title" content="<?= nh($article['title']) ?>">
<meta property="og:description" content="<?= nh($desc) ?>">
<?php if ($image): ?><meta property="og:image" content="<?= nh($image) ?>"><?php endif; ?>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600;800&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
<script type="application/ld+json"><?= json_encode([
    '@context' => 'https://schema.org',
    '@type' => 'NewsArticle',
    'headline' => $article['title'],
    'datePublished' => $publishedAt,
    'image' => $image ? [$image] : [],
    'author' => ['@type' => 'Organization', 'name' => 'HOM2BOX 뉴스'],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?></script>
<style>
:root { --ink:#111; --sub:#666; --line:#e5e5e5; --accent:#0b5fd9; }
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',-apple-system,'Malgun Gothic',sans-serif; color:var(--ink); background:#fff; }
a { color:inherit; text-decoration:none; }
img { max-width:100%; }
.wrap { max-width:820px; margin:0 auto; padding:0 16px; }
.masthead { text-align:center; padding:18px 0 12px; border-bottom:2px solid var(--ink); }
.masthead .logo { font-family:'Noto Serif KR',serif; font-weight:800; font-size:26px; letter-spacing:1px; }
.masthead .logo .b { color:var(--accent); }
.art-head { padding:30px 0 18px; border-bottom:1px solid var(--line); }
.art-head .sec { font-size:13px; font-weight:700; color:var(--accent); }
.art-head h1 { font-family:'Noto Serif KR',serif; font-size:32px; line-height:1.4; font-weight:800; margin:10px 0 14px; }
.art-head .meta { font-size:13px; color:var(--sub); display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
.pbadge { display:inline-block; font-size:11px; font-weight:700; color:#fff; border-radius:3px; padding:2px 7px; }
.figure { margin:22px 0 6px; }
.figure img { width:100%; border-radius:6px; }
.content { padding:10px 0 30px; }
.related { border-top:2px solid var(--ink); padding:20px 0 40px; }
.related h3 { font-family:'Noto Serif KR',serif; font-size:20px; font-weight:800; margin-bottom:14px; }
.related .cards { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
.related .card .thumb { aspect-ratio:16/10; overflow:hidden; background:#f4f4f4; border-radius:4px; }
.related .card img { width:100%; height:100%; object-fit:cover; }
.related .t { margin-top:8px; font-size:14.5px; font-weight:600; line-height:1.45; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
footer { border-top:2px solid var(--ink); padding:20px 0 40px; font-size:12.5px; color:var(--sub); }
@media (max-width:640px){ .art-head h1 { font-size:24px; } .related .cards { grid-template-columns:1fr 1fr; } }
</style>
</head>
<body>

<header class="masthead">
  <a class="logo" href="/">HOM2BOX <span class="b">뉴스</span></a>
</header>

<main class="wrap">
  <div class="art-head">
    <span class="sec"><?= nh($section) ?></span>
    <h1><?= nh($article['title']) ?></h1>
    <div class="meta">
      <span><?= nh(news_date($publishedAt)) ?> 발행</span>
      <span>
        <?php foreach (NEWS_PLATFORM_PRIORITY as $pf): if (empty(array_column($jobs, null, 'platform')[$pf])) continue;
          [$label, $color] = NEWS_PLATFORMS[$pf]; $u = array_column($jobs, null, 'platform')[$pf]['publishedUrl']; ?>
          <a class="pbadge" style="background:<?= $color ?>" href="<?= nh($u) ?>" target="_blank" rel="noopener"><?= nh($label) ?></a>
        <?php endforeach; ?>
      </span>
    </div>
  </div>

  <!-- adsense-slot: article-top -->

  <?php if ($showFigure): ?><div class="figure"><img src="<?= nh($image) ?>" alt="<?= nh($article['title']) ?>"></div><?php endif; ?>

  <article class="content"><?= $html /* goBlog가 생성한 자체 HTML — 이스케이프하지 않음 */ ?></article>

  <!-- adsense-slot: article-bottom -->

  <?php if ($related): ?>
  <section class="related">
    <h3><?= nh($section) ?> 최신 기사</h3>
    <div class="cards">
      <?php foreach ($related as $a): ?>
        <a class="card" href="/article.php?id=<?= (int) $a['id'] ?>">
          <?php if (!empty($a['image'])): ?><div class="thumb"><img src="<?= nh($a['image']) ?>" alt="" loading="lazy"></div><?php endif; ?>
          <div class="t"><?= nh($a['title']) ?></div>
        </a>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>
</main>

<footer>
  <div class="wrap">
    <p>일부 기사에는 제휴 링크가 포함되어 있으며, 이를 통해 구매 시 운영자가 일정 수수료를 제공받을 수 있습니다.</p>
    <p>© <?= date('Y') ?> HOM2BOX 뉴스</p>
  </div>
</footer>

</body>
</html>
