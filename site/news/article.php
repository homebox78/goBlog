<?php
// HOM2BOX 뉴스 — 기사 본문. goBlog contentHtml을 그대로 렌더하고,
// 광고가 없는 글에는 글 키워드에 매칭된 제휴 상품 배너를 자동 삽입한다.
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

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

record_article_view($id); // 조회수·IP 통계 기록

// 대표 이미지
$st = $db->prepare(
    "SELECT webpUrl, originalUrl FROM media_assets
     WHERE articleId = ? AND (webpUrl IS NOT NULL OR originalUrl IS NOT NULL)
     ORDER BY (kind = 'FEATURED') DESC, COALESCE(position, 99), id LIMIT 1",
);
$st->execute([$id]);
$imgRow = $st->fetch();
$image = $imgRow ? ($imgRow['webpUrl'] ?: $imgRow['originalUrl']) : null;

$html = strip_external_images($article['contentHtml']);

// 대표이미지는 목록 썸네일·og:image 용도 — 본문에 이미 들어있는 이미지면 상단에 다시 노출하지 않는다(중복 방지).
$showFigure = $image !== null && strpos($html, $image) === false;

// ── 제휴 배너 자동 삽입 ─────────────────────────────────────────────
// 생성 단계에서 광고가 안 들어간 글(adSource null)에만, 글 키워드에 매칭된 상품 중
// 제휴 트래킹 링크(link.coupang.com/coupa.ng/naver.me)가 있는 것을 골라 삽입한다.
// 키워드에 매칭된 제휴 상품을 최대 2개 가져온다 — [0]은 본문 배너, [1]은 사이드바 카드(중복 방지).
$adProducts = [];
if (!empty($article['keywordId'])) {
    $st = $db->prepare(
        "SELECT name, brand, price, originPrice, imageUrl, productUrl, source, isRocket
         FROM products
         WHERE matchedKeywordId = ? AND status <> 'DISABLED'
           AND (productUrl LIKE '%link.coupang.com%' OR productUrl LIKE '%coupa.ng%' OR productUrl LIKE '%naver.me%')
         ORDER BY COALESCE(ratingCount, 0) DESC LIMIT 2",
    );
    $st->execute([(int) $article['keywordId']]);
    $adProducts = $st->fetchAll();
}
// 본문 배너: 생성 단계에서 광고가 안 들어간 글(adSource null)에만 삽입
$ad = (empty($article['adSource']) && isset($adProducts[0])) ? $adProducts[0] : null;
// 사이드바 파트너스 추천: 본문 배너와 다른 상품(없으면 본문 배너 미노출 시 첫 상품)
$sideAd = $ad ? ($adProducts[1] ?? null) : ($adProducts[0] ?? null);

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

// ── 목차(TOC) 자동 생성 + h2 앵커 부여 ────────────────────────────
// 본문 h2를 훑어 목차를 만들고 각 h2에 id="toc-N"을 심는다(스무스 스크롤 앵커).
$toc = [];
$html = preg_replace_callback('/<h2\b([^>]*)>(.*?)<\/h2>/is', function ($m) use (&$toc) {
    $n = count($toc) + 1;
    // 목차 라벨에서는 이모지·기호를 제거한다(본문 h2 원문은 그대로 유지)
    $label = strip_tags($m[2]);
    $label = preg_replace('/[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}\x{2190}-\x{21FF}\x{FE00}-\x{FE0F}\x{1F1E6}-\x{1F1FF}\x{2B50}\x{2705}\x{2714}\x{2611}]/u', '', $label);
    $toc[] = trim(preg_replace('/\s+/u', ' ', $label));
    $attrs = preg_replace('/\s*id\s*=\s*"[^"]*"/i', '', $m[1]); // 기존 id 제거 후 통일
    return '<h2' . $attrs . ' id="toc-' . $n . '">' . $m[2] . '</h2>';
}, $html);

// ── FAQ 구조화 데이터(AEO/GEO) — 질문형 h2 + 바로 뒤 문단을 Q&A로 ──
// AI 답변엔진·구글이 인용하기 쉬운 FAQPage 스키마를 본문 구조에서 자동 추출한다.
$faq = [];
if (preg_match_all('/<h2\b[^>]*>(.*?)<\/h2>(.*?)(?=<h2\b|$)/is', $html, $mm, PREG_SET_ORDER)) {
    foreach ($mm as $seg) {
        $q = trim(strip_tags($seg[1]));
        if (!preg_match('/[?？]|인가요|나요|하나요|무엇|어떻게|얼마|될까|왜\b|차이/u', $q)) continue;
        if (preg_match('/<p\b[^>]*>(.*?)<\/p>/is', $seg[2], $pm)) {
            $a = trim(preg_replace('/\s+/u', ' ', strip_tags($pm[1])));
            if (mb_strlen($a) >= 25) {
                $faq[] = ['q' => $q, 'a' => mb_substr($a, 0, 320)];
                if (count($faq) >= 6) break;
            }
        }
    }
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
$readMin = max(3, (int) round(mb_strlen(strip_tags($html)) / 500));

// 사이드바 주요기사·티커용
$allForNav = [];
try {
    $allForNav = news_articles();
} catch (Throwable) {
}
$topRanked = $allForNav;
usort($topRanked, fn($a, $b) => ($b['quality'] <=> $a['quality']) ?: strcmp($b['publishedAt'], $a['publishedAt']));
$topRanked = array_slice(array_filter($topRanked, fn($a) => $a['id'] !== $id), 0, 8);

render_head($article['title'] . ' — HOM2BOX 뉴스', $desc, $image ?: '');
?>
<script type="application/ld+json"><?php
$ldImage = $image;
if ($ldImage && str_starts_with($ldImage, '/')) $ldImage = 'https://hom2box.com' . $ldImage;
$ldPub = $publishedAt ? date('c', strtotime($publishedAt)) : date('c');
echo json_encode([
    '@context' => 'https://schema.org',
    '@type' => 'NewsArticle',
    'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => 'https://hom2box.com/article.php?id=' . $id],
    'headline' => mb_substr($article['title'], 0, 110),
    'description' => $desc,
    'articleSection' => $section,
    'datePublished' => $ldPub,
    'dateModified' => $ldPub,
    'image' => $ldImage ? [$ldImage] : [],
    'author' => ['@type' => 'Organization', 'name' => 'HOM2BOX 편집국', 'url' => 'https://hom2box.com/'],
    'publisher' => [
        '@type' => 'Organization',
        'name' => 'HOM2BOX 뉴스',
        'logo' => ['@type' => 'ImageObject', 'url' => 'https://hom2box.com/favicon/favicon-32.png'],
    ],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
?></script>
<?php news_breadcrumb_ld([
    ['name' => '홈', 'url' => 'https://hom2box.com/'],
    ['name' => $section, 'url' => 'https://hom2box.com/category.php?cat=' . urlencode($section)],
    ['name' => $article['title']],
]);
if ($faq) {
    news_jsonld([
        '@context' => 'https://schema.org',
        '@type' => 'FAQPage',
        'mainEntity' => array_map(fn($f) => [
            '@type' => 'Question',
            'name' => $f['q'],
            'acceptedAnswer' => ['@type' => 'Answer', 'text' => $f['a']],
        ], $faq),
    ]);
}
?>
<style>
html { scroll-behavior:smooth; }
/* 생성 본문(contentHtml)의 인라인 폰트를 통일하고 이미지·표를 반응형으로 */
.article-body, .article-body * { font-family:'Escoredream','Noto Sans KR',sans-serif !important; }
.article-body img { max-width:100%; height:auto; border-radius:8px; }
.article-body table { width:100%; border-collapse:collapse; display:block; overflow-x:auto; }
.article-body h2 { font-size:22px; font-weight:800; margin:32px 0 12px; padding-top:22px; border-top:1px solid #f1f1f1; scroll-margin-top:80px; }
.article-body h3 { font-size:18px; font-weight:700; margin:24px 0 10px; }
.article-body p { font-size:16.5px; line-height:1.95; margin:14px 0; color:#222; }
.article-body a { color:<?= NEWS_PRIMARY ?>; text-decoration:underline; }
</style>

<div class="min-h-screen bg-white">
  <?php render_ticker(array_slice($allForNav, 0, 6)); ?>
  <?php render_topbar(); ?>
  <?php render_masthead(); ?>
  <?php render_nav($section, [], true); ?>

  <div class="mx-auto max-w-[1399px] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10 px-6 py-8">
    <!-- 기사 본문 -->
    <div class="min-w-0">
      <div class="mb-3 text-[13px] font-bold text-[<?= NEWS_PRIMARY ?>]"><?= nh($section) ?></div>
      <h1 class="mb-4 text-[30px] md:text-[33px] font-extrabold leading-snug tracking-tight"><?= nh($article['title']) ?></h1>
      <div class="flex flex-wrap justify-between items-center gap-3 pb-4 border-b border-zinc-200">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[<?= NEWS_PRIMARY ?>] text-sm font-extrabold text-white">H</div>
          <div>
            <div class="text-[13.5px] font-bold">HOM2BOX 편집국 <span class="ml-1 inline-flex items-center rounded-md bg-[<?= NEWS_PRIMARY ?>] px-2 py-0.5 text-[10.5px] font-bold text-white">자체기사</span></div>
            <div class="mt-0.5 text-xs text-zinc-400">입력 <?= nh(news_date($publishedAt)) ?> · 읽기 <?= $readMin ?>분</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <?php foreach (NEWS_PLATFORM_PRIORITY as $pf): if (empty(array_column($jobs, null, 'platform')[$pf])) continue;
            [$label, $color] = NEWS_PLATFORMS[$pf]; $u = array_column($jobs, null, 'platform')[$pf]['publishedUrl']; ?>
            <a href="<?= nh($u) ?>" target="_blank" rel="noopener" class="inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-bold text-white" style="background:<?= $color ?>"><?= nh($label) ?></a>
          <?php endforeach; ?>
          <?php $shareUrl = 'https://hom2box.com/article.php?id=' . $id; ?>
          <a href="mailto:?subject=<?= rawurlencode($article['title']) ?>&body=<?= rawurlencode($article['title'] . "\n" . $shareUrl) ?>" title="메일로 보내기" class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm hover:bg-zinc-50"><span class="material-symbols-outlined text-[18px]">mail</span></a>
          <div class="relative" id="h2bShare">
            <button type="button" onclick="h2bShareToggle(event)" title="공유" class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm hover:bg-zinc-50"><span class="material-symbols-outlined text-[18px]">share</span></button>
            <div id="h2bShareMenu" class="hidden absolute right-0 top-11 z-50 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl">
              <div class="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">공유하기</div>
              <button type="button" onclick="h2bCopy()" class="flex w-full items-center gap-2.5 border-0 bg-transparent px-3 py-2 text-left text-[13.5px] font-semibold text-zinc-700 hover:bg-zinc-50"><span class="material-symbols-outlined text-[18px] text-zinc-400">content_copy</span>링크 복사</button>
              <button type="button" onclick="h2bShareWin('https://twitter.com/intent/tweet?text='+encodeURIComponent(H2B_TITLE)+'&url='+encodeURIComponent(H2B_URL))" class="flex w-full items-center gap-2.5 border-0 bg-transparent px-3 py-2 text-left text-[13.5px] font-semibold text-zinc-700 hover:bg-zinc-50"><span class="material-symbols-outlined text-[18px] text-zinc-400">share</span>X(트위터)</button>
              <button type="button" onclick="h2bShareWin('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(H2B_URL))" class="flex w-full items-center gap-2.5 border-0 bg-transparent px-3 py-2 text-left text-[13.5px] font-semibold text-zinc-700 hover:bg-zinc-50"><span class="material-symbols-outlined text-[18px] text-zinc-400">public</span>페이스북</button>
            </div>
          </div>
        </div>
      </div>

      <?php if (!empty($article['excerpt'])):
        // 요약 불릿 처리 — 생성기가 줄바꿈으로 구분한 다항목 요약이면 목록,
        // 일반 산문(줄바꿈 없음)이면 한 덩어리. 한국어에서 '·'는 문장 내 나열 구분자라
        // 여기서 나누지 않는다(줄바꿈/줄머리 불릿 기호만 경계로 인정).
        $sumRaw = trim($article['excerpt']);
        $sumLines = preg_split('/\r?\n+/u', $sumRaw, -1, PREG_SPLIT_NO_EMPTY);
        $sumParts = array_map(fn($l) => ltrim(trim($l), '·•-* '), $sumLines);
        $sumParts = array_values(array_filter($sumParts, fn($l) => $l !== ''));
      ?>
      <div class="my-6 rounded-lg border-l-4 border-[<?= NEWS_PRIMARY ?>] bg-zinc-50 px-5 py-4">
        <div class="mb-2 text-xs font-extrabold text-[<?= NEWS_PRIMARY ?>]">핵심 요약</div>
        <?php if (count($sumParts) >= 2): ?>
          <ul class="space-y-1.5 text-sm leading-relaxed text-zinc-700">
            <?php foreach ($sumParts as $sp): ?>
              <li class="flex gap-2"><span class="mt-0.5 text-[<?= NEWS_PRIMARY ?>] font-bold">·</span><span><?= nh($sp) ?></span></li>
            <?php endforeach; ?>
          </ul>
        <?php else: ?>
          <div class="text-sm leading-loose text-zinc-700"><?= nh($sumRaw) ?></div>
        <?php endif; ?>
      </div>
      <?php endif; ?>

      <?php if (count($toc) >= 3): ?>
      <nav class="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-zinc-200 px-4 py-3 text-xs text-zinc-500" aria-label="목차">
        <span class="font-extrabold text-zinc-900">목차</span>
        <?php $nums = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩']; foreach ($toc as $i => $t): ?>
          <a href="#toc-<?= $i + 1 ?>" class="text-xs text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>] hover:underline"><?= $nums[$i] ?? ($i + 1) ?> <?= nh($t) ?></a>
        <?php endforeach; ?>
      </nav>
      <?php endif; ?>

      <?php render_ad("article-top"); ?>

      <?php if ($showFigure): ?>
      <figure class="my-6"><img src="<?= nh($image) ?>" alt="<?= nh($article['title']) ?>" class="block w-full rounded-lg object-cover"><figcaption class="mt-2 text-xs text-zinc-400">AI 생성 이미지</figcaption></figure>
      <?php endif; ?>

      <article class="article-body pb-8"><?= $html /* goBlog 생성 HTML — 이스케이프 안 함 */ ?></article>

      <!-- 저자 소개 (E-E-A-T) -->
      <div class="mt-8 flex items-center gap-3.5 rounded-lg border border-zinc-200 bg-zinc-50/50 px-5 py-4">
        <div class="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[<?= NEWS_PRIMARY ?>] text-[15px] font-extrabold text-white">H</div>
        <div class="text-[13px] leading-relaxed text-zinc-500"><b class="text-zinc-900">HOM2BOX 편집국</b><br>매일 아침·저녁, 이슈·경제·IT·생활 분야의 자체 기사를 선별해 발행합니다. 일부 기사에는 제휴 링크가 포함될 수 있습니다.</div>
      </div>

      <?php render_ad("article-bottom"); ?>

      <?php if ($related): ?>
      <section class="border-t-2 border-zinc-900 pt-6 pb-4">
        <h3 class="text-[19px] font-extrabold mb-4"><?= nh($section) ?> 최신 기사</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <?php foreach ($related as $a): ?>
            <a href="/article.php?id=<?= (int) $a['id'] ?>" class="block group rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <?php if (!empty($a['image'])): ?><div class="w-full aspect-[16/10] bg-cover bg-center bg-zinc-100" style="background-image:url('<?= nh($a['image']) ?>')"></div><?php endif; ?>
              <div class="p-3"><div class="text-[14.5px] font-bold leading-normal group-hover:text-[<?= NEWS_PRIMARY ?>] line-clamp-2"><?= nh($a['title']) ?></div></div>
            </a>
          <?php endforeach; ?>
        </div>
      </section>
      <?php endif; ?>
    </div>

    <!-- 사이드바 -->
    <div class="flex flex-col gap-5 self-start lg:sticky lg:top-16">
      <div class="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div class="px-4 pt-3.5 pb-2.5 text-[15.5px] font-extrabold border-b border-zinc-100">주요 기사</div>
        <div class="px-4 py-1.5">
          <?php foreach ($topRanked as $i => $r): ?>
            <a href="/article.php?id=<?= (int) $r['id'] ?>" class="flex gap-3 items-baseline py-2 border-b border-zinc-50 last:border-0 group">
              <span class="w-4 flex-none text-[15px] font-extrabold text-[<?= NEWS_PRIMARY ?>]"><?= $i + 1 ?></span>
              <span class="flex-1 text-[13.5px] font-semibold leading-normal group-hover:text-[<?= NEWS_PRIMARY ?>]"><?= nh($r['title']) ?></span>
            </a>
          <?php endforeach; ?>
        </div>
      </div>
      <?php if ($sideAd): $isCp = $sideAd['source'] === 'COUPANG'; $accent = $isCp ? '#e52528' : '#03c75a'; ?>
      <a href="<?= nh($sideAd['productUrl']) ?>" target="_blank" rel="sponsored nofollow noopener" class="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
        <div class="mb-2.5 flex items-center justify-between">
          <span class="text-[13px] font-extrabold text-[<?= NEWS_PRIMARY ?>]">파트너스 추천</span>
          <span class="inline-flex items-center rounded border border-zinc-200 px-1.5 text-[10.5px] text-zinc-400">AD</span>
        </div>
        <?php if (!empty($sideAd['imageUrl'])): ?>
          <img src="<?= nh($sideAd['imageUrl']) ?>" alt="<?= nh($sideAd['name']) ?>" referrerpolicy="no-referrer" loading="lazy" class="h-28 w-full rounded-md bg-zinc-50 object-contain">
        <?php endif; ?>
        <div class="mt-2.5 text-sm font-bold leading-normal line-clamp-2"><?= nh($sideAd['name']) ?></div>
        <?php if (!empty($sideAd['price'])): ?>
          <div class="mt-1 text-[15px] font-extrabold" style="color:<?= $accent ?>"><?= number_format((int) $sideAd['price']) ?>원<?= $sideAd['isRocket'] ? ' <span class="text-[11px]" style="color:#2c7fff">🚀</span>' : '' ?></div>
        <?php endif; ?>
        <div class="mt-1.5 flex items-center gap-1 text-[11px] text-zinc-400"><span class="material-symbols-outlined text-[13px]">info</span>구매 시 운영자가 수수료를 제공받을 수 있습니다</div>
      </a>
      <?php endif; ?>
      <a href="/welfare.php" class="block rounded-lg border border-[#0a8f5b] bg-[#0a8f5b] p-4 text-white hover:bg-[#087a4d]">
        <div class="flex items-center gap-2 text-[15px] font-extrabold"><span class="material-symbols-outlined text-[20px]">payments</span>정부 지원금 찾기</div>
        <div class="mt-1.5 text-[12.5px] leading-relaxed text-white/85">생애주기·지역별 신청 가능한 지원금을 한 번에.</div>
      </a>
      <a href="/subscribe.php" class="block rounded-lg border border-[<?= NEWS_PRIMARY ?>] bg-[<?= NEWS_PRIMARY ?>] p-4 text-white hover:bg-[#0f3d82]">
        <div class="flex items-center gap-2 text-[15px] font-extrabold"><span class="material-symbols-outlined text-[20px]">mail</span>무료 뉴스레터 구독</div>
        <div class="mt-1.5 text-[12.5px] leading-relaxed text-white/80">매일 아침·저녁 핵심 기사를 메일로.</div>
      </a>
    </div>
  </div>

  <?php render_footer(); ?>
</div>
<div id="h2bToast" class="hidden fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"><span class="material-symbols-outlined text-[16px]">check</span><span id="h2bToastMsg">링크가 복사되었습니다</span></div>
<script>
var H2B_URL = <?= json_encode($shareUrl, JSON_UNESCAPED_SLASHES) ?>;
var H2B_TITLE = <?= json_encode($article['title'], JSON_UNESCAPED_UNICODE) ?>;
function h2bShareToggle(e){ e.stopPropagation(); document.getElementById('h2bShareMenu').classList.toggle('hidden'); }
document.addEventListener('click', function(e){
  var w = document.getElementById('h2bShare');
  if (w && !w.contains(e.target)) document.getElementById('h2bShareMenu').classList.add('hidden');
});
function h2bToast(msg){ var t=document.getElementById('h2bToast'); document.getElementById('h2bToastMsg').textContent=msg; t.classList.remove('hidden'); t.classList.add('flex'); clearTimeout(window._h2bT); window._h2bT=setTimeout(function(){t.classList.add('hidden');t.classList.remove('flex');},2000); }
function h2bCopy(){ document.getElementById('h2bShareMenu').classList.add('hidden');
  (navigator.clipboard ? navigator.clipboard.writeText(H2B_URL) : Promise.reject()).then(function(){h2bToast('링크가 복사되었습니다');}).catch(function(){ var ta=document.createElement('textarea'); ta.value=H2B_URL; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');}catch(_){} document.body.removeChild(ta); h2bToast('링크가 복사되었습니다'); }); }
function h2bShareWin(u){ document.getElementById('h2bShareMenu').classList.add('hidden'); window.open(u,'_blank','noopener,width=600,height=520'); }
</script>
<?php render_foot();
