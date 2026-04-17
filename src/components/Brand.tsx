import { cn } from "@/lib/utils";

interface BrandProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Brand({ className, size = "md" }: BrandProps) {
  const sizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl",
    xl: "text-6xl md:text-7xl",
  };
  return (
    <div className={cn("brand-title font-bold leading-none", sizes[size], className)}>
      <span>CORPORE</span>
      <span className="brand-accent">10</span>
    </div>
  );
}
