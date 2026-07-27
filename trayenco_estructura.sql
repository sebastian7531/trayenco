--
-- PostgreSQL database dump
--

\restrict 6BTRk9sOLzDHrhj8aCJoAw0cWN9cAKutRyVlfqieW7vWPXEAcxkJ7oLvIXyux8G

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

-- Started on 2026-07-14 18:02:27

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 234 (class 1259 OID 24658)
-- Name: asistencia; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asistencia (
    id_asistencia integer NOT NULL,
    fecha date DEFAULT CURRENT_DATE NOT NULL
);


ALTER TABLE public.asistencia OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 24657)
-- Name: asistencia_id_asistencia_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asistencia_id_asistencia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.asistencia_id_asistencia_seq OWNER TO postgres;

--
-- TOC entry 5147 (class 0 OID 0)
-- Dependencies: 233
-- Name: asistencia_id_asistencia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asistencia_id_asistencia_seq OWNED BY public.asistencia.id_asistencia;


--
-- TOC entry 228 (class 1259 OID 24612)
-- Name: bidones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bidones (
    cod_bidon integer NOT NULL,
    descripcion character varying(100),
    formato character varying(20),
    precio numeric(10,2)
);


ALTER TABLE public.bidones OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 24611)
-- Name: bidones_cod_bidon_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bidones_cod_bidon_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bidones_cod_bidon_seq OWNER TO postgres;

--
-- TOC entry 5148 (class 0 OID 0)
-- Dependencies: 227
-- Name: bidones_cod_bidon_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bidones_cod_bidon_seq OWNED BY public.bidones.cod_bidon;


--
-- TOC entry 230 (class 1259 OID 24620)
-- Name: clientes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clientes (
    id_cliente integer NOT NULL,
    nombre character varying(100) NOT NULL,
    direccion character varying(200) NOT NULL,
    latitud numeric(10,8),
    longitud numeric(11,8),
    telefono character varying(20),
    activo boolean DEFAULT true,
    cod_zona integer
);


ALTER TABLE public.clientes OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 24619)
-- Name: clientes_id_cliente_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.clientes_id_cliente_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clientes_id_cliente_seq OWNER TO postgres;

--
-- TOC entry 5149 (class 0 OID 0)
-- Dependencies: 229
-- Name: clientes_id_cliente_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clientes_id_cliente_seq OWNED BY public.clientes.id_cliente;


--
-- TOC entry 226 (class 1259 OID 24603)
-- Name: estado_pedido; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.estado_pedido (
    cod integer NOT NULL,
    descripcion character varying(50) NOT NULL
);


ALTER TABLE public.estado_pedido OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 24602)
-- Name: estado_pedido_cod_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.estado_pedido_cod_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.estado_pedido_cod_seq OWNER TO postgres;

--
-- TOC entry 5150 (class 0 OID 0)
-- Dependencies: 225
-- Name: estado_pedido_cod_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.estado_pedido_cod_seq OWNED BY public.estado_pedido.cod;


--
-- TOC entry 241 (class 1259 OID 24742)
-- Name: pedido_estado; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pedido_estado (
    id_pedido integer NOT NULL,
    cod_estado integer NOT NULL,
    cantidad_entregada integer DEFAULT 0
);


ALTER TABLE public.pedido_estado OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 24668)
-- Name: pedidos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pedidos (
    id_pedido integer NOT NULL,
    fecha date DEFAULT CURRENT_DATE NOT NULL,
    orden_entrega integer,
    cod_ruta integer,
    prioridad character varying(20) DEFAULT 'normal'::character varying NOT NULL
);


ALTER TABLE public.pedidos OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 24667)
-- Name: pedidos_id_pedido_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pedidos_id_pedido_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pedidos_id_pedido_seq OWNER TO postgres;

--
-- TOC entry 5151 (class 0 OID 0)
-- Dependencies: 235
-- Name: pedidos_id_pedido_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pedidos_id_pedido_seq OWNED BY public.pedidos.id_pedido;


--
-- TOC entry 244 (class 1259 OID 57345)
-- Name: registro_entrega; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.registro_entrega (
    id_registro integer NOT NULL,
    id_pedido integer,
    id_repartidor integer,
    resultado character varying(20) NOT NULL,
    motivo character varying(50),
    observacion text,
    cantidad_entregada integer DEFAULT 0,
    fecha date DEFAULT CURRENT_DATE NOT NULL
);


ALTER TABLE public.registro_entrega OWNER TO postgres;

--
-- TOC entry 243 (class 1259 OID 57344)
-- Name: registro_entrega_id_registro_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.registro_entrega_id_registro_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.registro_entrega_id_registro_seq OWNER TO postgres;

--
-- TOC entry 5152 (class 0 OID 0)
-- Dependencies: 243
-- Name: registro_entrega_id_registro_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.registro_entrega_id_registro_seq OWNED BY public.registro_entrega.id_registro;


--
-- TOC entry 222 (class 1259 OID 24579)
-- Name: repartidor; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repartidor (
    id_repartidor integer NOT NULL,
    nombre character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    password character varying(255) NOT NULL,
    rol character varying(20) DEFAULT 'repartidor'::character varying NOT NULL
);


ALTER TABLE public.repartidor OWNER TO postgres;

--
-- TOC entry 239 (class 1259 OID 24701)
-- Name: repartidor_asistencia; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repartidor_asistencia (
    id_repartidor integer NOT NULL,
    id_asistencia integer NOT NULL,
    hora_entrada time without time zone,
    hora_salida time without time zone,
    horas_trabajadas numeric(4,2)
);


ALTER TABLE public.repartidor_asistencia OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 24578)
-- Name: repartidor_id_repartidor_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.repartidor_id_repartidor_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.repartidor_id_repartidor_seq OWNER TO postgres;

--
-- TOC entry 5153 (class 0 OID 0)
-- Dependencies: 221
-- Name: repartidor_id_repartidor_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.repartidor_id_repartidor_seq OWNED BY public.repartidor.id_repartidor;


--
-- TOC entry 232 (class 1259 OID 24636)
-- Name: ruta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ruta (
    cod_ruta integer NOT NULL,
    fecha date DEFAULT CURRENT_DATE NOT NULL,
    texto text,
    cantidad_bidones integer,
    id_repartidor integer,
    cod_zona integer,
    estado character varying(20) DEFAULT 'activa'::character varying NOT NULL
);


ALTER TABLE public.ruta OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 24635)
-- Name: ruta_cod_ruta_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ruta_cod_ruta_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ruta_cod_ruta_seq OWNER TO postgres;

--
-- TOC entry 5154 (class 0 OID 0)
-- Dependencies: 231
-- Name: ruta_cod_ruta_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ruta_cod_ruta_seq OWNED BY public.ruta.cod_ruta;


--
-- TOC entry 242 (class 1259 OID 49159)
-- Name: ruta_zona; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ruta_zona (
    cod_ruta integer NOT NULL,
    cod_zona integer NOT NULL
);


ALTER TABLE public.ruta_zona OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 24718)
-- Name: solicita; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.solicita (
    id_pedido integer NOT NULL,
    id_cliente integer NOT NULL,
    cod_bidon integer NOT NULL,
    cantidad integer NOT NULL
);


ALTER TABLE public.solicita OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 24683)
-- Name: stock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock (
    id_stock integer NOT NULL,
    fecha date DEFAULT CURRENT_DATE NOT NULL,
    bidones_planta integer DEFAULT 0,
    bidones_cargados integer DEFAULT 0,
    bidones_entregados integer DEFAULT 0,
    bidones_retornados integer DEFAULT 0,
    cod_bidon integer
);


ALTER TABLE public.stock OWNER TO postgres;

--
-- TOC entry 237 (class 1259 OID 24682)
-- Name: stock_id_stock_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_id_stock_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_id_stock_seq OWNER TO postgres;

--
-- TOC entry 5155 (class 0 OID 0)
-- Dependencies: 237
-- Name: stock_id_stock_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_id_stock_seq OWNED BY public.stock.id_stock;


--
-- TOC entry 224 (class 1259 OID 24592)
-- Name: zona; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.zona (
    cod_zona integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text
);


ALTER TABLE public.zona OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 24591)
-- Name: zona_cod_zona_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.zona_cod_zona_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.zona_cod_zona_seq OWNER TO postgres;

--
-- TOC entry 5156 (class 0 OID 0)
-- Dependencies: 223
-- Name: zona_cod_zona_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.zona_cod_zona_seq OWNED BY public.zona.cod_zona;


--
-- TOC entry 4929 (class 2604 OID 24661)
-- Name: asistencia id_asistencia; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia ALTER COLUMN id_asistencia SET DEFAULT nextval('public.asistencia_id_asistencia_seq'::regclass);


--
-- TOC entry 4923 (class 2604 OID 24615)
-- Name: bidones cod_bidon; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bidones ALTER COLUMN cod_bidon SET DEFAULT nextval('public.bidones_cod_bidon_seq'::regclass);


--
-- TOC entry 4924 (class 2604 OID 24623)
-- Name: clientes id_cliente; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes ALTER COLUMN id_cliente SET DEFAULT nextval('public.clientes_id_cliente_seq'::regclass);


--
-- TOC entry 4922 (class 2604 OID 24606)
-- Name: estado_pedido cod; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estado_pedido ALTER COLUMN cod SET DEFAULT nextval('public.estado_pedido_cod_seq'::regclass);


--
-- TOC entry 4931 (class 2604 OID 24671)
-- Name: pedidos id_pedido; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos ALTER COLUMN id_pedido SET DEFAULT nextval('public.pedidos_id_pedido_seq'::regclass);


--
-- TOC entry 4941 (class 2604 OID 57348)
-- Name: registro_entrega id_registro; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registro_entrega ALTER COLUMN id_registro SET DEFAULT nextval('public.registro_entrega_id_registro_seq'::regclass);


--
-- TOC entry 4919 (class 2604 OID 24582)
-- Name: repartidor id_repartidor; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repartidor ALTER COLUMN id_repartidor SET DEFAULT nextval('public.repartidor_id_repartidor_seq'::regclass);


--
-- TOC entry 4926 (class 2604 OID 24639)
-- Name: ruta cod_ruta; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ruta ALTER COLUMN cod_ruta SET DEFAULT nextval('public.ruta_cod_ruta_seq'::regclass);


--
-- TOC entry 4934 (class 2604 OID 24686)
-- Name: stock id_stock; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock ALTER COLUMN id_stock SET DEFAULT nextval('public.stock_id_stock_seq'::regclass);


--
-- TOC entry 4921 (class 2604 OID 24595)
-- Name: zona cod_zona; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zona ALTER COLUMN cod_zona SET DEFAULT nextval('public.zona_cod_zona_seq'::regclass);


--
-- TOC entry 4961 (class 2606 OID 24666)
-- Name: asistencia asistencia_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_pkey PRIMARY KEY (id_asistencia);


--
-- TOC entry 4953 (class 2606 OID 24618)
-- Name: bidones bidones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bidones
    ADD CONSTRAINT bidones_pkey PRIMARY KEY (cod_bidon);


--
-- TOC entry 4955 (class 2606 OID 24629)
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id_cliente);


--
-- TOC entry 4951 (class 2606 OID 24610)
-- Name: estado_pedido estado_pedido_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estado_pedido
    ADD CONSTRAINT estado_pedido_pkey PRIMARY KEY (cod);


--
-- TOC entry 4973 (class 2606 OID 24749)
-- Name: pedido_estado pedido_estado_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedido_estado
    ADD CONSTRAINT pedido_estado_pkey PRIMARY KEY (id_pedido, cod_estado);


--
-- TOC entry 4964 (class 2606 OID 24676)
-- Name: pedidos pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_pkey PRIMARY KEY (id_pedido);


--
-- TOC entry 4978 (class 2606 OID 57357)
-- Name: registro_entrega registro_entrega_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registro_entrega
    ADD CONSTRAINT registro_entrega_pkey PRIMARY KEY (id_registro);


--
-- TOC entry 4969 (class 2606 OID 24707)
-- Name: repartidor_asistencia repartidor_asistencia_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repartidor_asistencia
    ADD CONSTRAINT repartidor_asistencia_pkey PRIMARY KEY (id_repartidor, id_asistencia);


--
-- TOC entry 4945 (class 2606 OID 24590)
-- Name: repartidor repartidor_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repartidor
    ADD CONSTRAINT repartidor_email_key UNIQUE (email);


--
-- TOC entry 4947 (class 2606 OID 24588)
-- Name: repartidor repartidor_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repartidor
    ADD CONSTRAINT repartidor_pkey PRIMARY KEY (id_repartidor);


--
-- TOC entry 4959 (class 2606 OID 24646)
-- Name: ruta ruta_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ruta
    ADD CONSTRAINT ruta_pkey PRIMARY KEY (cod_ruta);


--
-- TOC entry 4975 (class 2606 OID 49165)
-- Name: ruta_zona ruta_zona_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ruta_zona
    ADD CONSTRAINT ruta_zona_pkey PRIMARY KEY (cod_ruta, cod_zona);


--
-- TOC entry 4971 (class 2606 OID 24726)
-- Name: solicita solicita_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicita
    ADD CONSTRAINT solicita_pkey PRIMARY KEY (id_pedido, id_cliente, cod_bidon);


--
-- TOC entry 4967 (class 2606 OID 24695)
-- Name: stock stock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_pkey PRIMARY KEY (id_stock);


--
-- TOC entry 4949 (class 2606 OID 24601)
-- Name: zona zona_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zona
    ADD CONSTRAINT zona_pkey PRIMARY KEY (cod_zona);


--
-- TOC entry 4956 (class 1259 OID 24762)
-- Name: idx_clientes_cod_zona; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clientes_cod_zona ON public.clientes USING btree (cod_zona);


--
-- TOC entry 4962 (class 1259 OID 24760)
-- Name: idx_pedidos_cod_ruta; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pedidos_cod_ruta ON public.pedidos USING btree (cod_ruta);


--
-- TOC entry 4976 (class 1259 OID 57368)
-- Name: idx_registro_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_registro_fecha ON public.registro_entrega USING btree (fecha);


--
-- TOC entry 4957 (class 1259 OID 24761)
-- Name: idx_ruta_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ruta_fecha ON public.ruta USING btree (fecha);


--
-- TOC entry 4965 (class 1259 OID 24763)
-- Name: idx_stock_cod_bidon; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_cod_bidon ON public.stock USING btree (cod_bidon);


--
-- TOC entry 4979 (class 2606 OID 24630)
-- Name: clientes clientes_cod_zona_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_cod_zona_fkey FOREIGN KEY (cod_zona) REFERENCES public.zona(cod_zona);


--
-- TOC entry 4989 (class 2606 OID 24755)
-- Name: pedido_estado pedido_estado_cod_estado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedido_estado
    ADD CONSTRAINT pedido_estado_cod_estado_fkey FOREIGN KEY (cod_estado) REFERENCES public.estado_pedido(cod);


--
-- TOC entry 4990 (class 2606 OID 24750)
-- Name: pedido_estado pedido_estado_id_pedido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedido_estado
    ADD CONSTRAINT pedido_estado_id_pedido_fkey FOREIGN KEY (id_pedido) REFERENCES public.pedidos(id_pedido);


--
-- TOC entry 4982 (class 2606 OID 24677)
-- Name: pedidos pedidos_cod_ruta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_cod_ruta_fkey FOREIGN KEY (cod_ruta) REFERENCES public.ruta(cod_ruta);


--
-- TOC entry 4993 (class 2606 OID 57358)
-- Name: registro_entrega registro_entrega_id_pedido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registro_entrega
    ADD CONSTRAINT registro_entrega_id_pedido_fkey FOREIGN KEY (id_pedido) REFERENCES public.pedidos(id_pedido);


--
-- TOC entry 4994 (class 2606 OID 57363)
-- Name: registro_entrega registro_entrega_id_repartidor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registro_entrega
    ADD CONSTRAINT registro_entrega_id_repartidor_fkey FOREIGN KEY (id_repartidor) REFERENCES public.repartidor(id_repartidor);


--
-- TOC entry 4984 (class 2606 OID 24713)
-- Name: repartidor_asistencia repartidor_asistencia_id_asistencia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repartidor_asistencia
    ADD CONSTRAINT repartidor_asistencia_id_asistencia_fkey FOREIGN KEY (id_asistencia) REFERENCES public.asistencia(id_asistencia);


--
-- TOC entry 4985 (class 2606 OID 24708)
-- Name: repartidor_asistencia repartidor_asistencia_id_repartidor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repartidor_asistencia
    ADD CONSTRAINT repartidor_asistencia_id_repartidor_fkey FOREIGN KEY (id_repartidor) REFERENCES public.repartidor(id_repartidor);


--
-- TOC entry 4980 (class 2606 OID 24652)
-- Name: ruta ruta_cod_zona_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ruta
    ADD CONSTRAINT ruta_cod_zona_fkey FOREIGN KEY (cod_zona) REFERENCES public.zona(cod_zona);


--
-- TOC entry 4981 (class 2606 OID 24647)
-- Name: ruta ruta_id_repartidor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ruta
    ADD CONSTRAINT ruta_id_repartidor_fkey FOREIGN KEY (id_repartidor) REFERENCES public.repartidor(id_repartidor);


--
-- TOC entry 4991 (class 2606 OID 49166)
-- Name: ruta_zona ruta_zona_cod_ruta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ruta_zona
    ADD CONSTRAINT ruta_zona_cod_ruta_fkey FOREIGN KEY (cod_ruta) REFERENCES public.ruta(cod_ruta) ON DELETE CASCADE;


--
-- TOC entry 4992 (class 2606 OID 49171)
-- Name: ruta_zona ruta_zona_cod_zona_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ruta_zona
    ADD CONSTRAINT ruta_zona_cod_zona_fkey FOREIGN KEY (cod_zona) REFERENCES public.zona(cod_zona);


--
-- TOC entry 4986 (class 2606 OID 24737)
-- Name: solicita solicita_cod_bidon_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicita
    ADD CONSTRAINT solicita_cod_bidon_fkey FOREIGN KEY (cod_bidon) REFERENCES public.bidones(cod_bidon);


--
-- TOC entry 4987 (class 2606 OID 24732)
-- Name: solicita solicita_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicita
    ADD CONSTRAINT solicita_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id_cliente);


--
-- TOC entry 4988 (class 2606 OID 24727)
-- Name: solicita solicita_id_pedido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicita
    ADD CONSTRAINT solicita_id_pedido_fkey FOREIGN KEY (id_pedido) REFERENCES public.pedidos(id_pedido);


--
-- TOC entry 4983 (class 2606 OID 24696)
-- Name: stock stock_cod_bidon_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_cod_bidon_fkey FOREIGN KEY (cod_bidon) REFERENCES public.bidones(cod_bidon);


-- Completed on 2026-07-14 18:02:27

--
-- PostgreSQL database dump complete
--

\unrestrict 6BTRk9sOLzDHrhj8aCJoAw0cWN9cAKutRyVlfqieW7vWPXEAcxkJ7oLvIXyux8G

