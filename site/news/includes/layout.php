<?php
// HOM2BOX 뉴스 디자인 시스템 — 공용 헤더/티커/내비/푸터 (시안: Tailwind + S-CoreDream, primary #134a9c).
declare(strict_types=1);

if (!function_exists('nh')) {
    require_once __DIR__ . '/goblog-db.php';
}

const NEWS_PRIMARY = '#134a9c';
// 정적 Tailwind CSS 캐시버전 — tailwind/dist 재빌드 시 갱신(브라우저 캐시 무효화)
const TW_CSS_VER = '20260718a';

/** 현재 요청 경로로 canonical URL 생성 — 추적/캐시버스트 파라미터(v, ajax, utm_*)는 제거 */
function news_canonical(): string
{
    $uri = $_SERVER['REQUEST_URI'] ?? '/';
    $parts = explode('?', $uri, 2);
    $path = $parts[0];
    if (empty($parts[1])) return 'https://hom2box.com' . $path;
    parse_str($parts[1], $q);
    foreach (array_keys($q) as $k) {
        if ($k === 'v' || $k === 'ajax' || $k === 'offset' || str_starts_with($k, 'utm_')) unset($q[$k]);
    }
    $qs = http_build_query($q);
    return 'https://hom2box.com' . $path . ($qs ? '?' . $qs : '');
}

/** JSON-LD 스크립트 태그 출력 (검색엔진·AI 인용용 구조화 데이터) */
function news_jsonld(array $data): void
{
    echo '<script type="application/ld+json">'
        . json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        . "</script>\n";
}

/**
 * BreadcrumbList 구조화 데이터.
 * @param array $crumbs [['name'=>'홈','url'=>'https://...'], ... 마지막 항목은 url 생략 가능]
 */
function news_breadcrumb_ld(array $crumbs): void
{
    $items = [];
    $i = 1;
    foreach ($crumbs as $c) {
        $li = ['@type' => 'ListItem', 'position' => $i++, 'name' => $c['name']];
        if (!empty($c['url'])) $li['item'] = $c['url'];
        $items[] = $li;
    }
    news_jsonld(['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $items]);
}

function render_head(string $title, string $desc = '', string $ogImage = '', string $canonical = ''): void
{
    $canonical = $canonical !== '' ? $canonical : news_canonical();
    $isArticle = str_contains($canonical, '/article.php');
    ?>
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= nh($title) ?></title>
<meta name="description" content="<?= nh($desc !== '' ? $desc : $title) ?>">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="canonical" href="<?= nh($canonical) ?>">
<meta property="og:type" content="<?= $isArticle ? 'article' : 'website' ?>">
<meta property="og:site_name" content="HOM2BOX 뉴스">
<meta property="og:locale" content="ko_KR">
<meta property="og:url" content="<?= nh($canonical) ?>">
<meta property="og:title" content="<?= nh($title) ?>">
<meta property="og:description" content="<?= nh($desc) ?>">
<meta name="twitter:card" content="<?= $ogImage ? 'summary_large_image' : 'summary' ?>">
<meta name="twitter:title" content="<?= nh($title) ?>">
<meta name="twitter:description" content="<?= nh($desc) ?>">
<?php if ($ogImage): ?><meta property="og:image" content="<?= nh($ogImage) ?>">
<meta name="twitter:image" content="<?= nh($ogImage) ?>"><?php endif; ?>
<link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32.png">
<link rel="apple-touch-icon" href="/favicon/apple-touch-icon-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fastly.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="/assets/tailwind.css?v=<?= TW_CSS_VER ?>">
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
/* 계산기 가로 마퀴 */
@keyframes h2bmq { from { transform:translateX(0);} to { transform:translateX(-50%);} }
.h2b-mq { display:inline-flex; white-space:nowrap; animation:h2bmq 55s linear infinite; }
.h2b-mq:hover { animation-play-state:paused; }
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
    ?>
<!-- 플로팅 버튼 그룹: 문의하기(+) · 맨 위로(↑) -->
<div class="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3">
  <button id="h2b-inquiry" type="button" aria-label="문의하기" title="문의하기"
          class="flex h-12 w-12 items-center justify-center rounded-full bg-[#134a9c] text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#0f3d82]">
    <span class="material-symbols-outlined text-[26px] leading-none">add</span>
  </button>
  <button id="h2b-top" type="button" aria-label="맨 위로" title="맨 위로" onclick="window.scrollTo({top:0,behavior:'smooth'})"
          class="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-lg opacity-0 pointer-events-none translate-y-2 transition-all duration-200 hover:border-zinc-300 hover:text-[<?= NEWS_PRIMARY ?>]">
    <span class="material-symbols-outlined text-[24px] leading-none">arrow_upward</span>
  </button>
</div>

<!-- 문의하기 모달 -->
<div id="h2b-inq-modal" class="fixed inset-0 z-[60] hidden items-center justify-center bg-black/40 p-4">
  <div class="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
    <div class="border-b border-zinc-100 px-6 py-5">
      <h2 class="text-[20px] font-extrabold text-zinc-900">문의하기</h2>
      <p class="mt-0.5 text-[13px] text-[#134a9c]">정정·제보, 제휴/광고, 저작권 등 무엇이든 남겨주세요</p>
    </div>
    <form id="h2b-inq-form" class="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
      <div>
        <label class="mb-1.5 block text-[13px] font-bold text-zinc-700">문의 유형</label>
        <div id="h2b-inq-cats" class="flex flex-wrap gap-2">
          <?php foreach (['정정·제보', '제휴·광고', '저작권', '기타'] as $i => $cat): ?>
            <button type="button" data-cat="<?= nh($cat) ?>"
                    class="h2b-cat rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors <?= $i === 0 ? 'border-[#134a9c] text-[#134a9c]' : 'border-zinc-200 text-zinc-500' ?>"><?= nh($cat) ?></button>
          <?php endforeach; ?>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-1.5 block text-[13px] font-bold text-zinc-700">이름 <span class="text-zinc-400">(선택)</span></label>
          <input name="name" placeholder="이름" class="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 h-11 text-sm outline-none focus:border-[#134a9c] focus:bg-white focus:ring-2 focus:ring-[#134a9c]/20">
        </div>
        <div>
          <label class="mb-1.5 block text-[13px] font-bold text-zinc-700">이메일 <span class="text-zinc-400">(회신용)</span></label>
          <input name="email" type="email" placeholder="you@example.com" class="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 h-11 text-sm outline-none focus:border-[#134a9c] focus:bg-white focus:ring-2 focus:ring-[#134a9c]/20">
        </div>
      </div>
      <div>
        <label class="mb-1.5 block text-[13px] font-bold text-zinc-700">제목 <span class="text-zinc-400">(선택)</span></label>
        <input name="subject" placeholder="제목을 입력하세요" class="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 h-11 text-sm outline-none focus:border-[#134a9c] focus:bg-white focus:ring-2 focus:ring-[#134a9c]/20">
      </div>
      <div>
        <label class="mb-1.5 block text-[13px] font-bold text-zinc-700">내용</label>
        <textarea name="message" required rows="5" placeholder="문의 내용을 입력하세요" class="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-sm outline-none focus:border-[#134a9c] focus:bg-white focus:ring-2 focus:ring-[#134a9c]/20"></textarea>
      </div>
      <div id="h2b-inq-msg" class="hidden text-[13px] font-bold"></div>
    </form>
    <div class="flex gap-3 border-t border-zinc-100 px-6 py-4">
      <button type="button" id="h2b-inq-close" class="flex-1 rounded-lg border border-zinc-200 py-3 text-[15px] font-bold text-zinc-600 hover:bg-zinc-50">닫기</button>
      <button type="submit" form="h2b-inq-form" class="flex-1 rounded-lg bg-[#134a9c] py-3 text-[15px] font-bold text-white hover:bg-[#0f3d82]">보내기</button>
    </div>
  </div>
</div>

<script>
(function(){
  var top=document.getElementById('h2b-top');
  function t(){ if(window.scrollY>400){top.classList.remove('opacity-0','pointer-events-none','translate-y-2');}else{top.classList.add('opacity-0','pointer-events-none','translate-y-2');} }
  window.addEventListener('scroll',t,{passive:true}); t();

  var modal=document.getElementById('h2b-inq-modal');
  function open(){ modal.classList.remove('hidden'); modal.classList.add('flex'); document.body.style.overflow='hidden'; }
  function close(){ modal.classList.add('hidden'); modal.classList.remove('flex'); document.body.style.overflow=''; }
  document.getElementById('h2b-inquiry').addEventListener('click',open);
  document.getElementById('h2b-inq-close').addEventListener('click',close);
  modal.addEventListener('click',function(e){ if(e.target===modal) close(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!modal.classList.contains('hidden')) close(); });

  var cat='정정·제보';
  document.getElementById('h2b-inq-cats').addEventListener('click',function(e){
    var b=e.target.closest('.h2b-cat'); if(!b) return; cat=b.dataset.cat;
    modal.querySelectorAll('.h2b-cat').forEach(function(x){ x.className='h2b-cat rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors border-zinc-200 text-zinc-500'; });
    b.className='h2b-cat rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors border-[#134a9c] text-[#134a9c]';
  });

  document.getElementById('h2b-inq-form').addEventListener('submit',function(e){
    e.preventDefault();
    var f=e.target, msg=document.getElementById('h2b-inq-msg');
    var fd=new FormData(f); fd.append('category',cat); fd.append('ajax','1');
    fetch('/contact.php',{method:'POST',body:fd}).then(function(r){return r.json();}).then(function(d){
      msg.classList.remove('hidden'); msg.textContent=(d.ok?'✅ ':'⚠️ ')+d.msg; msg.style.color=d.ok?'#0a8f5b':'#dc2626';
      if(d.ok){ f.reset(); setTimeout(close,1500); }
    }).catch(function(){ msg.classList.remove('hidden'); msg.textContent='⚠️ 일시적인 오류가 발생했습니다.'; msg.style.color='#dc2626'; });
  });
})();
</script>
    <?php
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
    $tabs[] = ['문서도구', '/docs.php'];
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

/**
 * 광고 슬롯 렌더 — ad_slots 테이블에서 position을 읽어 활성 시 배너/애드센스를 출력한다.
 * 관리자에서 켜지 않았거나 내용이 없으면 아무것도 출력하지 않는다(빈 슬롯).
 */
function render_ad(string $position): void
{
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        try {
            $rows = goblog_db()->query("SELECT position, enabled, type, adsenseCode, imageUrl, linkUrl, newTab, sponsored FROM ad_slots WHERE enabled=1")->fetchAll();
            foreach ($rows as $r) $cache[$r['position']] = $r;
        } catch (Throwable) {
            $cache = [];
        }
    }
    $ad = $cache[$position] ?? null;
    if (!$ad) return;

    if ($ad['type'] === 'ADSENSE' && !empty($ad['adsenseCode'])) {
        echo '<div class="my-5 flex justify-center">' . $ad['adsenseCode'] . '</div>';
        return;
    }
    if ($ad['type'] === 'IMAGE' && !empty($ad['imageUrl'])) {
        $img = '<img src="' . nh($ad['imageUrl']) . '" alt="광고" class="mx-auto max-w-full h-auto rounded-lg">';
        $rel = $ad['sponsored'] ? 'sponsored nofollow noopener' : 'noopener';
        $tgt = $ad['newTab'] ? ' target="_blank"' : '';
        echo '<div class="my-5 flex justify-center">';
        if (!empty($ad['linkUrl'])) {
            echo '<a href="' . nh($ad['linkUrl']) . '" rel="' . $rel . '"' . $tgt . '>' . $img . '</a>';
        } else {
            echo $img;
        }
        echo '<span class="sr-only">광고</span></div>';
    }
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
