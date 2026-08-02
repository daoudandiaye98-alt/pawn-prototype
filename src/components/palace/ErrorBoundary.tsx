import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Kurzer Klartext, was hier nicht geladen werden konnte. */
  label?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Fehlerbrücke: Ein einzelner Baustein darf nie die ganze Seite weiß machen.
 * Stattdessen bleibt der Rest der Seite stehen und hier steht ein ehrlicher Satz.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[PAWN] Baustein konnte nicht dargestellt werden:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <div className="border border-[rgba(0,0,0,.18)] p-6">
        <p className="palace-eyebrow">Hinweis</p>
        <p className="mt-3 font-serif italic text-[1rem] text-[#000000]/70">
          {this.props.label ?? "Dieser Abschnitt lässt sich gerade nicht darstellen."}
        </p>
      </div>
    );
  }
}
