import { ReactNode } from 'react';
import { Background } from './Background';

/**
 * Shared page shell component
 * Provides consistent layout with animated background behind content
 * Background is z-0, content is z-10
 */

interface PageShellProps {
  children: ReactNode;
  backgroundVariant?: 'default' | 'deep' | 'calm' | 'pressure' | 'frustration' | 'muted';
  className?: string;
}

export const PageShell = ({
  children,
  backgroundVariant = 'default',
  className = ''
}: PageShellProps) => {
  return (
    <>
      <Background variant={backgroundVariant} />
      {/* h-[100dvh] caps the shell at exactly the visible viewport so content
          can't grow off-screen. overflow-y-auto enables smooth in-shell scroll
          instead of the document scrolling (which is locked in scroll-fixes.css). */}
      <main
        className={`relative z-10 h-[100dvh] overflow-y-auto overflow-x-hidden ${className}`}
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          transform: 'translateZ(0)',
          willChange: 'scroll-position',
        }}
      >
        {children}
      </main>
    </>
  );
};
