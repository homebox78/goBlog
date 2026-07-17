<?php
// HOM2BOX 뉴스 디자인 시스템 — 공용 헤더/티커/내비/푸터 (시안: Tailwind + S-CoreDream, primary #134a9c).
declare(strict_types=1);

if (!function_exists('nh')) {
    require_once __DIR__ . '/goblog-db.php';
}

const NEWS_PRIMARY = '#134a9c';

function render_head(string $title, string $desc = '', string $ogImage = ''): void
{
    ?>
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= nh($title) ?></title>
<meta name="description" content="<?= nh($desc !== '' ? $desc : $title) ?>">
<meta property="og:title" content="<?= nh($title) ?>">
<meta property="og:description" content="<?= nh($desc) ?>">
<?php if ($ogImage): ?><meta property="og:image" content="<?= nh($ogImage) ?>"><?php endif; ?>
<link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32.png">
<link rel="apple-touch-icon" href="/favicon/apple-touch-icon-180.png">
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200">
<style>
@font-face{font-family:'Escoredream';src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-4Regular.woff') format('woff');font-weight:400;font-display:swap;}
@font-face{font-family:'Escoredream';src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-5Medium.woff') format('woff');font-weight:500;font-display:swap;}
@font-face{font-family:'Escoredream';src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-6Bold.woff') format('woff');font-weight:700;font-display:swap;}
@font-face{font-family:'Escoredream';src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-8Heavy.woff') format('woff');font-weight:800;font-display:swap;}
body,input,button,select,textarea,table { font-family:'Escoredream','Noto Sans KR',-apple-system,'Malgun Gothic',sans-serif !important; }
a { text-decoration:none; color:inherit; }
.material-symbols-outlined { line-height:1; display:inline-flex; align-items:center; justify-content:center; vertical-align:middle; position:relative; top:.5px; }
@keyframes h2bticker { from { transform:translateX(0);} to { transform:translateX(-50%);} }
.h2b-track { display:inline-flex; white-space:nowrap; animation:h2bticker 40s linear infinite; }
.h2b-track:hover { animation-play-state:paused; }
/* 속보 티커 일시정지/재생 (시안 동일 — 체크박스 CSS 토글, JS 불필요) */
.h2b-pause { display:none; }
.h2b-pause:checked ~ .h2b-bar .h2b-track { animation-play-state:paused !important; }
.h2b-ico-play { display:none; }
.h2b-pause:checked ~ label .h2b-ico-play { display:inline-flex; }
.h2b-pause:checked ~ label .h2b-ico-pause { display:none; }
</style>
</head>
<body class="bg-white text-zinc-900">
    <?php
}

function render_foot(): void
{
    echo "</body>\n</html>";
}

/** 속보 티커 — 최신 기사 제목 스크롤 */
function render_ticker(array $items): void
{
    if (!$items) return;
    $span = function () use ($items) {
        foreach ($items as $a) {
            echo '<a href="/article.php?id=' . (int) $a['id'] . '" class="mx-6 text-[11px] text-zinc-700 hover:text-[' . NEWS_PRIMARY . ']">· ' . nh($a['title']) . '</a>';
        }
    };
    ?>
<div class="border-b border-zinc-200 bg-white">
  <div class="mx-auto max-w-[1399px] flex items-stretch">
    <input type="checkbox" id="h2btk" class="h2b-pause">
    <label for="h2btk" title="클릭하면 멈춤/재생" class="flex flex-none cursor-pointer select-none items-center gap-1 bg-[#b91c1c] px-3 text-white">
      <span class="h2b-ico-pause material-symbols-outlined text-[16px]">pause</span><span class="h2b-ico-play material-symbols-outlined text-[16px]">play_arrow</span>
      <span class="whitespace-nowrap text-[12.5px] font-extrabold">속보</span>
    </label>
    <div class="h2b-bar min-w-0 flex-1 overflow-hidden py-2">
      <div class="h2b-track">
        <span class="inline-flex"><?php $span(); ?></span>
        <span class="inline-flex" aria-hidden="true"><?php $span(); ?></span>
      </div>
    </div>
  </div>
</div>
    <?php
}

function render_topbar(): void
{
    $week = ['일', '월', '화', '수', '목', '금', '토'];
    $today = date('Y년 n월 j일', time() + 9 * 3600) . ' (' . $week[(int) date('w', time() + 9 * 3600)] . ')';
    ?>
<div class="mx-auto max-w-[1399px] flex justify-between items-center px-6 py-2 text-xs text-zinc-500">
  <span><?= nh($today) ?></span>
  <div class="flex gap-3 sm:gap-4">
    <a href="https://hom2box.com/wordpress/" target="_blank" class="hover:underline"><span class="sm:hidden font-bold">W</span><span class="hidden sm:inline">Wordpress</span></a>
    <a href="https://hom2box.blogspot.com/" target="_blank" class="hover:underline"><span class="sm:hidden font-bold">B</span><span class="hidden sm:inline">BlogSpot</span></a>
    <a href="https://blog.naver.com/coreselect" target="_blank" class="hover:underline"><span class="sm:hidden font-bold">N</span><span class="hidden sm:inline">Naver Blog</span></a>
    <a href="https://hom2box.tistory.com" target="_blank" class="hover:underline"><span class="sm:hidden font-bold">T</span><span class="hidden sm:inline">Tistory</span></a>
  </div>
</div>
    <?php
}

/** 로고 + 검색 */
function render_masthead(string $q = ''): void
{
    ?>
<div class="border-t border-zinc-100">
  <div class="mx-auto max-w-[1399px] flex flex-wrap justify-between items-center gap-3 px-6 pt-5 pb-4">
    <div class="flex items-baseline gap-3">
      <a href="/" class="flex items-center gap-2">
        <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 8 H40 V33 L31 42 H8 Z" fill="#16181d"/><path d="M40 33 L31 33 V42 Z" fill="#4a4e57"/><rect x="14" y="15" width="16" height="5" rx="1" fill="#fff"/><rect x="14" y="24" width="20" height="3.6" rx="1" fill="#fff"/><rect x="14" y="31.5" width="13" height="3.6" rx="1" fill="#fff"/></svg>
        <span class="text-[32px] font-extrabold tracking-tight text-[#16181d]">HOM2BOX</span><span class="text-[19px] font-bold text-zinc-500">뉴스</span>
      </a>
      <span class="hidden sm:inline text-[13px] text-zinc-400">매일 아침·저녁 발행 · 이슈 · 경제 · IT · 생활</span>
    </div>
    <form action="/search.php" method="get" class="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 h-10 w-full sm:w-64 shadow-sm focus-within:ring-2 focus-within:ring-[<?= NEWS_PRIMARY ?>]/30">
      <input name="q" value="<?= nh($q) ?>" placeholder="뉴스 검색" class="flex-1 border-0 outline-none bg-transparent text-sm placeholder:text-zinc-400">
      <button type="submit" class="cursor-pointer border-0 bg-transparent p-0"><span class="material-symbols-outlined text-[20px] text-zinc-400 hover:text-[<?= NEWS_PRIMARY ?>]">search</span></button>
    </form>
  </div>
</div>
    <?php
}

/** 스티키 내비게이션 — 홈 + 분야 섹션 + 지원금 + 언론사 */
function render_nav(string $active, array $bySection = [], bool $hasPress = false): void
{
    $tabs = [['홈', '/']];
    foreach (NEWS_SECTIONS as $s) {
        $tabs[] = [$s, '/category.php?cat=' . urlencode($s)];
    }
    $tabs[] = ['지원금', '/welfare.php'];
    $tabs[] = ['계산기', '/tools.php'];
    $tabs[] = ['언론사', '/press.php'];
    $tabs[] = ['오피니언', '/opinion.php'];
    ?>
<div class="sticky top-0 z-50 bg-white/95 backdrop-blur border-t-2 border-zinc-900 border-b border-zinc-200">
  <div class="mx-auto max-w-[1399px] flex gap-1 px-4 overflow-x-auto">
    <?php foreach ($tabs as [$name, $href]):
        $on = $name === $active;
        $cls = $on
            ? 'px-4 py-3 text-[15px] font-extrabold whitespace-nowrap text-[' . NEWS_PRIMARY . '] border-b-2 border-[' . NEWS_PRIMARY . ']'
            : 'px-4 py-3 text-[15px] font-bold whitespace-nowrap text-zinc-700 hover:text-[' . NEWS_PRIMARY . ']'; ?>
      <a href="<?= nh($href) ?>" class="<?= $cls ?>"><?= nh($name) ?></a>
    <?php endforeach; ?>
  </div>
</div>
    <?php
}

function render_footer(): void
{
    ?>
<div class="border-t border-zinc-200 bg-zinc-50">
  <div class="mx-auto max-w-[1399px] px-6 py-10">
    <div class="grid grid-cols-2 gap-8 border-b border-zinc-200 pb-8 sm:grid-cols-[1.6fr_repeat(4,1fr)]">
      <div class="col-span-2 sm:col-span-1">
        <div class="text-[19px] font-extrabold">HOM2BOX <span class="text-[<?= NEWS_PRIMARY ?>]">뉴스</span></div>
        <div class="mt-2 max-w-xs text-[12.5px] leading-relaxed text-zinc-500">매일 아침·저녁, 편집국이 선별한 이슈·경제·IT·생활 뉴스와 가이드를 발행합니다.</div>
      </div>
      <div>
        <div class="mb-2.5 text-[13px] font-extrabold">뉴스</div>
        <a href="/" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">홈</a>
        <a href="/opinion.php" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">오피니언</a>
        <a href="/search.php" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">뉴스 검색</a>
        <a href="/welfare.php" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">정부 지원금</a>
        <a href="/subscribe.php" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">뉴스레터 구독</a>
      </div>
      <div>
        <div class="mb-2.5 text-[13px] font-extrabold">카테고리</div>
        <?php foreach (NEWS_SECTIONS as $s): ?>
          <a href="/category.php?cat=<?= urlencode($s) ?>" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]"><?= nh($s) ?></a>
        <?php endforeach; ?>
      </div>
      <div>
        <div class="mb-2.5 text-[13px] font-extrabold">채널</div>
        <a href="https://hom2box.com/wordpress/" target="_blank" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">Wordpress</a>
        <a href="https://hom2box.blogspot.com/" target="_blank" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">BlogSpot</a>
        <a href="https://blog.naver.com/coreselect" target="_blank" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">Naver Blog</a>
        <a href="https://hom2box.tistory.com" target="_blank" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">Tistory</a>
      </div>
      <div>
        <div class="mb-2.5 text-[13px] font-extrabold">약관·정책</div>
        <a href="/about.php" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">소개</a>
        <a href="/privacy.php" class="block py-1 text-[13px] font-semibold text-zinc-600 hover:text-[<?= NEWS_PRIMARY ?>]">개인정보처리방침</a>
        <a href="/contact.php" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">문의하기</a>
        <a href="/imgshop.php" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">AI 이미지샵</a>
      </div>
    </div>
    <div class="mt-6 text-xs leading-relaxed text-zinc-400">일부 기사에는 제휴 링크가 포함되어 있으며, 이를 통해 구매 시 운영자가 일정 수수료를 제공받을 수 있습니다. 제휴 매체 헤드라인은 RSS로 제공되는 콘텐츠입니다.<br>© <?= date('Y') ?> HOM2BOX. All rights reserved.</div>
  </div>
</div>
    <?php
}
