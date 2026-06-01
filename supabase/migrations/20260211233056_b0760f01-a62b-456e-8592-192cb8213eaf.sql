
-- Create user_entitlements table (source of truth for PRO status)
CREATE TABLE public.user_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  entitlement_source text NOT NULL DEFAULT 'free' CHECK (entitlement_source IN ('free', 'apple', 'test_override', 'stripe_web')),
  apple_entitlement_active boolean NOT NULL DEFAULT false,
  apple_product_id text,
  apple_original_transaction_id text,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

-- Users can read their own entitlements
CREATE POLICY "Users can view their own entitlements"
  ON public.user_entitlements FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own entitlements (for initial creation)
CREATE POLICY "Users can insert their own entitlements"
  ON public.user_entitlements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own entitlements
CREATE POLICY "Users can update their own entitlements"
  ON public.user_entitlements FOR UPDATE
  USING (auth.uid() = user_id);

-- Create index for fast lookups
CREATE INDEX idx_user_entitlements_user_id ON public.user_entitlements (user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_entitlements_updated_at
  BEFORE UPDATE ON public.user_entitlements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create entitlements row for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_entitlements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_entitlements (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_entitlements
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_entitlements();

-- Backfill entitlements for existing users
INSERT INTO public.user_entitlements (user_id, plan, entitlement_source)
SELECT p.user_id,
       CASE WHEN p.is_pro THEN 'pro' ELSE 'free' END,
       CASE WHEN p.is_pro THEN 'stripe_web' ELSE 'free' END
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_entitlements e WHERE e.user_id = p.user_id
);
