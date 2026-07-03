import { ReactNode } from "react";
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicHeader />
      {/* No top padding here — hero sections opt into their own pt-32 so the nav
          can float transparent over marble. Non-home pages add their own gap. */}
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
