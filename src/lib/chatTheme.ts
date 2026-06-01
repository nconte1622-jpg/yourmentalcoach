/**
 * Centralized chat bubble and input theming
 * Ensures consistent styling across all modes (Round, Reset, Close Strong, Frustration)
 */

export type ChatTheme = "default" | "dark" | "frustration";

interface BubbleClasses {
  user: string;
  coach: string;
  userText: string;
  coachText: string;
}

interface InputClasses {
  wrapper: string;
  input: string;
  button: string;
  placeholder: string;
}

/**
 * Get bubble classes for a given theme
 * @param theme - The current UI theme
 * @returns Object with user and coach bubble classes
 */
export function getBubbleClasses(theme: ChatTheme): BubbleClasses {
  switch (theme) {
    case "dark":
      // Close Strong and other dark-themed modes
      return {
        user: "rounded-3xl rounded-br-xl px-6 py-5 bg-[hsl(260_15%_18%)] border border-white/10",
        coach: "rounded-3xl rounded-bl-xl px-6 py-5 bg-white/10 backdrop-blur-sm border border-white/5",
        userText: "text-white",
        coachText: "text-white/90",
      };
    
    case "frustration":
      // Frustration mode - softer, calmer colors
      return {
        user: "rounded-3xl rounded-br-xl px-6 py-5 bg-[hsl(160_18%_12%)]",
        coach: "rounded-3xl rounded-bl-xl px-6 py-5 bg-gradient-to-br from-[hsl(158_25%_14%)] to-[hsl(155_22%_16%)] glow-calm animate-breathe",
        userText: "text-[hsl(150_12%_88%)]",
        coachText: "text-[hsl(150_14%_90%)]",
      };
    
    default:
      // Standard light theme (Round, Home, etc.)
      return {
        user: "chat-bubble-user",
        coach: "chat-bubble-coach",
        userText: "text-chat-user-foreground",
        coachText: "text-chat-coach-foreground",
      };
  }
}

/**
 * Get input classes for a given theme
 * @param theme - The current UI theme
 * @returns Object with input styling classes
 */
export function getInputClasses(theme: ChatTheme): InputClasses {
  switch (theme) {
    case "dark":
      // Close Strong and other dark-themed modes
      return {
        wrapper: "bg-white/5 backdrop-blur-sm border border-white/10",
        input: "bg-white/10 text-white placeholder:text-white/40 focus:ring-1 focus:ring-white/20",
        button: "bg-white/20 hover:bg-white/30 text-white",
        placeholder: "text-white/40",
      };
    
    case "frustration":
      // Frustration mode
      return {
        wrapper: "bg-[hsl(160_18%_10%)]/60",
        input: "bg-[hsl(160_15%_12%)]/80 text-[hsl(150_12%_88%)] placeholder:text-white/35 focus:ring-1 focus:ring-[hsl(195_25%_40%)]/30",
        button: "bg-[hsl(195_25%_32%)] hover:bg-[hsl(195_28%_38%)] text-white shadow-lg shadow-[hsl(195_30%_20%)]/20",
        placeholder: "text-white/35",
      };
    
    default:
      // Standard theme
      return {
        wrapper: "card-floating",
        input: "input-flow focus:ring-1 focus:ring-primary/15",
        button: "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25",
        placeholder: "text-muted-foreground/35",
      };
  }
}

/**
 * Determine the theme based on page/mode context
 */
export function getThemeFromContext(options: {
  isDarkMode?: boolean;
  isFrustrationMode?: boolean;
  isCloseStrong?: boolean;
  isReset?: boolean;
}): ChatTheme {
  if (options.isFrustrationMode) return "frustration";
  if (options.isCloseStrong || options.isDarkMode) return "dark";
  return "default";
}
