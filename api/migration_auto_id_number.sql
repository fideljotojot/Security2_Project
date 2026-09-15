-- Generate yearly sequential IDs in the format YYYY-0000.
CREATE TABLE IF NOT EXISTS public.id_number_sequences (
  id_year INTEGER PRIMARY KEY,
  next_number INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT id_number_sequences_range CHECK (next_number BETWEEN 0 AND 10000)
);

-- Seed the current year from existing IDs before switching to the sequence table.
INSERT INTO public.id_number_sequences (id_year, next_number)
SELECT EXTRACT(YEAR FROM current_date)::INTEGER,
       COALESCE(MAX((substring(id_number from 6 for 4))::INTEGER), -1) + 1
  FROM public.users
 WHERE id_number ~ ('^' || EXTRACT(YEAR FROM current_date)::TEXT || '-[0-9]{4}$')
ON CONFLICT (id_year) DO NOTHING;

CREATE OR REPLACE FUNCTION public.generate_next_id_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM current_date)::INTEGER;
  next_sequence INTEGER;
BEGIN
  INSERT INTO public.id_number_sequences (id_year, next_number)
  VALUES (current_year, 0)
  ON CONFLICT (id_year) DO NOTHING;

  UPDATE public.id_number_sequences
     SET next_number = next_number + 1
   WHERE id_year = current_year
   RETURNING next_number - 1 INTO next_sequence;

  IF next_sequence > 9999 THEN
    RAISE EXCEPTION 'No more ID numbers are available for %', current_year;
  END IF;

  RETURN current_year::TEXT || '-' || lpad(next_sequence::TEXT, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.generate_next_id_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_next_id_number() TO anon, authenticated;
