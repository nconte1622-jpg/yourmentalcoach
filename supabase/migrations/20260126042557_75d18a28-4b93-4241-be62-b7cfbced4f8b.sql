-- Create rounds table
CREATE TABLE public.rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round_type TEXT NOT NULL,
  environment TEXT NOT NULL,
  course_location TEXT,
  goal TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  post_round_best TEXT,
  post_round_cost TEXT,
  post_round_adjustment TEXT
);

-- Create index for efficient queries
CREATE INDEX idx_rounds_user_started ON public.rounds(user_id, started_at DESC);

-- Enable RLS
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rounds
CREATE POLICY "Users can view their own rounds"
  ON public.rounds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rounds"
  ON public.rounds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rounds"
  ON public.rounds FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rounds"
  ON public.rounds FOR DELETE
  USING (auth.uid() = user_id);

-- Create round_events table (moments during a round)
CREATE TABLE public.round_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  label TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_round_events_round_created ON public.round_events(round_id, created_at ASC);
CREATE INDEX idx_round_events_user_created ON public.round_events(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.round_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for round_events
CREATE POLICY "Users can view their own round events"
  ON public.round_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own round events"
  ON public.round_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own round events"
  ON public.round_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own round events"
  ON public.round_events FOR DELETE
  USING (auth.uid() = user_id);

-- Add index to existing memories table if not exists
CREATE INDEX IF NOT EXISTS idx_memories_user_created ON public.memories(user_id, created_at DESC);