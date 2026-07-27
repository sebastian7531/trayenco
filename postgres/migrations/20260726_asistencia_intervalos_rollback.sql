BEGIN;

SET LOCAL lock_timeout = '10s';

LOCK TABLE public.repartidor_asistencia IN ACCESS EXCLUSIVE MODE;

-- Volver a la PK compuesta dejaría de ser lossless cuando ya existen varios
-- intervalos para una misma jornada. En ese caso el rollback se cancela.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.repartidor_asistencia
    GROUP BY id_repartidor, id_asistencia
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Rollback cancelado: ya existen múltiples intervalos por jornada';
  END IF;
END
$$;

DROP INDEX IF EXISTS public.uq_repartidor_intervalo_abierto;

ALTER TABLE public.repartidor_asistencia
  DROP CONSTRAINT repartidor_asistencia_pkey;

ALTER TABLE public.repartidor_asistencia
  ADD CONSTRAINT repartidor_asistencia_pkey
  PRIMARY KEY (id_repartidor, id_asistencia);

ALTER TABLE public.repartidor_asistencia
  ALTER COLUMN hora_entrada DROP NOT NULL;

ALTER TABLE public.repartidor_asistencia
  DROP COLUMN id_registro;

COMMIT;

-- UNIQUE(fecha) se conserva: forma parte del esquema inicial y sigue siendo
-- una garantía necesaria aunque se revierta la cardinalidad de intervalos.
