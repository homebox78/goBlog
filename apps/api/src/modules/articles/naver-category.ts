/**
 * 네이버 블로그에 만들 고정 카테고리 세트 + 글 주제 → 카테고리 매핑.
 * 키워드 category는 AI가 자유 텍스트로 붙여(예: IT/금융/생활) 그대로 쓰면 카테고리가 난립한다.
 * 사용자가 네이버에 한 번만 만들면 되도록, 모든 글을 아래 고정 세트 중 하나로 매핑한다.
 */
export const NAVER_CATEGORIES = [
  "IT·디지털",
  "재테크·금융",
  "건강·헬스",
  "생활·살림",
  "쇼핑·리뷰",
  "여행·맛집",
  "뷰티·패션",
  "트렌드·이슈",
] as const;

export type NaverCategory = (typeof NAVER_CATEGORIES)[number];

// 구체적인 규칙을 먼저 둔다(아이폰 후기 → 쇼핑이 아니라 IT). 마지막은 기본값 트렌드·이슈.
const RULES: Array<{ cat: NaverCategory; re: RegExp }> = [
  { cat: "IT·디지털", re: /it|디지털|아이폰|갤럭시|노트북|컴퓨터|pc|가전|테크|스마트폰|스마트워치|앱|전자제품|반도체|ai|인공지능|카메라|이어폰|태블릿/i },
  { cat: "재테크·금융", re: /금융|재테크|주식|부동산|대출|신용카드|보험|연금|환율|투자|세금|적금|예금|코인|비트코인|청약|지원금|보조금/i },
  { cat: "건강·헬스", re: /건강|헬스|다이어트|운동|영양제|질병|의료|병원|치료|수면|숙면|피부질환|스트레스|혈압|혈당|면역/i },
  { cat: "여행·맛집", re: /여행|맛집|호텔|항공권|숙소|캠핑|국내여행|해외여행|카페|축제|관광|펜션/i },
  { cat: "뷰티·패션", re: /뷰티|화장품|패션|의류|코디|스킨케어|메이크업|향수|신발|가방|헤어/i },
  { cat: "생활·살림", re: /생활|살림|청소|주방|정리수납|육아|반려|인테리어|절약|꿀팁|세탁|주방용품|생필품/i },
  { cat: "쇼핑·리뷰", re: /쇼핑|리뷰|후기|추천템|구매|가성비|best|비교|언박싱|특가|할인/i },
];

/** 키워드 카테고리(자유 텍스트) + 키워드/제목 텍스트로 고정 네이버 카테고리를 정한다. */
export function suggestNaverCategory(category: string | null | undefined, text: string | null | undefined): NaverCategory {
  const hay = `${category ?? ""} ${text ?? ""}`;
  for (const rule of RULES) {
    if (rule.re.test(hay)) return rule.cat;
  }
  return "트렌드·이슈";
}
