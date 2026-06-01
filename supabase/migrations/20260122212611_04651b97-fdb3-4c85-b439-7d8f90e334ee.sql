-- Add is_pro column to profiles table for LRM Pro gating
ALTER TABLE public.profiles
ADD COLUMN is_pro BOOLEAN NOT NULL DEFAULT false;