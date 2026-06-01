
-- Drop the overly permissive UPDATE policy
DROP POLICY IF EXISTS "Users can update their own entitlements" ON public.user_entitlements;

-- Replace with a restrictive UPDATE policy: users can only update their own row
-- AND cannot change plan or entitlement_source (those fields must stay the same)
-- Only the service_role key (edge functions) can change plan/source
CREATE POLICY "Users can update own entitlements (non-plan fields only)"
  ON public.user_entitlements FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND plan = (SELECT ue.plan FROM public.user_entitlements ue WHERE ue.user_id = auth.uid())
    AND entitlement_source = (SELECT ue.entitlement_source FROM public.user_entitlements ue WHERE ue.user_id = auth.uid())
  );
