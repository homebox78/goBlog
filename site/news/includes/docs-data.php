<?php
// 문서 서식 정의 — docs.php(허브·상세)와 index.php(홈 바로가기 셀렉트)가 공유하는 단일 소스.
declare(strict_types=1);

const DOC_DEFS = [
    'pledge'     => ['icon' => 'history_edu',        'title' => '각서',                'desc' => '이행할 사항과 당사자 정보를 입력하면 완성된 각서가 즉시 만들어집니다.'],
    'poa'        => ['icon' => 'assignment_ind',     'title' => '위임장',              'desc' => '위임인·수임인 정보와 위임 내용을 입력해 위임장을 작성합니다.'],
    'loan'       => ['icon' => 'request_quote',      'title' => '차용증',              'desc' => '차용 금액·이자·변제 조건을 담은 차용증을 작성합니다.'],
    'settle'     => ['icon' => 'handshake',          'title' => '합의서',              'desc' => '당사자 간 합의 내용과 합의금을 정리한 합의서를 작성합니다.'],
    'nda'        => ['icon' => 'lock',               'title' => '비밀유지계약서(NDA)',  'desc' => '협업·투자 전 정보 유출을 막는 비밀유지계약서(NDA)를 작성합니다.'],
    'certmail'   => ['icon' => 'mail',               'title' => '내용증명',            'desc' => '대금 청구·계약 해지 등 통지 사실을 남기는 내용증명을 작성합니다.'],
    'resign'     => ['icon' => 'logout',             'title' => '사직서',              'desc' => '소속·사유·퇴사 희망일을 담은 사직서를 작성합니다.'],
    'incident'   => ['icon' => 'report',             'title' => '경위서',              'desc' => '사건 발생 경위와 재발 방지 대책을 정리한 경위서를 작성합니다.'],
    'leaveapp'   => ['icon' => 'event_available',    'title' => '연차신청서',          'desc' => '휴가 종류·기간·사유를 담은 연차(휴가) 신청서를 작성합니다.'],
    'empcert'    => ['icon' => 'badge',              'title' => '재직증명서',          'desc' => '직원의 재직 사실을 증명하는 재직증명서를 작성합니다.'],
    'career'     => ['icon' => 'workspace_premium',  'title' => '경력증명서',          'desc' => '재직 기간·담당 업무를 담은 경력증명서를 작성합니다.'],
    'retirecert' => ['icon' => 'assignment_turned_in','title' => '퇴직증명서',         'desc' => '입·퇴사일과 퇴사 사유를 담은 퇴직증명서를 작성합니다.'],
    'payslip'    => ['icon' => 'payments',           'title' => '급여명세서',          'desc' => '지급·공제 내역과 실지급액을 정리한 급여명세서를 작성합니다.'],
    'labor'      => ['icon' => 'contract',           'title' => '표준 근로계약서',      'desc' => '근무 조건과 임금을 담은 간이 근로계약서를 작성합니다.'],
    'parttime'   => ['icon' => 'schedule',           'title' => '알바·단기 근로계약서',  'desc' => '시급·근무일·근무시간을 담은 단시간 근로계약서를 작성합니다.'],
    'quote'      => ['icon' => 'receipt_long',       'title' => '견적서',              'desc' => '공급자·수신처·견적 내역을 담은 견적서를 작성합니다.'],
    'transdetail'=> ['icon' => 'list_alt',           'title' => '거래명세서',          'desc' => '거래 내역과 공급가액·부가세를 정리한 거래명세서를 작성합니다.'],
    'receipt'    => ['icon' => 'paid',               'title' => '영수증',              'desc' => '받은 금액과 항목을 기재한 영수증을 작성합니다.'],
    // 인사
    'leaveofabsence' => ['icon' => 'event_busy',     'title' => '휴직신청서',          'desc' => '휴직 종류·기간·사유를 담은 휴직신청서를 작성합니다.'],
    'recresign'  => ['icon' => 'person_remove',      'title' => '권고사직서',          'desc' => '권고 사유와 퇴직 조건을 담은 권고사직서를 작성합니다.'],
    // 비즈니스 계약
    'freelance'  => ['icon' => 'work',               'title' => '프리랜서 계약서',      'desc' => '업무·대금·지급 조건을 담은 프리랜서 계약서를 작성합니다.'],
    'service'    => ['icon' => 'engineering',        'title' => '용역계약서',          'desc' => '용역 내용·기간·대금을 담은 용역계약서를 작성합니다.'],
    'supply'     => ['icon' => 'local_shipping',     'title' => '공급(납품)계약서',     'desc' => '품목·대금·납품·검수 조건을 담은 공급계약서를 작성합니다.'],
    'purchase'   => ['icon' => 'shopping_bag',       'title' => '물품구매 계약서',      'desc' => '물품·금액·인도 조건을 담은 물품구매 계약서를 작성합니다.'],
    'mou'        => ['icon' => 'diversity_3',        'title' => '업무협약서(MOU)',      'desc' => '협약 목적·협력 내용을 담은 업무협약서(MOU)를 작성합니다.'],
    'consulting' => ['icon' => 'support_agent',      'title' => '컨설팅 계약서',        'desc' => '컨설팅 범위·보수·비밀유지를 담은 컨설팅 계약서를 작성합니다.'],
    'swdev'      => ['icon' => 'code',               'title' => '소프트웨어 개발 계약서', 'desc' => '개발 범위·대금·검수·권리 귀속을 담은 SW 개발 계약서를 작성합니다.'],
    // 법률
    'partnership'=> ['icon' => 'groups_2',           'title' => '동업계약서',          'desc' => '출자·손익분배·역할을 담은 동업계약서를 작성합니다.'],
    'copyright'  => ['icon' => 'copyright',          'title' => '저작권 양도 계약서',    'desc' => '저작물·양도 범위·대금을 담은 저작권 양도 계약서를 작성합니다.'],
    'transfer'   => ['icon' => 'swap_horiz',         'title' => '양도양수 계약서',      'desc' => '양도 대상·대금·인도 조건을 담은 양도양수 계약서를 작성합니다.'],
    // 정책·약관
    'privacy'    => ['icon' => 'privacy_tip',        'title' => '개인정보처리방침',      'desc' => '수집 항목·이용 목적·보유 기간을 담은 개인정보처리방침을 작성합니다.'],
    'terms'      => ['icon' => 'gavel',              'title' => '이용약관',            'desc' => '서비스 이용 조건·이용자 의무·책임 제한을 담은 이용약관을 작성합니다.'],
];
const DOC_CATS = [
    ['법률·계약', ['pledge', 'poa', 'loan', 'settle', 'nda', 'certmail', 'partnership', 'copyright', 'transfer']],
    ['직장·인사', ['resign', 'recresign', 'incident', 'leaveapp', 'leaveofabsence', 'empcert', 'career', 'retirecert', 'payslip', 'labor', 'parttime']],
    ['비즈니스 계약', ['freelance', 'service', 'supply', 'purchase', 'mou', 'consulting', 'swdev']],
    ['거래·회계', ['quote', 'transdetail', 'receipt']],
    ['정책·약관', ['privacy', 'terms']],
];
