BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

LOCK TABLE public.asistencia IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.repartidor_asistencia IN ACCESS EXCLUSIVE MODE;

-- La migración es deliberadamente conservadora: cualquier anomalía exige
-- revisión manual y revierte la transacción completa.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.asistencia
    GROUP BY fecha
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Migración cancelada: existen fechas duplicadas en asistencia';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.repartidor_asistencia
    WHERE hora_salida IS NULL
    GROUP BY id_repartidor
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Migración cancelada: existen múltiples intervalos abiertos para un repartidor';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.repartidor_asistencia
    WHERE hora_entrada IS NULL
  ) THEN
    RAISE EXCEPTION
      'Migración cancelada: existen registros sin hora_entrada';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.repartidor_asistencia ra
    LEFT JOIN public.repartidor r
      ON r.id_repartidor = ra.id_repartidor
    LEFT JOIN public.asistencia a
      ON a.id_asistencia = ra.id_asistencia
    WHERE r.id_repartidor IS NULL
       OR a.id_asistencia IS NULL
  ) THEN
    RAISE EXCEPTION
      'Migración cancelada: existen claves foráneas huérfanas';
  END IF;
END
$$;

CREATE TEMP TABLE control_migracion_asistencia
ON COMMIT DROP
AS
SELECT
  (SELECT COUNT(*) FROM public.asistencia) AS jornadas_antes,
  (SELECT COUNT(*) FROM public.repartidor_asistencia) AS intervalos_antes;

CREATE SEQUENCE public.repartidor_asistencia_id_registro_seq
  AS integer
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER TABLE public.repartidor_asistencia
  ADD COLUMN id_registro integer;

ALTER SEQUENCE public.repartidor_asistencia_id_registro_seq
  OWNED BY public.repartidor_asistencia.id_registro;

ALTER TABLE public.repartidor_asistencia
  ALTER COLUMN id_registro
  SET DEFAULT nextval(
    'public.repartidor_asistencia_id_registro_seq'::regclass
  );

UPDATE public.repartidor_asistencia
SET id_registro =
  nextval('public.repartidor_asistencia_id_registro_seq'::regclass)
WHERE id_registro IS NULL;

ALTER TABLE public.repartidor_asistencia
  ALTER COLUMN id_registro SET NOT NULL;

SELECT setval(
  'public.repartidor_asistencia_id_registro_seq',
  COALESCE(
    (SELECT MAX(id_registro) FROM public.repartidor_asistencia),
    1
  ),
  EXISTS (SELECT 1 FROM public.repartidor_asistencia)
);

ALTER TABLE public.repartidor_asistencia
  DROP CONSTRAINT repartidor_asistencia_pkey;

ALTER TABLE public.repartidor_asistencia
  ADD CONSTRAINT repartidor_asistencia_pkey
  PRIMARY KEY (id_registro);

ALTER TABLE public.repartidor_asistencia
  ALTER COLUMN id_repartidor SET NOT NULL,
  ALTER COLUMN id_asistencia SET NOT NULL,
  ALTER COLUMN hora_entrada SET NOT NULL;

-- Detecta cualquier índice único simple sobre fecha, incluso si pertenece a
-- una restricción con un nombre distinto.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.asistencia'::regclass
      AND i.indisunique
      AND i.indpred IS NULL
      AND i.indexprs IS NULL
      AND i.indnkeyatts = 1
      AND pg_get_indexdef(i.indexrelid, 1, true) = 'fecha'
  ) THEN
    ALTER TABLE public.asistencia
      ADD CONSTRAINT uq_asistencia_fecha UNIQUE (fecha);
  END IF;
END
$$;

CREATE UNIQUE INDEX uq_repartidor_intervalo_abierto
  ON public.repartidor_asistencia (id_repartidor)
  WHERE hora_salida IS NULL;

DO $$
DECLARE
  jornadas_esperadas bigint;
  jornadas_actuales bigint;
  intervalos_esperados bigint;
  intervalos_actuales bigint;
BEGIN
  SELECT jornadas_antes, intervalos_antes
    INTO jornadas_esperadas, intervalos_esperados
  FROM control_migracion_asistencia;

  SELECT COUNT(*) INTO jornadas_actuales
  FROM public.asistencia;

  SELECT COUNT(*) INTO intervalos_actuales
  FROM public.repartidor_asistencia;

  IF jornadas_esperadas <> jornadas_actuales THEN
    RAISE EXCEPTION
      'Migración cancelada: las jornadas cambiaron de % a %',
      jornadas_esperadas,
      jornadas_actuales;
  END IF;

  IF intervalos_esperados <> intervalos_actuales THEN
    RAISE EXCEPTION
      'Migración cancelada: los intervalos cambiaron de % a %',
      intervalos_esperados,
      intervalos_actuales;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.repartidor_asistencia
    WHERE id_registro IS NULL
  ) THEN
    RAISE EXCEPTION
      'Migración cancelada: quedaron registros sin id_registro';
  END IF;
END
$$;

COMMIT;

-- Verificaciones posteriores (solo lectura).
SELECT
  tc.constraint_name,
  kcu.column_name,
  kcu.ordinal_position
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name
 AND kcu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'repartidor_asistencia'
  AND tc.constraint_type = 'PRIMARY KEY'
ORDER BY kcu.ordinal_position;

SELECT fecha, COUNT(*)
FROM public.asistencia
GROUP BY fecha
HAVING COUNT(*) > 1;

SELECT id_repartidor, COUNT(*)
FROM public.repartidor_asistencia
WHERE hora_salida IS NULL
GROUP BY id_repartidor
HAVING COUNT(*) > 1;

SELECT
  COUNT(*) AS total,
  COUNT(id_registro) AS con_id,
  COUNT(DISTINCT id_registro) AS ids_distintos
FROM public.repartidor_asistencia;

SELECT
  conrelid::regclass AS tabla,
  conname,
  contype,
  pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid IN (
  'public.asistencia'::regclass,
  'public.repartidor_asistencia'::regclass
)
ORDER BY conrelid::regclass::text, conname;

SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('asistencia', 'repartidor_asistencia')
ORDER BY tablename, indexname;
