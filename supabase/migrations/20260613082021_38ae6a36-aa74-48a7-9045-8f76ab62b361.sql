
ALTER TABLE public.charging_stations ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE;

GRANT INSERT ON public.charging_stations TO authenticated;

CREATE POLICY "Authenticated users can insert stations"
ON public.charging_stations
FOR INSERT
TO authenticated
WITH CHECK (true);
