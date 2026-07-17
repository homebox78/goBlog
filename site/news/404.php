<?php
// 404 — 시안(HOM2BOX 404.dc.html) 기반: 아이콘 + 404 + 검색 + 인기 기사 카드.
declare(strict_types=1);
http_response_code(404);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

$all = [];
try { $all = news_articles(); } catch (Throwable) {}
$popular = array_slice($all, 0, 5);

render_head('요청하신 기사를 찾을 수 없습니다 (404) — HOM2BOX 뉴스', '주소가 바뀌었거나 삭제된 페이지일 수 있습니다. 검색으로 다시 찾아보세요.');
render_ticker(array_slice($all, 0, 6));
render_topbar();
render_masthead();
render_nav('');
?>
<div class="flex min-h-screen flex-col bg-white">
  <div class="flex flex-1 items-center justify-center px-6 py-20">
    <div class="w-full max-w-xl text-center">
      <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#134a9c]/10"><span class="material-symbols-outlined text-[44px] text-[#134a9c]">newspaper</span></div>
      <div class="text-[88px] font-extrabold leading-none tracking-tight text-[#134a9c]">404</div>
      <h1 class="mt-2 mb-3 text-[24px] font-extrabold tracking-tight">요청하신 기사를 찾을 수 없습니다</h1>
      <p class="mx-auto mb-8 max-w-md text-[14.5px] leading-relaxed text-zinc-500">주소가 바뀌었거나 삭제된 페이지일 수 있습니다. 검색으로 다시 찾아보거나 아래 인기 기사를 확인해 보세요.</p>

      <form action="/search.php" method="get" class="mx-auto mb-8 flex max-w-md items-center gap-2 rounded-lg border-2 border-zinc-900 px-3.5 h-12 focus-within:border-[#134a9c]">
        <span class="material-symbols-outlined text-[20px] text-zinc-400">search</span>
        <input name="q" placeholder="찾으시는 뉴스를 검색해 보세요" class="flex-1 border-0 outline-none bg-transparent text-[15px] placeholder:text-zinc-300">
        <button type="submit" class="inline-flex h-8 flex-none whitespace-nowrap cursor-pointer items-center rounded-md bg-[#134a9c] px-3.5 text-[13px] font-bold text-white hover:bg-[#0f3d82]">검색</button>
      </form>

      <div class="flex flex-wrap justify-center gap-2.5">
        <a href="/" class="inline-flex h-11 items-center gap-1.5 rounded-lg bg-[#134a9c] px-5 text-[14px] font-bold text-white shadow-sm hover:bg-[#0f3d82]"><span class="material-symbols-outlined text-[18px]">home</span>홈으로 가기</a>
        <a href="/" class="inline-flex h-11 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-5 text-[14px] font-bold text-zinc-600 shadow-sm hover:bg-zinc-50"><span class="material-symbols-outlined text-[18px]">grid_view</span>전체 카테고리</a>
      </div>

      <?php if ($popular): ?>
      <div class="mx-auto mt-12 max-w-md rounded-xl border border-zinc-200 bg-white text-left shadow-sm">
        <div class="border-b border-zinc-100 px-5 pt-4 pb-3 text-[14px] font-extrabold">지금 많이 보는 기사</div>
        <div class="px-5 py-1.5">
          <?php foreach ($popular as $i => $a): ?>
          <a href="/article.php?id=<?= (int) $a['id'] ?>" class="group flex items-baseline gap-3 border-b border-zinc-50 py-2.5 <?= $i === count($popular) - 1 ? 'border-0' : '' ?>">
            <span class="w-4 flex-none text-[15px] font-extrabold text-[#134a9c]"><?= $i + 1 ?></span>
            <span class="flex-1 text-[13px] font-semibold leading-normal group-hover:text-[#134a9c]"><?= nh($a['title']) ?></span>
            <span class="material-symbols-outlined flex-none text-[18px] text-zinc-300 group-hover:text-[#134a9c]">chevron_right</span>
          </a>
          <?php endforeach; ?>
        </div>
      </div>
      <?php endif; ?>
    </div>
  </div>
  <?php render_footer(); ?>
</div>
<?php render_foot();
