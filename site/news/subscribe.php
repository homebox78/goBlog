<?php
// 뉴스레터 구독 신청 — 시안: Hom2box디자인개편/HOM2BOX 구독신청.dc.html
// 이메일 + 받아볼 분야(칩 다중선택) + 발송 시간(morning|evening|both) + 개인정보 동의.
// 제출은 AJAX(fetch) → 페이지 내 완료 상태 전환. 비-JS 폼 POST도 동일 로직으로 처리.
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

$allTopics = array_merge(NEWS_SECTIONS, ['오피니언']);
$schedLabels = [
    'morning' => '아침 (매일 07:00)',
    'evening' => '저녁 (매일 18:00)',
    'both'    => '아침+저녁 (하루 2회)',
];

$done = false;
$error = '';
$postEmail = '';
$doneTopicsStr = '';
$doneSchedStr = '';
$isAjax = isset($_POST['ajax']) || (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'fetch');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $postEmail = trim((string) ($_POST['email'] ?? ''));
    // topics: "경제·금융,IT·게임" 콤마 구분 — 허용 목록과 교집합만 저장
    $topicsIn = array_filter(array_map('trim', explode(',', (string) ($_POST['topics'] ?? ''))));
    $topics = array_values(array_intersect($allTopics, $topicsIn));
    $sendTime = (string) ($_POST['sendTime'] ?? 'both');
    if (!isset($schedLabels[$sendTime])) $sendTime = 'both';
    $agree = (string) ($_POST['agree'] ?? '') === '1';

    if (!filter_var($postEmail, FILTER_VALIDATE_EMAIL)) {
        $error = '올바른 이메일 주소를 입력해 주세요.';
    } elseif (!$topics) {
        $error = '받아볼 분야를 최소 한 개 선택해 주세요.';
    } elseif (!$agree) {
        $error = '개인정보 수집·이용에 동의해 주세요.';
    } else {
        try {
            $src = mb_substr(trim((string) ($_POST['source'] ?? '')), 0, 40) ?: null;
            $topicsStr = mb_substr(implode(',', $topics), 0, 200);
            $st = goblog_db()->prepare(
                "INSERT INTO newsletter_subscribers (email, source, topics, sendTime)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE status='ACTIVE', topics=VALUES(topics), sendTime=VALUES(sendTime)",
            );
            $st->execute([mb_substr($postEmail, 0, 190), $src, $topicsStr, $sendTime]);
            $done = true;
            $doneTopicsStr = implode(', ', $topics);
            $doneSchedStr = $schedLabels[$sendTime];
        } catch (Throwable $e) {
            $error = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        }
    }
    if ($isAjax) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok'  => $done,
            'msg' => $done ? '구독 신청이 완료되었습니다. 감사합니다!' : $error,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// 사이드바 데이터 — 구독자 수(실값) · 티커
$subCount = 0;
try {
    $subCount = (int) goblog_db()->query("SELECT COUNT(*) FROM newsletter_subscribers WHERE status='ACTIVE'")->fetchColumn();
} catch (Throwable) {
}
$ticker = [];
try {
    $ticker = array_slice(news_articles(), 0, 6);
} catch (Throwable) {
}

$defaultTopics = ['경제·금융', 'IT·게임'];
$schedCards = [
    ['key' => 'morning', 'label' => '아침',       'sub' => '매일 07:00', 'icon' => 'wb_twilight'],
    ['key' => 'evening', 'label' => '저녁',       'sub' => '매일 18:00', 'icon' => 'bedtime'],
    ['key' => 'both',    'label' => '아침+저녁', 'sub' => '하루 2회',   'icon' => 'schedule'],
];
$benefits = [
    ['icon' => 'article', 'text' => '분야별 핵심 기사 5건씩 — 편집국이 직접 선별'],
    ['icon' => 'bolt',    'text' => '속보성 이슈는 발송 시간과 별개로 즉시 알림'],
    ['icon' => 'block',   'text' => '광고성 스팸 없이 뉴스와 가이드만'],
    ['icon' => 'logout',  'text' => '메일 하단 링크로 한 번에 구독 해지'],
];
$faq = [
    ['q' => '구독은 정말 무료인가요?', 'a' => '네, 뉴스레터 구독과 발송은 전액 무료입니다. 별도 결제 정보가 필요하지 않습니다.'],
    ['q' => '발송 시간을 바꿀 수 있나요?', 'a' => '구독 후에도 메일 하단의 설정 링크에서 분야와 발송 시간을 언제든 변경할 수 있습니다.'],
    ['q' => '제휴 매체 기사도 포함되나요?', 'a' => '자체 기사와 함께 제휴 매체 RSS로 제공되는 주요 헤드라인을 분야별로 정리해 담습니다.'],
    ['q' => '구독 해지는 어떻게 하나요?', 'a' => "모든 메일 하단의 '구독 해지' 링크를 한 번 누르면 즉시 해지됩니다."],
];

render_head('무료 뉴스레터 구독 — HOM2BOX 뉴스', '매일 아침·저녁, 편집국이 고른 분야별 핵심 기사를 메일함에서 받아보세요. 광고성 스팸 없이 뉴스만.');
render_ticker($ticker);
render_topbar();
render_masthead();
render_nav('');
?>
<div class="min-h-screen bg-white">

  <!-- 히어로 -->
  <div class="border-b border-zinc-100 bg-zinc-50">
    <div class="mx-auto max-w-[1399px] px-4 sm:px-6 py-14 text-center">
      <span class="inline-flex items-center gap-1.5 rounded-full bg-[#134a9c]/10 px-3 py-1 text-xs font-bold text-[#134a9c]"><span class="material-symbols-outlined text-[15px]">mail</span>무료 뉴스레터</span>
      <h1 class="mx-auto mt-4 mb-3 max-w-2xl text-[28px] sm:text-[36px] font-extrabold leading-tight tracking-tight">아침·저녁, 편집국이 고른 뉴스를<br>메일함에서 받아보세요</h1>
      <p class="mx-auto max-w-xl text-[15px] leading-relaxed text-zinc-500">매일 오전 7시·오후 6시, 분야별 핵심 기사 5건씩을 정리해 보내드립니다. 광고성 스팸 없이 뉴스만. 구독 해지는 언제든 한 번의 클릭으로.</p>
    </div>
  </div>

  <div class="mx-auto max-w-[1399px] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 lg:gap-12 px-4 sm:px-6 py-12">
    <div>

      <!-- 구독 폼 카드 -->
      <div id="sub-form-card" class="rounded-xl border border-zinc-200 bg-white p-7 shadow-sm<?= $done ? ' hidden' : '' ?>">
        <h2 class="mb-1 text-[20px] font-extrabold">구독 정보 입력</h2>
        <p class="mb-6 text-[13px] text-zinc-400">이메일과 받아볼 분야, 발송 시간을 선택하세요.</p>

        <form id="sub-form" method="post" novalidate>
          <input type="hidden" name="topics" id="sub-topics-input" value="<?= nh(implode(',', $defaultTopics)) ?>">
          <input type="hidden" name="sendTime" id="sub-time-input" value="both">
          <input type="hidden" name="source" value="subscribe-page">

          <label for="sub-email" class="mb-1.5 block text-[13px] font-bold">이메일 주소</label>
          <div id="sub-email-wrap" class="mb-1 flex items-center gap-2 rounded-lg border-2 px-3.5 h-12 border-zinc-900 focus-within:border-[#134a9c]">
            <span class="material-symbols-outlined text-[20px] text-zinc-400">mail</span>
            <input type="email" id="sub-email" name="email" value="<?= nh($done ? '' : $postEmail) ?>" placeholder="you@example.com" class="flex-1 border-0 outline-none bg-transparent text-[15px] placeholder:text-zinc-300">
          </div>
          <div id="sub-email-err" class="mb-2 hidden text-[12px] font-semibold text-red-600">올바른 이메일 주소를 입력해 주세요.</div>

          <div class="mb-2 mt-6 text-[13px] font-bold">받아볼 분야 <span class="font-medium text-zinc-400">(복수 선택)</span></div>
          <div id="sub-chips" class="mb-1 flex flex-wrap gap-2">
            <?php foreach ($allTopics as $t): $on = in_array($t, $defaultTopics, true); ?>
              <button type="button" data-topic="<?= nh($t) ?>" class="sub-chip cursor-pointer inline-flex whitespace-nowrap items-center gap-1 rounded-full border px-3.5 py-2 text-[13px] font-semibold shadow-sm <?= $on ? 'bg-[#134a9c] text-white border-[#134a9c]' : 'bg-white text-zinc-600 border-zinc-200 hover:border-[#134a9c] hover:text-[#134a9c]' ?>">
                <span class="sub-chip-check material-symbols-outlined text-[16px]<?= $on ? '' : ' hidden' ?>">check</span><?= nh($t) ?>
              </button>
            <?php endforeach; ?>
          </div>
          <div id="sub-topic-err" class="mb-2 hidden text-[12px] font-semibold text-red-600">최소 한 개 분야를 선택해 주세요.</div>

          <div class="mb-2 mt-6 text-[13px] font-bold">발송 시간</div>
          <div id="sub-times" class="mb-2 grid grid-cols-3 gap-2">
            <?php foreach ($schedCards as $s): $on = $s['key'] === 'both'; ?>
              <button type="button" data-time="<?= nh($s['key']) ?>" class="sub-time cursor-pointer flex flex-col items-center gap-1 rounded-lg border-2 py-3.5 shadow-sm <?= $on ? 'border-[#134a9c] bg-[#134a9c]/5 text-[#134a9c]' : 'border-zinc-200 bg-white text-zinc-600 hover:border-[#134a9c]' ?>">
                <span class="material-symbols-outlined text-[20px]"><?= nh($s['icon']) ?></span>
                <span class="text-[13.5px] font-bold"><?= nh($s['label']) ?></span>
                <span class="sub-time-sub text-[11px] <?= $on ? 'text-[#134a9c]/70' : 'text-zinc-400' ?>"><?= nh($s['sub']) ?></span>
              </button>
            <?php endforeach; ?>
          </div>

          <label class="mt-6 flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" id="sub-agree" name="agree" value="1" class="peer sr-only">
            <span id="sub-agree-box" class="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded border-2 border-zinc-300 bg-white peer-checked:border-[#134a9c] peer-checked:bg-[#134a9c]"><span class="material-symbols-outlined text-[15px] text-white">check</span></span>
            <span class="text-[13px] leading-relaxed text-zinc-500">개인정보 수집·이용(이메일, 뉴스레터 발송 목적)에 동의합니다. 수신 동의는 선택이며, 언제든 해지할 수 있습니다.</span>
          </label>
          <div id="sub-agree-err" class="mt-2 hidden text-[12px] font-semibold text-red-600">개인정보 수집·이용에 동의해 주세요.</div>

          <?php if ($error && !$done): ?>
            <div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-600"><?= nh($error) ?></div>
          <?php endif; ?>
          <div id="sub-server-msg" class="mt-4 hidden rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-600"></div>

          <button type="submit" id="sub-submit" class="mt-7 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#134a9c] text-[15px] font-bold text-white shadow-sm hover:bg-[#0f3d82] disabled:opacity-60">
            <span class="material-symbols-outlined text-[20px]">send</span>무료 구독 신청하기
          </button>
          <div class="mt-3 flex items-center justify-center gap-1 text-[11.5px] text-zinc-400"><span class="material-symbols-outlined text-[13px]">lock</span>입력하신 정보는 뉴스레터 발송 외 용도로 사용되지 않습니다.</div>
        </form>
      </div>

      <!-- 완료 상태 -->
      <div id="sub-done-card" class="rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm<?= $done ? '' : ' hidden' ?>">
        <div class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#134a9c]/10"><span class="material-symbols-outlined text-[36px] text-[#134a9c]">mark_email_read</span></div>
        <h2 class="mb-2 text-[24px] font-extrabold">구독 신청이 완료되었습니다</h2>
        <p class="mx-auto mb-6 max-w-md text-[14px] leading-relaxed text-zinc-500"><b id="sub-done-email" class="text-zinc-800"><?= nh($done ? $postEmail : '') ?></b> 주소로 다음 발송분부터 선택하신 분야의 뉴스레터를 보내드립니다.</p>
        <div class="mx-auto mb-7 max-w-sm rounded-lg border border-zinc-100 bg-zinc-50 px-5 py-4 text-left text-[13px] leading-relaxed text-zinc-600">
          <div class="mb-1 font-bold text-zinc-800">구독 요약</div>
          <div>분야 · <span id="sub-done-topics"><?= nh($doneTopicsStr) ?></span></div>
          <div>발송 · <span id="sub-done-sched"><?= nh($doneSchedStr) ?></span></div>
        </div>
        <div class="flex justify-center gap-2">
          <button type="button" id="sub-again" class="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-5 text-[14px] font-bold text-zinc-600 shadow-sm hover:bg-zinc-50">다시 신청</button>
          <a href="/" class="inline-flex h-11 items-center gap-1.5 rounded-lg bg-[#134a9c] px-5 text-[14px] font-bold text-white shadow-sm hover:bg-[#0f3d82]">홈으로 <span class="material-symbols-outlined text-[18px]">arrow_forward</span></a>
        </div>
      </div>

      <!-- FAQ -->
      <div class="mt-8">
        <div class="mb-4 text-[15px] font-extrabold">자주 묻는 질문</div>
        <?php foreach ($faq as $f): ?>
          <div class="border-b border-zinc-100 py-4">
            <div class="mb-1.5 flex items-start gap-2 text-[14.5px] font-bold"><span class="text-[#134a9c]">Q</span><?= nh($f['q']) ?></div>
            <div class="pl-5 text-[13.5px] leading-relaxed text-zinc-500"><?= nh($f['a']) ?></div>
          </div>
        <?php endforeach; ?>
      </div>
    </div>

    <!-- 사이드바 -->
    <div class="flex flex-col gap-5 self-start lg:sticky lg:top-16">
      <div class="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div class="mb-3 text-[14px] font-extrabold">뉴스레터에 담기는 것</div>
        <?php foreach ($benefits as $b): ?>
          <div class="flex items-start gap-2.5 py-1.5">
            <span class="material-symbols-outlined mt-0.5 text-[18px] text-[#134a9c]"><?= nh($b['icon']) ?></span>
            <span class="text-[13.5px] leading-relaxed text-zinc-600"><?= nh($b['text']) ?></span>
          </div>
        <?php endforeach; ?>
      </div>
      <div class="rounded-xl border border-zinc-200 bg-zinc-50/60 p-5">
        <div class="mb-1 text-[26px] font-extrabold text-[#134a9c]"><?= number_format($subCount) ?><span class="text-[15px] text-zinc-500">명</span></div>
        <div class="text-[13px] text-zinc-500">이미 HOM2BOX 뉴스레터를 구독 중입니다.</div>
      </div>
      <?php render_ad('home-sidebar'); ?>
    </div>
  </div>

  <?php render_footer(); ?>
</div>

<script>
(function(){
  var form=document.getElementById('sub-form');
  if(!form) return;
  var CHIP_ON=['bg-[#134a9c]','text-white','border-[#134a9c]'];
  var CHIP_OFF=['bg-white','text-zinc-600','border-zinc-200','hover:border-[#134a9c]','hover:text-[#134a9c]'];
  var TIME_ON=['border-[#134a9c]','bg-[#134a9c]/5','text-[#134a9c]'];
  var TIME_OFF=['border-zinc-200','bg-white','text-zinc-600','hover:border-[#134a9c]'];
  var SCHED_LABEL={morning:'아침 (매일 07:00)',evening:'저녁 (매일 18:00)',both:'아침+저녁 (하루 2회)'};

  var topicsInput=document.getElementById('sub-topics-input');
  var timeInput=document.getElementById('sub-time-input');
  var emailInput=document.getElementById('sub-email');
  var emailWrap=document.getElementById('sub-email-wrap');
  var agreeInput=document.getElementById('sub-agree');
  var agreeBox=document.getElementById('sub-agree-box');
  var touched=false;

  var selected=new Set(topicsInput.value.split(',').filter(Boolean));

  // 분야 칩 토글
  document.getElementById('sub-chips').addEventListener('click',function(e){
    var b=e.target.closest('.sub-chip'); if(!b) return;
    var t=b.dataset.topic, on=!selected.has(t);
    if(on){selected.add(t);}else{selected.delete(t);}
    (on?CHIP_OFF:CHIP_ON).forEach(function(c){b.classList.remove(c);});
    (on?CHIP_ON:CHIP_OFF).forEach(function(c){b.classList.add(c);});
    b.querySelector('.sub-chip-check').classList.toggle('hidden',!on);
    topicsInput.value=Array.from(selected).join(',');
    if(touched) validate();
  });

  // 발송 시간 3카드 (라디오 토글)
  document.getElementById('sub-times').addEventListener('click',function(e){
    var b=e.target.closest('.sub-time'); if(!b) return;
    timeInput.value=b.dataset.time;
    document.querySelectorAll('.sub-time').forEach(function(x){
      var on=x===b;
      (on?TIME_OFF:TIME_ON).forEach(function(c){x.classList.remove(c);});
      (on?TIME_ON:TIME_OFF).forEach(function(c){x.classList.add(c);});
      var sub=x.querySelector('.sub-time-sub');
      sub.classList.toggle('text-[#134a9c]/70',on);
      sub.classList.toggle('text-zinc-400',!on);
    });
  });

  agreeInput.addEventListener('change',function(){ if(touched) validate(); });
  emailInput.addEventListener('input',function(){ if(touched) validate(); });

  function show(id,on){ document.getElementById(id).classList.toggle('hidden',!on); }
  function validate(){
    var emailOk=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim());
    var topicOk=selected.size>0;
    var agreeOk=agreeInput.checked;
    show('sub-email-err',!emailOk);
    emailWrap.classList.toggle('border-red-400',!emailOk);
    emailWrap.classList.toggle('border-zinc-900',emailOk);
    show('sub-topic-err',!topicOk);
    show('sub-agree-err',!agreeOk);
    agreeBox.classList.toggle('border-red-400',!agreeOk);
    agreeBox.classList.toggle('border-zinc-300',agreeOk);
    return emailOk&&topicOk&&agreeOk;
  }

  // AJAX 제출 → 완료 상태 전환
  form.addEventListener('submit',function(e){
    e.preventDefault();
    touched=true;
    if(!validate()) return;
    var btn=document.getElementById('sub-submit');
    var srv=document.getElementById('sub-server-msg');
    btn.disabled=true; srv.classList.add('hidden');
    var fd=new FormData(form); fd.append('ajax','1');
    fetch('/subscribe.php',{method:'POST',body:fd,headers:{'X-Requested-With':'fetch'}})
      .then(function(r){return r.json();})
      .then(function(d){
        btn.disabled=false;
        if(d.ok){
          document.getElementById('sub-done-email').textContent=emailInput.value.trim();
          document.getElementById('sub-done-topics').textContent=Array.from(selected).join(', ');
          document.getElementById('sub-done-sched').textContent=SCHED_LABEL[timeInput.value]||timeInput.value;
          document.getElementById('sub-form-card').classList.add('hidden');
          document.getElementById('sub-done-card').classList.remove('hidden');
          window.scrollTo({top:0,behavior:'smooth'});
        }else{
          srv.textContent=d.msg||'일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
          srv.classList.remove('hidden');
        }
      })
      .catch(function(){
        btn.disabled=false;
        srv.textContent='일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        srv.classList.remove('hidden');
      });
  });

  // 다시 신청 — 폼으로 복귀
  document.getElementById('sub-again').addEventListener('click',function(){
    document.getElementById('sub-done-card').classList.add('hidden');
    document.getElementById('sub-form-card').classList.remove('hidden');
  });
})();
</script>
<?php render_foot();
