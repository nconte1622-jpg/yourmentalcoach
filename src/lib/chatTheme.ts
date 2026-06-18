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
      return {
        user: "rounded-3xl rounded-br-xl px-6 py-5 bg-[rgba(45,106,79,0.06)] border border-[rgba(45,106,79,0.1)]",
        coach: "rounded-3xl rounded-bl-xl px-6 py-5 bg-white/90 backdrop-blur-sm border border-[rgba(45,106,79,0.06)]",
        userText: "text-[#1a1a1a]",
        coachText: "text-[rgba(26,26,26,0.85)]",
      };

    case "frustration":
      return {
        user: "rounded-3xl rounded-br-xl px-6 py-5 bg-[rgba(45,106,79,0.08)]",
        coach: "rounded-3xl rounded-bl-xl px-6 py-5 bg-gradient-to-br from-white to-[rgba(45,106,79,0.04)] border border-[rgba(45,106,79,0.08)] glow-calm animate-breathe",
        userText: "text-[#1a1a1a]",
        coachText: "text-[rgba(26,26,26,0.8)]",
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
      return {
        wrapper: "bg-white/80 backdrop-blur-sm border border-[rgba(45,106,79,0.1)]",
        input: "bg-white/90 text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.35)] focus:ring-1 focus:ring-[#2d6a4f]/15",
        button: "bg-[#2d6a4f] hover:bg-[#245a42] text-white",
        placeholder: "text-[rgba(26,26,26,0.35)]",
      };

    case "frustration":
      return {
        wrapper: "bg-white/70 border border-[rgba(45,106,79,0.08)]",
        input: "bg-white/80 text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.3)] focus:ring-1 focus:ring-[#2d6a4f]/15",
        button: "bg-[#2d6a4f] hover:bg-[#245a42] text-white shadow-lg shadow-[#2d6a4f]/15",
        placeholder: "text-[rgba(26,26,26,0.3)]",
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
