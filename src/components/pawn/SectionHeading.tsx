import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeading({ eyebrow, title, description, align = "left", className }: SectionHeadingProps) {
  return (
    <div className={cn(align === "center" && "text-center", className)}>
      {eyebrow && <p className="editorial-eyebrow">{eyebrow}</p>}
      <h2 className="mt-3 font-serif text-4xl leading-[1.05] md:text-5xl">{title}</h2>
      {description && (
        <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">{description}</p>
      )}
    </div>
  );
}
