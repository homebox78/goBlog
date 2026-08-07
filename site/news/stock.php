<?php
// 주식 커뮤니티 — 종목 페이지 (무료·지연 종가). /stock.php?code=005930
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

// 국내=숫자 6자리, 해외=알파벳 심볼(NVDA 등) 모두 허용
$code = preg_replace('/[^0-9A-Za-z.]/', '', (string) ($_GET['code'] ?? ''));
$db = goblog_db();
$ovMv = null; // 해외 종목이면 랭킹 풀에서 합성한 시세

// 로그인 사용자 (커뮤니티 세션 쿠키 — 테이블 없으면 null)
$me = null;
try {
    $tok = (string) ($_COOKIE['h2b_uid'] ?? '');
    if ($tok !== '') {
        $st = $db->prepare('SELECT u.id, u.name FROM community_sessions s JOIN community_users u ON u.id=s.userId WHERE s.token=? AND s.expiresAt>NOW() LIMIT 1');
        $st->execute([$tok]);
        $me = $st->fetch() ?: null;
    }
} catch (Throwable) { $me = null; }

$stock = null;
$prices = [];
$articles = [];
$posts = [];
$sentiment = ['BUY' => 0, 'HOLD' => 0, 'SELL' => 0];
if ($code !== '') {
    try {
        $st = $db->prepare('SELECT ticker, name, market, sector FROM stocks WHERE ticker = ?');
        $st->execute([$code]);
        $stock = $st->fetch() ?: null;
    } catch (Throwable) { $stock = null; }

    // 미등록 국내 종목(랭킹으로 동적 발굴)도 실시간 시세로 최소 표시 — '종목 없음' 방지
    if (!$stock) {
        try {
            $mv = stock_movers();
            if (isset($mv[$code])) $stock = ['name' => $mv[$code]['name'], 'market' => $mv[$code]['market'], 'sector' => null];
        } catch (Throwable) {}
    }
    // 해외 종목(알파벳 심볼) — 미국 랭킹 풀에서 합성(USD 시세)
    if (!$stock) {
        try {
            $mvo = stock_movers_overseas();
            if (isset($mvo[$code])) { $ovMv = $mvo[$code]; $stock = ['name' => $ovMv['name'], 'market' => $ovMv['market'], 'sector' => null]; }
        } catch (Throwable) {}
    }

    if ($stock) {
        try {
            $st = $db->prepare('SELECT date, open, high, low, close, volume FROM stock_prices WHERE ticker = ? ORDER BY date DESC LIMIT 60');
            $st->execute([$code]);
            $prices = array_reverse($st->fetchAll()); // 오래된→최신
        } catch (Throwable) { $prices = []; }

        try {
            $st = $db->prepare(
                "SELECT a.id, a.title, a.excerpt, a.publishAt, k.category kwCategory
                 FROM article_stocks ast
                 JOIN articles a ON a.id = ast.articleId
                 LEFT JOIN keywords k ON k.id = a.keywordId
                 WHERE ast.ticker = ? AND a.contentHtml IS NOT NULL
                   AND (a.publishAt IS NOT NULL AND a.status IN ('SCHEDULED','PUBLISHED'))
                 ORDER BY a.publishAt DESC LIMIT 20"
            );
            $st->execute([$code]);
            $articles = $st->fetchAll();
        } catch (Throwable) { $articles = []; }

        // 커뮤니티 토론 글 + 투자의견 집계 (테이블 없으면 빈 값)
        try {
            $st = $db->prepare(
                'SELECT p.id, p.userId, p.body, p.stance, p.likes, p.comments, p.createdAt, (p.pw IS NOT NULL) hasPw, u.name authorName
                 FROM community_posts p JOIN community_users u ON u.id=p.userId
                 WHERE p.ticker=? AND p.hidden=0 ORDER BY p.createdAt DESC LIMIT 50'
            );
            $st->execute([$code]);
            $posts = $st->fetchAll();
            $sr = $db->prepare('SELECT stance, COUNT(*) c FROM community_posts WHERE ticker=? AND hidden=0 AND stance IS NOT NULL GROUP BY stance');
            $sr->execute([$code]);
            foreach ($sr->fetchAll() as $s) { if (isset($sentiment[$s['stance']])) $sentiment[$s['stance']] = (int) $s['c']; }
        } catch (Throwable) { $posts = []; }
    }
}

$ticker = [];
try { $ticker = array_slice(news_articles(), 0, 6); } catch (Throwable) {}

// 최신·전일 종가 → 전일대비
$last = $prices ? end($prices) : null;
$prev = (count($prices) >= 2) ? $prices[count($prices) - 2] : null;
$close = $last ? (int) $last['close'] : 0;
$prevClose = $prev ? (int) $prev['close'] : $close;
$diff = $close - $prevClose;
$rate = $prevClose > 0 ? ($diff / $prevClose) * 100 : 0;
// 실시간 시세(네이버 realtime — 마켓 스트립과 동일). 있으면 현재가로 표시.
$isLive = false;
if ($code !== '') {
    try {
        $rt = stock_realtime([$code]);
        if (isset($rt[$code])) {
            $isLive = true;
            $close = (int) round($rt[$code]['close']);
            $rate = $rt[$code]['ratio'] ?? ($prevClose > 0 ? (($close - $prevClose) / $prevClose) * 100 : 0);
            $diff = $rt[$code]['diff'] !== null ? (int) round($rt[$code]['diff']) : ($close - $prevClose);
        }
    } catch (Throwable) {}
}
// 해외 종목이면 USD 시세로 덮어씀(국내 realtime은 숫자 코드 전용이라 위에서 못 잡음)
$isUsd = $ovMv !== null;
if ($isUsd && $ovMv) {
    $isLive = true;
    $close = $ovMv['close']; // USD float
    $rate = (float) $ovMv['ratio'];
    $diff = $ovMv['diff'];
}
// 한국식: 상승=빨강, 하락=파랑
$upColor = '#d60000';
$downColor = '#1263e0';
$sign = $diff > 0 ? $upColor : ($diff < 0 ? $downColor : '#666');
$arrow = $diff > 0 ? '▲' : ($diff < 0 ? '▼' : '−');

$title = $stock ? ($stock['name'] . ' (' . $code . ') 주가·분석 — HOM2BOX') : '종목을 찾을 수 없습니다 — HOM2BOX';
render_head($title, $stock ? ($stock['name'] . ' 실시간 주가와 종목 AI 분석·토론.') : '');
render_ticker($ticker);
render_topbar();
render_masthead();
render_nav('종목', [], true);

// 일봉 라인 차트 (SVG, 의존성 0)
$chart = '';
if (count($prices) >= 2) {
    $closes = array_map(fn($p) => (int) $p['close'], $prices);
    $min = min($closes); $max = max($closes); $span = max(1, $max - $min);
    $w = 680; $h = 200; $pad = 6;
    $n = count($closes);
    $pts = [];
    foreach ($closes as $i => $c) {
        $x = $pad + ($i / max(1, $n - 1)) * ($w - 2 * $pad);
        $y = $pad + (1 - ($c - $min) / $span) * ($h - 2 * $pad);
        $pts[] = round($x, 1) . ',' . round($y, 1);
    }
    $line = implode(' ', $pts);
    $lineColor = ($closes[$n - 1] >= $closes[0]) ? $upColor : $downColor;
    $areaFill = ($closes[$n - 1] >= $closes[0]) ? 'rgba(214,0,0,0.06)' : 'rgba(18,99,224,0.06)';
    $areaPts = $pad . ',' . ($h - $pad) . ' ' . $line . ' ' . ($w - $pad) . ',' . ($h - $pad);
    $chart =
        '<svg viewBox="0 0 ' . $w . ' ' . $h . '" class="w-full" style="height:200px" preserveAspectRatio="none">'
        . '<polygon points="' . $areaPts . '" fill="' . $areaFill . '"/>'
        . '<polyline points="' . $line . '" fill="none" stroke="' . $lineColor . '" stroke-width="1.6"/>'
        . '</svg>';
}
?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-[1399px] px-4 sm:px-6 py-6">
  <?php if (!$stock): ?>
    <div class="py-24 text-center text-zinc-400">종목을 찾을 수 없습니다. (예: <a href="/stock.php?code=005930" class="text-[#134a9c] underline">삼성전자</a>)</div>
  <?php else: ?>
    <!-- 종목 헤더 -->
    <div class="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-[26px] font-extrabold tracking-tight"><?= nh($stock['name']) ?></h1>
          <span class="rounded bg-zinc-100 px-2 py-0.5 text-[12px] font-bold text-zinc-500"><?= nh($stock['market']) ?> · <?= nh($code) ?></span>
        </div>
        <div class="mt-2 flex items-baseline gap-3">
          <span class="text-[30px] font-extrabold" style="color:<?= $sign ?>"><?= $isUsd ? '$' . number_format((float) $close, 2) : number_format($close) ?></span>
          <span class="text-[16px] font-bold" style="color:<?= $sign ?>"><?= $arrow ?> <?= $isUsd ? '$' . number_format(abs((float) $diff), 2) : number_format(abs($diff)) ?> (<?= number_format($rate, 2) ?>%)</span>
        </div>
        <div class="mt-1 text-[12px] text-zinc-400"><?= $isLive ? '네이버 실시간 (장중 현재가·장마감 후 종가)' : ($last ? nh($last['date']) . ' 종가 기준 (지연 시세)' : '시세 준비 중') ?></div>
      </div>
      <a href="/" class="text-[13px] font-bold text-zinc-400 hover:text-[#134a9c]">← 홈</a>
    </div>

    <!-- 일봉 차트 -->
    <?php if ($chart): ?>
      <div class="mt-4 rounded-lg border border-zinc-200 bg-white p-3">
        <div class="mb-1 text-[12px] font-bold text-zinc-500">최근 <?= count($prices) ?>거래일 (종가)</div>
        <?= $chart ?>
      </div>
    <?php elseif ($isUsd && $ovMv): ?>
      <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-zinc-200 bg-white p-4 text-[13px]">
        <div><span class="text-zinc-400">거래량</span> <b class="text-zinc-800"><?= number_format((int) $ovMv['volume']) ?></b></div>
        <div><span class="text-zinc-400">거래대금</span> <b class="text-zinc-800"><?php $w = (float) $ovMv['amount']; echo $w >= 1e12 ? number_format($w / 1e12, 1) . '조' : ($w >= 1e8 ? number_format($w / 1e8, 0) . '억' : '—'); ?></b></div>
        <div><span class="text-zinc-400">시장</span> <b class="text-zinc-800"><?= nh($ovMv['market']) ?></b></div>
        <?php if (!empty($ovMv['reuters'])): ?><a href="https://m.stock.naver.com/worldstock/stock/<?= nh($ovMv['reuters']) ?>/total" target="_blank" rel="noopener" class="ml-auto font-bold text-[#134a9c] hover:underline">네이버에서 차트·상세 보기 →</a><?php endif; ?>
      </div>
      <p class="mt-2 text-[12px] text-zinc-400">해외 종목의 상세 차트·재무는 네이버 증권에서 확인하실 수 있습니다. (가격 USD·거래대금 원화 환산)</p>
    <?php else: ?>
      <div class="mt-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-[13px] text-zinc-400">시세 데이터를 불러오는 중입니다. 잠시 후 다시 확인해 주세요.</div>
    <?php endif; ?>

    <!-- AI 분석글 -->
    <div class="mt-8">
      <div class="mb-3 flex items-center gap-2.5 border-b-2 border-zinc-900 pb-2.5">
        <span class="h-[17px] w-[3px] rounded-full bg-[#e0392b]"></span>
        <h2 class="text-[18px] font-bold tracking-tight"><?= nh($stock['name']) ?> AI 분석</h2>
      </div>
      <?php if (!$articles): ?>
        <div class="py-10 text-center text-[13px] text-zinc-400">이 종목의 분석글이 아직 없습니다. 곧 채워집니다.</div>
      <?php else: ?>
        <div class="divide-y divide-zinc-100">
          <?php foreach ($articles as $a): ?>
            <a href="/article.php?id=<?= (int) $a['id'] ?>" class="group flex flex-col gap-1 py-3.5">
              <div class="text-[16px] font-bold leading-snug group-hover:text-[#134a9c]"><?= nh($a['title']) ?></div>
              <?php if (!empty($a['excerpt'])): ?><div class="text-[13px] leading-relaxed text-zinc-500 line-clamp-2"><?= nh($a['excerpt']) ?></div><?php endif; ?>
              <div class="text-[11.5px] text-zinc-400"><?= nh(news_date($a['publishAt'])) ?></div>
            </a>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>

    <!-- 종목 토론방 -->
    <?php
      $sTot = max(1, $sentiment['BUY'] + $sentiment['HOLD'] + $sentiment['SELL']);
      $pBuy = round($sentiment['BUY'] / $sTot * 100);
      $pHold = round($sentiment['HOLD'] / $sTot * 100);
      $pSell = 100 - $pBuy - $pHold;
      $loginUrl = '/goBlog/api/community/auth/google?next=' . rawurlencode('/stock.php?code=' . $code);
    ?>
    <div class="mt-8" id="board">
      <div class="mb-3 flex items-center gap-2.5 border-b-2 border-zinc-900 pb-2.5">
        <span class="h-[17px] w-[3px] rounded-full bg-[#e0392b]"></span>
        <h2 class="text-[18px] font-bold tracking-tight">💬 종목 토론</h2>
        <span class="text-[13px] text-zinc-400"><?= count($posts) ?></span>
      </div>

      <!-- 투자의견 게이지 -->
      <div class="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <div class="mb-2 flex items-center justify-between text-[12px] font-bold">
          <span style="color:#d60000">매수 <?= $sentiment['BUY'] ?></span>
          <span class="text-zinc-500">보유 <?= $sentiment['HOLD'] ?></span>
          <span style="color:#1263e0">매도 <?= $sentiment['SELL'] ?></span>
        </div>
        <div class="flex h-2.5 overflow-hidden rounded-full bg-zinc-100">
          <div style="width:<?= $pBuy ?>%;background:#d60000"></div>
          <div style="width:<?= $pHold ?>%;background:#c9ccd4"></div>
          <div style="width:<?= $pSell ?>%;background:#1263e0"></div>
        </div>
      </div>

      <!-- 글쓰기 / 로그인 -->
      <?php if ($me): ?>
        <div class="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
          <textarea id="pb" rows="2" maxlength="2000" placeholder="이 종목에 대한 생각을 남겨보세요 (특정 매수·매도 권유·리딩은 제한됩니다)" class="w-full resize-none rounded-md border border-zinc-200 px-3 py-2 text-[14px] outline-none focus:border-[#134a9c]"></textarea>
          <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 text-[12px]">
              <span class="text-zinc-400">투자의견</span>
              <button type="button" data-st="" class="stbtn rounded-full border border-zinc-200 px-2.5 py-1 font-bold text-zinc-500">없음</button>
              <button type="button" data-st="BUY" class="stbtn rounded-full border border-zinc-200 px-2.5 py-1 font-bold" style="color:#d60000">매수</button>
              <button type="button" data-st="HOLD" class="stbtn rounded-full border border-zinc-200 px-2.5 py-1 font-bold text-zinc-600">보유</button>
              <button type="button" data-st="SELL" class="stbtn rounded-full border border-zinc-200 px-2.5 py-1 font-bold" style="color:#1263e0">매도</button>
            </div>
            <div class="flex items-center gap-1.5">
              <input id="pname" value="<?= nh($me['name']) ?>" maxlength="20" placeholder="표시 이름" title="표시 이름(닉네임) — 직접 설정, 구글 이름 고정 아님" class="w-24 rounded-md border border-zinc-200 px-2 py-1 text-[12px] outline-none focus:border-[#134a9c]">
              <input id="ppw" inputmode="numeric" pattern="\d*" maxlength="6" placeholder="비번6자리" title="수정·삭제에 쓸 6자리 숫자 비밀번호(선택)" class="w-[76px] rounded-md border border-zinc-200 px-2 py-1 text-[12px] outline-none focus:border-[#134a9c]">
              <button type="button" id="psend" class="rounded-md bg-[#134a9c] px-4 py-1.5 text-[13px] font-bold text-white hover:bg-[#0f3d82]">등록</button>
            </div>
          </div>
        </div>
      <?php else: ?>
        <a href="<?= nh($loginUrl) ?>" class="mb-4 flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-[14px] font-bold text-zinc-700 hover:border-[#134a9c] hover:text-[#134a9c]">
          <span class="material-symbols-outlined text-[18px]">login</span> 구글로 로그인하고 토론 참여
        </a>
      <?php endif; ?>

      <!-- 글 목록 -->
      <?php if (!$posts): ?>
        <div class="py-8 text-center text-[13px] text-zinc-400">첫 글을 남겨보세요.</div>
      <?php else: ?>
        <div class="space-y-3" id="plist">
          <?php foreach ($posts as $p):
            $stColor = $p['stance'] === 'BUY' ? '#d60000' : ($p['stance'] === 'SELL' ? '#1263e0' : '#888');
            $stLabel = $p['stance'] === 'BUY' ? '매수' : ($p['stance'] === 'SELL' ? '매도' : ($p['stance'] === 'HOLD' ? '보유' : ''));
          ?>
            <div class="rounded-lg border border-zinc-200 bg-white p-4" data-pid="<?= (int) $p['id'] ?>" data-stance="<?= nh($p['stance'] ?? '') ?>">
              <div class="mb-1.5 flex items-center gap-2 text-[12px] text-zinc-400">
                <span class="font-bold text-zinc-600"><?= nh($p['authorName']) ?></span>
                <?php if ($stLabel): ?><span class="rounded px-1.5 py-0.5 text-[11px] font-bold" style="color:<?= $stColor ?>;background:<?= $stColor ?>1a"><?= $stLabel ?></span><?php endif; ?>
                <span><?= nh(news_date($p['createdAt'])) ?></span>
              </div>
              <div class="whitespace-pre-line text-[14px] leading-relaxed text-zinc-800"><?= nh($p['body']) ?></div>
              <div class="mt-2 flex items-center gap-4 text-[12.5px] text-zinc-400">
                <button type="button" class="likebtn hover:text-[#d60000]" data-pid="<?= (int) $p['id'] ?>">👍 <span class="lk"><?= (int) $p['likes'] ?></span></button>
                <button type="button" class="cmtbtn hover:text-[#134a9c]" data-pid="<?= (int) $p['id'] ?>">💬 <span><?= (int) $p['comments'] ?></span></button>
                <div class="ml-auto flex items-center gap-3">
                  <?php if ($me && (int) $p['userId'] === (int) $me['id']): ?>
                    <button type="button" class="editbtn hover:text-[#134a9c]" data-pid="<?= (int) $p['id'] ?>" data-haspw="<?= !empty($p['hasPw']) ? 1 : 0 ?>" title="수정">✏️ 수정</button>
                    <button type="button" class="delbtn hover:text-[#d60000]" data-pid="<?= (int) $p['id'] ?>" data-haspw="<?= !empty($p['hasPw']) ? 1 : 0 ?>" title="삭제">🗑️ 삭제</button>
                  <?php endif; ?>
                  <button type="button" class="reportbtn hover:text-zinc-600" data-pid="<?= (int) $p['id'] ?>" title="신고">🚩</button>
                </div>
              </div>
              <div class="cmts mt-3 hidden border-t border-zinc-100 pt-3"></div>
            </div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>
    <script>
    (function(){
      var API='/goBlog/api/community', LOGIN=<?= json_encode($loginUrl) ?>, ME=<?= $me ? 'true' : 'false' ?>, CODE=<?= json_encode($code) ?>;
      function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
      function need(){ if(!ME){ location.href=LOGIN; return true; } return false; }
      async function post(url,body){ var r=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})}); var d=await r.json().catch(function(){return{};}); if(!r.ok) throw new Error(d.error||'요청 실패'); return d; }
      // 투자의견 선택
      var stance='';
      document.querySelectorAll('.stbtn').forEach(function(b){ b.addEventListener('click',function(){ stance=b.dataset.st; document.querySelectorAll('.stbtn').forEach(function(x){x.classList.remove('border-[#134a9c]','bg-[#134a9c]/5');}); b.classList.add('border-[#134a9c]','bg-[#134a9c]/5'); }); });
      var send=document.getElementById('psend');
      if(send) send.addEventListener('click',async function(){
        if(need())return;
        var t=document.getElementById('pb').value.trim(); if(t.length<2){alert('내용을 입력하세요.');return;}
        var nm=(document.getElementById('pname')||{}).value; nm=nm?nm.trim():'';
        var pw=(document.getElementById('ppw')||{}).value; pw=pw?pw.trim():'';
        if(pw && !/^\d{6}$/.test(pw)){alert('비밀번호는 6자리 숫자로 입력하세요.');return;}
        send.disabled=true;
        try{
          if(nm.length>=2){ try{ await post(API+'/me/name',{name:nm}); }catch(e){ alert('표시 이름 저장 실패: '+e.message); send.disabled=false; return; } }
          await post(API+'/stocks/'+CODE+'/posts',{body:t,stance:stance,pw:pw||undefined});
          location.reload();
        }catch(e){ alert(e.message); send.disabled=false; }
      });
      // 수정 (본인 글) — 새 내용 + (설정돼 있으면)6자리 비번
      document.querySelectorAll('.editbtn').forEach(function(b){ b.addEventListener('click',async function(){ if(need())return;
        var card=b.closest('[data-pid]'); var cur=(card.querySelector('.whitespace-pre-line')||{}).textContent||'';
        var nb=prompt('코멘트 수정:', cur); if(nb===null)return; nb=nb.trim(); if(nb.length<2){alert('내용을 입력하세요.');return;}
        var pw=''; if(b.dataset.haspw==='1'){ pw=prompt('작성 시 설정한 6자리 비밀번호:'); if(pw===null)return; pw=(pw||'').trim(); }
        try{ await post(API+'/posts/'+b.dataset.pid+'/edit',{body:nb,stance:card.dataset.stance||'',pw:pw}); location.reload(); }catch(e){ alert(e.message); } }); });
      // 삭제 (본인 글)
      document.querySelectorAll('.delbtn').forEach(function(b){ b.addEventListener('click',async function(){ if(need())return;
        var pw=''; if(b.dataset.haspw==='1'){ pw=prompt('삭제하려면 작성 시 설정한 6자리 비밀번호:'); if(pw===null)return; pw=(pw||'').trim(); }
        else if(!confirm('이 코멘트를 삭제할까요?'))return;
        try{ await post(API+'/posts/'+b.dataset.pid+'/delete',{pw:pw}); b.closest('[data-pid]').style.display='none'; }catch(e){ alert(e.message); } }); });
      // 좋아요
      document.querySelectorAll('.likebtn').forEach(function(b){ b.addEventListener('click',async function(){ if(need())return; try{ var d=await post(API+'/posts/'+b.dataset.pid+'/like'); var lk=b.querySelector('.lk'); lk.textContent=(parseInt(lk.textContent||'0')+(d.liked?1:-1)); }catch(e){ alert(e.message); } }); });
      // 신고
      document.querySelectorAll('.reportbtn').forEach(function(b){ b.addEventListener('click',async function(){ if(need())return; if(!confirm('이 글을 신고할까요? (리딩·불법 글은 즉시 숨김)'))return; try{ await post(API+'/posts/'+b.dataset.pid+'/report'); b.closest('[data-pid]').style.display='none'; }catch(e){ alert(e.message); } }); });
      // 댓글 열기/로드
      document.querySelectorAll('.cmtbtn').forEach(function(b){ b.addEventListener('click',async function(){ var box=b.closest('[data-pid]').querySelector('.cmts'); if(!box.classList.contains('hidden')){ box.classList.add('hidden'); return; } box.classList.remove('hidden'); box.innerHTML='<div class="text-[12px] text-zinc-400">불러오는 중…</div>'; try{ var r=await fetch(API+'/posts/'+b.dataset.pid+'/comments',{credentials:'same-origin'}); var d=await r.json(); var h=(d.comments||[]).map(function(c){return '<div class="py-1.5 text-[13px]"><b class="text-zinc-600">'+esc(c.authorName)+'</b> <span class="text-zinc-800">'+esc(c.body)+'</span></div>';}).join('')||'<div class="text-[12px] text-zinc-400">첫 댓글을 남겨보세요.</div>'; h+='<div class="mt-2 flex gap-2"><input class="ci flex-1 rounded-md border border-zinc-200 px-2 py-1 text-[13px] outline-none" placeholder="댓글" maxlength="2000"><button class="cs rounded-md bg-zinc-800 px-3 text-[12px] font-bold text-white">등록</button></div>'; box.innerHTML=h; var cs=box.querySelector('.cs'), ci=box.querySelector('.ci'); cs.addEventListener('click',async function(){ if(need())return; var t=ci.value.trim(); if(t.length<2)return; try{ await post(API+'/posts/'+b.dataset.pid+'/comments',{body:t}); b.click(); b.click(); }catch(e){ alert(e.message); } }); }catch(e){ box.innerHTML='<div class="text-[12px] text-red-500">'+esc(e.message)+'</div>'; } }); });
    })();
    </script>

    <!-- 면책 고지 (필수) -->
    <div class="mt-6 rounded-md border border-zinc-200 bg-white p-3 text-[11.5px] leading-relaxed text-zinc-400">
      ⚠️ 본 페이지의 시세는 <?= $isLive ? '네이버 <b>실시간</b>(장중 현재가·장마감 후 종가)' : '<b>지연 종가</b>' ?>이며, 분석·정보는 참고용입니다. 특정 종목의 매수·매도를 권유하지 않으며, <b>투자 판단과 책임은 이용자 본인</b>에게 있습니다. HOM2BOX는 투자 결과에 대해 책임지지 않습니다.
    </div>
  <?php endif; ?>
  </div>
  <?php render_footer(); ?>
</div>
</body></html>
