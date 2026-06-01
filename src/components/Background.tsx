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
      case 'deep':
        return 'bg-gradient-flow-deep';
      case 'calm':
        return 'bg-gradient-reset';
      case 'pressure':
        return 'bg-gradient-close-strong';
      case 'frustration':
        return 'bg-gradient-flow-deep frustration-breathe';
      case 'muted':
        return 'bg-gradient-flow-deep opacity-60';
      default:
        return 'bg-gradient-flow-deep';
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-0 pointer-events-none ${getGradientClass()} ${className}`}
      aria-hidden="true"
    />
  );
};
