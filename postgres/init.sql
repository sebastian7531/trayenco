-- ============================================================
-- BASE DE DATOS TRAYENCO - ESQUEMA COMPLETO
-- Sistema de gestion de pedidos y optimizacion de rutas
-- ============================================================

-- tablas independientes

CREATE TABLE repartidor (
  id_repartidor  SERIAL PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL,
  email          VARCHAR(100) UNIQUE NOT NULL,
  password       VARCHAR(255) NOT NULL,
  rol            VARCHAR(20) NOT NULL DEFAULT 'repartidor'
);

CREATE TABLE zona (
  cod_zona     SERIAL PRIMARY KEY,
  nombre       VARCHAR(100) NOT NULL,
  descripcion  TEXT
);

CREATE TABLE estado_pedido (
  cod          SERIAL PRIMARY KEY,
  descripcion  VARCHAR(50) NOT NULL
);

CREATE TABLE estado_ruta (
  cod_estado   INTEGER PRIMARY KEY,
  descripcion  VARCHAR(20) UNIQUE NOT NULL
               CHECK (descripcion IN ('activa', 'cerrada'))
);

CREATE TABLE bidones (
  cod_bidon    SERIAL PRIMARY KEY,
  descripcion  VARCHAR(100),
  formato      VARCHAR(20),
  precio       DECIMAL(10,2)
);

-- tablas con dependencias de primer nivel

CREATE TABLE clientes (
  id_cliente  SERIAL PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  direccion   VARCHAR(200) NOT NULL,
  latitud     DECIMAL(10,8),
  longitud    DECIMAL(11,8),
  telefono    VARCHAR(20),
  activo      BOOLEAN DEFAULT TRUE,
  cod_zona    INTEGER REFERENCES zona(cod_zona)
);

CREATE TABLE ruta (
  cod_ruta         SERIAL PRIMARY KEY,
  fecha            DATE NOT NULL DEFAULT CURRENT_DATE,
  texto            TEXT,
  cantidad_bidones INTEGER,
  id_repartidor    INTEGER REFERENCES repartidor(id_repartidor),
  cod_zona         INTEGER REFERENCES zona(cod_zona)
);

CREATE TABLE ruta_repartidor (
  cod_ruta       INTEGER NOT NULL REFERENCES ruta(cod_ruta) ON DELETE CASCADE,
  id_repartidor  INTEGER NOT NULL REFERENCES repartidor(id_repartidor),
  PRIMARY KEY (cod_ruta, id_repartidor)
);

CREATE INDEX idx_ruta_repartidor_repartidor
  ON ruta_repartidor(id_repartidor, cod_ruta);

CREATE TABLE tiene_ruta (
  cod_ruta    INTEGER NOT NULL REFERENCES ruta(cod_ruta),
  cod_estado  INTEGER NOT NULL REFERENCES estado_ruta(cod_estado),
  fecha       DATE NOT NULL,
  hora        TIME NOT NULL,
  PRIMARY KEY (cod_ruta, cod_estado)
);

CREATE TABLE asistencia (
  id_asistencia  SERIAL PRIMARY KEY,
  fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (fecha)
);

CREATE TABLE pedidos (
  id_pedido      SERIAL PRIMARY KEY,
  fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
  orden_entrega  INTEGER,
  prioridad      VARCHAR(20) NOT NULL DEFAULT 'normal',
  cod_ruta       INTEGER REFERENCES ruta(cod_ruta)
);

CREATE TABLE stock (
  id_stock             SERIAL PRIMARY KEY,
  fecha                DATE NOT NULL DEFAULT CURRENT_DATE,
  bidones_planta       INTEGER DEFAULT 0,
  bidones_cargados     INTEGER DEFAULT 0,
  bidones_entregados   INTEGER DEFAULT 0,
  bidones_retornados   INTEGER DEFAULT 0,
  cod_bidon            INTEGER REFERENCES bidones(cod_bidon),
  UNIQUE (fecha, cod_bidon)
);

-- tablas intermedias

CREATE TABLE repartidor_asistencia (
  id_registro      SERIAL PRIMARY KEY,
  id_repartidor    INTEGER NOT NULL REFERENCES repartidor(id_repartidor),
  id_asistencia    INTEGER NOT NULL REFERENCES asistencia(id_asistencia),
  hora_entrada     TIME NOT NULL,
  hora_salida      TIME,
  horas_trabajadas DECIMAL(4,2)
);

CREATE UNIQUE INDEX uq_repartidor_intervalo_abierto
  ON repartidor_asistencia(id_repartidor)
  WHERE hora_salida IS NULL;

CREATE TABLE solicita (
  id_pedido  INTEGER REFERENCES pedidos(id_pedido),
  id_cliente INTEGER REFERENCES clientes(id_cliente),
  cod_bidon  INTEGER REFERENCES bidones(cod_bidon),
  cantidad   INTEGER NOT NULL,
  PRIMARY KEY (id_pedido, id_cliente, cod_bidon)
);

CREATE TABLE pedido_estado (
  id_pedido          INTEGER REFERENCES pedidos(id_pedido),
  cod_estado         INTEGER REFERENCES estado_pedido(cod),
  cantidad_entregada INTEGER DEFAULT 0,
  PRIMARY KEY (id_pedido, cod_estado)
);

-- datos iniciales

INSERT INTO estado_pedido (descripcion) VALUES
  ('pendiente'),
  ('en_ruta'),
  ('entregado'),
  ('parcial'),
  ('fallido');

INSERT INTO estado_ruta (cod_estado, descripcion) VALUES
  (1, 'activa'),
  (2, 'cerrada');

INSERT INTO bidones (descripcion, formato, precio) VALUES
  ('Bidon de agua purificada 10L', '10 litros', 2000.00),
  ('Bidon de agua purificada 20L', '20 litros', 2500.00);

-- usuario administrador inicial
-- password: admin123
INSERT INTO repartidor (nombre, email, password, rol) VALUES
  ('Administrador', 'admin@trayenco.cl', '$2b$10$3IS3RdOffBjNbF4exiolRezmI7i6K2B.TeoHiu1CM0.mkg/q.tgiG', 'administrador');

-- indices en FK de consulta frecuente

CREATE INDEX idx_pedidos_cod_ruta  ON pedidos(cod_ruta);
CREATE INDEX idx_ruta_fecha        ON ruta(fecha);
CREATE INDEX idx_clientes_cod_zona ON clientes(cod_zona);
CREATE INDEX idx_stock_cod_bidon   ON stock(cod_bidon);
