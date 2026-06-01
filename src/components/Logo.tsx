import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
}

/**
 * Abstract minimalist logo representing calm, precision, and focus.
 * Three concentric arcs suggesting breath, centering, and flow.
 */
export const Logo = ({ className, size = "md", variant = "dark" }: LogoProps) => {
  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  };

  const strokeColor = variant === "dark" 
    ? "stroke-[hsl(158_38%_22%)]" 
    : "stroke-[hsl(150_15%_90%)]";

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(sizeClasses[size], className)}
    >
      {/* Outer arc - representing awareness/environment */}
      <path
        d="M 12 32 A 20 20 0 0 1 52 32"
        className={cn(strokeColor, "opacity-30")}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      
      {/* Middle arc - representing process/commitment */}
      <path
        d="M 18 32 A 14 14 0 0 1 46 32"
        className={cn(strokeColor, "opacity-55")}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      
      {/* Inner arc - representing focus/present moment */}
      <path
        d="M 24 32 A 8 8 0 0 1 40 32"
        className={cn(strokeColor, "opacity-85")}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      
      {/* Center point - the moment of clarity */}
      <circle
        cx="32"
        cy="32"
        r="2"
        className={cn(
          variant === "dark" 
            ? "fill-[hsl(158_38%_22%)]" 
            : "fill-[hsl(150_15%_90%)]"
        )}
      />
    </svg>
  );
};

export default Logo;