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
<link rel="canonical" href="https://hom2box.com/article.php?id=<?= $id ?>">
<script type="application/ld+json"><?= json_encode([
    '@context' => 'https://schema.org',
    '@type' => 'NewsArticle',
    'headline' => $article['title'],
    'datePublished' => $publishedAt,
    'image' => $image ? [$image] : [],
    'author' => ['@type' => 'Organization', 'name' => 'HOM2BOX 뉴스'],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?></script>
<style>
/* 생성 본문(contentHtml)의 인라인 폰트를 통일하고 이미지·표를 반응형으로 */
.article-body, .article-body * { font-family:'Escoredream','Noto Sans KR',sans-serif !important; }
.article-body img { max-width:100%; height:auto; border-radius:8px; }
.article-body table { width:100%; border-collapse:collapse; display:block; overflow-x:auto; }
.article-body h2 { font-size:22px; font-weight:800; margin:32px 0 12px; padding-top:22px; border-top:1px solid #f1f1f1; }
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
          <button type="button" onclick="if(navigator.share){navigator.share({title:document.title,url:location.href})}else{navigator.clipboard.writeText(location.href);this.querySelector('span').textContent='check'}" class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm hover:bg-zinc-50"><span class="material-symbols-outlined text-[18px]">share</span></button>
        </div>
      </div>

      <?php if (!empty($article['excerpt'])): ?>
      <div class="my-6 rounded-lg border-l-4 border-[<?= NEWS_PRIMARY ?>] bg-zinc-50 px-5 py-4">
        <div class="mb-1.5 text-xs font-extrabold text-[<?= NEWS_PRIMARY ?>]">핵심 요약</div>
        <div class="text-sm leading-loose text-zinc-700"><?= nh($article['excerpt']) ?></div>
      </div>
      <?php endif; ?>

      <!-- adsense-slot: article-top -->

      <?php if ($showFigure): ?>
      <figure class="my-6"><img src="<?= nh($image) ?>" alt="<?= nh($article['title']) ?>" class="block w-full rounded-lg object-cover"><figcaption class="mt-2 text-xs text-zinc-400">AI 생성 이미지</figcaption></figure>
      <?php endif; ?>

      <article class="article-body pb-8"><?= $html /* goBlog 생성 HTML — 이스케이프 안 함 */ ?></article>

      <!-- adsense-slot: article-bottom -->

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
<?php render_foot();
