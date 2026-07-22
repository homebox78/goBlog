<?php
// 채널 상세 (샘플). /rank/channel.php?id=
declare(strict_types=1);
require_once __DIR__ . '/_layout.php';

$db = goblog_db();
$id = (string) ($_GET['id'] ?? '');
$c = null; $vids = [];
try {
    $st = $db->prepare("SELECT c.*, cat.name catName FROM rt_channels c LEFT JOIN rt_categories cat ON cat.id=c.categoryId WHERE c.channelId=:id LIMIT 1");
    $st->bindValue(':id', $id); $st->execute();
    $c = $st->fetch() ?: null;
    if ($c) {
        $st2 = $db->prepare("SELECT videoId,title,viewCount,view24h,durationSec,publishedAt FROM rt_videos WHERE channelId=:id ORDER BY viewCount DESC LIMIT 24");
        $st2->bindValue(':id', $id); $st2->execute();
        $vids = $st2->fetchAll();
    }
} catch (Throwable) {}

if (!$c) { rt_head('채널을 찾을 수 없음'); rt_nav(''); echo '<main class="mx-auto max-w-[900px] px-4 py-24 text-center text-zinc-400">채널을 찾을 수 없습니다. <a class="text-[#ff0033] font-bold" href="/rank/youtuber.php">유튜버 랭킹으로</a></main>'; rt_foot(); exit; }

$avg = $vids ? (int) round(array_sum(array_map(fn($x) => (int) $x['viewCount'], $vids)) / count($vids)) : 0;
rt_head($c['title'] . ' 채널 분석', '유튜브 채널 구독자·조회수 분석');
rt_nav('youtuber');
?>
<main class="mx-auto max-w-[1100px] px-4 py-6">
  <a href="/rank/youtuber.php" class="text-[13px] font-bold text-zinc-400 hover:text-zinc-700">← 유튜버 랭킹</a>

  <div class="mt-3 flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
    <span class="flex h-16 w-16 flex-none items-center justify-center rounded-full text-[26px] font-extrabold text-white" style="background:<?= nh($c['color']) ?>"><?= nh(mb_substr($c['title'], 0, 1)) ?></span>
    <div class="min-w-0">
      <h1 class="text-[22px] font-extrabold"><?= nh($c['title']) ?></h1>
      <div class="mt-0.5 text-[13px] text-zinc-500"><?= nh($c['catName'] ?? '') ?> · 영상 <?= number_format((int) $c['videoCount']) ?>개</div>
    </div>
    <a href="https://www.youtube.com/channel/<?= nh($c['channelId']) ?>" target="_blank" rel="noopener" class="ml-auto rounded-full bg-[#ff0033] px-4 py-2 text-[13px] font-bold text-white">채널 방문</a>
  </div>

  <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
    <?php
    $stats = [['구독자', rt_num((int) $c['subscribers'])], ['24시간 구독', '+' . rt_num((int) $c['subs24h'])], ['총 조회수', rt_num((int) $c['totalViews'])], ['영상당 평균', rt_num($avg)]];
    foreach ($stats as [$lb, $val]): ?>
      <div class="rounded-xl border border-zinc-200 bg-white p-4 text-center">
        <div class="text-[12px] font-bold text-zinc-400"><?= $lb ?></div>
        <div class="mt-1 text-[19px] font-extrabold tabular-nums"><?= $val ?></div>
      </div>
    <?php endforeach; ?>
  </div>

  <h2 class="mt-7 text-[17px] font-extrabold">인기 영상</h2>
  <?php if (!$vids): ?>
    <div class="py-16 text-center text-zinc-400">영상 데이터가 없습니다.</div>
  <?php else: ?>
    <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <?php foreach ($vids as $i => $m): ?>
        <a href="/rank/video.php?id=<?= nh($m['videoId']) ?>" class="group rounded-xl border border-zinc-200 bg-white p-2.5 hover:border-zinc-300">
          <div class="relative"><?= rt_thumb($c['color'], $m['videoId'], rt_dur((int) $m['durationSec']), 'aspect-video w-full') ?>
            <span class="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-black/70 text-[13px] font-extrabold text-white"><?= $i + 1 ?></span></div>
          <div class="mt-2 line-clamp-2 text-[14px] font-bold leading-snug group-hover:text-[#ff0033]"><?= nh($m['title']) ?></div>
          <div class="mt-1 flex items-center justify-between text-[12px]">
            <span class="text-zinc-500">조회 <?= rt_num((int) $m['viewCount']) ?></span>
            <span class="font-bold text-[#ff0033]">🔥 <?= rt_delta((int) $m['view24h']) ?></span>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</main>
<?php rt_foot(); ?>
