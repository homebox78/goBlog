import { Card, CardContent } from "@/components/ui/card";

export default function SchedulePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">스케줄</h1>
        <p className="text-sm text-muted-foreground">
          키워드 수집·글 생성·예약 발행 일정을 관리합니다.
        </p>
      </div>
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          5단계(게시 시스템)에서 구현됩니다.
        </CardContent>
      </Card>
    </div>
  );
}
