import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * 에러 경계 — 렌더 중 예외가 나도 **백지 화면**은 띄우지 않는다.
 *
 * 실제 사고: 다크 모드가 렌더 전에 localStorage를 읽었는데 브라우저 스토리지 오류가 나면서
 * 관리자 화면 전체가 백지가 됐다. 화면이 하얗게 뜨면 사용자는 원인을 알 방법이 없다.
 * 최소한 **무엇이 터졌는지 보여주고 다시 시도할 길**은 남겨야 한다.
 */
interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-bold">화면을 그리는 중 오류가 발생했습니다</h1>
        <p className="max-w-lg text-sm text-muted-foreground">{error.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          새로고침
        </button>
      </div>
    );
  }
}
