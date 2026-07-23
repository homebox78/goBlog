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
];
const DOC_CATS = [
    ['법률·계약', ['pledge', 'poa', 'loan', 'settle', 'nda', 'certmail']],
    ['직장·인사', ['resign', 'incident', 'leaveapp', 'empcert', 'career', 'retirecert', 'payslip', 'labor', 'parttime']],
    ['거래·회계', ['quote', 'transdetail', 'receipt']],
];
