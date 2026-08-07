import * as React from "react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * Teil 26b: der bislang fehlende siebte Zustand — bewusst schlicht, kein Ornament.
 * Der Text selbst trägt die Ehrlichkeit ("Die ersten Häuser ziehen ein."), nicht die Form.
 */
const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col items-center gap-3 border border-dashed border-border px-6 py-16 text-center", className)}
      {...props}
    >
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <p className="font-serif text-lg">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  ),
);
EmptyState.displayName = "EmptyState";

export { EmptyState };
