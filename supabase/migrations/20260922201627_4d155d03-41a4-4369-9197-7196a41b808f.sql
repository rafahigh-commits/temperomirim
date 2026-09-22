CREATE TABLE public.tip_closings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day date NOT NULL UNIQUE,
  total_cents integer NOT NULL DEFAULT 0,
  people_count integer NOT NULL DEFAULT 0,
  per_person_cents integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tip_closings TO authenticated;
GRANT ALL ON public.tip_closings TO service_role;

ALTER TABLE public.tip_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tip_closings_manager_read" ON public.tip_closings
  FOR SELECT TO authenticated USING (private.is_manager(auth.uid()));
CREATE POLICY "tip_closings_manager_write" ON public.tip_closings
  FOR ALL TO authenticated USING (private.is_manager(auth.uid())) WITH CHECK (private.is_manager(auth.uid()));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_tip_closings_updated_at BEFORE UPDATE ON public.tip_closings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();