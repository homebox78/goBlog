import { Card, CardContent } from "@/components/ui/card";

export default function KeywordsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">오늘의 키워드</h1>
        <p className="text-sm text-muted-foreground">
          매일 오전 7시(KST)에 실시간 이슈·트렌드 데이터에서 수익 키워드를 자동 발굴합니다.
        </p>
      </div>
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          2단계(키워드 수집 엔진)에서 구현됩니다.
          <br />
          설정에서 Google Ads API를 먼저 연결해주세요.
        </CardContent>
      </Card>
    </div>
  );
}
