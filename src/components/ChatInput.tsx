import { useState, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getInputClasses, ChatTheme } from "@/lib/chatTheme";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  isFrustrationMode?: boolean;
  theme?: ChatTheme;
  className?: string;
  inputClassName?: string;
  sendButtonClassName?: string;
}

export function ChatInput({ 
  onSend, 
  disabled = false, 
  placeholder = "What's on your mind?", 
  isFrustrationMode = false,
  theme,
  className,
  inputClassName,
  sendButtonClassName,
}: ChatInputProps) {
  const [message, setMessage] = useState("");

  // Determine theme - use prop if provided, otherwise derive from frustration mode
  const activeTheme: ChatTheme = theme || (isFrustrationMode ? "frustration" : "default");
  const inputClasses = getInputClasses(activeTheme);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div 
      className={cn(
        "flex items-end gap-4 p-5 rounded-3xl backdrop-blur-sm transition-all duration-300",
        inputClasses.wrapper,
        className
      )}
    >
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "min-h-[52px] max-h-32 resize-none rounded-2xl text-base border-0 transition-all duration-300",
          inputClasses.input,
          inputClassName
        )}
        rows={1}
      />
      <Button
        onClick={handleSend}
        disabled={!message.trim() || disabled}
        size="icon"
        className={cn(
          "h-12 w-12 rounded-full transition-all duration-300 shrink-0 tap-44",
          inputClasses.button,
          sendButtonClassName
        )}
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
