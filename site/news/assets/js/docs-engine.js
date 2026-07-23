/* HOM2BOX 문서도구 공용 엔진 — 서식별 입력필드·문서블록·FAQ 정의 (단일 진리원).
 * 상세 페이지(docs.php?doc=)의 실시간 미리보기와 허브의 '바로 다운로드'가 모두 이 파일을 사용한다.
 * 블록 모델: title / kv(라벨-값) / para(정렬·굵기·섹션 옵션) / sp(간격). 렌더러는 화면(Tailwind)과 Word(inline) 둘 다 지원. */
(function () {
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function num(v) {
    var n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
    return isFinite(n) ? n : 0;
  }
  function won(v) {
    var n = num(v);
    return n > 0 ? n.toLocaleString("ko-KR") : "";
  }
  function amt(v) {
    var w = won(v);
    return w ? "일금 " + w + "원정 (₩" + w + ")" : "—";
  }
  function fmtDate(iso) {
    if (!iso) return "20    년      월      일";
    var p = String(iso).split("-");
    if (p.length < 3) return iso;
    return p[0] + "년 " + parseInt(p[1], 10) + "월 " + parseInt(p[2], 10) + "일";
  }

  // 서식 제목 (허브 다운로드 라벨·파일명용)
  var TITLES = {
    pledge: "각서", poa: "위임장", loan: "차용증", settle: "합의서", resign: "사직서",
    incident: "경위서", empcert: "재직증명서", labor: "표준 근로계약서", quote: "견적서", receipt: "영수증",
    career: "경력증명서", retirecert: "퇴직증명서", leaveapp: "연차신청서", parttime: "알바·단기 근로계약서",
    transdetail: "거래명세서", certmail: "내용증명", payslip: "급여명세서", nda: "비밀유지계약서(NDA)",
    leaveofabsence: "휴직신청서", recresign: "권고사직서", freelance: "프리랜서 계약서", service: "용역계약서",
    supply: "공급(납품)계약서", purchase: "물품구매 계약서", mou: "업무협약서(MOU)", consulting: "컨설팅 계약서",
    swdev: "소프트웨어 개발 계약서", partnership: "동업계약서", copyright: "저작권 양도 계약서",
    transfer: "양도양수 계약서", privacy: "개인정보처리방침", terms: "이용약관",
  };

  // 서식별 정의를 반환 — {fields, doc, faqs}
  function build(view, vals) {
    vals = vals || {};
    function g(k, def) {
      var v = vals[view + "_" + k];
      return v === undefined ? (def === undefined ? "" : def) : v;
    }
    function pf(k) { return view + "_" + k; }
    function tf(key, label, ph, def, opt) {
      opt = opt || {};
      return { key: key, label: label, ph: ph, area: !!opt.area, date: false, full: !!(opt.area || opt.full), value: g(key.replace(view + "_", ""), def) };
    }
    function df(key, label) { return { key: key, label: label, date: true, area: false, full: false, value: g(key.replace(view + "_", ""), today()) }; }
    var T = function (t) { return { t: "title", text: t }; },
      KV = function (k, v) { return { t: "kv", k: k, v: v && String(v).trim() ? v : "—" }; },
      P = function (t, o) { o = o || {}; return { t: "para", text: t || "", align: o.align, bold: o.bold, section: o.section }; },
      SEC = function (t) { return P(t, { section: true }); },
      R = function (t) { return P(t, { align: "right" }); },
      RB = function (t) { return P(t, { align: "right", bold: true }); },
      C = function (t) { return P(t, { align: "center", bold: true }); },
      SP = function () { return { t: "sp" }; };

    var fields = [], doc = [], faqs = [];

    if (view === "pledge") {
      fields = [tf(pf("name"), "작성자 성명", "홍길동"), tf(pf("phone"), "연락처", "010-0000-0000"), tf(pf("addr"), "작성자 주소", "서울시 …", "", { full: true }), tf(pf("payee"), "수령인(기업/개인)", "○○ 주식회사"), df(pf("date"), "작성일"), tf(pf("content"), "이행 사항", "예) 20XX년 X월 X일까지 금 500만원을 변제하겠습니다.", "", { area: true }), tf(pf("penalty"), "위반 시 조치(선택)", "예) 위반 시 법적 책임을 감수합니다.", "", { area: true })];
      doc = [T("각    서"), SEC("작성자(서약자)"), KV("성명", g("name")), KV("연락처", g("phone")), KV("주소", g("addr")), SEC("수령인"), KV("성명/기관", g("payee")), SEC("이행 사항"), P(g("content") || "이행할 사항을 입력하세요.")].concat(g("penalty").trim() ? [SEC("위반 시 조치"), P(g("penalty"))] : []).concat([SP(), P("본인은 위 사항을 성실히 이행할 것을 서약하며, 이를 어길 경우 그에 따른 모든 책임을 감수할 것을 확약합니다."), SP(), R(fmtDate(g("date", today()))), RB("서약자 : " + (g("name") || "") + "  (인)")]);
      faqs = [{ q: "각서에 법적 효력이 있나요?", a: "각서 자체로는 강제집행력이 없지만, 자필 서명·날인이 있으면 민사소송에서 채무·의무 이행 약속을 입증하는 핵심 증거가 됩니다." }, { q: "인감도장이 꼭 필요한가요?", a: "일반 서명·날인으로도 유효하나, 인감도장 날인과 인감증명서를 첨부하면 증거력이 크게 강화됩니다." }, { q: "강요로 쓴 각서도 유효한가요?", a: "허위·강요로 작성된 각서는 무효가 될 수 있으며, 강요죄(형법 제324조)에 해당할 수 있습니다." }];
    } else if (view === "poa") {
      fields = [tf(pf("wn"), "위임인 성명", "홍길동"), tf(pf("wr"), "위임인 주민등록번호", "000000-0000000"), tf(pf("wa"), "위임인 주소", "서울시 …", "", { full: true }), tf(pf("an"), "수임인 성명", "김대리"), tf(pf("ar"), "수임인 주민등록번호", "000000-0000000"), tf(pf("aa"), "수임인 주소", "서울시 …", "", { full: true }), tf(pf("content"), "위임 내용", "예) 부동산 매매계약 체결 및 잔금 수령에 관한 일체의 권한", "", { area: true }), tf(pf("period"), "위임 기간", "20XX.XX.XX ~ 20XX.XX.XX"), df(pf("date"), "작성일")];
      doc = [T("위  임  장"), SEC("위임인"), KV("성명", g("wn")), KV("주민등록번호", g("wr")), KV("주소", g("wa")), SEC("수임인"), KV("성명", g("an")), KV("주민등록번호", g("ar")), KV("주소", g("aa")), SEC("위임 내용"), P(g("content") || "위임할 내용을 입력하세요."), KV("위임 기간", g("period")), SP(), P("위임인은 위 위임 사항에 관한 일체의 권한을 수임인에게 위임합니다."), SP(), R(fmtDate(g("date", today()))), RB("위임인 : " + (g("wn") || "") + "  (인)")];
      faqs = [{ q: "위임장에 인감증명서가 필요한가요?", a: "부동산 거래·금융 업무 등에서는 위임인의 인감증명서를 함께 제출해야 효력이 인정되는 경우가 많습니다." }, { q: "위임 범위는 어떻게 적나요?", a: "민법 제680조에 따라 위임 범위를 구체적으로 명시해야 하며, 포괄 위임은 분쟁 소지가 있습니다." }, { q: "수임인이 범위를 넘으면?", a: "위임 범위를 초과한 행위는 표현대리(민법 제126조)가 문제될 수 있으므로 범위를 명확히 한정하세요." }];
    } else if (view === "loan") {
      fields = [tf(pf("amount"), "차용 금액(원)", "5000000"), tf(pf("rate"), "이자율(연 %)", "0"), tf(pf("debtor"), "채무자 성명", "홍길동"), tf(pf("daddr"), "채무자 주소", "서울시 …", "", { full: true }), tf(pf("creditor"), "채권자 성명", "김철수"), tf(pf("due"), "변제 기일", "20XX.XX.XX"), tf(pf("method"), "변제 방법", "예) 채권자 계좌로 일시 상환"), df(pf("date"), "작성일")];
      doc = [T("차  용  증"), SP(), KV("차용 금액", amt(g("amount"))), SEC("채무자"), KV("성명", g("debtor")), KV("주소", g("daddr")), SEC("채권자"), KV("성명", g("creditor")), SEC("변제 조건"), KV("이자율", (won(g("rate")) || g("rate") || "0") + " %"), KV("변제 기일", g("due")), KV("변제 방법", g("method")), SP(), P("채무자는 위 금액을 채권자로부터 차용하였음을 확인하며, 약정한 기일과 방법에 따라 성실히 변제할 것을 확약합니다."), SP(), R(fmtDate(g("date", today()))), RB("채무자 : " + (g("debtor") || "") + "  (인)")];
      faqs = [{ q: "차용증만으로 돈을 돌려받을 수 있나요?", a: "차용증은 채권의 존재를 입증하는 증거이며, 미상환 시 지급명령·민사소송으로 회수 절차를 밟을 수 있습니다." }, { q: "이자를 안 적으면 어떻게 되나요?", a: "약정 이자가 없으면 원칙적으로 무이자이며, 지연 시 법정이율(민사 연 5%)이 적용될 수 있습니다." }, { q: "공증을 받아야 하나요?", a: "필수는 아니지만 공정증서로 작성하면 소송 없이 강제집행이 가능해 회수가 훨씬 수월합니다." }];
    } else if (view === "settle") {
      fields = [tf(pf("a"), "갑(성명)", "홍길동"), tf(pf("b"), "을(성명)", "김철수"), tf(pf("content"), "합의 내용", "예) 20XX.XX.XX 발생한 교통사고에 관하여 다음과 같이 합의한다.", "", { area: true }), tf(pf("amount"), "합의금(원, 선택)", "0"), tf(pf("method"), "지급 방법", "예) 합의 즉시 을의 계좌로 이체"), df(pf("date"), "작성일")];
      doc = [T("합  의  서"), KV("갑", g("a")), KV("을", g("b")), SEC("합의 내용"), P(g("content") || "합의 내용을 입력하세요.")].concat(won(g("amount")) ? [KV("합의금", amt(g("amount"))), KV("지급 방법", g("method"))] : []).concat([SP(), P("갑과 을은 위 내용에 원만히 합의하였으며, 향후 본 건과 관련하여 민·형사상 어떠한 이의도 제기하지 않을 것을 확약합니다."), SP(), R(fmtDate(g("date", today()))), RB("갑 : " + (g("a") || "") + "  (인)"), RB("을 : " + (g("b") || "") + "  (인)")]);
      faqs = [{ q: "합의서를 쓰면 다시 소송할 수 없나요?", a: "'민·형사상 이의를 제기하지 않는다'는 부제소 특약이 있으면 원칙적으로 재소송이 제한됩니다." }, { q: "합의금은 꼭 적어야 하나요?", a: "금전이 오가는 합의라면 금액·지급 방법·기한을 명확히 기재해야 분쟁을 예방할 수 있습니다." }];
    } else if (view === "resign") {
      fields = [tf(pf("name"), "성명", "홍길동"), tf(pf("dept"), "소속 부서", "영업1팀"), tf(pf("position"), "직위", "대리"), tf(pf("reason"), "사직 사유", "예) 개인 사정으로 인하여", "", { area: true }), tf(pf("last"), "퇴사 희망일", "20XX.XX.XX"), df(pf("date"), "작성일")];
      doc = [T("사  직  서"), KV("소속 부서", g("dept")), KV("직위", g("position")), KV("성명", g("name")), SEC("사직 사유"), P(g("reason") || "사직 사유를 입력하세요."), KV("퇴사 희망일", g("last")), SP(), P("위와 같은 사유로 사직하고자 하오니 재가하여 주시기 바랍니다."), SP(), R(fmtDate(g("date", today()))), RB("작성자 : " + (g("name") || "") + "  (인)")];
      faqs = [{ q: "사직서를 내면 바로 퇴사되나요?", a: "사용자가 수리하면 그 시점에, 수리하지 않으면 통상 1개월(민법 제660조) 경과 후 효력이 생깁니다." }, { q: "사직 사유를 꼭 적어야 하나요?", a: "'일신상의 사유'로 간단히 적어도 무방하며, 구체적 사유 기재는 선택입니다." }];
    } else if (view === "incident") {
      fields = [tf(pf("name"), "성명", "홍길동"), tf(pf("dept"), "소속 부서", "물류팀"), tf(pf("when"), "발생 일시", "20XX.XX.XX 14:00경"), tf(pf("where"), "발생 장소", "본사 3층 창고"), tf(pf("content"), "발생 경위", "발생 상황을 시간 순으로 구체적으로 작성하세요.", "", { area: true }), tf(pf("prevent"), "재발 방지 대책", "재발을 막기 위한 대책을 작성하세요.", "", { area: true }), df(pf("date"), "작성일")];
      doc = [T("경  위  서"), KV("소속 부서", g("dept")), KV("성명", g("name")), KV("발생 일시", g("when")), KV("발생 장소", g("where")), SEC("발생 경위"), P(g("content") || "발생 경위를 입력하세요."), SEC("재발 방지 대책"), P(g("prevent") || "재발 방지 대책을 입력하세요."), SP(), P("위 내용은 사실과 다름이 없음을 확인합니다."), SP(), R(fmtDate(g("date", today()))), RB("작성자 : " + (g("name") || "") + "  (인)")];
      faqs = [{ q: "경위서와 시말서의 차이는?", a: "경위서는 사실관계를 객관적으로 설명하는 문서, 시말서는 반성·재발방지 다짐을 담은 문서입니다." }, { q: "경위서 제출이 징계인가요?", a: "경위서 제출 자체는 징계가 아니라 사실 확인 절차이며, 사실만 정확히 기재하는 것이 중요합니다." }];
    } else if (view === "empcert") {
      fields = [tf(pf("company"), "회사명", "○○ 주식회사"), tf(pf("name"), "성명", "홍길동"), tf(pf("rrn"), "생년월일/주민번호", "0000.00.00"), tf(pf("addr"), "주소", "서울시 …", "", { full: true }), tf(pf("dept"), "소속", "개발본부"), tf(pf("position"), "직위", "책임연구원"), tf(pf("join"), "입사일", "20XX.XX.XX"), tf(pf("purpose"), "용도", "예) 은행 제출용"), df(pf("date"), "발급일")];
      doc = [T("재 직 증 명 서"), SEC("인적 사항"), KV("성명", g("name")), KV("생년월일", g("rrn")), KV("주소", g("addr")), SEC("재직 사항"), KV("소속", g("dept")), KV("직위", g("position")), KV("입사일", g("join")), KV("용도", g("purpose")), SP(), P("위 사람은 당사에 위와 같이 재직하고 있음을 증명합니다."), SP(), R(fmtDate(g("date", today()))), C((g("company") || "○○ 주식회사") + "   대표이사   (직인)")];
      faqs = [{ q: "재직증명서는 누가 발급하나요?", a: "재직 중인 회사의 인사·총무 부서에서 발급하며, 대표이사 직인 또는 회사 직인이 찍혀야 효력이 있습니다." }, { q: "경력증명서와 다른가요?", a: "재직증명서는 '현재 재직 중' 사실을, 경력증명서는 과거 근무 이력을 증명한다는 점이 다릅니다." }];
    } else if (view === "labor") {
      fields = [tf(pf("employer"), "사업주(갑)", "○○ 주식회사 대표 홍길동"), tf(pf("worker"), "근로자(을)", "김철수"), tf(pf("place"), "근무 장소", "본사 사무실"), tf(pf("duty"), "업무 내용", "예) 웹 서비스 개발"), tf(pf("hours"), "근로 시간", "예) 09:00~18:00 (주 40시간)"), tf(pf("wage"), "임금", "예) 월 300만원 (매월 25일 지급)"), tf(pf("term"), "계약 기간", "예) 20XX.XX.XX ~ (기간의 정함 없음)"), df(pf("date"), "작성일")];
      doc = [T("표준 근로계약서"), KV("사업주(갑)", g("employer")), KV("근로자(을)", g("worker")), SEC("근로 조건"), KV("근무 장소", g("place")), KV("업무 내용", g("duty")), KV("근로 시간", g("hours")), KV("임금", g("wage")), KV("계약 기간", g("term")), SP(), P("갑과 을은 위 근로조건에 합의하여 근로계약을 체결하며, 각자 성실히 이행할 것을 확약한다. 본 계약서에 정하지 않은 사항은 근로기준법 및 취업규칙에 따른다."), SP(), R(fmtDate(g("date", today()))), RB("사업주(갑) : " + (g("employer") ? "(서명)" : "") + "  (서명)"), RB("근로자(을) : " + (g("worker") || "") + "  (서명)")];
      faqs = [{ q: "근로계약서는 꼭 서면으로 써야 하나요?", a: "임금·근로시간 등 핵심 근로조건은 서면 명시·교부가 의무이며, 위반 시 사용자에게 과태료가 부과됩니다." }, { q: "이 서식만으로 충분한가요?", a: "핵심 항목을 담은 간이 서식입니다. 수습·연장근로·4대보험 등은 고용노동부 표준근로계약서를 함께 참고하세요." }];
    } else if (view === "quote") {
      fields = [tf(pf("supplier"), "공급자", "○○ 주식회사"), tf(pf("client"), "수신처", "△△ 주식회사 귀중"), tf(pf("items"), "견적 내역", "예) 웹사이트 구축 1식 …\n유지보수 12개월 …", "", { area: true }), tf(pf("amount"), "견적 금액(원)", "5000000"), tf(pf("valid"), "유효 기간", "발행일로부터 30일"), df(pf("date"), "작성일")];
      doc = [T("견  적  서"), KV("수신", g("client")), SP(), P("아래와 같이 견적합니다."), SEC("견적 내역"), P(g("items") || "견적 내역을 입력하세요."), KV("견적 금액", won(g("amount")) ? "일금 " + won(g("amount")) + "원정 (VAT 별도)" : "—"), KV("유효 기간", g("valid")), SP(), R(fmtDate(g("date", today()))), RB("공급자 : " + (g("supplier") || "") + "  (인)")];
      faqs = [{ q: "견적서에 부가세를 포함해야 하나요?", a: "'VAT 별도' 또는 'VAT 포함'을 명확히 표기해야 합니다. 미표기 시 분쟁 소지가 있습니다." }, { q: "견적서에 유효기간이 필요한가요?", a: "원자재·환율 변동에 대비해 유효기간을 두는 것이 일반적이며, 기간 경과 후 재견적을 요청할 수 있습니다." }];
    } else if (view === "receipt") {
      fields = [tf(pf("amount"), "금액(원)", "500000"), tf(pf("issuer"), "받은 사람(발행인)", "홍길동"), tf(pf("payer"), "낸 사람", "김철수"), tf(pf("item"), "항목·내역", "예) 상품 대금"), df(pf("date"), "발행일")];
      doc = [T("영  수  증"), SP(), KV("금액", amt(g("amount"))), KV("항목", g("item")), KV("받은 사람", g("issuer")), KV("낸 사람", g("payer")), SP(), P("위 금액을 정히 영수하였음을 확인합니다."), SP(), R(fmtDate(g("date", today()))), RB("발행인 : " + (g("issuer") || "") + "  (인)")];
      faqs = [{ q: "영수증도 법적 증거가 되나요?", a: "네. 금전 수수 사실을 입증하는 증거이며, 발행인의 서명·날인이 있으면 증거력이 높아집니다." }, { q: "세금계산서와 다른가요?", a: "세금계산서는 부가세 신고용 세무 서식이고, 영수증은 금전 수수 확인용 문서로 목적이 다릅니다." }];
    } else if (view === "career") {
      fields = [tf(pf("company"), "회사명", "○○ 주식회사"), tf(pf("name"), "성명", "홍길동"), tf(pf("rrn"), "생년월일", "0000.00.00"), tf(pf("addr"), "주소", "서울시 …", "", { full: true }), tf(pf("dept"), "소속 부서", "영업본부"), tf(pf("position"), "직위", "과장"), tf(pf("join"), "입사일", "20XX.XX.XX"), tf(pf("leave"), "퇴사일", "20XX.XX.XX"), tf(pf("job"), "담당 업무", "예) 국내 영업 및 거래처 관리", "", { area: true }), tf(pf("purpose"), "용도", "예) 이직 지원용"), df(pf("date"), "발급일")];
      doc = [T("경 력 증 명 서"), SEC("인적 사항"), KV("성명", g("name")), KV("생년월일", g("rrn")), KV("주소", g("addr")), SEC("근무 경력"), KV("소속 부서", g("dept")), KV("직위", g("position")), KV("재직 기간", (g("join") || "") + " ~ " + (g("leave") || "")), SEC("담당 업무"), P(g("job") || "담당 업무를 입력하세요."), KV("용도", g("purpose")), SP(), P("위 사람은 당사에 위와 같이 근무하였음을 증명합니다."), SP(), R(fmtDate(g("date", today()))), C((g("company") || "○○ 주식회사") + "   대표이사   (직인)")];
      faqs = [{ q: "경력증명서와 재직증명서 차이는?", a: "경력증명서는 과거 근무 이력(퇴사자 포함)을, 재직증명서는 현재 재직 사실을 증명합니다." }, { q: "퇴사한 회사가 발급을 거부하면?", a: "사용증명서 발급은 근로기준법 제39조상 사용자의 의무로, 재직·경력 사실은 요구 시 발급해야 합니다." }];
    } else if (view === "retirecert") {
      fields = [tf(pf("company"), "회사명", "○○ 주식회사"), tf(pf("name"), "성명", "홍길동"), tf(pf("rrn"), "생년월일", "0000.00.00"), tf(pf("dept"), "소속 부서", "개발팀"), tf(pf("position"), "직위", "선임"), tf(pf("join"), "입사일", "20XX.XX.XX"), tf(pf("leave"), "퇴사일", "20XX.XX.XX"), tf(pf("reason"), "퇴사 사유", "예) 개인 사정 / 계약 만료 / 권고사직"), tf(pf("purpose"), "용도", "예) 실업급여 신청용"), df(pf("date"), "발급일")];
      doc = [T("퇴 직 증 명 서"), SEC("인적 사항"), KV("성명", g("name")), KV("생년월일", g("rrn")), SEC("재직 사항"), KV("소속 부서", g("dept")), KV("직위", g("position")), KV("입사일", g("join")), KV("퇴사일", g("leave")), KV("퇴사 사유", g("reason")), KV("용도", g("purpose")), SP(), P("위 사람은 당사에서 위와 같이 근무 후 퇴직하였음을 증명합니다."), SP(), R(fmtDate(g("date", today()))), C((g("company") || "○○ 주식회사") + "   대표이사   (직인)")];
      faqs = [{ q: "퇴직증명서는 실업급여에 필요한가요?", a: "실업급여는 이직확인서가 필수이며, 퇴직증명서는 보조 증빙으로 요청될 수 있습니다." }, { q: "퇴사 사유가 실업급여에 영향을 주나요?", a: "자진퇴사는 원칙적으로 수급 제외이며, 권고사직·계약만료 등 비자발적 사유여야 수급 대상이 됩니다." }];
    } else if (view === "leaveapp") {
      fields = [tf(pf("name"), "성명", "홍길동"), tf(pf("dept"), "소속 부서", "마케팅팀"), tf(pf("position"), "직위", "대리"), tf(pf("kind"), "휴가 종류", "예) 연차 / 반차 / 병가"), tf(pf("from"), "시작일", "20XX.XX.XX"), tf(pf("to"), "종료일", "20XX.XX.XX"), tf(pf("days"), "사용 일수", "예) 3일"), tf(pf("reason"), "사유", "예) 개인 사정", "", { area: true }), df(pf("date"), "신청일")];
      doc = [T("연 차 신 청 서"), KV("소속 부서", g("dept")), KV("직위", g("position")), KV("성명", g("name")), SEC("신청 내용"), KV("휴가 종류", g("kind", "연차")), KV("사용 기간", (g("from") || "") + " ~ " + (g("to") || "")), KV("사용 일수", g("days")), SEC("사유"), P(g("reason") || "사유를 입력하세요."), SP(), P("위와 같이 휴가를 신청하오니 승인하여 주시기 바랍니다."), SP(), R(fmtDate(g("date", today()))), RB("신청자 : " + (g("name") || "") + "  (인)"), RB("결재 :          (인)")];
      faqs = [{ q: "연차는 며칠 전에 신청해야 하나요?", a: "법정 기한은 없으나 회사 취업규칙·관행에 따르며, 사업 운영에 막대한 지장이 없으면 근로자가 청구한 시기에 부여해야 합니다." }, { q: "회사가 연차를 거부할 수 있나요?", a: "사용자는 시기변경권만 있고 거부권은 없습니다. 다만 사업 운영에 중대한 지장이 있을 때 시기를 변경할 수 있습니다." }];
    } else if (view === "parttime") {
      fields = [tf(pf("employer"), "사업주(갑)", "○○ 카페 대표 홍길동"), tf(pf("worker"), "근로자(을)", "김알바"), tf(pf("place"), "근무 장소", "○○ 카페 강남점"), tf(pf("duty"), "업무 내용", "예) 매장 서빙 및 계산"), tf(pf("term"), "계약 기간", "예) 20XX.XX.XX ~ 20XX.XX.XX"), tf(pf("days"), "근무일·시간", "예) 주 3일(월·수·금) 10:00~15:00"), tf(pf("wage"), "시급(원)", "10030"), tf(pf("payday"), "임금 지급일", "예) 매월 10일"), df(pf("date"), "작성일")];
      doc = [T("단시간 근로계약서"), KV("사업주(갑)", g("employer")), KV("근로자(을)", g("worker")), SEC("근로 조건"), KV("근무 장소", g("place")), KV("업무 내용", g("duty")), KV("계약 기간", g("term")), KV("근무일·시간", g("days")), KV("시급", (won(g("wage")) || g("wage") || "—") + " 원"), KV("임금 지급일", g("payday")), SP(), P("주휴수당·연장근로수당 등은 근로기준법에 따라 지급하며, 4대보험은 가입 요건 충족 시 가입한다. 본 계약에 없는 사항은 근로기준법을 따른다."), SP(), R(fmtDate(g("date", today()))), RB("사업주(갑) : " + (g("employer") ? "(서명)" : "") + "  (서명)"), RB("근로자(을) : " + (g("worker") || "") + "  (서명)")];
      faqs = [{ q: "알바도 주휴수당을 받나요?", a: "주 15시간 이상 근무하고 결근이 없으면 단시간 근로자도 주휴수당을 받습니다." }, { q: "알바 근로계약서를 안 쓰면?", a: "단시간·기간제 근로자에게 근로조건 서면 명시를 안 하면 사용자에게 최대 500만원의 과태료가 부과될 수 있습니다." }];
    } else if (view === "transdetail") {
      fields = [tf(pf("supplier"), "공급자", "○○ 주식회사"), tf(pf("bizno"), "사업자등록번호", "000-00-00000"), tf(pf("client"), "공급받는 자", "△△ 상사"), tf(pf("items"), "거래 내역", "예) A상품 10개 × 20,000원\nB상품 5개 × 30,000원", "", { area: true }), tf(pf("supply"), "공급가액(원)", "350000"), tf(pf("vat"), "부가세(원)", "35000"), df(pf("date"), "거래일자")];
      doc = [T("거 래 명 세 서"), KV("공급자", g("supplier")), KV("사업자등록번호", g("bizno")), KV("공급받는 자", g("client")), KV("거래일자", fmtDate(g("date", today()))), SEC("거래 내역"), P(g("items") || "거래 내역을 입력하세요."), KV("공급가액", (won(g("supply")) || "0") + " 원"), KV("부가세", (won(g("vat")) || "0") + " 원"), RB("합계 : " + (num(g("supply")) + num(g("vat"))).toLocaleString("ko-KR") + " 원"), SP(), R(fmtDate(g("date", today()))), RB("공급자 : " + (g("supplier") || "") + "  (인)")];
      faqs = [{ q: "거래명세서와 세금계산서 차이는?", a: "거래명세서는 거래 내역 확인용 문서이고, 세금계산서는 부가세 신고·매입세액공제에 쓰이는 세무 증빙입니다." }, { q: "거래명세서에 부가세를 꼭 나눠야 하나요?", a: "공급가액과 부가세를 구분 기재하면 정산·회계 처리가 명확해집니다. 면세 거래는 부가세가 없습니다." }];
    } else if (view === "certmail") {
      fields = [tf(pf("sender"), "발신인 성명", "홍길동"), tf(pf("saddr"), "발신인 주소", "서울시 …", "", { full: true }), tf(pf("receiver"), "수신인 성명", "김철수"), tf(pf("raddr"), "수신인 주소", "서울시 …", "", { full: true }), tf(pf("title"), "제목", "예) 대여금 반환 청구"), tf(pf("body"), "내용", "예) 귀하는 20XX.XX.XX 본인으로부터 금 500만원을 차용하였으나 변제기가 지나도록 이를 반환하지 않고 있습니다. 본 통지 수령 후 14일 이내에 위 금액을 반환하여 주시기 바랍니다.", "", { area: true }), df(pf("date"), "발송일")];
      doc = [T("내 용 증 명"), KV("제목", g("title")), SEC("발신인"), KV("성명", g("sender")), KV("주소", g("saddr")), SEC("수신인"), KV("성명", g("receiver")), KV("주소", g("raddr")), SEC("내용"), P(g("body") || "통지 내용을 입력하세요."), SP(), P("위와 같이 통지합니다."), SP(), R(fmtDate(g("date", today()))), RB("발신인 : " + (g("sender") || "") + "  (인)")];
      faqs = [{ q: "내용증명은 법적 효력이 있나요?", a: "내용증명 자체에 강제력은 없지만, '언제 어떤 내용을 통지했다'는 사실을 우체국이 공적으로 증명해 소송 시 강력한 증거가 됩니다." }, { q: "어떻게 발송하나요?", a: "같은 내용 3부를 작성해 우체국에 제출하면 1부는 발송, 1부는 본인 보관, 1부는 우체국이 보관합니다. 등기로 발송됩니다." }];
    } else if (view === "payslip") {
      fields = [tf(pf("company"), "회사명", "○○ 주식회사"), tf(pf("name"), "성명", "홍길동"), tf(pf("dept"), "소속", "개발팀"), tf(pf("month"), "귀속 월", "예) 20XX년 X월분"), tf(pf("basic"), "기본급(원)", "3000000"), tf(pf("allow"), "제수당(원)", "300000"), tf(pf("pension"), "국민연금(원)", "135000"), tf(pf("health"), "건강보험(원)", "106000"), tf(pf("emp"), "고용보험(원)", "27000"), tf(pf("tax"), "소득세·지방세(원)", "90000"), df(pf("date"), "지급일")];
      var gross = num(g("basic")) + num(g("allow"));
      var ded = num(g("pension")) + num(g("health")) + num(g("emp")) + num(g("tax"));
      doc = [T("급 여 명 세 서"), KV("회사", g("company")), KV("성명", g("name")), KV("소속", g("dept")), KV("귀속", g("month")), SEC("지급 내역"), KV("기본급", won(g("basic")) + " 원"), KV("제수당", won(g("allow")) + " 원"), RB("지급 합계 : " + gross.toLocaleString("ko-KR") + " 원"), SEC("공제 내역"), KV("국민연금", won(g("pension")) + " 원"), KV("건강보험", won(g("health")) + " 원"), KV("고용보험", won(g("emp")) + " 원"), KV("소득세·지방세", won(g("tax")) + " 원"), RB("공제 합계 : " + ded.toLocaleString("ko-KR") + " 원"), SP(), RB("실 지급액 : " + (gross - ded).toLocaleString("ko-KR") + " 원"), SP(), R(fmtDate(g("date", today()))), C((g("company") || "○○ 주식회사"))];
      faqs = [{ q: "급여명세서 교부가 의무인가요?", a: "2021.11.19부터 사용자는 임금 지급 시 구성 항목·계산 방법·공제 내역을 적은 급여명세서를 서면·전자로 교부해야 합니다." }, { q: "명세서를 안 주면?", a: "미교부·허위 기재 시 사용자에게 500만원 이하의 과태료가 부과될 수 있습니다." }];
    } else if (view === "nda") {
      fields = [tf(pf("a"), "정보 제공자(갑)", "○○ 주식회사"), tf(pf("b"), "정보 수령자(을)", "△△ 주식회사"), tf(pf("purpose"), "목적", "예) 사업 제휴 검토를 위한 정보 교환"), tf(pf("scope"), "비밀정보 범위", "예) 기술자료·고객정보·영업비밀 등 서면·구두로 제공한 일체의 정보", "", { area: true }), tf(pf("period"), "비밀유지 기간", "예) 계약 종료 후 3년"), df(pf("date"), "체결일")];
      doc = [T("비밀유지계약서 (NDA)"), KV("정보 제공자(갑)", g("a")), KV("정보 수령자(을)", g("b")), SEC("제1조 (목적)"), P(g("purpose") || "본 계약의 목적을 입력하세요."), SEC("제2조 (비밀정보의 범위)"), P(g("scope") || "비밀정보의 범위를 입력하세요."), SEC("제3조 (의무)"), P("을은 갑의 비밀정보를 목적 외로 사용하지 않으며, 제3자에게 누설하지 않는다. 갑의 사전 서면 동의 없이 복제·배포할 수 없다."), SEC("제4조 (기간)"), KV("비밀유지 기간", g("period", "계약 종료 후 3년")), SEC("제5조 (위반 시 책임)"), P("본 계약 위반으로 갑에게 손해가 발생한 경우 을은 이를 배상한다."), SP(), R(fmtDate(g("date", today()))), RB("갑 : " + (g("a") || "") + "  (인)"), RB("을 : " + (g("b") || "") + "  (인)")];
      faqs = [{ q: "NDA는 언제 체결하나요?", a: "협업·투자·외주·채용 등 영업비밀이나 기술자료를 교환하기 전에 체결해 정보 유출을 예방합니다." }, { q: "일방 NDA와 쌍방 NDA 차이는?", a: "한쪽만 정보를 제공하면 일방(단방향), 서로 정보를 교환하면 쌍방(상호) NDA를 사용합니다. 이 서식은 일방 기준이며 필요 시 양쪽 의무로 수정하세요." }];
    } else if (view === "leaveofabsence") {
      fields = [tf(pf("name"), "성명", "홍길동"), tf(pf("dept"), "소속 부서", "영업1팀"), tf(pf("position"), "직위", "대리"), tf(pf("kind"), "휴직 종류", "예) 육아휴직 / 병가 / 개인휴직"), tf(pf("from"), "휴직 시작일", "20XX.XX.XX"), tf(pf("to"), "휴직 종료일", "20XX.XX.XX"), tf(pf("reason"), "휴직 사유", "예) 자녀 양육을 위하여", "", { area: true }), df(pf("date"), "신청일")];
      doc = [T("휴 직 신 청 서"), KV("소속 부서", g("dept")), KV("직위", g("position")), KV("성명", g("name")), SEC("신청 내용"), KV("휴직 종류", g("kind")), KV("휴직 기간", (g("from") || "") + " ~ " + (g("to") || "")), SEC("사유"), P(g("reason") || "휴직 사유를 입력하세요."), SP(), P("위와 같이 휴직을 신청하오니 승인하여 주시기 바랍니다."), SP(), R(fmtDate(g("date", today()))), RB("신청자 : " + (g("name") || "") + "  (인)"), RB("결재 :          (인)")];
      faqs = [{ q: "휴직 중에도 급여가 나오나요?", a: "회사 규정에 따라 다릅니다. 육아휴직은 고용보험 육아휴직급여, 병가는 회사 규정·상병수당 등을 확인하세요." }, { q: "휴직 기간은 근속연수에 포함되나요?", a: "휴직 종류·회사 규정에 따라 다르며, 육아휴직 기간은 근속기간에 포함하는 것이 원칙입니다." }];
    } else if (view === "recresign") {
      fields = [tf(pf("company"), "회사명", "○○ 주식회사"), tf(pf("name"), "성명", "홍길동"), tf(pf("dept"), "소속·직위", "영업팀 대리"), tf(pf("reason"), "권고 사유", "예) 경영상 사정에 의한 인원 조정", "", { area: true }), tf(pf("last"), "퇴직 예정일", "20XX.XX.XX"), tf(pf("cond"), "위로금·조건(선택)", "예) 위로금 ○개월분 지급"), df(pf("date"), "작성일")];
      doc = [T("권 고 사 직 서"), KV("회사", g("company")), KV("소속·직위", g("dept")), KV("성명", g("name")), SEC("권고 사유"), P(g("reason") || "권고 사유를 입력하세요."), KV("퇴직 예정일", g("last"))].concat(g("cond").trim() ? [KV("퇴직 조건", g("cond"))] : []).concat([SP(), P("본인은 위 사유에 따른 회사의 권고를 수용하여 사직하기로 하며, 위 조건에 합의합니다."), SP(), R(fmtDate(g("date", today()))), RB("근로자 : " + (g("name") || "") + "  (서명)"), RB("사용자 : " + (g("company") || "") + "  (인)")]);
      faqs = [{ q: "권고사직도 실업급여를 받나요?", a: "권고사직은 비자발적 이직으로 보아 원칙적으로 실업급여 수급 대상이 됩니다(이직확인서에 권고사직으로 기재)." }, { q: "자진퇴사와 무엇이 다른가요?", a: "자진퇴사는 본인 의사, 권고사직은 회사의 권고를 수용한 것입니다. 실업급여·위로금에서 차이가 큽니다." }];
    } else if (view === "freelance") {
      fields = [tf(pf("client"), "발주자(갑)", "○○ 주식회사"), tf(pf("worker"), "프리랜서(을)", "홍길동"), tf(pf("work"), "업무 내용", "예) 웹사이트 디자인 및 퍼블리싱", "", { area: true }), tf(pf("period"), "작업 기간", "20XX.XX.XX ~ 20XX.XX.XX"), tf(pf("fee"), "대금(원)", "3000000"), tf(pf("pay"), "지급 방법·시기", "예) 완료 후 7일 내 계좌 이체(원천징수 3.3%)"), df(pf("date"), "체결일")];
      doc = [T("프리랜서 계약서"), KV("발주자(갑)", g("client")), KV("프리랜서(을)", g("worker")), SEC("제1조 (업무 내용)"), P(g("work") || "업무 내용을 입력하세요."), SEC("제2조 (기간)"), KV("작업 기간", g("period")), SEC("제3조 (대금·지급)"), KV("대금", amt(g("fee"))), KV("지급 방법", g("pay")), SEC("제4조 (권리·의무)"), P("을은 선량한 관리자의 주의로 업무를 수행하고, 결과물의 저작권 귀속·수정 범위는 상호 합의한다. 갑은 약정한 대금을 기일에 지급한다."), SP(), R(fmtDate(g("date", today()))), RB("갑 : " + (g("client") || "") + "  (인)"), RB("을 : " + (g("worker") || "") + "  (인)")];
      faqs = [{ q: "프리랜서는 4대보험에 가입하나요?", a: "근로자가 아닌 사업소득자면 4대보험 가입 대상이 아니며, 대금에서 3.3% 원천징수 후 5월 종합소득세로 정산합니다." }, { q: "결과물 저작권은 누구 것인가요?", a: "계약에 명시하지 않으면 창작자(을)에게 있습니다. 갑이 권리를 갖고 싶으면 '저작권 양도' 조항을 명시하세요." }];
    } else if (view === "service") {
      fields = [tf(pf("client"), "발주자(갑)", "○○ 주식회사"), tf(pf("provider"), "수급자(을)", "△△ 주식회사"), tf(pf("work"), "용역 내용", "예) 사옥 청소 용역 / 전산 유지보수", "", { area: true }), tf(pf("period"), "용역 기간", "20XX.XX.XX ~ 20XX.XX.XX"), tf(pf("fee"), "용역 대금(원)", "10000000"), tf(pf("pay"), "대금 지급", "예) 매월 말 익월 지급(VAT 별도)"), df(pf("date"), "체결일")];
      doc = [T("용 역 계 약 서"), KV("발주자(갑)", g("client")), KV("수급자(을)", g("provider")), SEC("제1조 (용역의 내용)"), P(g("work") || "용역 내용을 입력하세요."), SEC("제2조 (기간)"), KV("용역 기간", g("period")), SEC("제3조 (대금 및 지급)"), KV("용역 대금", amt(g("fee"))), KV("지급 방법", g("pay")), SEC("제4조 (의무)"), P("을은 선량한 관리자의 주의로 용역을 성실히 수행하고, 갑은 용역 결과를 검수한 후 대금을 지급한다. 본 계약에 없는 사항은 관계 법령과 상관례에 따른다."), SP(), R(fmtDate(g("date", today()))), RB("갑 : " + (g("client") || "") + "  (인)"), RB("을 : " + (g("provider") || "") + "  (인)")];
      faqs = [{ q: "용역계약과 도급계약 차이는?", a: "용역은 일정 기간 노무·서비스 제공, 도급은 '일의 완성'에 대가를 지급합니다. 유지보수·청소는 보통 용역계약입니다." }, { q: "부가세는 어떻게 하나요?", a: "'VAT 별도/포함'을 명확히 기재하세요. 사업자 간 거래는 세금계산서를 발행합니다." }];
    } else if (view === "supply") {
      fields = [tf(pf("buyer"), "발주자(갑)", "○○ 주식회사"), tf(pf("supplier"), "공급자(을)", "△△ 상사"), tf(pf("item"), "품목·규격·수량", "예) A제품 500개, 규격 …", "", { area: true }), tf(pf("amount"), "공급 대금(원)", "5000000"), tf(pf("deliver"), "납품 기일·장소", "예) 20XX.XX.XX, 갑의 본사 창고"), tf(pf("pay"), "대금 지급", "예) 납품 검수 후 30일 내(VAT 별도)"), df(pf("date"), "체결일")];
      doc = [T("공급(납품) 계약서"), KV("발주자(갑)", g("buyer")), KV("공급자(을)", g("supplier")), SEC("제1조 (품목)"), P(g("item") || "품목·규격·수량을 입력하세요."), SEC("제2조 (대금)"), KV("공급 대금", amt(g("amount"))), KV("지급 방법", g("pay")), SEC("제3조 (납품)"), KV("납품 기일·장소", g("deliver")), SEC("제4조 (검수·하자)"), P("갑은 납품물을 검수하며, 하자가 있으면 을은 지체 없이 교환·보수한다. 을은 납기를 준수하고, 지연 시 지체상금을 부담할 수 있다."), SP(), R(fmtDate(g("date", today()))), RB("갑 : " + (g("buyer") || "") + "  (인)"), RB("을 : " + (g("supplier") || "") + "  (인)")];
      faqs = [{ q: "납기를 어기면 어떻게 되나요?", a: "계약에 지체상금(보통 지연일수 × 요율) 조항을 두면 청구할 수 있습니다. 조항이 없으면 손해배상을 별도로 청구합니다." }, { q: "하자담보 기간은?", a: "품목에 따라 다르며 계약서에 하자보수 기간·범위를 명시하는 것이 안전합니다." }];
    } else if (view === "purchase") {
      fields = [tf(pf("buyer"), "구매자(갑)", "○○ 주식회사"), tf(pf("seller"), "판매자(을)", "△△ 상사"), tf(pf("item"), "물품명·규격·수량", "예) 노트북 10대, 모델 …", "", { area: true }), tf(pf("amount"), "구매 금액(원)", "10000000"), tf(pf("deliver"), "인도 기일·장소", "예) 20XX.XX.XX, 갑 사무실"), tf(pf("warranty"), "보증(선택)", "예) 무상 A/S 1년"), df(pf("date"), "체결일")];
      doc = [T("물품 구매 계약서"), KV("구매자(갑)", g("buyer")), KV("판매자(을)", g("seller")), SEC("제1조 (구매 물품)"), P(g("item") || "물품명·규격·수량을 입력하세요."), SEC("제2조 (금액)"), KV("구매 금액", amt(g("amount")))].concat(g("warranty").trim() ? [KV("보증", g("warranty"))] : []).concat([SEC("제3조 (인도)"), KV("인도 기일·장소", g("deliver")), SEC("제4조 (소유권·위험)"), P("물품의 소유권과 위험은 인도 및 대금 완납 시 을에서 갑으로 이전한다. 하자 발견 시 을은 교환·환불한다."), SP(), R(fmtDate(g("date", today()))), RB("갑 : " + (g("buyer") || "") + "  (인)"), RB("을 : " + (g("seller") || "") + "  (인)")]);
      faqs = [{ q: "소유권은 언제 넘어가나요?", a: "보통 물품 인도와 대금 완납 시 이전하도록 정합니다. 할부·선급 시에는 별도 특약을 둡니다." }, { q: "물품에 하자가 있으면?", a: "민법상 하자담보책임에 따라 교환·대금감액·해제를 청구할 수 있으며, 계약서에 기간을 명시하면 명확합니다." }];
    } else if (view === "mou") {
      fields = [tf(pf("a"), "기관/회사 A(갑)", "○○ 주식회사"), tf(pf("b"), "기관/회사 B(을)", "△△ 재단"), tf(pf("purpose"), "협약 목적", "예) 공동 사업 추진을 위한 상호 협력", "", { area: true }), tf(pf("scope"), "협력 내용", "예) 인력·정보 교류, 공동 마케팅 …", "", { area: true }), tf(pf("period"), "협약 기간", "예) 체결일로부터 1년(자동 연장)"), df(pf("date"), "체결일")];
      doc = [T("업 무 협 약 서 (MOU)"), KV("갑", g("a")), KV("을", g("b")), SEC("제1조 (목적)"), P(g("purpose") || "협약 목적을 입력하세요."), SEC("제2조 (협력 내용)"), P(g("scope") || "협력 내용을 입력하세요."), SEC("제3조 (기간)"), KV("협약 기간", g("period")), SEC("제4조 (효력)"), P("본 협약은 상호 협력의 기본 방향을 정한 것으로 법적 구속력을 갖지 않으며, 구체적 사항은 별도 계약으로 정한다. 양측은 신의성실의 원칙에 따라 협력한다."), SP(), R(fmtDate(g("date", today()))), RB("갑 : " + (g("a") || "") + "  (인)"), RB("을 : " + (g("b") || "") + "  (인)")];
      faqs = [{ q: "MOU는 법적 효력이 있나요?", a: "일반적으로 MOU는 협력 의사를 확인하는 문서로 법적 구속력이 약합니다. 구속력을 원하면 본계약(용역·공급 등)을 별도 체결하세요." }, { q: "MOU와 계약서의 차이는?", a: "MOU는 방향·의지 표명, 계약서는 구체적 권리·의무와 책임을 정합니다." }];
    } else if (view === "consulting") {
      fields = [tf(pf("client"), "의뢰인(갑)", "○○ 주식회사"), tf(pf("consultant"), "컨설턴트(을)", "△△ 컨설팅"), tf(pf("scope"), "컨설팅 범위", "예) 마케팅 전략 수립 및 자문", "", { area: true }), tf(pf("period"), "계약 기간", "20XX.XX.XX ~ 20XX.XX.XX"), tf(pf("fee"), "컨설팅 보수(원)", "5000000"), tf(pf("pay"), "지급 방법", "예) 착수금 50% + 완료 50%"), df(pf("date"), "체결일")];
      doc = [T("컨 설 팅 계 약 서"), KV("의뢰인(갑)", g("client")), KV("컨설턴트(을)", g("consultant")), SEC("제1조 (컨설팅 범위)"), P(g("scope") || "컨설팅 범위를 입력하세요."), SEC("제2조 (기간)"), KV("계약 기간", g("period")), SEC("제3조 (보수)"), KV("컨설팅 보수", amt(g("fee"))), KV("지급 방법", g("pay")), SEC("제4조 (비밀유지·성과)"), P("을은 컨설팅 과정에서 취득한 갑의 정보를 비밀로 유지한다. 산출물의 권리 귀속과 자문의 한계(결과 보장 아님)는 상호 합의한다."), SP(), R(fmtDate(g("date", today()))), RB("갑 : " + (g("client") || "") + "  (인)"), RB("을 : " + (g("consultant") || "") + "  (인)")];
      faqs = [{ q: "컨설팅 결과가 기대에 못 미치면?", a: "컨설팅은 자문·조력이라 특정 성과를 보장하는 계약이 아닌 경우가 많습니다. 성과 기준·보수 연동을 원하면 명시하세요." }, { q: "비밀유지는 어떻게 하나요?", a: "본 계약에 비밀유지 조항을 넣거나 별도 NDA를 함께 체결합니다." }];
    } else if (view === "swdev") {
      fields = [tf(pf("client"), "발주자(갑)", "○○ 주식회사"), tf(pf("dev"), "개발자(을)", "△△ 소프트"), tf(pf("scope"), "개발 범위", "예) 쇼핑몰 웹/앱 개발(기획서 별첨)", "", { area: true }), tf(pf("period"), "개발 기간", "20XX.XX.XX ~ 20XX.XX.XX"), tf(pf("fee"), "개발 대금(원)", "20000000"), tf(pf("pay"), "지급 일정", "예) 착수 30% / 중도 40% / 검수 30%"), tf(pf("warranty"), "하자보수 기간", "예) 검수 후 3개월"), df(pf("date"), "체결일")];
      doc = [T("소프트웨어 개발 계약서"), KV("발주자(갑)", g("client")), KV("개발자(을)", g("dev")), SEC("제1조 (개발 범위)"), P(g("scope") || "개발 범위를 입력하세요."), SEC("제2조 (기간)"), KV("개발 기간", g("period")), SEC("제3조 (대금·지급)"), KV("개발 대금", amt(g("fee"))), KV("지급 일정", g("pay")), SEC("제4조 (검수·하자보수)"), KV("하자보수 기간", g("warranty")), P("갑은 결과물을 검수하고, 을은 하자보수 기간 내 결함을 무상 수정한다."), SEC("제5조 (권리 귀속)"), P("대금 완납 시 결과물의 저작권(을이 보유한 범용 라이브러리 제외)은 갑에게 귀속한다. 소스코드 인도 여부는 상호 합의한다."), SP(), R(fmtDate(g("date", today()))), RB("갑 : " + (g("client") || "") + "  (인)"), RB("을 : " + (g("dev") || "") + "  (인)")];
      faqs = [{ q: "소스코드는 누가 갖나요?", a: "계약에 명시하지 않으면 분쟁이 잦습니다. '대금 완납 시 소스코드 일체를 갑에게 인도·저작권 양도'처럼 구체적으로 정하세요." }, { q: "요구사항이 계속 바뀌면?", a: "범위(기획서)를 별첨하고, 범위 초과 변경은 추가 대금·일정으로 처리한다는 조항을 두세요." }];
    } else if (view === "partnership") {
      fields = [tf(pf("a"), "동업자 A", "홍길동"), tf(pf("b"), "동업자 B", "김철수"), tf(pf("biz"), "사업 내용", "예) 카페 공동 운영", "", { area: true }), tf(pf("capital"), "출자 내역", "예) A 5,000만원 / B 5,000만원", "", { area: true }), tf(pf("ratio"), "손익 분배 비율", "예) A 50% : B 50%"), tf(pf("role"), "역할 분담", "예) A 경영·재무, B 매장 운영"), df(pf("date"), "체결일")];
      doc = [T("동 업 계 약 서"), KV("동업자 A", g("a")), KV("동업자 B", g("b")), SEC("제1조 (사업 내용)"), P(g("biz") || "사업 내용을 입력하세요."), SEC("제2조 (출자)"), P(g("capital") || "출자 내역을 입력하세요."), SEC("제3조 (손익 분배)"), KV("분배 비율", g("ratio")), SEC("제4조 (역할)"), P(g("role") || "역할 분담을 입력하세요."), SEC("제5조 (탈퇴·해산)"), P("동업자의 탈퇴·지분 양도·사업 해산 시 정산 방법은 상호 협의하며, 중요 의사결정은 합의로 정한다."), SP(), R(fmtDate(g("date", today()))), RB("A : " + (g("a") || "") + "  (인)"), RB("B : " + (g("b") || "") + "  (인)")];
      faqs = [{ q: "동업은 어떤 위험이 있나요?", a: "손익·채무를 공동 부담하므로 출자·분배·탈퇴·의사결정·경업금지를 명확히 정해야 분쟁을 예방합니다." }, { q: "지분은 어떻게 정하나요?", a: "출자 비율을 기준으로 하되 노무·역할 기여를 반영해 합의로 정합니다. 반드시 서면화하세요." }];
    } else if (view === "copyright") {
      fields = [tf(pf("owner"), "양도인(저작권자)", "홍길동"), tf(pf("buyer"), "양수인", "○○ 주식회사"), tf(pf("work"), "저작물", "예) 로고 디자인 / 원고 / 사진 …", "", { area: true }), tf(pf("scope"), "양도 범위", "예) 저작재산권 전부(복제·배포·2차저작 포함)"), tf(pf("price"), "양도 대금(원)", "1000000"), df(pf("date"), "체결일")];
      doc = [T("저작권 양도 계약서"), KV("양도인", g("owner")), KV("양수인", g("buyer")), SEC("제1조 (대상 저작물)"), P(g("work") || "저작물을 입력하세요."), SEC("제2조 (양도 범위)"), KV("양도 범위", g("scope", "저작재산권 전부")), SEC("제3조 (대금)"), KV("양도 대금", amt(g("price"))), SEC("제4조 (보증)"), P("양도인은 해당 저작물이 제3자의 권리를 침해하지 않음을 보증한다. 저작인격권은 양도되지 않으며, 양도인은 그 행사를 제한할 수 있다."), SP(), R(fmtDate(g("date", today()))), RB("양도인 : " + (g("owner") || "") + "  (인)"), RB("양수인 : " + (g("buyer") || "") + "  (인)")];
      faqs = [{ q: "저작인격권도 양도되나요?", a: "저작인격권(성명표시·동일성유지 등)은 양도할 수 없습니다. 실무에서는 '인격권을 행사하지 않는다'는 특약을 둡니다." }, { q: "'이용허락'과 '양도'의 차이는?", a: "이용허락(라이선스)은 쓸 권리만 빌려주는 것, 양도는 권리 자체를 넘기는 것입니다. 필요에 맞게 선택하세요." }];
    } else if (view === "transfer") {
      fields = [tf(pf("owner"), "양도인", "홍길동"), tf(pf("buyer"), "양수인", "김철수"), tf(pf("target"), "양도 대상", "예) ○○ 사업체 / 차량 / 권리 등", "", { area: true }), tf(pf("price"), "양도 대금(원)", "10000000"), tf(pf("pay"), "대금 지급", "예) 계약금 10% + 잔금 인도 시"), tf(pf("handover"), "인도일", "20XX.XX.XX"), df(pf("date"), "체결일")];
      doc = [T("양 도 양 수 계 약 서"), KV("양도인", g("owner")), KV("양수인", g("buyer")), SEC("제1조 (양도 대상)"), P(g("target") || "양도 대상을 입력하세요."), SEC("제2조 (대금)"), KV("양도 대금", amt(g("price"))), KV("지급 방법", g("pay")), SEC("제3조 (인도)"), KV("인도일", g("handover")), SEC("제4조 (권리·책임)"), P("양도인은 대상에 대한 정당한 권리를 보유하며 인도일에 일체의 권리를 양수인에게 이전한다. 인도 전 발생한 채무·하자는 양도인이 책임진다."), SP(), R(fmtDate(g("date", today()))), RB("양도인 : " + (g("owner") || "") + "  (인)"), RB("양수인 : " + (g("buyer") || "") + "  (인)")];
      faqs = [{ q: "사업체 양도 시 직원·부채는?", a: "포괄 양수도면 근로관계·채권채무가 함께 승계됩니다. 승계 범위를 계약서에 명확히 하고 관련 동의를 받으세요." }, { q: "명의 이전은 별도인가요?", a: "차량·부동산·사업자 등은 별도의 명의 이전(등록) 절차가 필요합니다. 계약과 별개로 진행하세요." }];
    } else if (view === "privacy") {
      fields = [tf(pf("company"), "사업자/서비스명", "○○ 주식회사"), tf(pf("items"), "수집 항목", "예) 이름, 이메일, 휴대전화번호", "", { area: true }), tf(pf("purpose"), "이용 목적", "예) 회원 관리, 서비스 제공, 문의 응대", "", { area: true }), tf(pf("period"), "보유 기간", "예) 회원 탈퇴 시까지(법령상 별도 보관 제외)"), tf(pf("manager"), "개인정보 보호책임자", "예) 홍길동 (privacy@example.com)"), df(pf("date"), "시행일")];
      doc = [T("개인정보처리방침"), P((g("company") || "○○") + "(이하 '회사')는 이용자의 개인정보를 중요시하며 「개인정보 보호법」을 준수합니다."), SEC("1. 수집하는 개인정보 항목"), P(g("items") || "수집 항목을 입력하세요."), SEC("2. 개인정보의 이용 목적"), P(g("purpose") || "이용 목적을 입력하세요."), SEC("3. 보유 및 이용 기간"), P(g("period", "회원 탈퇴 시까지") + " 보유하며, 관계 법령에 따라 별도 보관이 필요한 경우 해당 기간 동안 보관합니다."), SEC("4. 제3자 제공·처리 위탁"), P("법령에 근거하거나 이용자의 동의가 있는 경우를 제외하고 개인정보를 외부에 제공하지 않습니다."), SEC("5. 이용자의 권리"), P("이용자는 언제든지 개인정보 열람·정정·삭제·처리정지를 요구할 수 있습니다."), SEC("6. 개인정보 보호책임자"), KV("보호책임자", g("manager")), SP(), KV("시행일", fmtDate(g("date", today())))];
      faqs = [{ q: "개인정보처리방침은 의무인가요?", a: "개인정보를 처리하는 사업자는 개인정보처리방침을 수립·공개해야 합니다(개인정보 보호법 제30조)." }, { q: "이 서식만으로 충분한가요?", a: "핵심 항목을 담은 표준 초안입니다. 쿠키·마케팅 활용·국외 이전 등이 있으면 항목을 추가하고 법률 검토를 받으세요." }];
    } else if (view === "terms") {
      fields = [tf(pf("service"), "서비스명", "○○ 서비스"), tf(pf("company"), "운영자(회사)", "○○ 주식회사"), tf(pf("desc"), "서비스 내용", "예) 온라인 정보 제공 및 커뮤니티", "", { area: true }), tf(pf("paid"), "유료 여부·환불", "예) 일부 유료, 환불은 관련 법령에 따름"), df(pf("date"), "시행일")];
      doc = [T("이 용 약 관"), SEC("제1조 (목적)"), P("본 약관은 " + (g("company") || "회사") + "(이하 '회사')가 제공하는 " + (g("service") || "서비스") + "(이하 '서비스')의 이용 조건과 절차, 회사와 이용자의 권리·의무를 규정함을 목적으로 합니다."), SEC("제2조 (서비스의 내용)"), P(g("desc") || "서비스 내용을 입력하세요."), SEC("제3조 (이용계약)"), P("이용계약은 이용자가 약관에 동의하고 회사가 이를 승낙함으로써 성립합니다."), SEC("제4조 (이용자의 의무)"), P("이용자는 관계 법령과 본 약관을 준수하며, 타인의 권리를 침해하거나 서비스 운영을 방해하는 행위를 하여서는 안 됩니다."), SEC("제5조 (유료·환불)"), P(g("paid", "유료 서비스의 환불은 관계 법령 및 회사의 환불정책에 따릅니다.")), SEC("제6조 (책임 제한)"), P("회사는 천재지변, 이용자의 귀책 등 회사의 통제를 벗어난 사유로 인한 손해에 대해 책임을 지지 않습니다."), SP(), KV("시행일", fmtDate(g("date", today())))];
      faqs = [{ q: "이용약관은 꼭 있어야 하나요?", a: "법적 의무는 아니지만, 서비스 운영·분쟁 예방을 위해 필수적입니다. 유료 서비스는 환불·청약철회 규정을 반드시 포함하세요." }, { q: "약관을 바꾸려면?", a: "변경 시 시행일 7일(이용자 불리한 변경은 30일) 전 공지해야 하며, 미동의 시 해지할 수 있게 안내합니다." }];
    }
    return { fields: fields, doc: doc, faqs: faqs };
  }

  // 문서 블록 → HTML. mode 'screen'(Tailwind, 미리보기) | 'word'(inline 스타일, 다운로드)
  function sheetHtml(doc, mode) {
    var word = mode === "word";
    return doc
      .map(function (b) {
        if (b.t === "title") {
          return word
            ? '<div style="text-align:center;font-size:22pt;font-weight:800;letter-spacing:8px;margin:0 0 28px">' + esc(b.text) + "</div>"
            : '<div class="mb-8 text-center text-[24px] font-extrabold tracking-[0.35em] text-zinc-900">' + esc(b.text) + "</div>";
        }
        if (b.t === "kv") {
          return word
            ? '<table style="width:100%;border-collapse:collapse;margin:2px 0"><tr><td style="width:110px;font-weight:700;color:#555;font-size:11pt;vertical-align:top;padding:3px 0">' + esc(b.k) + '</td><td style="font-size:11pt;border-bottom:1px solid #ccc;padding:3px 0;white-space:pre-wrap">' + esc(b.v) + "</td></tr></table>"
            : '<div class="flex items-start gap-3 py-[5px] text-[13.5px] leading-relaxed"><span class="w-24 flex-none font-bold text-zinc-500">' + esc(b.k) + '</span><span class="min-w-0 flex-1 whitespace-pre-wrap border-b border-zinc-200 pb-1 text-zinc-900">' + esc(b.v) + "</span></div>";
        }
        if (b.t === "para") {
          if (word) {
            var st = "font-size:" + (b.section ? "12pt" : "11pt") + ";line-height:1.9;white-space:pre-wrap;margin:" + (b.section ? "14px 0 2px" : "3px 0") + ";";
            if (b.section || b.bold) st += "font-weight:700;";
            if (b.align) st += "text-align:" + b.align + ";";
            st += "color:#1a1a1a;";
            return '<div style="' + st + '">' + esc(b.text) + "</div>";
          }
          var cls = "whitespace-pre-wrap ";
          if (b.section) cls += "mt-4 mb-1 text-[14px] font-bold text-zinc-900";
          else if (b.align === "right") cls += "py-0.5 text-right text-[" + (b.bold ? "14px] font-bold" : "13.5px]") + " text-zinc-900";
          else if (b.align === "center") cls += "text-center text-[14px] font-bold text-zinc-900";
          else cls += "py-1 text-[13.5px] leading-[1.9] text-zinc-800";
          return '<div class="' + cls + '">' + esc(b.text) + "</div>";
        }
        if (b.t === "sp") return word ? '<div style="height:16px"></div>' : '<div class="h-4"></div>';
        return "";
      })
      .join("");
  }

  // 선택 서식을 blank 상태로 Word(.doc) 파일 다운로드 — 오프라인에서 채워 쓰는 양식 템플릿
  function download(view) {
    var title = TITLES[view] || "문서";
    var body = sheetHtml(build(view, {}).doc, "word");
    var html =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8">' +
      "<title>" + esc(title) + "</title>" +
      '<style>@page{size:A4;margin:20mm} body{font-family:"Malgun Gothic","맑은 고딕",sans-serif;color:#1a1a1a}</style>' +
      '</head><body><div style="max-width:640px;margin:0 auto">' + body + "</div></body></html>";
    var blob = new Blob(["﻿" + html], { type: "application/msword;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = title + "_양식.doc";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  window.H2BDocs = { titles: TITLES, build: build, sheetHtml: sheetHtml, download: download, today: today, esc: esc };
})();
