import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

// Teil 26b: hover ist überall Invertierung (schwarz↔weiß), nie Opacity — das Haus-Gesetz
// gilt jetzt auch für die generische Bibliothek, nicht nur für die Editorial-Seiten.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-background hover:text-foreground border border-primary",
        destructive: "bg-destructive text-destructive-foreground hover:bg-background hover:text-destructive border border-destructive",
        outline: "border border-input bg-background hover:bg-foreground hover:text-background",
        secondary: "bg-secondary text-secondary-foreground border border-input hover:bg-foreground hover:text-background",
        ghost: "hover:bg-foreground hover:text-background",
        link: "text-primary underline-offset-4 hover:underline",
        // Ersetzt .palace-btn (Teil 26b) — bewusst ohne feste Höhe, Padding kommt aus size="chip".
        editorial: "border-[1.5px] border-black bg-white text-black gap-[.6rem] text-[0.65rem] uppercase tracking-[.36em] font-medium hover:bg-black hover:text-white",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        // Ersetzt .palace-btn's Padding-getriebene Höhe — kein h-* hier, damit nichts mit
        // dem festen Höhen-Raster der anderen Größen kollidiert.
        chip: "h-auto px-[1.4rem] py-[.8rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? children : (
          <>
            {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
