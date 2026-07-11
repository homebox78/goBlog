import { Card, CardContent } from "@/components/ui/card";

export default function ArticlesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">글 관리</h1>
        <p className="text-sm text-muted-foreground">
          Claude가 작성한 글의 초안·검수·발행 상태와 버전 히스토리를 관리합니다.
        </p>
      </div>
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          3단계(콘텐츠 엔진)에서 구현됩니다.
        </CardContent>
      </Card>
    </div>
  );
}
