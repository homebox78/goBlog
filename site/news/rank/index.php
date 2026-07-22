<?php
// 랭크튜브형 홈 (샘플). /rank/
declare(strict_types=1);
require_once __DIR__ . '/_layout.php';

$db = goblog_db();
$rising = $cats = $tubers = [];
try {
    $rising = $db->query("SELECT v.videoId,v.title,v.viewCount,v.view24h,v.durationSec,c.title chTitle,c.color,cat.name catName
        FROM rt_videos v JOIN rt_channels c ON c.channelId=v.channelId LEFT JOIN rt_categories cat ON cat.id=v.categoryId
        ORDER BY v.view24h DESC LIMIT 8")->fetchAll();
    $cats = rt_categories();
    $tubers = $db->query("SELECT channelId,title,subscribers,subs24h,color,
        (SELECT name FROM rt_categories cc WHERE cc.id=rt_channels.categoryId) catName
        FROM rt_channels ORDER BY subscribers DESC LIMIT 6")->fetchAll();
} catch (Throwable) {}

rt_head('랭크튜브 - 유튜브 조회수·급상승 랭킹', '유튜브 영상·채널·키워드 랭킹과 조회수 분석');
rt_nav('home');
?>
<main class="mx-auto max-w-[1200px] px-4 py-7">
  <!-- 히어로 -->
  <section class="rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-700 px-6 py-8 text-white">
    <div class="text-[13px] font-bold text-[#ff5a72]">유튜브 랭킹 · 실시간 분석</div>
    <h1 class="mt-2 text-[27px] font-extrabold leading-tight sm:text-[32px]">지금 뜨는 유튜브,<br>조회수·급상승으로 한눈에</h1>
    <p class="mt-2 max-w-xl text-[14px] text-white/70">카테고리·유튜버·키워드별 랭킹과 조회수 추이를 무료로 확인하세요.</p>
    <div class="mt-4 flex flex-wrap gap-2">
      <a href="/rank/category.php" class="rounded-full bg-[#ff0033] px-4 py-2 text-[14px] font-bold">카테고리 랭킹</a>
      <a href="/rank/youtuber.php" class="rounded-full bg-white/15 px-4 py-2 text-[14px] font-bold hover:bg-white/25">유튜버 랭킹</a>
      <a href="/rank/keyword.php" class="rounded-full bg-white/15 px-4 py-2 text-[14px] font-bold hover:bg-white/25">키워드 랭킹</a>
    </div>
  </section>

  <!-- 실시간 급상승 -->
  <section class="mt-8">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="flex items-center gap-2 text-[19px] font-extrabold">🔥 실시간 급상승 <span class="text-[13px] font-normal text-zinc-400">24시간 조회수 증가</span></h2>
      <a href="/rank/category.php?sortBy=view24h" class="text-[13px] font-bold text-zinc-500 hover:text-[#ff0033]">전체 보기 →</a>
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <?php foreach (array_slice($rising, 0, 8) as $i => $r): ?>
        <a href="/rank/video.php?id=<?= nh($r['videoId']) ?>" class="group rounded-xl border border-zinc-200 bg-white p-2.5 hover:border-zinc-300 hover:shadow-sm">
          <div class="relative"><?= rt_thumb($r['color'], $r['videoId'], rt_dur((int) $r['durationSec']), 'aspect-video w-full') ?>
            <span class="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-black/70 text-[13px] font-extrabold text-white"><?= $i + 1 ?></span></div>
          <div class="mt-2 line-clamp-2 text-[14px] font-bold leading-snug group-hover:text-[#ff0033]"><?= nh($r['title']) ?></div>
          <div class="mt-1 flex items-center justify-between text-[12px]">
            <span class="truncate text-zinc-500"><?= nh($r['chTitle']) ?></span>
            <span class="flex-none font-bold text-[#ff0033]">🔥 <?= rt_delta((int) $r['view24h']) ?></span>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
  </section>

  <!-- 카테고리 바로가기 -->
  <section class="mt-8">
    <h2 class="mb-3 text-[19px] font-extrabold">카테고리별 랭킹</h2>
    <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      <?php foreach ($cats as $c): ?>
        <a href="/rank/category.php?cat=<?= (int) $c['id'] ?>" class="rounded-xl border border-zinc-200 bg-white px-3 py-4 text-center text-[14px] font-bold text-zinc-700 hover:border-[#ff0033]/40 hover:text-[#ff0033]"><?= nh($c['name']) ?></a>
      <?php endforeach; ?>
    </div>
  </section>

  <!-- 유튜버 TOP -->
  <section class="mt-8">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-[19px] font-extrabold">인기 유튜버</h2>
      <a href="/rank/youtuber.php" class="text-[13px] font-bold text-zinc-500 hover:text-[#ff0033]">전체 보기 →</a>
    </div>
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <?php foreach ($tubers as $i => $t): ?>
        <a href="/rank/channel.php?id=<?= nh($t['channelId']) ?>" class="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 hover:border-zinc-300">
          <span class="w-5 text-center text-[15px] font-extrabold text-zinc-400"><?= $i + 1 ?></span>
          <span class="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[15px] font-extrabold text-white" style="background:<?= nh($t['color']) ?>"><?= nh(mb_substr($t['title'], 0, 1)) ?></span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-[15px] font-bold"><?= nh($t['title']) ?></div>
            <div class="text-[12.5px] text-zinc-500">구독 <?= rt_num((int) $t['subscribers']) ?> · <span class="text-[#ff0033] font-bold"><?= rt_delta((int) $t['subs24h']) ?></span></div>
          </div>
          <span class="flex-none rounded bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500"><?= nh($t['catName'] ?? '') ?></span>
        </a>
      <?php endforeach; ?>
    </div>
  </section>
</main>
<?php rt_foot(); ?>
