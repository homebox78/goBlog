<?php
// 제휴 상품 전체보기 — 쿠팡 파트너스 + 네이버 커넥트 섞어서 전시. (홈 특가 캐러셀의 '전체보기')
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

$src = trim((string) ($_GET['src'] ?? ''));
if (!in_array($src, ['COUPANG', 'BRANDCONNECT'], true)) $src = '';
$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = 40;
$offset = ($page - 1) * $perPage;

$total = news_shop_count($src);
$totalPages = max(1, (int) ceil($total / $perPage));
// 섞어서(전체)는 지퍼 교차, 출처 필터 시 리뷰순
$products = $src === '' ? news_shop_mixed($perPage) : news_shop_products($perPage, $src, $offset);

$ticker = [];
try { $ticker = array_slice(news_articles(), 0, 6); } catch (Throwable) {}

$P = NEWS_PRIMARY;
render_head('특가 쇼핑 — 쿠팡·네이버 인기 상품 | HOM2BOX 뉴스', '쿠팡 파트너스·네이버 커넥트 인기 상품을 한 곳에. 최대 50% 할인 특가템을 골라 담으세요.');
news_breadcrumb_ld([
    ['name' => '홈', 'url' => 'https://hom2box.com/'],
    ['name' => '특가 쇼핑'],
]);
render_ticker($ticker);
render_topbar();
render_masthead();
render_nav('', [], true);

$tab = function (string $key, string $label) use ($src): string {
    $on = $src === $key;
    $cls = $on ? 'text-[#134a9c] border-b-2 border-[#134a9c]' : 'text-zinc-500 hover:text-zinc-900 border-b-2 border-transparent';
    $href = $key === '' ? '/shop.php' : '/shop.php?src=' . $key;
    return '<a href="' . $href . '" class="pb-2 text-[14px] font-bold ' . $cls . '">' . nh($label) . '</a>';
};
?>
<div class="min-h-screen bg-white">
  <?php // 히어로 (절제된 다크 밴드) ?>
  <section class="border-b border-zinc-200 bg-[#03c75a] text-white">
    <div class="mx-auto max-w-[1399px] px-4 py-7 sm:px-6 sm:py-9">
      <div class="text-[12px] font-bold uppercase tracking-wider text-white/50">SHOP</div>
      <h1 class="mt-2 flex items-center gap-2 text-[26px] font-extrabold tracking-tight sm:text-[32px]"><span class="material-symbols-outlined text-[28px]">shopping_cart</span>지금 가장 많이 담는 특가</h1>
      <p class="mt-2 text-[14px] leading-relaxed text-white/70">쿠팡 파트너스·네이버 커넥트 인기 상품 <b class="text-white"><?= number_format($total) ?></b>개를 한 곳에. 꼭 담아야 할 특가템을 골라 담으세요.</p>
    </div>
  </section>

  <div class="mx-auto max-w-[1399px] px-4 sm:px-6">
    <?php // 출처 탭 ?>
    <div class="flex items-center gap-5 border-b border-zinc-200 pt-6">
      <?= $tab('', '전체') ?>
      <?= $tab('COUPANG', '쿠팡') ?>
      <?= $tab('BRANDCONNECT', '네이버') ?>
    </div>

    <?php if (!$products): ?>
      <div class="py-24 text-center text-zinc-400">표시할 상품이 없습니다.</div>
    <?php else: ?>
      <div class="grid grid-cols-2 gap-x-3 gap-y-7 py-7 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-5 xl:grid-cols-6">
        <?php foreach ($products as $p) render_product_card($p); ?>
      </div>

      <?php if ($src !== '' && $totalPages > 1): ?>
        <div class="flex items-center justify-center gap-1.5 border-t border-zinc-100 py-8">
          <?php
          $qs = fn(int $pg) => '/shop.php?src=' . $src . '&page=' . $pg;
          $start = max(1, $page - 2);
          $end = min($totalPages, $start + 4);
          ?>
          <?php if ($page > 1): ?><a href="<?= $qs($page - 1) ?>" class="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:border-[#134a9c] hover:text-[#134a9c]"><span class="material-symbols-outlined text-[18px]">chevron_left</span></a><?php endif; ?>
          <?php for ($i = $start; $i <= $end; $i++): ?>
            <a href="<?= $qs($i) ?>" class="flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-[13.5px] font-bold <?= $i === $page ? 'bg-[#134a9c] text-white' : 'border border-zinc-200 text-zinc-600 hover:border-[#134a9c] hover:text-[#134a9c]' ?>"><?= $i ?></a>
          <?php endfor; ?>
          <?php if ($page < $totalPages): ?><a href="<?= $qs($page + 1) ?>" class="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:border-[#134a9c] hover:text-[#134a9c]"><span class="material-symbols-outlined text-[18px]">chevron_right</span></a><?php endif; ?>
        </div>
      <?php endif; ?>

      <p class="border-t border-zinc-100 py-5 text-[11.5px] leading-relaxed text-zinc-400">※ 본 페이지는 쿠팡 파트너스·네이버 쇼핑 커넥트 활동의 일환으로, 상품 구매 시 일정액의 수수료를 제공받을 수 있습니다. 가격·재고·할인은 각 판매 페이지 기준이며 실시간과 다를 수 있습니다.</p>
    <?php endif; ?>
  </div>

  <?php render_footer(); ?>
</div>
<?php render_foot(); ?>
