/**
 * 백과사전 그라운딩 — **드라마·영화·예능·인물 같은 '사실 콘텐츠'를 지어내지 않게** 막는다.
 *
 * 왜 필요한가 (2026-07-15 실제 사고):
 *   '참교육 드라마 줄거리 결말' 글이 그라운딩 0건 상태에서 생성돼, 주인공 이름(한정호)·배우(이이경)·
 *   결말이 **전부 허구**로 발행됐다. 실제는 나화진·이성민·조규철이다.
 *   원인: 그라운딩이 '네이버 뉴스 검색'뿐이었는데, 드라마 줄거리·인물은 뉴스가 아니라 백과사전에 있다.
 *
 * 해법: 주제가 사실 검증이 필요한 종류(드라마·영화·예능·인물 등)면, 위키백과에서 개요·기본정보를 받아
 *   프롬프트에 '유일한 근거'로 주입한다. Claude가 기억으로 지어내는 대신 이 사실만 쓰게 한다.
 *
 * ⚠️ 나무위키가 더 상세하지만 스크래핑을 강하게 차단(403)한다. 위키백과는 공식 API가 있어 안정적이다.
 *   위키백과 개요는 짧지만, **최소한 제목·방송사·공개일·기본 성격은 사실로 못박아** 통째 창작을 막는다.
 */

/** 사실 검증이 특히 중요한 주제인지 — 드라마·영화·예능·연예·인물·스포츠 등 */
const FACT_SENSITIVE =
  /(드라마|영화|예능|시즌|방영|방송|넷플릭스|디즈니|티빙|웨이브|왓챠|배우|가수|아이돌|그룹|멤버|출연|주연|감독|웹툰|애니|만화|소설|줄거리|결말|등장인물|출연진|캐스팅|시청률|개봉|공개일|OST|앨범|데뷔|은퇴|열애|결혼|이혼|선수|구단|경기|우승)/;

export interface EncyclopediaFact {
  title: string; // 위키백과 문서 제목
  summary: string; // 개요(사실)
  url: string; // 출처
}

/** 이 주제에 백과사전 사실 확인이 필요한가 */
export function needsEncyclopedia(topic: string): boolean {
  return FACT_SENSITIVE.test(topic);
}

interface WikiSearchHit {
  title: string;
}

/** 검색 잡음 낱말 — 문서 제목엔 안 들어가고 검색을 흐리게 한다 */
const NOISE = /^(줄거리|결말|등장인물|출연진|리뷰|정보|총정리|정리|스포|후기|관계도|드라마|영화|예능|몇부작|회차)$/;

/**
 * 검색어를 문서명에 가깝게 정리한다.
 * "참교육 드라마 줄거리 결말" → "참교육" (잡음 낱말 제거, 핵심 명사만)
 * 원문도 함께 시도하되, **핵심 명사를 우선**한다.
 */
function searchQueries(topic: string): string[] {
  const words = topic.split(/\s+/).filter(Boolean);
  const core = words.filter((w) => !NOISE.test(w));
  return [...new Set([core.join(" "), topic])].filter((q) => q.length >= 2);
}

/** 검색 결과 제목이 이 주제와 실제로 관련 있는가 — 핵심 명사가 제목에 들어가야 한다 */
function isRelevant(topic: string, docTitle: string): boolean {
  const core = topic.split(/\s+/).filter((w) => !NOISE.test(w));
  // 핵심 명사 중 하나라도 문서 제목에 포함돼야 신뢰한다
  // (예: 주제 "참교육 드라마"의 핵심 '참교육'이 문서 제목 "참교육"·"참교육 (드라마)"에 있으면 OK)
  return core.some((w) => w.length >= 2 && docTitle.includes(w));
}

/**
 * 위키백과에서 주제의 개요를 가져온다. 없거나 관련 문서가 아니면 null.
 * @param topic 키워드 (예: "참교육 드라마 줄거리 결말")
 */
export async function fetchEncyclopedia(topic: string): Promise<EncyclopediaFact | null> {
  const query = topic.trim();
  if (!query) return null;

  try {
    // 1) 핵심 명사로 검색해 실제 문서 제목을 찾는다 (긴 문구를 그대로 던지면 엉뚱한 문서가 1등이 된다)
    let docTitle: string | null = null;
    for (const q of searchQueries(query)) {
      const searchUrl =
        "https://ko.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=5&srsearch=" +
        encodeURIComponent(q);
      const searchRes = await fetch(searchUrl, {
        headers: { "User-Agent": "goBlog/1.0 (blog content grounding)" },
        signal: AbortSignal.timeout(10000),
      });
      if (!searchRes.ok) continue;
      const searchData = (await searchRes.json()) as { query?: { search?: WikiSearchHit[] } };
      const hits = searchData.query?.search ?? [];
      // ⚠️ 첫 결과를 무조건 믿지 않는다 — **핵심 명사가 제목에 든 문서**만 채택한다.
      //    (실측: "참교육 드라마 줄거리 결말" 검색 1등이 엉뚱하게 "타임슬립 닥터 진"이었다.
      //     그걸 근거로 주면 또 다른 허위가 된다. 관련 없으면 차라리 근거 없음으로 두는 게 안전하다.)
      const match = hits.find((h) => isRelevant(query, h.title));
      if (match) {
        docTitle = match.title;
        break;
      }
    }
    if (!docTitle) return null;

    // 2) 그 문서의 개요(intro)를 평문으로 가져온다
    const extractUrl =
      "https://ko.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=" +
      encodeURIComponent(docTitle);
    const extractRes = await fetch(extractUrl, {
      headers: { "User-Agent": "goBlog/1.0 (blog content grounding)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!extractRes.ok) return null;
    const extractData = (await extractRes.json()) as {
      query?: { pages?: Record<string, { extract?: string }> };
    };
    const pages = extractData.query?.pages ?? {};
    const page = Object.values(pages)[0];
    const summary = (page?.extract ?? "").trim();
    if (summary.length < 20) return null; // 너무 짧으면 신호로 못 쓴다

    return {
      title: docTitle,
      summary: summary.slice(0, 1500),
      url: `https://ko.wikipedia.org/wiki/${encodeURIComponent(docTitle)}`,
    };
  } catch {
    // 백과사전을 못 구해도 글 생성이 막히면 안 된다 — 대신 프롬프트가 '지어내지 마라'로 막는다
    return null;
  }
}
