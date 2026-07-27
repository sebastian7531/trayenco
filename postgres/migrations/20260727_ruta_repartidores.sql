BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

LOCK TABLE public.ruta IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE public.ruta_repartidor (
  cod_ruta integer NOT NULL,
  id_repartidor integer NOT NULL,
  CONSTRAINT ruta_repartidor_pkey PRIMARY KEY (cod_ruta, id_repartidor),
  CONSTRAINT ruta_repartidor_cod_ruta_fkey
    FOREIGN KEY (cod_ruta)
    REFERENCES public.ruta(cod_ruta)
    ON DELETE CASCADE,
  CONSTRAINT ruta_repartidor_id_repartidor_fkey
    FOREIGN KEY (id_repartidor)
    REFERENCES public.repartidor(id_repartidor)
);

CREATE INDEX idx_ruta_repartidor_repartidor
  ON public.ruta_repartidor (id_repartidor, cod_ruta);

-- Conserva automáticamente todas las asignaciones individuales existentes.
INSERT INTO public.ruta_repartidor (cod_ruta, id_repartidor)
SELECT cod_ruta, id_repartidor
FROM public.ruta
WHERE id_repartidor IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.ruta r
    WHERE r.id_repartidor IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.ruta_repartidor rr
        WHERE rr.cod_ruta = r.cod_ruta
          AND rr.id_repartidor = r.id_repartidor
      )
  ) THEN
    RAISE EXCEPTION
      'Migración cancelada: no se copiaron todas las asignaciones antiguas';
  END IF;
END
$$;

COMMIT;

-- Verificaciones posteriores de solo lectura.
SELECT
  (SELECT COUNT(*) FROM public.ruta WHERE id_repartidor IS NOT NULL)
    AS asignaciones_individuales,
  (SELECT COUNT(*) FROM public.ruta_repartidor)
    AS asignaciones_migradas;

SELECT r.cod_ruta, r.id_repartidor
FROM public.ruta r
LEFT JOIN public.ruta_repartidor rr
  ON rr.cod_ruta = r.cod_ruta
 AND rr.id_repartidor = r.id_repartidor
WHERE r.id_repartidor IS NOT NULL
  AND rr.cod_ruta IS NULL;
