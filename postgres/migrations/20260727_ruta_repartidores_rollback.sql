BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

LOCK TABLE public.ruta IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.ruta_repartidor IN ACCESS EXCLUSIVE MODE;

-- El modelo antiguo no puede representar dos asignaciones. Para no perder
-- datos, el rollback se cancela hasta que cada ruta tenga como máximo una.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.ruta_repartidor
    GROUP BY cod_ruta
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Rollback cancelado: existen rutas con más de un repartidor';
  END IF;
END
$$;

UPDATE public.ruta r
SET id_repartidor = rr.id_repartidor
FROM public.ruta_repartidor rr
WHERE rr.cod_ruta = r.cod_ruta;

DROP TABLE public.ruta_repartidor;

COMMIT;

-- Verificación posterior de solo lectura.
SELECT cod_ruta, id_repartidor
FROM public.ruta
ORDER BY cod_ruta;
