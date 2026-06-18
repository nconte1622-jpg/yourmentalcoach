import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/haptics';
import { saveHoleMood, getHoleMoods, getHoleMood, type MoodType } from '@/lib/holeMoods';

interface HoleMoodTrackerProps {
  roundId: string;
  className?: string;
}

interface MoodOption {
  type: MoodType;
  emoji: string;
  label: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  dotColor: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  {
    type: 'locked',
    emoji: '🔥',
    label: 'Locked In',
    activeBg: 'rgba(45,106,79,0.1)',
    activeBorder: 'rgba(45,106,79,0.3)',
    activeText: '#2d6a4f',
    dotColor: '#4eb87a',
  },
  {
    type: 'steady',
    emoji: '😐',
    label: 'Steady',
    activeBg: 'rgba(140,130,100,0.1)',
    activeBorder: 'rgba(140,130,100,0.3)',
    activeText: '#6b6040',
    dotColor: '#a09060',
  },
  {
    type: 'frustrated',
    emoji: '😤',
    label: 'Off',
    activeBg: 'rgba(200,120,30,0.1)',
    activeBorder: 'rgba(200,120,30,0.3)',
    activeText: '#b06820',
    dotColor: '#d4922a',
  },
];

export function HoleMoodTracker({ roundId, className }: HoleMoodTrackerProps) {
  const [currentHole, setCurrentHole] = useState(1);
  // Map of hole → mood for all logged holes
  const [loggedMoods, setLoggedMoods] = useState<Record<number, MoodType>>({});
  // Hole that was just tapped — triggers flash highlight, clears after 1.5s
  const [flashHole, setFlashHole] = useState<number | null>(null);

  // Load persisted moods on mount
  useEffect(() => {
    const moods = getHoleMoods(roundId);
    const map: Record<number, MoodType> = {};
    moods.forEach((m) => { map[m.hole] = m.mood; });
    setLoggedMoods(map);
  }, [roundId]);

  const handleMoodTap = useCallback((mood: MoodType) => {
    triggerHaptic('soft');
    saveHoleMood(roundId, currentHole, mood);
    setLoggedMoods((prev) => ({ ...prev, [currentHole]: mood }));
    setFlashHole(currentHole);
    setTimeout(() => setFlashHole(null), 1500);
  }, [roundId, currentHole]);

  const prevHole = () => setCurrentHole((h) => Math.max(1, h - 1));
  const nextHole = () => setCurrentHole((h) => Math.min(18, h + 1));

  const currentMood = loggedMoods[currentHole] ?? null;
  const isFlashing = flashHole === currentHole;

  return (
    <div
      className={cn(
        'rounded-2xl border px-3 py-2.5',
        'bg-white/80 border-[rgba(45,106,79,0.12)] backdrop-blur-sm',
        className
      )}
    >
      {/* Hole selector row */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={prevHole}
          disabled={currentHole === 1}
          aria-label="Previous hole"
          className="w-7 h-7 flex items-center justify-center rounded-full text-[#2d6a4f] opacity-70 hover:opacity-100 disabled:opacity-25 transition-opacity"
        >
          ‹
        </button>

        <span className="text-[11px] font-medium tracking-[0.14em] uppercase text-[#2d6a4f] select-none">
          Hole {currentHole}
        </span>

        <button
          type="button"
          onClick={nextHole}
          disabled={currentHole === 18}
          aria-label="Next hole"
          className="w-7 h-7 flex items-center justify-center rounded-full text-[#2d6a4f] opacity-70 hover:opacity-100 disabled:opacity-25 transition-opacity"
        >
          ›
        </button>
      </div>

      {/* Mood buttons */}
      <div className="flex gap-2 mb-2.5">
        {MOOD_OPTIONS.map((opt) => {
          const isSelected = currentMood === opt.type;
          const showActive = isSelected && isFlashing;

          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => handleMoodTap(opt.type)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-xl py-1.5 px-2',
                'text-[11px] font-medium tracking-wide border transition-all duration-300',
                isSelected
                  ? showActive
                    ? 'scale-[1.03]'
                    : 'opacity-90'
                  : 'opacity-60 hover:opacity-80'
              )}
              style={
                isSelected
                  ? {
                      background: opt.activeBg,
                      borderColor: opt.activeBorder,
                      color: opt.activeText,
                    }
                  : {
                      background: 'rgba(45,106,79,0.03)',
                      borderColor: 'rgba(45,106,79,0.1)',
                      color: 'rgba(26,26,26,0.5)',
                    }
              }
            >
              <span className="text-[13px] leading-none">{opt.emoji}</span>
              <span>{opt.label}</span>
              {isSelected && !isFlashing && (
                <span
                  className="w-1 h-1 rounded-full flex-shrink-0"
                  style={{ background: opt.dotColor }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 18-dot progress strip */}
      <div className="flex gap-[3px] justify-center">
        {Array.from({ length: 18 }, (_, i) => {
          const hole = i + 1;
          const mood = loggedMoods[hole];
          const moodOpt = mood ? MOOD_OPTIONS.find((o) => o.type === mood) : null;
          const isCurrent = hole === currentHole;

          return (
            <button
              key={hole}
              type="button"
              onClick={() => setCurrentHole(hole)}
              aria-label={`Go to hole ${hole}`}
              className="rounded-full transition-all duration-200 flex-shrink-0"
              style={{
                width: isCurrent ? 7 : 5,
                height: isCurrent ? 7 : 5,
                background: moodOpt
                  ? moodOpt.dotColor
                  : isCurrent
                    ? 'rgba(45,106,79,0.4)'
                    : 'rgba(26,26,26,0.12)',
                border: isCurrent ? '1px solid rgba(45,106,79,0.3)' : 'none',
                boxSizing: 'border-box',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
