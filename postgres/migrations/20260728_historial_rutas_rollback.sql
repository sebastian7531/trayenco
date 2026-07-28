BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DROP TABLE public.tiene_ruta;
DROP TABLE public.estado_ruta;

COMMIT;
