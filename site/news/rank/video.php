<?php
// 영상 상세 (샘플). /rank/video.php?id=
declare(strict_types=1);
require_once __DIR__ . '/_layout.php';

$db = goblog_db();
$id = (string) ($_GET['id'] ?? '');
$v = null; $more = [];
try {
    $st = $db->prepare("SELECT v.*, c.title chTitle, c.channelId, c.subscribers, c.color, cat.name catName, cat.id catId
        FROM rt_videos v JOIN rt_channels c ON c.channelId=v.channelId LEFT JOIN rt_categories cat ON cat.id=v.categoryId
        WHERE v.videoId=:id LIMIT 1");
    $st->bindValue(':id', $id);
    $st->execute();
    $v = $st->fetch() ?: null;
    if ($v) {
        $st2 = $db->prepare("SELECT v.videoId,v.title,v.viewCount,v.view24h,v.durationSec,c.title chTitle,c.color
            FROM rt_videos v JOIN rt_channels c ON c.channelId=v.channelId
            WHERE v.channelId=:ch AND v.videoId<>:id ORDER BY v.viewCount DESC LIMIT 6");
        $st2->bindValue(':ch', $v['channelId']); $st2->bindValue(':id', $id); $st2->execute();
        $more = $st2->fetchAll();
    }
} catch (Throwable) {}

if (!$v) { rt_head('영상을 찾을 수 없음'); rt_nav(''); echo '<main class="mx-auto max-w-[900px] px-4 py-24 text-center text-zinc-400">영상을 찾을 수 없습니다. <a class="text-[#ff0033] font-bold" href="/rank/">홈으로</a></main>'; rt_foot(); exit; }

$engage = (int) $v['viewCount'] > 0 ? min(100, round((int) $v['likeCount'] / (int) $v['viewCount'] * 100, 2)) : 0;
rt_head($v['title'], '유튜브 영상 조회수·급상승 분석');
rt_nav('');
?>
<main class="mx-auto max-w-[1000px] px-4 py-6">
  <a href="javascript:history.back()" class="text-[13px] font-bold text-zinc-400 hover:text-zinc-700">← 뒤로</a>
  <div class="mt-3 grid gap-6 lg:grid-cols-[1fr_320px]">
    <div>
      <?= rt_thumb($v['color'], $v['videoId'], rt_dur((int) $v['durationSec']), 'aspect-video w-full') ?>
      <h1 class="mt-4 text-[21px] font-extrabold leading-snug"><?= nh($v['title']) ?></h1>
      <div class="mt-3 flex items-center gap-3">
        <span class="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[15px] font-extrabold text-white" style="background:<?= nh($v['color']) ?>"><?= nh(mb_substr($v['chTitle'], 0, 1)) ?></span>
        <div>
          <a href="/rank/channel.php?id=<?= nh($v['channelId']) ?>" class="text-[15px] font-bold hover:text-[#ff0033]"><?= nh($v['chTitle']) ?></a>
          <div class="text-[12.5px] text-zinc-500">구독 <?= rt_num((int) $v['subscribers']) ?> · <?= nh($v['catName'] ?? '') ?></div>
        </div>
        <a href="https://www.youtube.com/watch?v=<?= nh($v['videoId']) ?>" target="_blank" rel="noopener" class="ml-auto rounded-full bg-[#ff0033] px-4 py-2 text-[13px] font-bold text-white">유튜브에서 보기</a>
      </div>

      <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <?php
        $stats = [['총 조회수', rt_num((int) $v['viewCount'])], ['24시간', '+' . rt_num((int) $v['view24h'])], ['7일', '+' . rt_num((int) $v['view7d'])], ['좋아요', rt_num((int) $v['likeCount'])]];
        foreach ($stats as [$lb, $val]): ?>
          <div class="rounded-xl border border-zinc-200 bg-white p-3.5 text-center">
            <div class="text-[12px] font-bold text-zinc-400"><?= $lb ?></div>
            <div class="mt-1 text-[18px] font-extrabold tabular-nums"><?= $val ?></div>
          </div>
        <?php endforeach; ?>
      </div>

      <div class="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
        <div class="flex items-center justify-between text-[13px] font-bold"><span>참여율 (좋아요/조회수)</span><span class="text-[#ff0033]"><?= $engage ?>%</span></div>
        <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100"><div class="h-full rounded-full bg-[#ff0033]" style="width:<?= min(100, $engage * 20) ?>%"></div></div>
        <div class="mt-3 text-[12.5px] text-zinc-500">업로드 <?= rt_ago($v['publishedAt']) ?> · <?= nh($v['catName'] ?? '') ?> 카테고리</div>
      </div>
    </div>

    <aside>
      <div class="text-[14px] font-extrabold">이 채널의 다른 영상</div>
      <div class="mt-3 space-y-2">
        <?php foreach ($more as $m): ?>
          <a href="/rank/video.php?id=<?= nh($m['videoId']) ?>" class="flex gap-2.5 rounded-lg border border-zinc-200 bg-white p-2 hover:border-zinc-300">
            <?= rt_thumb($m['color'], $m['videoId'], rt_dur((int) $m['durationSec']), 'h-[52px] w-[92px] flex-none') ?>
            <div class="min-w-0">
              <div class="line-clamp-2 text-[13px] font-bold leading-snug"><?= nh($m['title']) ?></div>
              <div class="mt-0.5 text-[11.5px] text-zinc-400">조회 <?= rt_num((int) $m['viewCount']) ?></div>
            </div>
          </a>
        <?php endforeach; ?>
      </div>
    </aside>
  </div>
</main>
<?php rt_foot(); ?>
