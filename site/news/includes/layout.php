<?php
// HOM2BOX 뉴스 디자인 시스템 — 공용 헤더/티커/내비/푸터 (시안: Tailwind + S-CoreDream, primary #134a9c).
declare(strict_types=1);

if (!function_exists('nh')) {
    require_once __DIR__ . '/goblog-db.php';
}
require_once __DIR__ . '/market.php';

const NEWS_PRIMARY = '#134a9c';
// 정적 Tailwind CSS 캐시버전 — tailwind/dist 재빌드 시 갱신(브라우저 캐시 무효화)
const TW_CSS_VER = '20260718z';

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
<!-- 포털 검색 등록 소유확인 -->
<meta name="naver-site-verification" content="9ecc3c8fb1e58fdffb9406529b6cb1f887b10208">
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
<!-- 폰트 전량 자체호스팅(외부 CDN 호출 없음). MS 기본 클래스는 tailwind.css 앞에 둬 text-[Npx]가 뒤에서 크기를 이기게 함 -->
<link rel="preload" href="/assets/fonts/S-CoreDream-4Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/MaterialSymbolsOutlined.woff2" as="font" type="font/woff2" crossorigin>
<style>
@font-face{font-family:'Material Symbols Outlined';font-style:normal;font-weight:normal;font-display:block;src:url('/assets/fonts/MaterialSymbolsOutlined.woff2') format('woff2');}
.material-symbols-outlined{font-family:'Material Symbols Outlined';font-weight:normal;font-style:normal;font-size:24px;line-height:1;letter-spacing:normal;text-transform:none;white-space:nowrap;word-wrap:normal;direction:ltr;font-feature-settings:'liga';-webkit-font-smoothing:antialiased;}
</style>
<link rel="stylesheet" href="/assets/tailwind.css?v=<?= TW_CSS_VER ?>">
<style>
@font-face{font-family:'Escoredream';src:url('/assets/fonts/S-CoreDream-3Light.woff2') format('woff2');font-weight:300;font-display:swap;}
@font-face{font-family:'Escoredream';src:url('/assets/fonts/S-CoreDream-4Regular.woff2') format('woff2');font-weight:400;font-display:swap;}
@font-face{font-family:'Escoredream';src:url('/assets/fonts/S-CoreDream-5Medium.woff2') format('woff2');font-weight:500;font-display:swap;}
@font-face{font-family:'Escoredream';src:url('/assets/fonts/S-CoreDream-6Bold.woff2') format('woff2');font-weight:700;font-display:swap;}
@font-face{font-family:'Escoredream';src:url('/assets/fonts/S-CoreDream-8Heavy.woff2') format('woff2');font-weight:800;font-display:swap;}
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
/* 좌우 퀵 레일 접기 (시안 동일 — :has 토글) */
body:has(#h2brail:checked) .h2b-rail-items { display:none; }
body:has(#h2brail:checked) .h2b-rail-chev { transform:rotate(180deg); }
</style>
</head>
<body class="bg-white text-zinc-900">
    <?php
}

function render_foot(): void
{
    $cur = basename($_SERVER['PHP_SELF'] ?? '');
    $act = fn(array $n) => in_array($cur, $n, true);
    // 레일 링크 항목 (좌: 네비 / 우: 유틸)
    $item = function (string $href, string $title, string $icon, bool $active, string $side) {
        $st = $active ? 'text-[#134a9c] bg-[#134a9c]/10' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900';
        $tip = $side === 'left' ? 'left-[52px]' : 'right-[52px]';
        echo '<a href="' . $href . '" title="' . nh($title) . '" class="group relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ' . $st . '">'
            . '<span class="material-symbols-outlined text-[22px]">' . $icon . '</span>'
            . '<span class="pointer-events-none absolute ' . $tip . ' whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">' . nh($title) . '</span></a>';
    };
    ?>
<!-- 좌우 퀵 레일 (2xl 이상, 시안 동일) — 접기 토글 공유 -->
<input type="checkbox" id="h2brail" class="hidden">
<aside class="fixed left-3 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-1 rounded-2xl border border-zinc-200 bg-white/90 p-1.5 shadow-lg backdrop-blur 2xl:flex">
  <label for="h2brail" title="접기/펼치기" class="flex h-9 w-11 flex-none cursor-pointer items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"><span class="material-symbols-outlined text-[20px] transition-transform h2b-rail-chev">chevron_left</span></label>
  <div class="flex flex-col items-center gap-1 h2b-rail-items">
    <?php
      $item('/', '뉴스', 'public', $act(['index.php', '']), 'left');
      $item('/opinion.php', '오피니언', 'description', $act(['opinion.php']), 'left');
      $item('/press.php', '언론사', 'forum', $act(['press.php']), 'left');
      $item('/tools.php', '계산기', 'calculate', $act(['tools.php', 'tool.php']), 'left');
      $item('/welfare.php', '지원금', 'volunteer_activism', $act(['welfare.php']), 'left');
      $item('/jobs.php', '노인일자리', 'elderly', $act(['jobs.php']), 'left');
    ?>
  </div>
</aside>
<aside class="fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-1 rounded-2xl border border-zinc-200 bg-white/90 p-1.5 shadow-lg backdrop-blur 2xl:flex">
  <label for="h2brail" title="접기/펼치기" class="flex h-9 w-11 flex-none cursor-pointer items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"><span class="material-symbols-outlined text-[20px] transition-transform h2b-rail-chev">chevron_right</span></label>
  <div class="flex flex-col items-center gap-1 h2b-rail-items">
    <?php
      $item('/docs.php', '문서도구', 'draft', $act(['docs.php']), 'right');
      $item('/search.php', '검색', 'search', $act(['search.php']), 'right');
      $item('/subscribe.php', '구독', 'bookmark', $act(['subscribe.php']), 'right');
    ?>
    <button type="button" title="문의하기" class="h2b-open-inq group relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border-0 bg-transparent text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
      <span class="material-symbols-outlined text-[22px]">support_agent</span>
      <span class="pointer-events-none absolute right-[52px] whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">문의하기</span>
    </button>
    <div class="my-0.5 h-px w-6 bg-zinc-200"></div>
    <button type="button" title="맨 위로" onclick="window.scrollTo({top:0,behavior:'smooth'})" class="group relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border-0 bg-transparent text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
      <span class="material-symbols-outlined text-[22px]">arrow_upward</span>
      <span class="pointer-events-none absolute right-[52px] whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">맨 위로</span>
    </button>
  </div>
</aside>

<!-- 플로팅 버튼 그룹 (2xl 미만 — 레일 숨김 시 노출) -->
<div class="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3 2xl:hidden">
  <button type="button" aria-label="문의하기" title="문의하기"
          class="h2b-open-inq flex h-12 w-12 items-center justify-center rounded-full bg-[#134a9c] text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#0f3d82]">
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
  document.querySelectorAll('.h2b-open-inq').forEach(function(b){ b.addEventListener('click',open); });
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
/**
 * JTBC 속보 바 — 헤더 위, 24시간 내 속보가 있을 때만. X로 닫으면(그 속보 한정) 다시 안 뜬다.
 * 새 속보가 뜨면(키가 바뀌면) 다시 노출.
 */
function render_breaking_bar(): void
{
    if (!function_exists('news_breaking')) {
        $f = __DIR__ . '/press-rss.php';
        if (is_file($f)) require_once $f; else return;
    }
    $b = null;
    try { $b = news_breaking(); } catch (Throwable) {}
    if (!$b) return;
    ?>
<div id="h2b-bk" data-k="<?= nh($b['key']) ?>" class="bg-[#16356e]">
  <div class="mx-auto flex max-w-[1399px] items-center gap-3 px-4 py-3 sm:px-6">
    <a href="<?= nh($b['link']) ?>" target="_blank" rel="noopener nofollow" class="flex min-w-0 flex-1 items-center gap-8">
      <span class="flex-none text-[12px] font-bold text-white sm:text-[14px]">속보</span>
      <span class="truncate text-[12px] font-medium text-white/95 sm:text-[14px]"><?= nh($b['title']) ?></span>
    </a>
    <button type="button" onclick="try{localStorage.setItem('h2b_bk_'+this.parentNode.parentNode.dataset.k,'1')}catch(e){};this.closest('#h2b-bk').remove();" aria-label="속보 닫기" class="flex-none text-white/80 hover:text-white"><span class="material-symbols-outlined text-[20px]">close</span></button>
  </div>
</div>
<script>(function(){try{var el=document.getElementById('h2b-bk');if(el&&localStorage.getItem('h2b_bk_'+el.dataset.k))el.remove();}catch(e){}})();</script>
    <?php
}

function render_ticker(array $items): void
{
    // 티커 = 언론사 헤드라인 JTBC '이슈 TOP10' 10건(외부 링크). 수집 실패 시 전달받은 자체 기사로 폴백.
    if (!function_exists('press_headlines')) {
        $f = __DIR__ . '/press-rss.php';
        if (is_file($f)) require_once $f;
    }
    $issue = [];
    if (function_exists('press_headlines')) {
        try {
            $ph = press_headlines(10);
            foreach (($ph['jtbc']['boxes']['이슈 TOP10'] ?? []) as $it) {
                if (!empty($it['title']) && !empty($it['link'])) $issue[] = ['title' => $it['title'], 'link' => $it['link']];
                if (count($issue) >= 10) break;
            }
        } catch (Throwable) {}
    }
    $rows = $issue ?: array_map(fn($a) => ['title' => $a['title'], 'link' => '/article.php?id=' . (int) $a['id']], $items);
    if (!$rows) return;
    $span = function () use ($rows) {
        foreach ($rows as $a) {
            $ext = str_starts_with($a['link'], 'http');
            echo '<a href="' . nh($a['link']) . '"' . ($ext ? ' target="_blank" rel="noopener nofollow"' : '') . ' class="mx-6 text-[11px] text-zinc-700 hover:text-[' . NEWS_PRIMARY . ']">· ' . nh($a['title']) . '</a>';
        }
    };
    ?>
<div class="border-b border-zinc-200 bg-white">
  <div class="mx-auto max-w-[1399px] flex items-stretch">
    <input type="checkbox" id="h2btk" class="h2b-pause">
    <label for="h2btk" title="클릭하면 멈춤/재생" class="flex flex-none cursor-pointer select-none items-center gap-1 bg-[#b91c1c] px-3 text-white">
      <span class="h2b-ico-pause material-symbols-outlined text-[16px]">pause</span><span class="h2b-ico-play material-symbols-outlined text-[16px]">play_arrow</span>
      <span class="whitespace-nowrap text-[12.5px] font-extrabold">이슈</span>
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
    // 시안 개편: 날짜·채널 상단바는 제거(채널 링크는 푸터로) — 기존 페이지 호출 호환용 no-op
}

/** 시안 개편: 대형 로고+검색 매스트헤드 제거(로고·검색은 슬림 내비로 통합) — 호환용 no-op */
function render_masthead(string $q = ''): void
{
}

/** 슬림 통합 내비 — 로고 + 탭 + 우측 검색 (시안 1단 sticky 바) + 하단 Market 스트립 */
function render_nav(string $active, array $bySection = [], bool $hasPress = false): void
{
    // 좌측 = 기사 관련(홈·카테고리·언론사·오피니언), 우측 = 유틸(지원금·일자리·계산기·문서도구).
    // 데스크톱에선 유틸 그룹을 우측 정렬 + '|'로 분기, 모바일에선 가로 스크롤로 자연스럽게 이어진다.
    $newsTabs = [['홈', '/']];
    foreach (NEWS_SECTIONS as $s) {
        $newsTabs[] = [$s, '/category.php?cat=' . urlencode($s)];
    }
    $newsTabs[] = ['언론사', '/press.php'];
    $newsTabs[] = ['오피니언', '/opinion.php'];
    $utilTabs = [
        ['지원금', '/welfare.php'],
        ['노인일자리', '/jobs.php'],
        ['계산기', '/tools.php'],
        ['문서도구', '/docs.php'],
    ];
    $tabCls = function (bool $on): string {
        return $on
            ? 'flex-none whitespace-nowrap px-2.5 py-4 text-sm font-bold text-[' . NEWS_PRIMARY . '] border-b-[3px] border-[' . NEWS_PRIMARY . ']'
            : 'flex-none whitespace-nowrap px-2.5 py-4 text-sm font-bold text-zinc-700 hover:text-[' . NEWS_PRIMARY . ']';
    };
    // 드로어 링크 = 좌측(기사) + 구분선 + 우측(유틸) + 검색
    $drawerLink = function (string $name, string $href) use ($active): string {
        $on = $name === $active;
        $cls = $on ? 'bg-[#134a9c]/10 text-[#134a9c]' : 'text-zinc-700 hover:bg-zinc-50';
        return '<a href="' . nh($href) . '" class="rounded-lg px-3 py-2.5 text-[14px] font-bold ' . $cls . '">' . nh($name) . '</a>';
    };
    ?>
<!-- 모바일 햄버거 드로어 (CSS-only, JS 불필요) — lg 미만에서만 동작 -->
<input type="checkbox" id="h2bnav" class="peer hidden">
<label for="h2bnav" aria-label="메뉴 닫기" class="fixed inset-0 z-[80] hidden bg-black/50 backdrop-blur-sm peer-checked:block lg:!hidden"></label>
<aside class="fixed left-0 top-0 z-[90] flex h-full w-[284px] max-w-[82%] -translate-x-full flex-col overflow-y-auto bg-white shadow-2xl transition-transform duration-300 ease-out peer-checked:translate-x-0 lg:hidden">
  <div class="flex items-center justify-between border-b border-zinc-200 px-4 py-3.5">
    <a href="/" class="flex items-center gap-1.5"><svg width="22" height="22" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 8 H40 V33 L31 42 H8 Z" fill="#16181d"/><path d="M40 33 L31 33 V42 Z" fill="#4a4e57"/><rect x="14" y="15" width="16" height="5" rx="1" fill="#fff"/><rect x="14" y="24" width="20" height="3.6" rx="1" fill="#fff"/><rect x="14" y="31.5" width="13" height="3.6" rx="1" fill="#fff"/></svg><span class="text-[17px] font-extrabold tracking-tight text-[#16181d]">HOM2BOX</span><span class="text-[12px] font-bold text-zinc-500">뉴스</span></a>
    <label for="h2bnav" aria-label="닫기" class="flex h-9 w-9 cursor-pointer items-center justify-center text-zinc-500"><span class="material-symbols-outlined text-[24px]">close</span></label>
  </div>
  <nav class="flex flex-col p-2">
    <?php foreach ($newsTabs as [$name, $href]) echo $drawerLink($name, $href); ?>
    <div class="my-1.5 border-t border-zinc-100"></div>
    <?php foreach ($utilTabs as [$name, $href]) echo $drawerLink($name, $href); ?>
    <?php echo $drawerLink('검색', '/search.php'); ?>
  </nav>
</aside>

<div class="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
  <div class="mx-auto flex max-w-[1399px] items-center gap-2 px-4 sm:px-6 lg:gap-4">
    <label for="h2bnav" aria-label="메뉴 열기" class="order-2 flex h-10 w-10 flex-none cursor-pointer items-center justify-center text-zinc-700 lg:hidden"><span class="material-symbols-outlined text-[26px]">menu</span></label>
    <a href="/" class="order-1 mr-auto flex flex-none items-center gap-1.5 py-2.5 lg:mr-0">
      <svg width="26" height="26" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 8 H40 V33 L31 42 H8 Z" fill="#16181d"/><path d="M40 33 L31 33 V42 Z" fill="#4a4e57"/><rect x="14" y="15" width="16" height="5" rx="1" fill="#fff"/><rect x="14" y="24" width="20" height="3.6" rx="1" fill="#fff"/><rect x="14" y="31.5" width="13" height="3.6" rx="1" fill="#fff"/></svg>
      <span class="text-[21px] font-extrabold tracking-tight text-[#16181d]">HOM2BOX</span><span class="text-[14px] font-bold text-zinc-500">뉴스</span>
    </a>
    <nav class="order-3 hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto lg:ml-16 lg:flex">
      <?php foreach ($newsTabs as [$name, $href]): ?>
        <a href="<?= nh($href) ?>" class="<?= $tabCls($name === $active) ?>"><?= nh($name) ?></a>
      <?php endforeach; ?>
      <?php // 구분자 — ml-auto로 유틸 그룹을 데스크톱에서 우측으로 밀고 '|'로 분기 ?>
      <span class="ml-auto flex-none select-none px-2 text-zinc-300" aria-hidden="true">|</span>
      <?php foreach ($utilTabs as [$name, $href]): ?>
        <a href="<?= nh($href) ?>" class="<?= $tabCls($name === $active) ?>"><?= nh($name) ?></a>
      <?php endforeach; ?>
    </nav>
    <a href="/search.php" class="order-4 flex flex-none items-center gap-1 py-3 text-sm font-bold text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">
      <span class="material-symbols-outlined text-[20px]">search</span><span class="hidden sm:inline">검색</span>
    </a>
  </div>
</div>
    <?php
    render_breaking_bar(); // 속보 바 = 헤더(로고+메뉴) 바로 아래 (JTBC 스타일)
    render_market_strip();
}

/**
 * 제휴 상품 카드 — 쿠팡 파트너스 / 네이버 커넥트 공용. (홈 캐러셀·전체보기 페이지 공용)
 * ⚠️ 트래킹 링크는 새 창 + rel=sponsored nofollow. 대가성은 페이지에서 별도 고지.
 */
function render_product_card(array $p): void
{
    $isCoupang = ($p['source'] ?? '') === 'COUPANG';
    $badge = $isCoupang ? ($p['isRocket'] ? '로켓배송' : '쿠팡') : '네이버';
    $badgeBg = $isCoupang ? 'bg-[#2c7fff]' : 'bg-[#03c75a]';
    $price = (int) ($p['price'] ?? 0);
    $orig = (int) ($p['originPrice'] ?? 0);
    $disc = ($orig > $price && $price > 0) ? (int) round(($orig - $price) / $orig * 100) : 0;
    $reviews = (int) ($p['ratingCount'] ?? 0);
    ?>
<a href="<?= nh($p['productUrl']) ?>" target="_blank" rel="sponsored nofollow noopener" class="group block">
  <div class="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-zinc-100">
    <img src="<?= nh($p['imageUrl']) ?>" alt="<?= nh($p['name']) ?>" loading="lazy" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105">
    <span class="absolute left-0 top-0 rounded-br-lg <?= $badgeBg ?> px-2 py-1 text-[10.5px] font-bold text-white"><?= $badge ?></span>
  </div>
  <div class="mt-2">
    <div class="line-clamp-2 min-h-[2.5em] text-[13px] leading-snug text-zinc-800 group-hover:text-[#134a9c]"><?= nh($p['name']) ?></div>
    <?php if ($orig > $price): ?><div class="mt-1 text-[11px] text-zinc-400 line-through"><?= number_format($orig) ?>원</div><?php endif; ?>
    <div class="mt-0.5 flex items-baseline gap-1">
      <?php if ($disc > 0): ?><span class="text-[17px] font-extrabold text-[#e0392b]"><?= $disc ?>%</span><?php endif; ?>
      <span class="text-[17px] font-extrabold text-zinc-900"><?= number_format($price) ?>원</span>
    </div>
    <?php if ($reviews > 0): ?>
      <div class="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-400"><span class="material-symbols-outlined text-[13px] text-amber-400" style="font-variation-settings:'FILL' 1;">star</span>리뷰 <?= number_format($reviews) ?></div>
    <?php endif; ?>
  </div>
</a>
    <?php
}

/**
 * 섹션 구독 배너 — 카테고리/기사 상단. 시안(경제 돋보기) 스타일:
 * 절제된 다크 밴드에 "{섹션} 돋보기" + 구독 버튼 + 관련 토픽 해시태그.
 */
function render_section_subscribe(string $section): void
{
    static $topics = [
        '경제·금융' => ['물가·금리', '부동산', '증시·환율'],
        'IT·게임'   => ['AI·반도체', '스마트폰', '게임'],
        '생활·건강' => ['건강', '재테크', '생활정보'],
        '여행·문화' => ['여행', '맛집', '문화'],
        '종합'      => ['이슈', '사회', '트렌드'],
    ];
    $tags = $topics[$section] ?? [];
    ?>
<section class="border-b border-zinc-200 bg-[#0f2942] text-white">
  <div class="mx-auto max-w-[1399px] px-4 py-7 sm:px-6 sm:py-[45px]">
    <div class="flex flex-wrap items-center gap-2.5">
      <h2 class="text-[19px] font-extrabold tracking-tight sm:text-[22px]"><?= nh($section) ?> 돋보기</h2>
      <a href="/subscribe.php" class="inline-flex flex-none items-center gap-1 rounded-md border border-[#45c4de] bg-[#45c4de] px-2.5 py-1 text-[12.5px] font-bold text-white transition-colors hover:border-[#3bb4ce] hover:bg-[#3bb4ce]"><span class="material-symbols-outlined text-[15px]">add</span>구독</a>
    </div>
    <?php if ($tags): ?>
      <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] font-medium text-white/50">
        <?php foreach ($tags as $t): ?><span>#<?= nh($t) ?></span><?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>
    <?php
}

/**
 * 유틸 페이지(지원금·계산기·문서도구·노인일자리) 공용 히어로 헤더.
 * 절제된 다크 밴드 — 좌: 눈썹+제목+구독 버튼+부제+메타태그 / 우: 최근 기사 이미지(임시).
 * 시안(이가혁 라이브)의 구조를 뉴스 톤으로. 모바일에선 이미지 아래로 접힌다.
 */
function render_util_hero(string $eyebrow, string $title, string $subtitle, array $metaTags = [], string $image = ''): void
{
    // 우측 이미지 = 페이지 전용 히어로 이미지($image). 없으면 최근 기사 이미지로 폴백.
    $img = $image;
    if ($img === '') {
        try {
            foreach (news_articles() as $a) {
                if (!empty($a['image'])) { $img = (string) $a['image']; break; }
            }
        } catch (Throwable) {
        }
    }
    ?>
<section class="border-b border-zinc-200 bg-[#0f2942] text-white">
  <div class="mx-auto flex max-w-[1399px] flex-col-reverse items-stretch md:flex-row md:items-center">
    <div class="flex-1 px-4 py-4 sm:px-6 sm:py-5 md:py-6">
      <div class="text-[12px] font-bold uppercase tracking-wider text-[#45c4de]"><?= nh($eyebrow) ?></div>
      <div class="mt-1.5 flex flex-wrap items-center gap-2.5">
        <h1 class="text-[26px] font-extrabold tracking-tight sm:text-[32px]"><?= nh($title) ?></h1>
        <a href="/subscribe.php" class="inline-flex flex-none items-center gap-1 rounded-md border border-[#45c4de] bg-[#45c4de] px-2.5 py-1 text-[13px] font-bold text-white transition-colors hover:border-[#3bb4ce] hover:bg-[#3bb4ce]"><span class="material-symbols-outlined text-[16px]">add</span>구독</a>
      </div>
      <?php if ($subtitle !== ''): ?><p class="mt-2 text-[14px] leading-relaxed text-white/70"><?= nh($subtitle) ?></p><?php endif; ?>
      <?php if ($metaTags): ?>
        <div class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-medium text-white/60">
          <?php foreach ($metaTags as $t): ?><span>#<?= nh($t) ?></span><?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>
    <?php if ($img !== ''): ?>
      <div class="relative h-28 w-full overflow-hidden md:h-[240px] md:w-5/12">
        <img src="<?= nh($img) ?>" alt="" class="h-full w-full object-cover opacity-90" loading="lazy">
        <div class="absolute inset-0 bg-gradient-to-r from-[#0f2942] via-transparent to-transparent"></div>
      </div>
    <?php endif; ?>
  </div>
</section>
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
    <div class="grid grid-cols-2 gap-8 border-b border-zinc-200 pb-8 sm:grid-cols-[1.4fr_repeat(5,1fr)]">
      <div class="col-span-2 sm:col-span-1">
        <div class="text-[19px] font-extrabold">HOM2BOX <span class="text-[<?= NEWS_PRIMARY ?>]">뉴스</span></div>
        <div class="mt-2 max-w-xs text-[12.5px] leading-relaxed text-zinc-500">매일 아침·저녁, 편집국이 선별한 이슈·경제·IT·생활 뉴스와 가이드를 발행합니다.</div>
      </div>
      <div>
        <div class="mb-2.5 text-[13px] font-extrabold">뉴스</div>
        <a href="/" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">홈</a>
        <a href="/press.php" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">언론사 헤드라인</a>
        <a href="/opinion.php" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">오피니언</a>
        <a href="/search.php" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">뉴스 검색</a>
        <a href="/subscribe.php" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">뉴스레터 구독</a>
      </div>
      <div>
        <div class="mb-2.5 text-[13px] font-extrabold">카테고리</div>
        <?php foreach (NEWS_SECTIONS as $s): ?>
          <a href="/category.php?cat=<?= urlencode($s) ?>" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]"><?= nh($s) ?></a>
        <?php endforeach; ?>
      </div>
      <div>
        <div class="mb-2.5 text-[13px] font-extrabold">생활·유틸</div>
        <a href="/welfare.php" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">정부 지원금</a>
        <a href="/jobs.php" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">노인일자리</a>
        <a href="/tools.php" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">계산기</a>
        <a href="/docs.php" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">문서도구</a>
        <a href="/shop.php" class="block py-1 text-[13px] text-zinc-500 hover:text-[<?= NEWS_PRIMARY ?>]">특가 쇼핑</a>
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
      </div>
    </div>
    <div class="mt-6 text-xs leading-relaxed text-zinc-400">일부 기사에는 제휴 링크가 포함되어 있으며, 이를 통해 구매 시 운영자가 일정 수수료를 제공받을 수 있습니다. 제휴 매체 헤드라인은 RSS로 제공되는 콘텐츠입니다.<br>© <?= date('Y') ?> HOM2BOX. All rights reserved.</div>
  </div>
</div>
    <?php
}
