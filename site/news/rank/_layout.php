<?php
// 랭크튜브형 랭킹 섹션 — 자체 레이아웃(홈/카테고리/유튜버/키워드). goBlog 뉴스와 별개 네비.
declare(strict_types=1);
require_once __DIR__ . '/../includes/goblog-db.php';

const RT_RED = '#ff0033';
const RT_CSS_VER = '20260721a';

/** 한국식 숫자 축약: 185억 · 1,240만 · 3,400 */
function rt_num(int $n): string
{
    if ($n >= 100000000) { $v = $n / 100000000; return rtrim(rtrim(number_format($v, ($v < 10 ? 1 : 0)), '0'), '.') . '억'; }
    if ($n >= 10000)     { return number_format((int) round($n / 10000)) . '만'; }
    return number_format($n);
}
function rt_delta(int $n): string { return ($n >= 0 ? '+' : '') . rt_num($n); }
function rt_dur(int $s): string { $m = intdiv($s, 60); $sec = $s % 60; return $m . ':' . str_pad((string) $sec, 2, '0', STR_PAD_LEFT); }
function rt_ago(?string $dt): string
{
    if (!$dt) return '';
    $t = strtotime($dt); if ($t === false) return '';
    $d = max(0, time() - $t);
    if ($d < 3600) return intdiv($d, 60) . '분 전';
    if ($d < 86400) return intdiv($d, 3600) . '시간 전';
    return intdiv($d, 86400) . '일 전';
}
/** 썸네일 자리(외부 이미지 없이 카테고리 색 그라디언트 + 재생 삼각형 + 길이 배지) */
function rt_thumb(string $color, string $seed, string $dur = '', string $cls = ''): string
{
    $c2 = $color;
    return '<div class="relative overflow-hidden rounded-lg ' . $cls . '" style="background:linear-gradient(135deg,' . nh($color) . '22,' . nh($c2) . '55)">'
        . '<div class="absolute inset-0 flex items-center justify-center">'
        . '<span class="flex h-9 w-9 items-center justify-center rounded-full bg-black/45"><span class="ml-0.5 h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-white"></span></span></div>'
        . ($dur ? '<span class="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-0.5 text-[10px] font-bold text-white">' . nh($dur) . '</span>' : '')
        . '</div>';
}

function rt_head(string $title, string $desc = ''): void
{
    ?>
<!DOCTYPE html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= nh($title) ?> | RANKTUBE</title>
<meta name="description" content="<?= nh($desc !== '' ? $desc : $title) ?>">
<meta name="robots" content="noindex">
<link rel="stylesheet" href="/assets/tailwind.css?v=<?= RT_CSS_VER ?>">
<style>
@font-face{font-family:'Escoredream';src:url('/assets/fonts/S-CoreDream-4Regular.woff2') format('woff2');font-weight:400;font-display:swap;}
@font-face{font-family:'Escoredream';src:url('/assets/fonts/S-CoreDream-5Medium.woff2') format('woff2');font-weight:500;font-display:swap;}
@font-face{font-family:'Escoredream';src:url('/assets/fonts/S-CoreDream-6Bold.woff2') format('woff2');font-weight:700;font-display:swap;}
@font-face{font-family:'Escoredream';src:url('/assets/fonts/S-CoreDream-8Heavy.woff2') format('woff2');font-weight:800;font-display:swap;}
body,input,button,select{font-family:'Escoredream','Noto Sans KR',-apple-system,'Malgun Gothic',sans-serif;}
a{text-decoration:none;color:inherit;}
</style>
</head><body class="bg-zinc-50 text-zinc-900">
    <?php
}

function rt_nav(string $active): void
{
    $tabs = [['홈', '/rank/', 'home'], ['카테고리 랭킹', '/rank/category.php', 'category'], ['유튜버 랭킹', '/rank/youtuber.php', 'youtuber'], ['키워드 랭킹', '/rank/keyword.php', 'keyword']];
    ?>
<header class="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
  <div class="mx-auto flex h-14 max-w-[1200px] items-center gap-6 px-4">
    <a href="/rank/" class="flex items-center gap-1.5 font-extrabold tracking-tight">
      <span class="flex h-6 w-8 items-center justify-center rounded bg-[<?= RT_RED ?>]"><span class="ml-0.5 h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-white"></span></span>
      <span class="text-[19px]">RANK<span class="text-[<?= RT_RED ?>]">TUBE</span></span>
    </a>
    <nav class="hidden items-center gap-1 sm:flex">
      <?php foreach ($tabs as [$label, $href, $key]):
        $on = $key === $active; ?>
        <a href="<?= $href ?>" class="rounded-full px-3.5 py-1.5 text-[14px] font-bold <?= $on ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100' ?>"><?= $label ?></a>
      <?php endforeach; ?>
    </nav>
    <div class="ml-auto flex items-center gap-2">
      <span class="hidden rounded-full border border-[<?= RT_RED ?>]/40 px-2.5 py-1 text-[11px] font-extrabold text-[<?= RT_RED ?>] sm:inline">Pro</span>
      <a href="#" class="rounded-full bg-zinc-100 px-3.5 py-1.5 text-[13px] font-bold text-zinc-700 hover:bg-zinc-200">로그인</a>
    </div>
  </div>
  <!-- 모바일 탭 -->
  <div class="flex gap-1 overflow-x-auto border-t border-zinc-100 px-3 py-2 sm:hidden">
    <?php foreach ($tabs as [$label, $href, $key]): $on = $key === $active; ?>
      <a href="<?= $href ?>" class="flex-none rounded-full px-3 py-1.5 text-[13px] font-bold <?= $on ? 'bg-zinc-900 text-white' : 'text-zinc-600 bg-zinc-100' ?>"><?= $label ?></a>
    <?php endforeach; ?>
  </div>
</header>
<div class="bg-amber-50 border-b border-amber-200 text-center text-[12px] text-amber-800 py-1.5">⚠️ 프로토타입 · <b>샘플 데이터</b>입니다 (실제 유튜브 통계 아님 — Data API 키 연결 시 실데이터로 전환)</div>
    <?php
}

function rt_foot(): void
{
    ?>
<footer class="mt-16 border-t border-zinc-200 bg-white">
  <div class="mx-auto max-w-[1200px] px-4 py-8 text-[12.5px] text-zinc-400">
    <div class="font-extrabold text-zinc-500">RANK<span class="text-[<?= RT_RED ?>]">TUBE</span> <span class="font-normal">프로토타입</span></div>
    <div class="mt-1">유튜브 영상·채널·키워드 랭킹 · 조회수·급상승 분석 (샘플)</div>
    <div class="mt-2 flex gap-3"><a href="#" class="hover:text-zinc-600">이용약관</a><a href="#" class="hover:text-zinc-600">개인정보</a><a href="#" class="hover:text-zinc-600">FAQ</a><a href="#" class="hover:text-zinc-600">문의</a></div>
  </div>
</footer>
</body></html>
    <?php
}

/** 카테고리 목록(칩) */
function rt_categories(): array
{
    try { return goblog_db()->query('SELECT id,name,slug FROM rt_categories ORDER BY sort')->fetchAll(); }
    catch (Throwable) { return []; }
}
