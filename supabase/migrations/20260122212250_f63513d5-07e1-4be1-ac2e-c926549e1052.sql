-- Create memories table for long-term mental coaching memories
CREATE TABLE public.memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('pattern', 'cue', 'success', 'breakdown')),
  content TEXT NOT NULL,
  confidence FLOAT NOT NULL DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own memories"
ON public.memories
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memories"
ON public.memories
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memories"
ON public.memories
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memories"
ON public.memories
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster user lookups
CREATE INDEX idx_memories_user_id ON public.memories(user_id);
CREATE INDEX idx_memories_category ON public.memories(category);