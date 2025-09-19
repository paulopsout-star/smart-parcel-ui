-- Corrigir função para ter search_path fixo
CREATE OR REPLACE FUNCTION public.calculate_next_charge_date(
  base_date TIMESTAMP WITH TIME ZONE,
  recurrence_type recurrence_type,
  interval_value INTEGER DEFAULT 1
)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  CASE recurrence_type
    WHEN 'pontual' THEN
      RETURN NULL;
    WHEN 'diaria' THEN
      RETURN base_date + (interval_value || ' days')::INTERVAL;
    WHEN 'semanal' THEN
      RETURN base_date + (interval_value || ' weeks')::INTERVAL;
    WHEN 'quinzenal' THEN
      RETURN base_date + (interval_value * 2 || ' weeks')::INTERVAL;
    WHEN 'mensal' THEN
      RETURN base_date + (interval_value || ' months')::INTERVAL;
    WHEN 'semestral' THEN
      RETURN base_date + (interval_value * 6 || ' months')::INTERVAL;
    WHEN 'anual' THEN
      RETURN base_date + (interval_value || ' years')::INTERVAL;
    ELSE
      RETURN NULL;
  END CASE;
END;
$$;