BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE public.estado_ruta (
  cod_estado integer NOT NULL,
  descripcion character varying(20) NOT NULL,
  CONSTRAINT estado_ruta_pkey PRIMARY KEY (cod_estado),
  CONSTRAINT estado_ruta_descripcion_key UNIQUE (descripcion),
  CONSTRAINT estado_ruta_descripcion_check
    CHECK (descripcion IN ('activa', 'cerrada'))
);

INSERT INTO public.estado_ruta (cod_estado, descripcion)
VALUES
  (1, 'activa'),
  (2, 'cerrada');

CREATE TABLE public.tiene_ruta (
  cod_ruta integer NOT NULL,
  cod_estado integer NOT NULL,
  fecha date NOT NULL,
  hora time without time zone NOT NULL,
  CONSTRAINT tiene_ruta_pkey PRIMARY KEY (cod_ruta, cod_estado),
  CONSTRAINT tiene_ruta_cod_ruta_fkey
    FOREIGN KEY (cod_ruta)
    REFERENCES public.ruta(cod_ruta),
  CONSTRAINT tiene_ruta_cod_estado_fkey
    FOREIGN KEY (cod_estado)
    REFERENCES public.estado_ruta(cod_estado)
);

COMMIT;

-- Verificaciones posteriores de solo lectura.
SELECT cod_estado, descripcion
FROM public.estado_ruta
ORDER BY cod_estado;

SELECT
  (SELECT COUNT(*) FROM public.ruta) AS rutas_existentes,
  (SELECT COUNT(*) FROM public.tiene_ruta) AS eventos_registrados;
