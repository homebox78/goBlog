<?php
// 개인정보처리방침 — 시안(HOM2BOX 개인정보처리방침.dc.html) 기반: 브레드크럼 + 회색 밴드 헤더 + sticky 목차 2열.
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

$contactEmail = 'homebox000001@gmail.com';

$toc = [
    's1' => '1. 수집하는 개인정보 항목 및 목적',
    's2' => '2. 개인정보의 수집 방법',
    's3' => '3. 개인정보의 보유 및 이용 기간',
    's4' => '4. 쿠키 및 광고에 관한 사항',
    's5' => '5. 개인정보의 제3자 제공',
    's6' => '6. 이용자의 권리와 행사 방법',
    's7' => '7. 개인정보의 안전성 확보 조치',
    's8' => '8. 개인정보 보호책임자',
];

render_head('개인정보처리방침 — HOM2BOX 뉴스', 'HOM2BOX 개인정보처리방침 — 수집 항목, 쿠키·구글 애드센스 광고, 제휴 마케팅 고지, 이용자 권리 안내.');
render_topbar();
render_masthead();
render_nav('');
?>
<style>html { scroll-behavior: smooth; }</style>
<div class="min-h-screen bg-white">
  <div class="border-b border-zinc-100 bg-zinc-50">
    <div class="mx-auto max-w-[1399px] px-4 sm:px-6 py-10">
      <div class="mb-2 flex items-center gap-1.5 text-[12.5px] text-zinc-400"><a href="/" class="hover:text-[#134a9c]">홈</a><span class="material-symbols-outlined text-[14px]">chevron_right</span><span>약관·정책</span><span class="material-symbols-outlined text-[14px]">chevron_right</span><span class="font-semibold text-zinc-600">개인정보처리방침</span></div>
      <h1 class="m-0 text-[24px] sm:text-[30px] font-extrabold tracking-tight">개인정보처리방침</h1>
      <div class="mt-2 text-[13px] text-zinc-400">시행일 2026.07.01 · 최종 개정 2026.07.15</div>
    </div>
  </div>

  <div class="mx-auto max-w-[1399px] grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-8 lg:gap-12 px-4 sm:px-6 py-10">
    <div class="self-start lg:sticky lg:top-20">
      <div class="mb-3 text-[13px] font-extrabold text-zinc-500">목차</div>
      <?php foreach ($toc as $anchor => $label): ?>
      <a href="#<?= $anchor ?>" class="block border-l-2 border-zinc-100 py-2 pl-4 text-[13.5px] font-semibold text-zinc-500 hover:border-[#134a9c] hover:text-[#134a9c]"><?= nh($label) ?></a>
      <?php endforeach; ?>
      <div class="mt-6 rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 text-[12.5px] leading-relaxed text-zinc-500">
        문의: 개인정보 보호책임자<br><a href="mailto:<?= nh($contactEmail) ?>" class="font-semibold text-[#134a9c] break-all"><?= nh($contactEmail) ?></a>
      </div>
    </div>

    <div>
      <div class="mb-8 rounded-lg border-l-4 border-[#134a9c] bg-zinc-50 px-5 py-4 text-[13.5px] leading-loose text-zinc-700">
        HOM2BOX(이하 '회사')는 이용자의 개인정보를 중요하게 생각하며, 「개인정보 보호법」 등 관련 법령을 준수합니다. 본 방침은 회사가 운영하는 hom2box.com 및 관련 서비스에 적용됩니다.
      </div>

      <div id="s1" class="mb-9" style="scroll-margin-top:96px">
        <h2 class="mb-3 border-b border-zinc-200 pb-2.5 text-[19px] font-extrabold">1. 수집하는 개인정보 항목 및 목적</h2>
        <p class="mb-3 text-[14.5px] leading-loose text-zinc-700">회사는 서비스 제공을 위해 아래와 같은 최소한의 개인정보를 수집합니다.</p>
        <div class="mb-3 overflow-hidden rounded-lg border border-zinc-200">
          <table class="w-full border-collapse text-[13.5px]">
            <thead><tr class="bg-zinc-50 text-left">
              <th class="border-b border-zinc-200 px-3.5 py-2.5 font-extrabold">항목</th>
              <th class="border-b border-zinc-200 px-3.5 py-2.5 font-extrabold">수집 목적</th>
              <th class="border-b border-zinc-200 px-3.5 py-2.5 font-extrabold">보유 기간</th>
            </tr></thead>
            <tbody>
              <tr class="border-b border-zinc-100"><td class="px-3.5 py-2.5 font-semibold">이메일 주소</td><td class="px-3.5 py-2.5 text-zinc-600">뉴스레터 발송, 구독 인증</td><td class="px-3.5 py-2.5 whitespace-nowrap text-zinc-600">구독 해지 시까지</td></tr>
              <tr class="border-b border-zinc-100"><td class="px-3.5 py-2.5 font-semibold">관심 분야·발송 시간</td><td class="px-3.5 py-2.5 text-zinc-600">맞춤형 뉴스레터 구성</td><td class="px-3.5 py-2.5 whitespace-nowrap text-zinc-600">구독 해지 시까지</td></tr>
              <tr><td class="px-3.5 py-2.5 font-semibold">접속 로그·쿠키·기기 정보</td><td class="px-3.5 py-2.5 text-zinc-600">서비스 이용 통계, 부정 이용 방지</td><td class="px-3.5 py-2.5 whitespace-nowrap text-zinc-600">최대 1년</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div id="s2" class="mb-9" style="scroll-margin-top:96px">
        <h2 class="mb-3 border-b border-zinc-200 pb-2.5 text-[19px] font-extrabold">2. 개인정보의 수집 방법</h2>
        <p class="mb-3 text-[14.5px] leading-loose text-zinc-700">회사는 다음의 방법으로 개인정보를 수집합니다.</p>
        <ul class="mb-3 space-y-1.5 pl-1">
          <li class="flex items-start gap-2 text-[14px] leading-relaxed text-zinc-600"><span class="mt-2 h-1 w-1 flex-none rounded-full bg-[#134a9c]"></span><span>뉴스레터 구독 신청 폼을 통한 이용자의 직접 입력</span></li>
          <li class="flex items-start gap-2 text-[14px] leading-relaxed text-zinc-600"><span class="mt-2 h-1 w-1 flex-none rounded-full bg-[#134a9c]"></span><span>서비스 이용 과정에서 자동으로 생성·수집되는 접속 정보(쿠키, 로그)</span></li>
          <li class="flex items-start gap-2 text-[14px] leading-relaxed text-zinc-600"><span class="mt-2 h-1 w-1 flex-none rounded-full bg-[#134a9c]"></span><span>제휴 광고 및 통계 도구를 통한 비식별 이용 데이터</span></li>
        </ul>
      </div>

      <div id="s3" class="mb-9" style="scroll-margin-top:96px">
        <h2 class="mb-3 border-b border-zinc-200 pb-2.5 text-[19px] font-extrabold">3. 개인정보의 보유 및 이용 기간</h2>
        <p class="mb-3 text-[14.5px] leading-loose text-zinc-700">원칙적으로 개인정보의 수집·이용 목적이 달성되면 지체 없이 파기합니다. 다만 관련 법령에 따라 보존할 필요가 있는 경우 해당 기간 동안 보관합니다.</p>
        <p class="mb-3 text-[14.5px] leading-loose text-zinc-700">뉴스레터 구독 정보는 이용자가 구독을 해지하는 즉시 파기됩니다.</p>
      </div>

      <div id="s4" class="mb-9" style="scroll-margin-top:96px">
        <h2 class="mb-3 border-b border-zinc-200 pb-2.5 text-[19px] font-extrabold">4. 쿠키 및 광고에 관한 사항</h2>
        <p class="mb-3 text-[14.5px] leading-loose text-zinc-700">회사는 서비스 개선과 맞춤형 콘텐츠·광고 제공을 위해 쿠키를 사용합니다. 본 사이트는 Google AdSense 등 제3자 광고를 게재하며, 광고 사업자는 쿠키를 통해 이용자의 관심에 기반한 광고를 제공할 수 있습니다.</p>
        <p class="mb-3 text-[14.5px] leading-loose text-zinc-700">이용자는 브라우저 설정에서 쿠키 저장을 거부할 수 있으며, <a href="https://adssettings.google.com/" target="_blank" rel="noopener" class="font-semibold text-[#134a9c] underline">Google 광고 설정</a> 페이지에서 맞춤 광고를 해제할 수 있습니다.</p>
        <ul class="mb-3 space-y-1.5 pl-1">
          <li class="flex items-start gap-2 text-[14px] leading-relaxed text-zinc-600"><span class="mt-2 h-1 w-1 flex-none rounded-full bg-[#134a9c]"></span><span>쿠키 거부 시 일부 맞춤형 서비스 이용에 제한이 있을 수 있습니다.</span></li>
          <li class="flex items-start gap-2 text-[14px] leading-relaxed text-zinc-600"><span class="mt-2 h-1 w-1 flex-none rounded-full bg-[#134a9c]"></span><span>제휴 링크를 통한 구매 시 회사는 일정 수수료를 제공받을 수 있으며, 이는 이용자에게 추가 비용을 발생시키지 않습니다.</span></li>
        </ul>
      </div>

      <div id="s5" class="mb-9" style="scroll-margin-top:96px">
        <h2 class="mb-3 border-b border-zinc-200 pb-2.5 text-[19px] font-extrabold">5. 개인정보의 제3자 제공</h2>
        <p class="mb-3 text-[14.5px] leading-loose text-zinc-700">회사는 이용자의 개인정보를 본 방침에서 고지한 범위를 초과하여 이용하거나 제3자에게 제공하지 않습니다. 다만 법령의 규정에 의거하거나 수사 목적으로 관계 기관의 적법한 요구가 있는 경우는 예외로 합니다.</p>
      </div>

      <div id="s6" class="mb-9" style="scroll-margin-top:96px">
        <h2 class="mb-3 border-b border-zinc-200 pb-2.5 text-[19px] font-extrabold">6. 이용자의 권리와 행사 방법</h2>
        <p class="mb-3 text-[14.5px] leading-loose text-zinc-700">이용자는 언제든지 본인의 개인정보에 대한 열람·정정·삭제·처리정지를 요청할 수 있습니다.</p>
        <ul class="mb-3 space-y-1.5 pl-1">
          <li class="flex items-start gap-2 text-[14px] leading-relaxed text-zinc-600"><span class="mt-2 h-1 w-1 flex-none rounded-full bg-[#134a9c]"></span><span>뉴스레터 하단의 '구독 해지' 링크를 통한 즉시 해지</span></li>
          <li class="flex items-start gap-2 text-[14px] leading-relaxed text-zinc-600"><span class="mt-2 h-1 w-1 flex-none rounded-full bg-[#134a9c]"></span><span>개인정보 보호책임자 이메일을 통한 열람·정정·삭제 요청</span></li>
          <li class="flex items-start gap-2 text-[14px] leading-relaxed text-zinc-600"><span class="mt-2 h-1 w-1 flex-none rounded-full bg-[#134a9c]"></span><span>요청 접수 시 지체 없이(최대 10일 이내) 조치</span></li>
        </ul>
      </div>

      <div id="s7" class="mb-9" style="scroll-margin-top:96px">
        <h2 class="mb-3 border-b border-zinc-200 pb-2.5 text-[19px] font-extrabold">7. 개인정보의 안전성 확보 조치</h2>
        <p class="mb-3 text-[14.5px] leading-loose text-zinc-700">회사는 개인정보의 안전한 처리를 위해 다음의 조치를 취합니다.</p>
        <ul class="mb-3 space-y-1.5 pl-1">
          <li class="flex items-start gap-2 text-[14px] leading-relaxed text-zinc-600"><span class="mt-2 h-1 w-1 flex-none rounded-full bg-[#134a9c]"></span><span>개인정보 접근 권한의 최소화 및 접근 통제</span></li>
          <li class="flex items-start gap-2 text-[14px] leading-relaxed text-zinc-600"><span class="mt-2 h-1 w-1 flex-none rounded-full bg-[#134a9c]"></span><span>전송 구간 암호화(SSL/TLS) 적용</span></li>
          <li class="flex items-start gap-2 text-[14px] leading-relaxed text-zinc-600"><span class="mt-2 h-1 w-1 flex-none rounded-full bg-[#134a9c]"></span><span>접속 기록의 보관 및 위·변조 방지</span></li>
        </ul>
      </div>

      <div id="s8" class="mb-9" style="scroll-margin-top:96px">
        <h2 class="mb-3 border-b border-zinc-200 pb-2.5 text-[19px] font-extrabold">8. 개인정보 보호책임자</h2>
        <p class="mb-3 text-[14.5px] leading-loose text-zinc-700">개인정보 처리에 관한 문의, 불만 처리, 피해 구제 등에 관한 사항은 아래 보호책임자에게 연락하실 수 있습니다.</p>
        <ul class="mb-3 space-y-1.5 pl-1">
          <li class="flex items-start gap-2 text-[14px] leading-relaxed text-zinc-600"><span class="mt-2 h-1 w-1 flex-none rounded-full bg-[#134a9c]"></span><span>개인정보 보호책임자: HOM2BOX 운영팀</span></li>
          <li class="flex items-start gap-2 text-[14px] leading-relaxed text-zinc-600"><span class="mt-2 h-1 w-1 flex-none rounded-full bg-[#134a9c]"></span><span>이메일: <a href="mailto:<?= nh($contactEmail) ?>" class="font-semibold text-[#134a9c] underline"><?= nh($contactEmail) ?></a></span></li>
        </ul>
      </div>

      <div class="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/60 p-5 text-[13px] leading-loose text-zinc-500">
        본 개인정보처리방침은 2026년 7월 1일부터 적용됩니다. 법령·정책 변경 또는 서비스 개선에 따라 내용이 추가·삭제·수정될 수 있으며, 개정 시 시행일 7일 전부터 웹사이트 공지사항을 통해 고지합니다.
      </div>
    </div>
  </div>

  <?php render_footer(); ?>
</div>
<?php render_foot();
