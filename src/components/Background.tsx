/**
 * Shared animated background component
 * Renders the premium gradient + grain as a purely decorative layer
 * Always use z-0 and pointer-events-none to prevent blocking content
 */

interface BackgroundProps {
  variant?: 'default' | 'deep' | 'calm' | 'pressure' | 'frustration' | 'muted';
  className?: string;
}

export const Background = ({ variant = 'default', className = '' }: BackgroundProps) => {
  const getGradientClass = () => {
    switch (variant) {
      // Immersive dark pages (Coach Mode, auth) keep a deep background.
      case 'deep':
        return 'bg-gradient-flow-deep';
      case 'pressure':
        return 'bg-gradient-close-strong';
      // Light, calm sand background — the default app surface.
      case 'calm':
      case 'frustration':
      case 'muted':
      default:
        return 'bg-gradient-flow';
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-0 pointer-events-none ${getGradientClass()} ${className}`}
      aria-hidden="true"
    />
  );
};
