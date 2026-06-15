--
-- PostgreSQL database dump
--

\restrict cATzwE2WDSdcaj9yT9lJosPlwM4RJSf8lnvwZFruvpo6FPNIgwXiZlLhfPffcur

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

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
-- Name: agenda_taller; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agenda_taller (
    id bigint NOT NULL,
    id_sucursal bigint NOT NULL,
    id_cliente bigint,
    cliente_nombre character varying(150) NOT NULL,
    cliente_telefono character varying(50),
    fecha date NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone,
    tipo_servicio character varying(150) NOT NULL,
    descripcion text,
    estado character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    id_usuario_creador bigint NOT NULL,
    notas text,
    id_orden_taller bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id_bicicleta_cliente bigint,
    franja character varying(20) NOT NULL,
    recordatorio_enviado boolean DEFAULT false NOT NULL,
    fecha_recordatorio timestamp with time zone,
    fecha_prometida_entrega date,
    cliente_avisado boolean DEFAULT false NOT NULL,
    fecha_cliente_avisado timestamp with time zone
);


--
-- Name: agenda_taller_historial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agenda_taller_historial (
    id bigint NOT NULL,
    id_turno_agenda bigint NOT NULL,
    tipo_evento character varying(40) NOT NULL,
    detalle text,
    fecha_anterior date,
    fecha_nueva date,
    hora_inicio_anterior time without time zone,
    hora_inicio_nueva time without time zone,
    estado_anterior character varying(40),
    estado_nuevo character varying(40),
    id_usuario bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agenda_taller_historial_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agenda_taller_historial_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agenda_taller_historial_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agenda_taller_historial_id_seq OWNED BY public.agenda_taller_historial.id;


--
-- Name: agenda_taller_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agenda_taller_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agenda_taller_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agenda_taller_id_seq OWNED BY public.agenda_taller.id;


--
-- Name: auditoria_eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_eventos (
    id bigint NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    id_usuario bigint NOT NULL,
    id_sucursal bigint,
    entidad character varying(50) NOT NULL,
    entidad_id bigint NOT NULL,
    accion character varying(50) NOT NULL,
    detalle text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb,
    origen_tipo character varying(50),
    origen_id integer
);


--
-- Name: auditoria_eventos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auditoria_eventos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_eventos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auditoria_eventos_id_seq OWNED BY public.auditoria_eventos.id;


--
-- Name: bicicletas_clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bicicletas_clientes (
    id bigint NOT NULL,
    id_cliente bigint NOT NULL,
    marca character varying(100),
    modelo character varying(100),
    rodado character varying(50),
    color character varying(50),
    numero_cuadro character varying(100),
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id_bicicleta_serializada bigint,
    id_venta_origen bigint,
    fecha_compra date,
    condicion_entrega character varying(20),
    plan_postventa character varying(30),
    fecha_limite_service_gratis date,
    service_gratis_usado boolean DEFAULT false NOT NULL,
    id_orden_service_gratis bigint,
    service_gratis_autorizado_fuera_plazo boolean DEFAULT false CONSTRAINT bicicletas_clientes_service_gratis_autorizado_fuera_pl_not_null NOT NULL,
    motivo_service_gratis_fuera_plazo text,
    id_usuario_autoriza_service_gratis integer,
    fecha_autoriza_service_gratis timestamp without time zone
);


--
-- Name: bicicletas_clientes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bicicletas_clientes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bicicletas_clientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bicicletas_clientes_id_seq OWNED BY public.bicicletas_clientes.id;


--
-- Name: bicicletas_serializadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bicicletas_serializadas (
    id bigint NOT NULL,
    id_variante bigint NOT NULL,
    id_sucursal_actual bigint NOT NULL,
    numero_cuadro character varying(100) NOT NULL,
    estado character varying(30) DEFAULT 'disponible'::character varying NOT NULL,
    fecha_alta timestamp with time zone DEFAULT now() NOT NULL,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_bicicletas_serializadas_estado CHECK (((estado)::text = ANY ((ARRAY['disponible'::character varying, 'reservada'::character varying, 'vendida_pendiente_entrega'::character varying, 'entregada'::character varying, 'fuera_de_stock'::character varying])::text[])))
);


--
-- Name: bicicletas_serializadas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bicicletas_serializadas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bicicletas_serializadas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bicicletas_serializadas_id_seq OWNED BY public.bicicletas_serializadas.id;


--
-- Name: caja_movimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caja_movimientos (
    id bigint NOT NULL,
    id_caja bigint NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    tipo_movimiento character varying(20) NOT NULL,
    submedio character varying(30),
    monto numeric(14,2) NOT NULL,
    origen_tipo character varying(30),
    origen_id bigint,
    nota text,
    id_usuario bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    direccion_ajuste character varying(10),
    CONSTRAINT chk_caja_mov_direccion_ajuste_consistencia CHECK (((((tipo_movimiento)::text = 'ajuste'::text) AND (direccion_ajuste IS NOT NULL)) OR (((tipo_movimiento)::text <> 'ajuste'::text) AND (direccion_ajuste IS NULL)))),
    CONSTRAINT chk_caja_mov_monto_positivo CHECK ((monto > (0)::numeric)),
    CONSTRAINT chk_caja_mov_submedio CHECK (((submedio)::text = ANY ((ARRAY['efectivo'::character varying, 'transferencia'::character varying, 'mercadopago'::character varying, 'tarjeta'::character varying])::text[]))),
    CONSTRAINT chk_caja_mov_tipo CHECK (((tipo_movimiento)::text = ANY ((ARRAY['ingreso'::character varying, 'egreso'::character varying, 'ajuste'::character varying])::text[]))),
    CONSTRAINT chk_caja_movimientos_direccion_ajuste CHECK (((direccion_ajuste IS NULL) OR ((direccion_ajuste)::text = ANY ((ARRAY['positivo'::character varying, 'negativo'::character varying])::text[]))))
);


--
-- Name: caja_movimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.caja_movimientos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caja_movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.caja_movimientos_id_seq OWNED BY public.caja_movimientos.id;


--
-- Name: cajas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cajas (
    id bigint NOT NULL,
    fecha date NOT NULL,
    id_sucursal bigint NOT NULL,
    estado character varying(20) DEFAULT 'abierta'::character varying NOT NULL,
    monto_apertura numeric(14,2) DEFAULT 0 NOT NULL,
    monto_cierre_teorico numeric(14,2),
    monto_cierre_real numeric(14,2),
    diferencia numeric(14,2),
    id_usuario_apertura bigint NOT NULL,
    id_usuario_cierre bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_cajas_estado CHECK (((estado)::text = ANY ((ARRAY['abierta'::character varying, 'cerrada'::character varying])::text[])))
);


--
-- Name: cajas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cajas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cajas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cajas_id_seq OWNED BY public.cajas.id;


--
-- Name: capital_movimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capital_movimientos (
    id bigint NOT NULL,
    fecha date DEFAULT CURRENT_DATE NOT NULL,
    id_sucursal bigint,
    id_participante bigint NOT NULL,
    tipo_movimiento character varying(40) NOT NULL,
    descripcion text NOT NULL,
    monto numeric(14,2) NOT NULL,
    medio_pago character varying(30),
    impacta_caja boolean DEFAULT false NOT NULL,
    id_caja_movimiento bigint,
    estado character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    origen_tipo character varying(40),
    origen_id bigint,
    id_usuario bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_capital_movimientos_caja_consistencia CHECK ((((impacta_caja = true) AND (id_caja_movimiento IS NOT NULL)) OR (impacta_caja = false))),
    CONSTRAINT chk_capital_movimientos_estado CHECK (((estado)::text = ANY ((ARRAY['activo'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT chk_capital_movimientos_medio_pago CHECK (((medio_pago IS NULL) OR ((medio_pago)::text = ANY ((ARRAY['efectivo'::character varying, 'transferencia'::character varying, 'mercadopago'::character varying, 'tarjeta'::character varying])::text[])))),
    CONSTRAINT chk_capital_movimientos_monto CHECK ((monto > (0)::numeric)),
    CONSTRAINT chk_capital_movimientos_tipo CHECK (((tipo_movimiento)::text = ANY ((ARRAY['aporte_capital'::character varying, 'prestamo_socio'::character varying, 'devolucion_prestamo'::character varying, 'retiro_personal'::character varying, 'distribucion_ganancia'::character varying])::text[])))
);


--
-- Name: capital_movimientos_historial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capital_movimientos_historial (
    id bigint NOT NULL,
    id_movimiento bigint NOT NULL,
    tipo_evento character varying(30) NOT NULL,
    monto numeric(14,2) NOT NULL,
    detalle text,
    origen_tipo character varying(40),
    origen_id bigint,
    id_usuario bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_capital_historial_monto CHECK ((monto > (0)::numeric)),
    CONSTRAINT chk_capital_historial_tipo CHECK (((tipo_evento)::text = ANY ((ARRAY['creacion'::character varying, 'anulacion'::character varying])::text[])))
);


--
-- Name: capital_movimientos_historial_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.capital_movimientos_historial_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: capital_movimientos_historial_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.capital_movimientos_historial_id_seq OWNED BY public.capital_movimientos_historial.id;


--
-- Name: capital_movimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.capital_movimientos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: capital_movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.capital_movimientos_id_seq OWNED BY public.capital_movimientos.id;


--
-- Name: capital_participantes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capital_participantes (
    id bigint NOT NULL,
    nombre character varying(120) NOT NULL,
    tipo character varying(20) DEFAULT 'persona'::character varying NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_capital_participantes_tipo CHECK (((tipo)::text = ANY ((ARRAY['persona'::character varying, 'fondo'::character varying])::text[])))
);


--
-- Name: capital_participantes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.capital_participantes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: capital_participantes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.capital_participantes_id_seq OWNED BY public.capital_participantes.id;


--
-- Name: catalogo_imagenes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_imagenes (
    id bigint NOT NULL,
    id_producto bigint,
    id_variante bigint,
    url text NOT NULL,
    es_principal boolean DEFAULT false NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_catalogo_imagenes_destino CHECK ((((id_producto IS NOT NULL) AND (id_variante IS NULL)) OR ((id_producto IS NULL) AND (id_variante IS NOT NULL))))
);


--
-- Name: catalogo_imagenes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.catalogo_imagenes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: catalogo_imagenes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.catalogo_imagenes_id_seq OWNED BY public.catalogo_imagenes.id;


--
-- Name: categorias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categorias (
    id bigint NOT NULL,
    nombre character varying(100) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: categorias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categorias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categorias_id_seq OWNED BY public.categorias.id;


--
-- Name: cierres_rentabilidad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cierres_rentabilidad (
    id bigint NOT NULL,
    periodo_mes date NOT NULL,
    fecha_desde date NOT NULL,
    fecha_hasta date NOT NULL,
    id_sucursal bigint,
    id_regla_distribucion bigint,
    regla_nombre_snapshot character varying(120),
    ventas_brutas numeric(14,2) DEFAULT 0 NOT NULL,
    devoluciones_total numeric(14,2) DEFAULT 0 NOT NULL,
    ventas_netas numeric(14,2) DEFAULT 0 NOT NULL,
    cmv_bruto numeric(14,2) DEFAULT 0 NOT NULL,
    cmv_devoluciones numeric(14,2) DEFAULT 0 NOT NULL,
    cmv_neto numeric(14,2) DEFAULT 0 NOT NULL,
    margen_bruto numeric(14,2) DEFAULT 0 NOT NULL,
    gastos_operativos numeric(14,2) DEFAULT 0 NOT NULL,
    resultado_distribuible numeric(14,2) DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'cerrado'::character varying NOT NULL,
    id_usuario_cierre bigint NOT NULL,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_cierres_rentabilidad_estado CHECK (((estado)::text = ANY ((ARRAY['cerrado'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT chk_cierres_rentabilidad_fechas CHECK ((fecha_desde <= fecha_hasta))
);


--
-- Name: cierres_rentabilidad_distribuciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cierres_rentabilidad_distribuciones (
    id bigint NOT NULL,
    id_cierre bigint NOT NULL,
    id_participante bigint,
    participante_nombre_snapshot character varying(120) CONSTRAINT cierres_rentabilidad_distri_participante_nombre_snapsh_not_null NOT NULL,
    participante_tipo_snapshot character varying(20),
    porcentaje numeric(7,4) NOT NULL,
    monto numeric(14,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_crd_monto CHECK ((monto >= (0)::numeric)),
    CONSTRAINT chk_crd_porcentaje CHECK (((porcentaje > (0)::numeric) AND (porcentaje <= (100)::numeric)))
);


--
-- Name: cierres_rentabilidad_distribuciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cierres_rentabilidad_distribuciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cierres_rentabilidad_distribuciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cierres_rentabilidad_distribuciones_id_seq OWNED BY public.cierres_rentabilidad_distribuciones.id;


--
-- Name: cierres_rentabilidad_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cierres_rentabilidad_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cierres_rentabilidad_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cierres_rentabilidad_id_seq OWNED BY public.cierres_rentabilidad.id;


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes (
    id bigint NOT NULL,
    nombre character varying(150) NOT NULL,
    telefono character varying(50),
    dni character varying(30),
    direccion character varying(200),
    tipo_cliente character varying(30) DEFAULT 'minorista'::character varying NOT NULL,
    notas text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    condicion_iva character varying(30) DEFAULT 'consumidor_final'::character varying NOT NULL,
    cuit character varying(20),
    razon_social character varying(150),
    CONSTRAINT chk_clientes_tipo_cliente CHECK (((tipo_cliente)::text = ANY ((ARRAY['minorista'::character varying, 'mayorista'::character varying, 'consumidor_final'::character varying])::text[])))
);


--
-- Name: clientes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clientes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clientes_id_seq OWNED BY public.clientes.id;


--
-- Name: credito_movimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credito_movimientos (
    id bigint NOT NULL,
    id_credito bigint NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    tipo_movimiento character varying(30) NOT NULL,
    monto numeric(14,2) NOT NULL,
    origen_tipo character varying(30),
    origen_id bigint,
    nota text,
    id_usuario bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_credito_movimientos_monto_positivo CHECK ((monto > (0)::numeric)),
    CONSTRAINT chk_credito_movimientos_tipo CHECK (((tipo_movimiento)::text = ANY ((ARRAY['credito_generado'::character varying, 'aplicacion_a_venta'::character varying, 'reintegro'::character varying, 'ajuste'::character varying, 'anulacion_credito'::character varying])::text[])))
);


--
-- Name: credito_movimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.credito_movimientos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credito_movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.credito_movimientos_id_seq OWNED BY public.credito_movimientos.id;


--
-- Name: creditos_cliente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creditos_cliente (
    id bigint NOT NULL,
    id_cliente bigint NOT NULL,
    origen_tipo character varying(30) NOT NULL,
    origen_id bigint NOT NULL,
    fecha_origen timestamp with time zone DEFAULT now() NOT NULL,
    saldo_actual numeric(14,2) NOT NULL,
    estado character varying(20) DEFAULT 'abierto'::character varying NOT NULL,
    observacion text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_creditos_cliente_estado CHECK (((estado)::text = ANY ((ARRAY['abierto'::character varying, 'aplicado_parcial'::character varying, 'aplicado_total'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT chk_creditos_cliente_origen_tipo CHECK (((origen_tipo)::text = ANY ((ARRAY['venta'::character varying, 'reserva'::character varying, 'orden_taller'::character varying, 'ajuste_manual'::character varying])::text[]))),
    CONSTRAINT chk_creditos_cliente_saldo_no_negativo CHECK ((saldo_actual >= (0)::numeric))
);


--
-- Name: creditos_cliente_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.creditos_cliente_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: creditos_cliente_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.creditos_cliente_id_seq OWNED BY public.creditos_cliente.id;


--
-- Name: deuda_movimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deuda_movimientos (
    id bigint NOT NULL,
    id_deuda bigint NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    tipo_movimiento character varying(20) NOT NULL,
    monto numeric(14,2) NOT NULL,
    origen_tipo character varying(30),
    origen_id bigint,
    nota text,
    id_usuario bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_deuda_mov_monto_positivo CHECK ((monto > (0)::numeric)),
    CONSTRAINT chk_deuda_mov_tipo CHECK (((tipo_movimiento)::text = ANY ((ARRAY['cargo'::character varying, 'pago'::character varying, 'recargo'::character varying, 'ajuste'::character varying, 'reversion'::character varying])::text[])))
);


--
-- Name: deuda_movimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.deuda_movimientos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: deuda_movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.deuda_movimientos_id_seq OWNED BY public.deuda_movimientos.id;


--
-- Name: deudas_cliente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deudas_cliente (
    id bigint NOT NULL,
    id_cliente bigint NOT NULL,
    origen_tipo character varying(30) NOT NULL,
    origen_id bigint NOT NULL,
    fecha_origen timestamp with time zone DEFAULT now() NOT NULL,
    saldo_actual numeric(14,2) NOT NULL,
    genera_recargo boolean DEFAULT false NOT NULL,
    tasa_recargo numeric(7,4),
    proximo_vencimiento timestamp with time zone,
    estado character varying(20) DEFAULT 'abierta'::character varying NOT NULL,
    observacion text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_deuda_origen_tipo CHECK (((origen_tipo)::text = ANY ((ARRAY['venta'::character varying, 'orden_taller'::character varying, 'financiacion'::character varying])::text[]))),
    CONSTRAINT chk_deuda_saldo_no_negativo CHECK ((saldo_actual >= (0)::numeric)),
    CONSTRAINT chk_deudas_con_recargo_tasa CHECK (((genera_recargo = false) OR (tasa_recargo IS NOT NULL))),
    CONSTRAINT chk_deudas_estado CHECK (((estado)::text = ANY ((ARRAY['abierta'::character varying, 'cerrada'::character varying, 'anulada'::character varying])::text[]))),
    CONSTRAINT chk_deudas_sin_recargo_limpias CHECK (((genera_recargo = true) OR ((tasa_recargo IS NULL) AND (proximo_vencimiento IS NULL))))
);


--
-- Name: deudas_cliente_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.deudas_cliente_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: deudas_cliente_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.deudas_cliente_id_seq OWNED BY public.deudas_cliente.id;


--
-- Name: familias_precio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.familias_precio (
    id bigint NOT NULL,
    nombre character varying(80) NOT NULL,
    descripcion text,
    activa boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: familias_precio_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.familias_precio_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: familias_precio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.familias_precio_id_seq OWNED BY public.familias_precio.id;


--
-- Name: gasto_categorias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gasto_categorias (
    id bigint NOT NULL,
    nombre character varying(100) NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: gasto_categorias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gasto_categorias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gasto_categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gasto_categorias_id_seq OWNED BY public.gasto_categorias.id;


--
-- Name: gastos_movimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gastos_movimientos (
    id bigint NOT NULL,
    id_gasto bigint NOT NULL,
    tipo_movimiento character varying(40) NOT NULL,
    monto numeric(14,2) NOT NULL,
    detalle text,
    origen_tipo character varying(40),
    origen_id bigint,
    id_usuario bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_gastos_movimientos_tipo CHECK (((tipo_movimiento)::text = ANY ((ARRAY['creacion'::character varying, 'correccion'::character varying, 'anulacion'::character varying, 'pago'::character varying, 'reversion_pago'::character varying])::text[]))),
    CONSTRAINT gastos_movimientos_monto_check CHECK ((monto > (0)::numeric))
);


--
-- Name: gastos_movimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gastos_movimientos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gastos_movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gastos_movimientos_id_seq OWNED BY public.gastos_movimientos.id;


--
-- Name: gastos_operativos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gastos_operativos (
    id bigint NOT NULL,
    fecha date DEFAULT CURRENT_DATE NOT NULL,
    id_sucursal bigint,
    id_categoria_gasto bigint,
    descripcion text NOT NULL,
    monto numeric(14,2) NOT NULL,
    medio_pago character varying(30),
    impacta_caja boolean DEFAULT false NOT NULL,
    id_caja_movimiento bigint,
    periodo_mes date,
    es_recurrente boolean DEFAULT false NOT NULL,
    estado character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    origen_tipo character varying(40),
    origen_id bigint,
    id_usuario bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_gastos_operativos_caja_consistencia CHECK ((((impacta_caja = true) AND (id_caja_movimiento IS NOT NULL)) OR (impacta_caja = false))),
    CONSTRAINT chk_gastos_operativos_estado CHECK (((estado)::text = ANY ((ARRAY['activo'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT gastos_operativos_monto_check CHECK ((monto > (0)::numeric))
);


--
-- Name: gastos_operativos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gastos_operativos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gastos_operativos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gastos_operativos_id_seq OWNED BY public.gastos_operativos.id;


--
-- Name: ingresos_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingresos_stock (
    id bigint NOT NULL,
    id_sucursal bigint NOT NULL,
    id_variante bigint NOT NULL,
    id_proveedor bigint NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    cantidad_ingresada numeric(14,3) NOT NULL,
    costo_productos numeric(14,2) DEFAULT 0 NOT NULL,
    gastos_adicionales numeric(14,2) DEFAULT 0 NOT NULL,
    costo_total_lote numeric(14,2) NOT NULL,
    costo_unitario_calculado numeric(14,4) NOT NULL,
    origen_ingreso character varying(30) DEFAULT 'manual'::character varying NOT NULL,
    observacion text,
    id_usuario bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_ingresos_stock_cantidad_positiva CHECK ((cantidad_ingresada > (0)::numeric)),
    CONSTRAINT chk_ingresos_stock_costos_no_negativos CHECK (((costo_productos >= (0)::numeric) AND (gastos_adicionales >= (0)::numeric) AND (costo_total_lote >= (0)::numeric) AND (costo_unitario_calculado >= (0)::numeric))),
    CONSTRAINT chk_ingresos_stock_origen CHECK (((origen_ingreso)::text = ANY ((ARRAY['inicial'::character varying, 'manual'::character varying, 'compra'::character varying])::text[]))),
    CONSTRAINT chk_ingresos_stock_total_consistente CHECK ((costo_total_lote = (costo_productos + gastos_adicionales)))
);


--
-- Name: ingresos_stock_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ingresos_stock_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingresos_stock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ingresos_stock_id_seq OWNED BY public.ingresos_stock.id;


--
-- Name: marcas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marcas (
    id bigint NOT NULL,
    nombre character varying(100) NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: marcas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.marcas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: marcas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.marcas_id_seq OWNED BY public.marcas.id;


--
-- Name: movimientos_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movimientos_stock (
    id bigint NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    id_sucursal bigint NOT NULL,
    id_variante bigint NOT NULL,
    id_bicicleta_serializada bigint,
    tipo_movimiento character varying(40) NOT NULL,
    cantidad numeric(14,3) NOT NULL,
    costo_unitario_aplicado numeric(14,4),
    origen_tipo character varying(50) NOT NULL,
    origen_id bigint NOT NULL,
    nota text,
    id_usuario bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_movimientos_stock_cantidad_no_cero CHECK ((cantidad <> (0)::numeric)),
    CONSTRAINT chk_movimientos_stock_costo_no_negativo CHECK (((costo_unitario_aplicado IS NULL) OR (costo_unitario_aplicado >= (0)::numeric))),
    CONSTRAINT chk_movimientos_stock_origen_tipo CHECK (((origen_tipo)::text = ANY (ARRAY[('ingreso_stock'::character varying)::text, ('venta'::character varying)::text, ('reserva'::character varying)::text, ('orden_taller'::character varying)::text, ('ajuste_manual'::character varying)::text, ('devolucion_venta'::character varying)::text, ('transferencia'::character varying)::text, ('bicicleta_serializada'::character varying)::text]))),
    CONSTRAINT chk_movimientos_stock_tipo CHECK (((tipo_movimiento)::text = ANY ((ARRAY['ingreso'::character varying, 'reserva'::character varying, 'cancelacion_reserva'::character varying, 'venta'::character varying, 'cancelacion_venta'::character varying, 'entrega'::character varying, 'devolucion_venta'::character varying, 'devolucion'::character varying, 'ajuste'::character varying, 'uso_taller'::character varying, 'reversion_uso_taller'::character varying, 'serializacion'::character varying, 'venta_serializada'::character varying, 'entrega_serializada'::character varying, 'anulacion_serializada'::character varying, 'devolucion_serializada'::character varying])::text[])))
);


--
-- Name: movimientos_stock_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.movimientos_stock_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: movimientos_stock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.movimientos_stock_id_seq OWNED BY public.movimientos_stock.id;


--
-- Name: ordenes_taller; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordenes_taller (
    id bigint NOT NULL,
    fecha_ingreso timestamp with time zone DEFAULT now() NOT NULL,
    id_sucursal bigint NOT NULL,
    id_cliente bigint NOT NULL,
    id_bicicleta_cliente bigint NOT NULL,
    estado character varying(30) DEFAULT 'ingresada'::character varying NOT NULL,
    problema_reportado text NOT NULL,
    observaciones text,
    fecha_prometida timestamp with time zone,
    total_final numeric(14,2) DEFAULT 0 NOT NULL,
    saldo_pendiente numeric(14,2) DEFAULT 0 NOT NULL,
    id_usuario bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id_venta_generada integer,
    fecha_terminada timestamp with time zone,
    fecha_retirada timestamp with time zone,
    cliente_avisado_retiro boolean DEFAULT false NOT NULL,
    fecha_aviso_retiro timestamp with time zone,
    prioridad character varying(20) DEFAULT 'normal'::character varying NOT NULL,
    es_service_postventa boolean DEFAULT false NOT NULL,
    tipo_postventa character varying(30),
    CONSTRAINT chk_ordenes_taller_estado CHECK (((estado)::text = ANY ((ARRAY['ingresada'::character varying, 'presupuestada'::character varying, 'esperando_aprobacion'::character varying, 'esperando_repuestos'::character varying, 'en_reparacion'::character varying, 'terminada'::character varying, 'facturada'::character varying, 'lista_para_retirar'::character varying, 'retirada'::character varying, 'cancelada'::character varying])::text[]))),
    CONSTRAINT chk_ordenes_taller_montos_no_negativos CHECK (((total_final >= (0)::numeric) AND (saldo_pendiente >= (0)::numeric)))
);


--
-- Name: ordenes_taller_eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordenes_taller_eventos (
    id bigint NOT NULL,
    id_orden_taller bigint NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    tipo_evento character varying(40) NOT NULL,
    detalle text,
    id_usuario bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ordenes_taller_eventos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ordenes_taller_eventos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ordenes_taller_eventos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ordenes_taller_eventos_id_seq OWNED BY public.ordenes_taller_eventos.id;


--
-- Name: ordenes_taller_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ordenes_taller_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ordenes_taller_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ordenes_taller_id_seq OWNED BY public.ordenes_taller.id;


--
-- Name: ordenes_taller_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordenes_taller_items (
    id bigint NOT NULL,
    id_orden_taller bigint NOT NULL,
    id_variante bigint,
    etapa character varying(20) DEFAULT 'presupuestado'::character varying NOT NULL,
    descripcion_snapshot character varying(255) NOT NULL,
    cantidad numeric(14,3) DEFAULT 1 NOT NULL,
    precio_unitario numeric(14,2) DEFAULT 0 NOT NULL,
    costo_unitario_aplicado numeric(14,4),
    aprobado boolean DEFAULT false NOT NULL,
    subtotal numeric(14,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tipo_item character varying(20) DEFAULT 'repuesto'::character varying NOT NULL,
    id_servicio_taller bigint,
    CONSTRAINT chk_ordenes_taller_items_cantidad_positiva CHECK ((cantidad > (0)::numeric)),
    CONSTRAINT chk_ordenes_taller_items_etapa CHECK (((etapa)::text = ANY ((ARRAY['presupuestado'::character varying, 'agregado'::character varying, 'ejecutado'::character varying, 'cancelado'::character varying])::text[]))),
    CONSTRAINT chk_ordenes_taller_items_montos_no_negativos CHECK (((precio_unitario >= (0)::numeric) AND (subtotal >= (0)::numeric) AND ((costo_unitario_aplicado IS NULL) OR (costo_unitario_aplicado >= (0)::numeric)))),
    CONSTRAINT chk_oti_tipo_item CHECK (((tipo_item)::text = ANY ((ARRAY['repuesto'::character varying, 'servicio'::character varying])::text[])))
);


--
-- Name: ordenes_taller_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ordenes_taller_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ordenes_taller_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ordenes_taller_items_id_seq OWNED BY public.ordenes_taller_items.id;


--
-- Name: pagos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos (
    id bigint NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    id_cliente bigint,
    origen_tipo character varying(30) NOT NULL,
    origen_id bigint NOT NULL,
    medio_pago character varying(30) NOT NULL,
    monto_total_cobrado numeric(14,2) NOT NULL,
    estado character varying(20) DEFAULT 'confirmado'::character varying NOT NULL,
    nota text,
    id_usuario bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    monto_base_aplicado numeric(14,2) NOT NULL,
    monto_descuento_aplicado numeric(14,2) DEFAULT 0 NOT NULL,
    monto_recargo_aplicado numeric(14,2) DEFAULT 0 NOT NULL,
    CONSTRAINT chk_pagos_estado CHECK (((estado)::text = ANY ((ARRAY['confirmado'::character varying, 'revertido'::character varying, 'devuelto_externo'::character varying])::text[]))),
    CONSTRAINT chk_pagos_medio_pago CHECK (((medio_pago)::text = ANY ((ARRAY['efectivo'::character varying, 'transferencia'::character varying, 'mercadopago'::character varying, 'tarjeta'::character varying])::text[]))),
    CONSTRAINT chk_pagos_monto_positivo CHECK ((monto_total_cobrado > (0)::numeric)),
    CONSTRAINT chk_pagos_origen_tipo CHECK (((origen_tipo)::text = ANY ((ARRAY['venta'::character varying, 'reserva'::character varying, 'orden_taller'::character varying, 'deuda_cliente'::character varying])::text[])))
);


--
-- Name: pagos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pagos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pagos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pagos_id_seq OWNED BY public.pagos.id;


--
-- Name: pagos_reversion_legacy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos_reversion_legacy (
    id bigint CONSTRAINT pagos_reversion_id_not_null NOT NULL,
    id_pago_original bigint CONSTRAINT pagos_reversion_id_pago_original_not_null NOT NULL,
    id_pago_reversion bigint CONSTRAINT pagos_reversion_id_pago_reversion_not_null NOT NULL,
    motivo text CONSTRAINT pagos_reversion_motivo_not_null NOT NULL,
    fecha timestamp without time zone DEFAULT now() CONSTRAINT pagos_reversion_fecha_not_null NOT NULL,
    created_at timestamp without time zone DEFAULT now() CONSTRAINT pagos_reversion_created_at_not_null NOT NULL
);


--
-- Name: pagos_reversion_legacy_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pagos_reversion_legacy_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pagos_reversion_legacy_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pagos_reversion_legacy_id_seq OWNED BY public.pagos_reversion_legacy.id;


--
-- Name: pagos_reversiones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos_reversiones (
    id bigint NOT NULL,
    id_pago_original bigint NOT NULL,
    id_pago_reversion bigint NOT NULL,
    motivo text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_pagos_reversiones_distintos CHECK ((id_pago_original <> id_pago_reversion))
);


--
-- Name: pagos_reversiones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pagos_reversiones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pagos_reversiones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pagos_reversiones_id_seq OWNED BY public.pagos_reversiones.id;


--
-- Name: pagos_tarjeta_detalle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos_tarjeta_detalle (
    id bigint NOT NULL,
    id_pago bigint NOT NULL,
    monto_base numeric(14,2) NOT NULL,
    monto_recargo_financiero numeric(14,2) DEFAULT 0 NOT NULL,
    monto_neto_liquidado numeric(14,2) NOT NULL,
    cuotas integer,
    entidad character varying(100),
    observacion text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    id_tarjeta_plan bigint,
    porcentaje_recargo_aplicado numeric(10,4),
    CONSTRAINT chk_pagos_tarjeta_montos CHECK (((monto_base >= (0)::numeric) AND (monto_recargo_financiero >= (0)::numeric) AND (monto_neto_liquidado >= (0)::numeric)))
);


--
-- Name: pagos_tarjeta_detalle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pagos_tarjeta_detalle_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pagos_tarjeta_detalle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pagos_tarjeta_detalle_id_seq OWNED BY public.pagos_tarjeta_detalle.id;


--
-- Name: permisos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permisos (
    id bigint NOT NULL,
    codigo character varying(100) NOT NULL,
    descripcion text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permisos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permisos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permisos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permisos_id_seq OWNED BY public.permisos.id;


--
-- Name: precios_movimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.precios_movimientos (
    id bigint NOT NULL,
    id_variante bigint NOT NULL,
    precio_minorista_anterior numeric(14,2),
    precio_minorista_nuevo numeric(14,2),
    precio_mayorista_anterior numeric(14,2),
    precio_mayorista_nuevo numeric(14,2),
    costo_anterior numeric(14,4),
    costo_nuevo numeric(14,4),
    tipo_movimiento character varying(40) NOT NULL,
    motivo text,
    origen_tipo character varying(40),
    origen_id bigint,
    id_usuario bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_precios_mov_al_menos_un_cambio CHECK (((precio_minorista_anterior IS DISTINCT FROM precio_minorista_nuevo) OR (precio_mayorista_anterior IS DISTINCT FROM precio_mayorista_nuevo) OR (costo_anterior IS DISTINCT FROM costo_nuevo))),
    CONSTRAINT chk_precios_mov_tipo CHECK (((tipo_movimiento)::text = ANY ((ARRAY['actualizacion_manual'::character varying, 'actualizacion_por_ingreso_stock'::character varying, 'actualizacion_por_lista_proveedor'::character varying, 'correccion_error'::character varying, 'cambio_margen'::character varying])::text[])))
);


--
-- Name: precios_movimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.precios_movimientos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: precios_movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.precios_movimientos_id_seq OWNED BY public.precios_movimientos.id;


--
-- Name: producto_ficha_tecnica; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producto_ficha_tecnica (
    id bigint NOT NULL,
    id_producto bigint NOT NULL,
    grupo character varying(80) NOT NULL,
    clave character varying(120) NOT NULL,
    valor text NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: producto_ficha_tecnica_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.producto_ficha_tecnica_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: producto_ficha_tecnica_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.producto_ficha_tecnica_id_seq OWNED BY public.producto_ficha_tecnica.id;


--
-- Name: productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos (
    id bigint NOT NULL,
    id_categoria bigint NOT NULL,
    nombre character varying(150) NOT NULL,
    tipo_item character varying(20) NOT NULL,
    stockeable boolean DEFAULT true NOT NULL,
    serializable boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    descripcion text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id_marca bigint,
    rodado character varying(30),
    tipo_bicicleta character varying(80),
    material_cuadro character varying(80),
    id_familia_precio bigint,
    CONSTRAINT chk_productos_serializable_stockeable CHECK (((serializable = false) OR ((serializable = true) AND (stockeable = true)))),
    CONSTRAINT chk_productos_tipo_item CHECK (((tipo_item)::text = ANY ((ARRAY['producto'::character varying, 'servicio'::character varying])::text[])))
);


--
-- Name: productos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productos_id_seq OWNED BY public.productos.id;


--
-- Name: proveedores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proveedores (
    id bigint NOT NULL,
    nombre character varying(150) NOT NULL,
    telefono character varying(50),
    email character varying(150),
    notas text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: proveedores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.proveedores_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: proveedores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.proveedores_id_seq OWNED BY public.proveedores.id;


--
-- Name: reglas_comerciales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reglas_comerciales (
    id bigint NOT NULL,
    nombre character varying(120) NOT NULL,
    tipo character varying(30) NOT NULL,
    medio_pago character varying(30),
    porcentaje numeric(10,4),
    monto_fijo numeric(14,2),
    requiere_pago_total boolean DEFAULT false NOT NULL,
    combinable boolean DEFAULT false NOT NULL,
    prioridad integer DEFAULT 100 NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    fecha_desde timestamp with time zone,
    fecha_hasta timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_reglas_comerciales_medio_pago CHECK (((medio_pago IS NULL) OR ((medio_pago)::text = ANY ((ARRAY['efectivo'::character varying, 'transferencia'::character varying, 'mercadopago'::character varying, 'tarjeta'::character varying])::text[])))),
    CONSTRAINT chk_reglas_comerciales_monto_fijo CHECK (((monto_fijo IS NULL) OR (monto_fijo >= (0)::numeric))),
    CONSTRAINT chk_reglas_comerciales_porcentaje CHECK (((porcentaje IS NULL) OR (porcentaje >= (0)::numeric))),
    CONSTRAINT chk_reglas_comerciales_tipo CHECK (((tipo)::text = ANY ((ARRAY['descuento'::character varying, 'recargo'::character varying])::text[]))),
    CONSTRAINT chk_reglas_comerciales_valor CHECK (((porcentaje IS NOT NULL) OR (monto_fijo IS NOT NULL)))
);


--
-- Name: reglas_comerciales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reglas_comerciales_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reglas_comerciales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reglas_comerciales_id_seq OWNED BY public.reglas_comerciales.id;


--
-- Name: reglas_distribucion_resultado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reglas_distribucion_resultado (
    id bigint NOT NULL,
    nombre character varying(120) NOT NULL,
    descripcion text,
    activa boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reglas_distribucion_resultado_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reglas_distribucion_resultado_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reglas_distribucion_resultado_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reglas_distribucion_resultado_id_seq OWNED BY public.reglas_distribucion_resultado.id;


--
-- Name: reglas_distribucion_resultado_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reglas_distribucion_resultado_items (
    id bigint NOT NULL,
    id_regla bigint NOT NULL,
    id_participante bigint NOT NULL,
    porcentaje numeric(7,4) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_rdr_items_porcentaje CHECK (((porcentaje > (0)::numeric) AND (porcentaje <= (100)::numeric)))
);


--
-- Name: reglas_distribucion_resultado_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reglas_distribucion_resultado_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reglas_distribucion_resultado_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reglas_distribucion_resultado_items_id_seq OWNED BY public.reglas_distribucion_resultado_items.id;


--
-- Name: reglas_precio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reglas_precio (
    id bigint NOT NULL,
    nombre character varying(100) NOT NULL,
    id_categoria bigint,
    id_marca bigint,
    tipo_cliente character varying(30) NOT NULL,
    margen_porcentaje numeric(7,4) NOT NULL,
    redondeo_base numeric(14,2) DEFAULT 100 NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    descuento_base_porcentaje numeric(7,4) DEFAULT 0 NOT NULL,
    margen_minimo_porcentaje numeric(7,4) DEFAULT 0 NOT NULL,
    id_familia_precio bigint,
    id_proveedor bigint,
    CONSTRAINT chk_reglas_precio_descuento_base CHECK (((descuento_base_porcentaje >= (0)::numeric) AND (descuento_base_porcentaje < (100)::numeric))),
    CONSTRAINT chk_reglas_precio_margen_minimo CHECK ((margen_minimo_porcentaje >= (0)::numeric)),
    CONSTRAINT chk_reglas_precio_margen_no_negativo CHECK ((margen_porcentaje >= (0)::numeric)),
    CONSTRAINT chk_reglas_precio_redondeo_positivo CHECK ((redondeo_base > (0)::numeric)),
    CONSTRAINT chk_reglas_precio_tipo_cliente CHECK (((tipo_cliente)::text = ANY ((ARRAY['minorista'::character varying, 'mayorista'::character varying])::text[])))
);


--
-- Name: reglas_precio_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reglas_precio_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reglas_precio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reglas_precio_id_seq OWNED BY public.reglas_precio.id;


--
-- Name: reserva_eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reserva_eventos (
    id bigint NOT NULL,
    id_reserva bigint NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    tipo_evento character varying(40) NOT NULL,
    detalle text,
    id_usuario bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_reserva_eventos_tipo CHECK (((tipo_evento)::text = ANY ((ARRAY['creada'::character varying, 'senal_recibida'::character varying, 'vencida'::character varying, 'cancelada'::character varying, 'sena_perdida'::character varying, 'convertida_en_venta'::character varying, 'asignacion_serie'::character varying, 'cambio_estado'::character varying])::text[])))
);


--
-- Name: reserva_eventos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reserva_eventos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reserva_eventos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reserva_eventos_id_seq OWNED BY public.reserva_eventos.id;


--
-- Name: reserva_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reserva_items (
    id bigint NOT NULL,
    id_reserva bigint NOT NULL,
    id_variante bigint NOT NULL,
    id_bicicleta_serializada bigint,
    cantidad numeric(14,3) DEFAULT 1 NOT NULL,
    precio_estimado numeric(14,2) DEFAULT 0 NOT NULL,
    subtotal_estimado numeric(14,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_reserva_items_bici_serializada_cantidad CHECK (((id_bicicleta_serializada IS NULL) OR (cantidad = (1)::numeric))),
    CONSTRAINT chk_reserva_items_cantidad_positiva CHECK ((cantidad > (0)::numeric)),
    CONSTRAINT chk_reserva_items_montos_no_negativos CHECK (((precio_estimado >= (0)::numeric) AND (subtotal_estimado >= (0)::numeric)))
);


--
-- Name: reserva_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reserva_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reserva_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reserva_items_id_seq OWNED BY public.reserva_items.id;


--
-- Name: reservas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservas (
    id bigint NOT NULL,
    fecha_reserva timestamp with time zone DEFAULT now() NOT NULL,
    id_cliente bigint NOT NULL,
    id_sucursal bigint NOT NULL,
    tipo_reserva character varying(20) DEFAULT 'comun'::character varying NOT NULL,
    estado character varying(30) DEFAULT 'activa'::character varying NOT NULL,
    fecha_vencimiento timestamp with time zone,
    fecha_inicio_financiacion timestamp with time zone,
    plazo_sin_recargo_dias integer,
    fecha_inicio_recargo timestamp with time zone,
    tasa_recargo numeric(7,4),
    sena_total numeric(14,2) DEFAULT 0 NOT NULL,
    saldo_estimado numeric(14,2) DEFAULT 0 NOT NULL,
    sena_perdida boolean DEFAULT false NOT NULL,
    nota text,
    id_usuario bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_reservas_comun_sin_financiacion CHECK ((((tipo_reserva)::text <> 'comun'::text) OR ((fecha_inicio_financiacion IS NULL) AND (plazo_sin_recargo_dias IS NULL) AND (fecha_inicio_recargo IS NULL) AND (tasa_recargo IS NULL)))),
    CONSTRAINT chk_reservas_estado CHECK (((estado)::text = ANY ((ARRAY['activa'::character varying, 'vencida'::character varying, 'cancelada'::character varying, 'convertida_en_venta'::character varying])::text[]))),
    CONSTRAINT chk_reservas_financiada_campos CHECK ((((tipo_reserva)::text = 'comun'::text) OR (((tipo_reserva)::text = 'financiada'::text) AND (fecha_inicio_financiacion IS NOT NULL) AND (plazo_sin_recargo_dias IS NOT NULL) AND (fecha_inicio_recargo IS NOT NULL) AND (tasa_recargo IS NOT NULL)))),
    CONSTRAINT chk_reservas_montos_no_negativos CHECK (((sena_total >= (0)::numeric) AND (saldo_estimado >= (0)::numeric))),
    CONSTRAINT chk_reservas_plazo_no_negativo CHECK (((plazo_sin_recargo_dias IS NULL) OR (plazo_sin_recargo_dias >= 0))),
    CONSTRAINT chk_reservas_tasa_no_negativa CHECK (((tasa_recargo IS NULL) OR (tasa_recargo >= (0)::numeric))),
    CONSTRAINT chk_reservas_tipo CHECK (((tipo_reserva)::text = ANY ((ARRAY['comun'::character varying, 'financiada'::character varying])::text[])))
);


--
-- Name: reservas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reservas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reservas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reservas_id_seq OWNED BY public.reservas.id;


--
-- Name: rol_permisos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rol_permisos (
    id_rol bigint NOT NULL,
    id_permiso bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id bigint NOT NULL,
    nombre character varying(80) NOT NULL,
    descripcion text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: servicios_taller; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicios_taller (
    id bigint NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion text,
    precio_sugerido numeric(14,2) DEFAULT 0 NOT NULL,
    duracion_estimada_min integer,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_servicios_taller_duracion_positiva CHECK (((duracion_estimada_min IS NULL) OR (duracion_estimada_min > 0))),
    CONSTRAINT chk_servicios_taller_precio_no_negativo CHECK ((precio_sugerido >= (0)::numeric))
);


--
-- Name: servicios_taller_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.servicios_taller_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: servicios_taller_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.servicios_taller_id_seq OWNED BY public.servicios_taller.id;


--
-- Name: stock_sucursal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_sucursal (
    id bigint NOT NULL,
    id_sucursal bigint NOT NULL,
    id_variante bigint NOT NULL,
    stock_fisico numeric(14,3) DEFAULT 0 NOT NULL,
    stock_reservado numeric(14,3) DEFAULT 0 NOT NULL,
    stock_vendido_pendiente_entrega numeric(14,3) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_stock_sucursal_no_negativo CHECK (((stock_fisico >= (0)::numeric) AND (stock_reservado >= (0)::numeric) AND (stock_vendido_pendiente_entrega >= (0)::numeric)))
);


--
-- Name: stock_sucursal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_sucursal_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_sucursal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_sucursal_id_seq OWNED BY public.stock_sucursal.id;


--
-- Name: sucursales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sucursales (
    id bigint NOT NULL,
    nombre character varying(120) NOT NULL,
    direccion character varying(200),
    activa boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sucursales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sucursales_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sucursales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sucursales_id_seq OWNED BY public.sucursales.id;


--
-- Name: tarjeta_planes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tarjeta_planes (
    id bigint NOT NULL,
    nombre character varying(120) NOT NULL,
    medio_pago character varying(30) DEFAULT 'tarjeta'::character varying NOT NULL,
    entidad character varying(100),
    cuotas integer NOT NULL,
    porcentaje_recargo_cliente numeric(10,4) DEFAULT 0 NOT NULL,
    porcentaje_costo_financiero numeric(10,4) DEFAULT 0 NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    fecha_desde timestamp with time zone,
    fecha_hasta timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_tarjeta_planes_costo CHECK ((porcentaje_costo_financiero >= (0)::numeric)),
    CONSTRAINT chk_tarjeta_planes_cuotas CHECK ((cuotas > 0)),
    CONSTRAINT chk_tarjeta_planes_medio_pago CHECK (((medio_pago)::text = ANY ((ARRAY['tarjeta'::character varying, 'mercadopago'::character varying])::text[]))),
    CONSTRAINT chk_tarjeta_planes_recargo CHECK ((porcentaje_recargo_cliente >= (0)::numeric))
);


--
-- Name: tarjeta_planes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tarjeta_planes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tarjeta_planes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tarjeta_planes_id_seq OWNED BY public.tarjeta_planes.id;


--
-- Name: tipos_evento_taller; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipos_evento_taller (
    codigo character varying(50) NOT NULL,
    descripcion text NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: usuario_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_roles (
    id_usuario bigint NOT NULL,
    id_rol bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id bigint NOT NULL,
    nombre character varying(120) NOT NULL,
    email character varying(150),
    username character varying(80) NOT NULL,
    password_hash text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: venta_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venta_items (
    id bigint NOT NULL,
    id_venta bigint NOT NULL,
    id_variante bigint,
    id_bicicleta_serializada bigint,
    descripcion_snapshot character varying(255) NOT NULL,
    cantidad numeric(14,3) DEFAULT 1 NOT NULL,
    precio_lista numeric(14,2) DEFAULT 0 NOT NULL,
    precio_final numeric(14,2) DEFAULT 0 NOT NULL,
    costo_unitario_aplicado numeric(14,4) DEFAULT 0 NOT NULL,
    subtotal numeric(14,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bonificado boolean DEFAULT false NOT NULL,
    motivo_bonificacion text,
    motivo_precio_manual text,
    precio_unitario_original numeric(14,2),
    precio_unitario_final numeric(14,2),
    iva_porcentaje numeric(5,2) DEFAULT 21 NOT NULL,
    iva_monto numeric(14,2) DEFAULT 0 NOT NULL,
    subtotal_neto numeric(14,2) DEFAULT 0 NOT NULL,
    id_orden_taller_item integer,
    tipo_item character varying(30) DEFAULT 'producto'::character varying NOT NULL,
    id_servicio_taller bigint,
    CONSTRAINT chk_venta_items_bici_serializada_cantidad CHECK (((id_bicicleta_serializada IS NULL) OR (cantidad = (1)::numeric))),
    CONSTRAINT chk_venta_items_cantidad_positiva CHECK ((cantidad > (0)::numeric)),
    CONSTRAINT chk_venta_items_montos_no_negativos CHECK (((precio_lista >= (0)::numeric) AND (precio_final >= (0)::numeric) AND (costo_unitario_aplicado >= (0)::numeric) AND (subtotal >= (0)::numeric))),
    CONSTRAINT chk_venta_items_referencia_por_tipo CHECK (((((tipo_item)::text = 'producto'::text) AND (id_variante IS NOT NULL) AND (id_servicio_taller IS NULL)) OR (((tipo_item)::text = 'servicio_taller'::text) AND (id_variante IS NULL) AND (id_servicio_taller IS NOT NULL) AND (id_bicicleta_serializada IS NULL)))),
    CONSTRAINT chk_venta_items_tipo_item CHECK (((tipo_item)::text = ANY ((ARRAY['producto'::character varying, 'servicio_taller'::character varying])::text[])))
);


--
-- Name: ventas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ventas (
    id bigint NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    id_sucursal bigint NOT NULL,
    id_cliente bigint NOT NULL,
    estado character varying(30) DEFAULT 'creada'::character varying NOT NULL,
    subtotal_base numeric(14,2) DEFAULT 0 NOT NULL,
    descuento_total numeric(14,2) DEFAULT 0 NOT NULL,
    recargo_total numeric(14,2) DEFAULT 0 NOT NULL,
    total_final numeric(14,2) DEFAULT 0 NOT NULL,
    saldo_pendiente numeric(14,2) DEFAULT 0 NOT NULL,
    entrega_con_deuda_autorizada boolean DEFAULT false NOT NULL,
    motivo_excepcion text,
    id_usuario_creador bigint NOT NULL,
    id_usuario_autorizador bigint,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id_reserva_origen bigint,
    subtotal_neto numeric(14,2) DEFAULT 0 NOT NULL,
    iva_total numeric(14,2) DEFAULT 0 NOT NULL,
    tipo_precio character varying(20) DEFAULT 'minorista'::character varying NOT NULL,
    id_orden_taller integer,
    CONSTRAINT chk_ventas_estado CHECK (((estado)::text = ANY ((ARRAY['creada'::character varying, 'pagada_parcial'::character varying, 'pagada_total'::character varying, 'entregada'::character varying, 'anulada'::character varying, 'devuelta'::character varying, 'devuelta_parcial'::character varying])::text[]))),
    CONSTRAINT chk_ventas_montos_no_negativos CHECK (((subtotal_base >= (0)::numeric) AND (descuento_total >= (0)::numeric) AND (recargo_total >= (0)::numeric) AND (total_final >= (0)::numeric) AND (saldo_pendiente >= (0)::numeric))),
    CONSTRAINT chk_ventas_tipo_precio CHECK (((tipo_precio)::text = ANY (ARRAY[('minorista'::character varying)::text, ('mayorista'::character varying)::text])))
);


--
-- Name: v_metricas_ganancia_bruta_mensual; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_metricas_ganancia_bruta_mensual AS
 SELECT (date_trunc('month'::text, v.fecha))::date AS periodo_mes,
    v.id_sucursal,
    (sum(vi.subtotal))::numeric(14,2) AS ventas_items_total,
    (sum((vi.costo_unitario_aplicado * vi.cantidad)))::numeric(14,2) AS costo_mercaderia_vendida,
    ((sum(vi.subtotal) - sum((vi.costo_unitario_aplicado * vi.cantidad))))::numeric(14,2) AS ganancia_bruta
   FROM (public.ventas v
     JOIN public.venta_items vi ON ((vi.id_venta = v.id)))
  WHERE ((v.estado)::text <> 'anulada'::text)
  GROUP BY ((date_trunc('month'::text, v.fecha))::date), v.id_sucursal;


--
-- Name: v_metricas_gastos_mensual; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_metricas_gastos_mensual AS
 SELECT (date_trunc('month'::text, (COALESCE(periodo_mes, fecha))::timestamp with time zone))::date AS periodo_mes,
    id_sucursal,
    (sum(monto))::numeric(14,2) AS gastos_operativos
   FROM public.gastos_operativos go
  WHERE ((estado)::text = 'activo'::text)
  GROUP BY ((date_trunc('month'::text, (COALESCE(periodo_mes, fecha))::timestamp with time zone))::date), id_sucursal;


--
-- Name: v_metricas_ganancia_neta_mensual; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_metricas_ganancia_neta_mensual AS
 SELECT gb.periodo_mes,
    gb.id_sucursal,
    gb.ventas_items_total,
    gb.costo_mercaderia_vendida,
    gb.ganancia_bruta,
    (COALESCE(gm.gastos_operativos, (0)::numeric))::numeric(14,2) AS gastos_operativos,
    ((gb.ganancia_bruta - COALESCE(gm.gastos_operativos, (0)::numeric)))::numeric(14,2) AS ganancia_neta_estimada
   FROM (public.v_metricas_ganancia_bruta_mensual gb
     LEFT JOIN public.v_metricas_gastos_mensual gm ON (((gm.periodo_mes = gb.periodo_mes) AND (NOT (gm.id_sucursal IS DISTINCT FROM gb.id_sucursal)))));


--
-- Name: variantes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variantes (
    id bigint NOT NULL,
    id_producto bigint NOT NULL,
    nombre_variante character varying(150) NOT NULL,
    sku character varying(100),
    codigo_barras character varying(100),
    proveedor_preferido_id bigint,
    alicuota_iva numeric(5,2) DEFAULT 21.00 NOT NULL,
    gravado boolean DEFAULT true NOT NULL,
    precio_minorista numeric(14,2) DEFAULT 0 NOT NULL,
    precio_mayorista numeric(14,2) DEFAULT 0 NOT NULL,
    permite_precio_libre boolean DEFAULT false NOT NULL,
    costo_promedio_vigente numeric(14,4) DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    codigo_proveedor character varying(100),
    talle character varying(50),
    color character varying(120),
    CONSTRAINT chk_variantes_alicuota_iva CHECK ((alicuota_iva = ANY (ARRAY[(0)::numeric, 10.50, 21.00, 27.00]))),
    CONSTRAINT chk_variantes_precios_no_negativos CHECK (((precio_minorista >= (0)::numeric) AND (precio_mayorista >= (0)::numeric) AND (costo_promedio_vigente >= (0)::numeric)))
);


--
-- Name: v_metricas_productos_rentables; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_metricas_productos_rentables AS
 SELECT vi.id_variante,
    p.nombre AS producto,
    var.nombre_variante,
    (sum(vi.cantidad))::numeric(14,3) AS cantidad_vendida,
    (sum(vi.subtotal))::numeric(14,2) AS venta_total,
    (sum((vi.costo_unitario_aplicado * vi.cantidad)))::numeric(14,2) AS costo_total,
    ((sum(vi.subtotal) - sum((vi.costo_unitario_aplicado * vi.cantidad))))::numeric(14,2) AS ganancia_bruta,
        CASE
            WHEN (sum(vi.subtotal) > (0)::numeric) THEN round((((sum(vi.subtotal) - sum((vi.costo_unitario_aplicado * vi.cantidad))) / sum(vi.subtotal)) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS margen_bruto_porcentaje
   FROM (((public.venta_items vi
     JOIN public.ventas v ON ((v.id = vi.id_venta)))
     JOIN public.variantes var ON ((var.id = vi.id_variante)))
     JOIN public.productos p ON ((p.id = var.id_producto)))
  WHERE ((v.estado)::text <> 'anulada'::text)
  GROUP BY vi.id_variante, p.nombre, var.nombre_variante;


--
-- Name: v_metricas_stock_valorizado; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_metricas_stock_valorizado AS
 SELECT ss.id_sucursal,
    ss.id_variante,
    p.nombre AS producto,
    var.nombre_variante,
    ss.stock_fisico,
    var.costo_promedio_vigente,
    ((ss.stock_fisico * var.costo_promedio_vigente))::numeric(14,2) AS valor_stock_estimado
   FROM ((public.stock_sucursal ss
     JOIN public.variantes var ON ((var.id = ss.id_variante)))
     JOIN public.productos p ON ((p.id = var.id_producto)));


--
-- Name: variantes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.variantes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: variantes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.variantes_id_seq OWNED BY public.variantes.id;


--
-- Name: venta_anulaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venta_anulaciones (
    id bigint NOT NULL,
    id_venta bigint NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    motivo text NOT NULL,
    id_usuario bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: venta_anulaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.venta_anulaciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: venta_anulaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.venta_anulaciones_id_seq OWNED BY public.venta_anulaciones.id;


--
-- Name: venta_devoluciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venta_devoluciones (
    id bigint NOT NULL,
    id_venta bigint NOT NULL,
    id_venta_item bigint NOT NULL,
    id_bicicleta_serializada bigint NOT NULL,
    id_sucursal_reingreso bigint NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    motivo text NOT NULL,
    id_usuario bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: venta_devoluciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.venta_devoluciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: venta_devoluciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.venta_devoluciones_id_seq OWNED BY public.venta_devoluciones.id;


--
-- Name: venta_item_devoluciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venta_item_devoluciones (
    id integer NOT NULL,
    id_venta integer NOT NULL,
    id_venta_item integer NOT NULL,
    id_variante integer,
    cantidad_devuelta numeric(14,3) NOT NULL,
    monto_credito_generado numeric(14,2) NOT NULL,
    motivo text NOT NULL,
    id_usuario integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tipo_item character varying(30) DEFAULT 'producto'::character varying NOT NULL,
    id_servicio_taller bigint,
    CONSTRAINT chk_vid_referencia_por_tipo CHECK (((((tipo_item)::text = 'producto'::text) AND (id_variante IS NOT NULL) AND (id_servicio_taller IS NULL)) OR (((tipo_item)::text = 'servicio_taller'::text) AND (id_variante IS NULL) AND (id_servicio_taller IS NOT NULL)))),
    CONSTRAINT chk_vid_tipo_item CHECK (((tipo_item)::text = ANY ((ARRAY['producto'::character varying, 'servicio_taller'::character varying])::text[]))),
    CONSTRAINT venta_item_devoluciones_cantidad_devuelta_check CHECK ((cantidad_devuelta > (0)::numeric)),
    CONSTRAINT venta_item_devoluciones_monto_credito_generado_check CHECK ((monto_credito_generado >= (0)::numeric))
);


--
-- Name: venta_item_devoluciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.venta_item_devoluciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: venta_item_devoluciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.venta_item_devoluciones_id_seq OWNED BY public.venta_item_devoluciones.id;


--
-- Name: venta_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.venta_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: venta_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.venta_items_id_seq OWNED BY public.venta_items.id;


--
-- Name: venta_reglas_aplicadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venta_reglas_aplicadas (
    id bigint NOT NULL,
    id_venta bigint NOT NULL,
    id_regla_comercial bigint,
    tipo character varying(30) NOT NULL,
    descripcion_snapshot character varying(200) NOT NULL,
    monto_aplicado numeric(14,2) NOT NULL,
    porcentaje_aplicado numeric(10,4),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_venta_reglas_aplicadas_monto CHECK ((monto_aplicado >= (0)::numeric)),
    CONSTRAINT chk_venta_reglas_aplicadas_tipo CHECK (((tipo)::text = ANY ((ARRAY['descuento'::character varying, 'recargo'::character varying])::text[])))
);


--
-- Name: venta_reglas_aplicadas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.venta_reglas_aplicadas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: venta_reglas_aplicadas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.venta_reglas_aplicadas_id_seq OWNED BY public.venta_reglas_aplicadas.id;


--
-- Name: ventas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ventas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ventas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ventas_id_seq OWNED BY public.ventas.id;


--
-- Name: agenda_taller id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_taller ALTER COLUMN id SET DEFAULT nextval('public.agenda_taller_id_seq'::regclass);


--
-- Name: agenda_taller_historial id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_taller_historial ALTER COLUMN id SET DEFAULT nextval('public.agenda_taller_historial_id_seq'::regclass);


--
-- Name: auditoria_eventos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_eventos ALTER COLUMN id SET DEFAULT nextval('public.auditoria_eventos_id_seq'::regclass);


--
-- Name: bicicletas_clientes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bicicletas_clientes ALTER COLUMN id SET DEFAULT nextval('public.bicicletas_clientes_id_seq'::regclass);


--
-- Name: bicicletas_serializadas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bicicletas_serializadas ALTER COLUMN id SET DEFAULT nextval('public.bicicletas_serializadas_id_seq'::regclass);


--
-- Name: caja_movimientos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_movimientos ALTER COLUMN id SET DEFAULT nextval('public.caja_movimientos_id_seq'::regclass);


--
-- Name: cajas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cajas ALTER COLUMN id SET DEFAULT nextval('public.cajas_id_seq'::regclass);


--
-- Name: capital_movimientos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_movimientos ALTER COLUMN id SET DEFAULT nextval('public.capital_movimientos_id_seq'::regclass);


--
-- Name: capital_movimientos_historial id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_movimientos_historial ALTER COLUMN id SET DEFAULT nextval('public.capital_movimientos_historial_id_seq'::regclass);


--
-- Name: capital_participantes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_participantes ALTER COLUMN id SET DEFAULT nextval('public.capital_participantes_id_seq'::regclass);


--
-- Name: catalogo_imagenes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_imagenes ALTER COLUMN id SET DEFAULT nextval('public.catalogo_imagenes_id_seq'::regclass);


--
-- Name: categorias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias ALTER COLUMN id SET DEFAULT nextval('public.categorias_id_seq'::regclass);


--
-- Name: cierres_rentabilidad id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierres_rentabilidad ALTER COLUMN id SET DEFAULT nextval('public.cierres_rentabilidad_id_seq'::regclass);


--
-- Name: cierres_rentabilidad_distribuciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierres_rentabilidad_distribuciones ALTER COLUMN id SET DEFAULT nextval('public.cierres_rentabilidad_distribuciones_id_seq'::regclass);


--
-- Name: clientes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes ALTER COLUMN id SET DEFAULT nextval('public.clientes_id_seq'::regclass);


--
-- Name: credito_movimientos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_movimientos ALTER COLUMN id SET DEFAULT nextval('public.credito_movimientos_id_seq'::regclass);


--
-- Name: creditos_cliente id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creditos_cliente ALTER COLUMN id SET DEFAULT nextval('public.creditos_cliente_id_seq'::regclass);


--
-- Name: deuda_movimientos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deuda_movimientos ALTER COLUMN id SET DEFAULT nextval('public.deuda_movimientos_id_seq'::regclass);


--
-- Name: deudas_cliente id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deudas_cliente ALTER COLUMN id SET DEFAULT nextval('public.deudas_cliente_id_seq'::regclass);


--
-- Name: familias_precio id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.familias_precio ALTER COLUMN id SET DEFAULT nextval('public.familias_precio_id_seq'::regclass);


--
-- Name: gasto_categorias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto_categorias ALTER COLUMN id SET DEFAULT nextval('public.gasto_categorias_id_seq'::regclass);


--
-- Name: gastos_movimientos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_movimientos ALTER COLUMN id SET DEFAULT nextval('public.gastos_movimientos_id_seq'::regclass);


--
-- Name: gastos_operativos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_operativos ALTER COLUMN id SET DEFAULT nextval('public.gastos_operativos_id_seq'::regclass);


--
-- Name: ingresos_stock id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos_stock ALTER COLUMN id SET DEFAULT nextval('public.ingresos_stock_id_seq'::regclass);


--
-- Name: marcas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marcas ALTER COLUMN id SET DEFAULT nextval('public.marcas_id_seq'::regclass);


--
-- Name: movimientos_stock id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_stock ALTER COLUMN id SET DEFAULT nextval('public.movimientos_stock_id_seq'::regclass);


--
-- Name: ordenes_taller id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_taller ALTER COLUMN id SET DEFAULT nextval('public.ordenes_taller_id_seq'::regclass);


--
-- Name: ordenes_taller_eventos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_taller_eventos ALTER COLUMN id SET DEFAULT nextval('public.ordenes_taller_eventos_id_seq'::regclass);


--
-- Name: ordenes_taller_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_taller_items ALTER COLUMN id SET DEFAULT nextval('public.ordenes_taller_items_id_seq'::regclass);


--
-- Name: pagos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos ALTER COLUMN id SET DEFAULT nextval('public.pagos_id_seq'::regclass);


--
-- Name: pagos_reversion_legacy id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_reversion_legacy ALTER COLUMN id SET DEFAULT nextval('public.pagos_reversion_legacy_id_seq'::regclass);


--
-- Name: pagos_reversiones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_reversiones ALTER COLUMN id SET DEFAULT nextval('public.pagos_reversiones_id_seq'::regclass);


--
-- Name: pagos_tarjeta_detalle id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_tarjeta_detalle ALTER COLUMN id SET DEFAULT nextval('public.pagos_tarjeta_detalle_id_seq'::regclass);


--
-- Name: permisos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos ALTER COLUMN id SET DEFAULT nextval('public.permisos_id_seq'::regclass);


--
-- Name: precios_movimientos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios_movimientos ALTER COLUMN id SET DEFAULT nextval('public.precios_movimientos_id_seq'::regclass);


--
-- Name: producto_ficha_tecnica id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_ficha_tecnica ALTER COLUMN id SET DEFAULT nextval('public.producto_ficha_tecnica_id_seq'::regclass);


--
-- Name: productos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos ALTER COLUMN id SET DEFAULT nextval('public.productos_id_seq'::regclass);


--
-- Name: proveedores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedores ALTER COLUMN id SET DEFAULT nextval('public.proveedores_id_seq'::regclass);


--
-- Name: reglas_comerciales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_comerciales ALTER COLUMN id SET DEFAULT nextval('public.reglas_comerciales_id_seq'::regclass);


--
-- Name: reglas_distribucion_resultado id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_distribucion_resultado ALTER COLUMN id SET DEFAULT nextval('public.reglas_distribucion_resultado_id_seq'::regclass);


--
-- Name: reglas_distribucion_resultado_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_distribucion_resultado_items ALTER COLUMN id SET DEFAULT nextval('public.reglas_distribucion_resultado_items_id_seq'::regclass);


--
-- Name: reglas_precio id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_precio ALTER COLUMN id SET DEFAULT nextval('public.reglas_precio_id_seq'::regclass);


--
-- Name: reserva_eventos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva_eventos ALTER COLUMN id SET DEFAULT nextval('public.reserva_eventos_id_seq'::regclass);


--
-- Name: reserva_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva_items ALTER COLUMN id SET DEFAULT nextval('public.reserva_items_id_seq'::regclass);


--
-- Name: reservas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas ALTER COLUMN id SET DEFAULT nextval('public.reservas_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: servicios_taller id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios_taller ALTER COLUMN id SET DEFAULT nextval('public.servicios_taller_id_seq'::regclass);


--
-- Name: stock_sucursal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_sucursal ALTER COLUMN id SET DEFAULT nextval('public.stock_sucursal_id_seq'::regclass);


--
-- Name: sucursales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sucursales ALTER COLUMN id SET DEFAULT nextval('public.sucursales_id_seq'::regclass);


--
-- Name: tarjeta_planes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarjeta_planes ALTER COLUMN id SET DEFAULT nextval('public.tarjeta_planes_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: variantes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variantes ALTER COLUMN id SET DEFAULT nextval('public.variantes_id_seq'::regclass);


--
-- Name: venta_anulaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_anulaciones ALTER COLUMN id SET DEFAULT nextval('public.venta_anulaciones_id_seq'::regclass);


--
-- Name: venta_devoluciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_devoluciones ALTER COLUMN id SET DEFAULT nextval('public.venta_devoluciones_id_seq'::regclass);


--
-- Name: venta_item_devoluciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_item_devoluciones ALTER COLUMN id SET DEFAULT nextval('public.venta_item_devoluciones_id_seq'::regclass);


--
-- Name: venta_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_items ALTER COLUMN id SET DEFAULT nextval('public.venta_items_id_seq'::regclass);


--
-- Name: venta_reglas_aplicadas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_reglas_aplicadas ALTER COLUMN id SET DEFAULT nextval('public.venta_reglas_aplicadas_id_seq'::regclass);


--
-- Name: ventas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas ALTER COLUMN id SET DEFAULT nextval('public.ventas_id_seq'::regclass);


--
-- Name: agenda_taller_historial agenda_taller_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_taller_historial
    ADD CONSTRAINT agenda_taller_historial_pkey PRIMARY KEY (id);


--
-- Name: agenda_taller agenda_taller_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_taller
    ADD CONSTRAINT agenda_taller_pkey PRIMARY KEY (id);


--
-- Name: auditoria_eventos auditoria_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_eventos
    ADD CONSTRAINT auditoria_eventos_pkey PRIMARY KEY (id);


--
-- Name: bicicletas_clientes bicicletas_clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bicicletas_clientes
    ADD CONSTRAINT bicicletas_clientes_pkey PRIMARY KEY (id);


--
-- Name: bicicletas_serializadas bicicletas_serializadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bicicletas_serializadas
    ADD CONSTRAINT bicicletas_serializadas_pkey PRIMARY KEY (id);


--
-- Name: caja_movimientos caja_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_movimientos
    ADD CONSTRAINT caja_movimientos_pkey PRIMARY KEY (id);


--
-- Name: cajas cajas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cajas
    ADD CONSTRAINT cajas_pkey PRIMARY KEY (id);


--
-- Name: capital_movimientos_historial capital_movimientos_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_movimientos_historial
    ADD CONSTRAINT capital_movimientos_historial_pkey PRIMARY KEY (id);


--
-- Name: capital_movimientos capital_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_movimientos
    ADD CONSTRAINT capital_movimientos_pkey PRIMARY KEY (id);


--
-- Name: capital_participantes capital_participantes_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_participantes
    ADD CONSTRAINT capital_participantes_nombre_key UNIQUE (nombre);


--
-- Name: capital_participantes capital_participantes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_participantes
    ADD CONSTRAINT capital_participantes_pkey PRIMARY KEY (id);


--
-- Name: catalogo_imagenes catalogo_imagenes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_imagenes
    ADD CONSTRAINT catalogo_imagenes_pkey PRIMARY KEY (id);


--
-- Name: categorias categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY (id);


--
-- Name: cierres_rentabilidad_distribuciones cierres_rentabilidad_distribuciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierres_rentabilidad_distribuciones
    ADD CONSTRAINT cierres_rentabilidad_distribuciones_pkey PRIMARY KEY (id);


--
-- Name: cierres_rentabilidad cierres_rentabilidad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierres_rentabilidad
    ADD CONSTRAINT cierres_rentabilidad_pkey PRIMARY KEY (id);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: credito_movimientos credito_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_movimientos
    ADD CONSTRAINT credito_movimientos_pkey PRIMARY KEY (id);


--
-- Name: creditos_cliente creditos_cliente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creditos_cliente
    ADD CONSTRAINT creditos_cliente_pkey PRIMARY KEY (id);


--
-- Name: deuda_movimientos deuda_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deuda_movimientos
    ADD CONSTRAINT deuda_movimientos_pkey PRIMARY KEY (id);


--
-- Name: deudas_cliente deudas_cliente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deudas_cliente
    ADD CONSTRAINT deudas_cliente_pkey PRIMARY KEY (id);


--
-- Name: familias_precio familias_precio_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.familias_precio
    ADD CONSTRAINT familias_precio_nombre_key UNIQUE (nombre);


--
-- Name: familias_precio familias_precio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.familias_precio
    ADD CONSTRAINT familias_precio_pkey PRIMARY KEY (id);


--
-- Name: gasto_categorias gasto_categorias_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto_categorias
    ADD CONSTRAINT gasto_categorias_nombre_key UNIQUE (nombre);


--
-- Name: gasto_categorias gasto_categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto_categorias
    ADD CONSTRAINT gasto_categorias_pkey PRIMARY KEY (id);


--
-- Name: gastos_movimientos gastos_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_movimientos
    ADD CONSTRAINT gastos_movimientos_pkey PRIMARY KEY (id);


--
-- Name: gastos_operativos gastos_operativos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_operativos
    ADD CONSTRAINT gastos_operativos_pkey PRIMARY KEY (id);


--
-- Name: ingresos_stock ingresos_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos_stock
    ADD CONSTRAINT ingresos_stock_pkey PRIMARY KEY (id);


--
-- Name: marcas marcas_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marcas
    ADD CONSTRAINT marcas_nombre_key UNIQUE (nombre);


--
-- Name: marcas marcas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marcas
    ADD CONSTRAINT marcas_pkey PRIMARY KEY (id);


--
-- Name: movimientos_stock movimientos_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_stock
    ADD CONSTRAINT movimientos_stock_pkey PRIMARY KEY (id);


--
-- Name: ordenes_taller_eventos ordenes_taller_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_taller_eventos
    ADD CONSTRAINT ordenes_taller_eventos_pkey PRIMARY KEY (id);


--
-- Name: ordenes_taller_items ordenes_taller_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_taller_items
    ADD CONSTRAINT ordenes_taller_items_pkey PRIMARY KEY (id);


--
-- Name: ordenes_taller ordenes_taller_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_taller
    ADD CONSTRAINT ordenes_taller_pkey PRIMARY KEY (id);


--
-- Name: pagos pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_pkey PRIMARY KEY (id);


--
-- Name: pagos_reversion_legacy pagos_reversion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_reversion_legacy
    ADD CONSTRAINT pagos_reversion_pkey PRIMARY KEY (id);


--
-- Name: pagos_reversiones pagos_reversiones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_reversiones
    ADD CONSTRAINT pagos_reversiones_pkey PRIMARY KEY (id);


--
-- Name: pagos_tarjeta_detalle pagos_tarjeta_detalle_id_pago_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_tarjeta_detalle
    ADD CONSTRAINT pagos_tarjeta_detalle_id_pago_key UNIQUE (id_pago);


--
-- Name: pagos_tarjeta_detalle pagos_tarjeta_detalle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_tarjeta_detalle
    ADD CONSTRAINT pagos_tarjeta_detalle_pkey PRIMARY KEY (id);


--
-- Name: permisos permisos_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key UNIQUE (codigo);


--
-- Name: permisos permisos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_pkey PRIMARY KEY (id);


--
-- Name: precios_movimientos precios_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios_movimientos
    ADD CONSTRAINT precios_movimientos_pkey PRIMARY KEY (id);


--
-- Name: producto_ficha_tecnica producto_ficha_tecnica_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_ficha_tecnica
    ADD CONSTRAINT producto_ficha_tecnica_pkey PRIMARY KEY (id);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);


--
-- Name: reglas_comerciales reglas_comerciales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_comerciales
    ADD CONSTRAINT reglas_comerciales_pkey PRIMARY KEY (id);


--
-- Name: reglas_distribucion_resultado_items reglas_distribucion_resultado_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_distribucion_resultado_items
    ADD CONSTRAINT reglas_distribucion_resultado_items_pkey PRIMARY KEY (id);


--
-- Name: reglas_distribucion_resultado reglas_distribucion_resultado_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_distribucion_resultado
    ADD CONSTRAINT reglas_distribucion_resultado_nombre_key UNIQUE (nombre);


--
-- Name: reglas_distribucion_resultado reglas_distribucion_resultado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_distribucion_resultado
    ADD CONSTRAINT reglas_distribucion_resultado_pkey PRIMARY KEY (id);


--
-- Name: reglas_precio reglas_precio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_precio
    ADD CONSTRAINT reglas_precio_pkey PRIMARY KEY (id);


--
-- Name: reserva_eventos reserva_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva_eventos
    ADD CONSTRAINT reserva_eventos_pkey PRIMARY KEY (id);


--
-- Name: reserva_items reserva_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva_items
    ADD CONSTRAINT reserva_items_pkey PRIMARY KEY (id);


--
-- Name: reservas reservas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_pkey PRIMARY KEY (id);


--
-- Name: rol_permisos rol_permisos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol_permisos
    ADD CONSTRAINT rol_permisos_pkey PRIMARY KEY (id_rol, id_permiso);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: servicios_taller servicios_taller_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios_taller
    ADD CONSTRAINT servicios_taller_pkey PRIMARY KEY (id);


--
-- Name: stock_sucursal stock_sucursal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_sucursal
    ADD CONSTRAINT stock_sucursal_pkey PRIMARY KEY (id);


--
-- Name: sucursales sucursales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sucursales
    ADD CONSTRAINT sucursales_pkey PRIMARY KEY (id);


--
-- Name: tarjeta_planes tarjeta_planes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarjeta_planes
    ADD CONSTRAINT tarjeta_planes_pkey PRIMARY KEY (id);


--
-- Name: tipos_evento_taller tipos_evento_taller_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_evento_taller
    ADD CONSTRAINT tipos_evento_taller_pkey PRIMARY KEY (codigo);


--
-- Name: bicicletas_serializadas uq_bicicletas_serializadas_numero_cuadro; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bicicletas_serializadas
    ADD CONSTRAINT uq_bicicletas_serializadas_numero_cuadro UNIQUE (numero_cuadro);


--
-- Name: categorias uq_categorias_nombre; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT uq_categorias_nombre UNIQUE (nombre);


--
-- Name: cierres_rentabilidad uq_cierres_rentabilidad_periodo_sucursal; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierres_rentabilidad
    ADD CONSTRAINT uq_cierres_rentabilidad_periodo_sucursal UNIQUE (periodo_mes, id_sucursal);


--
-- Name: pagos_reversiones uq_pagos_reversiones_original; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_reversiones
    ADD CONSTRAINT uq_pagos_reversiones_original UNIQUE (id_pago_original);


--
-- Name: proveedores uq_proveedores_nombre; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT uq_proveedores_nombre UNIQUE (nombre);


--
-- Name: reglas_distribucion_resultado_items uq_rdr_items_regla_participante; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_distribucion_resultado_items
    ADD CONSTRAINT uq_rdr_items_regla_participante UNIQUE (id_regla, id_participante);


--
-- Name: pagos_reversiones uq_reversion_unica; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_reversiones
    ADD CONSTRAINT uq_reversion_unica UNIQUE (id_pago_reversion);


--
-- Name: roles uq_roles_nombre; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT uq_roles_nombre UNIQUE (nombre);


--
-- Name: stock_sucursal uq_stock_sucursal_variante; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_sucursal
    ADD CONSTRAINT uq_stock_sucursal_variante UNIQUE (id_sucursal, id_variante);


--
-- Name: sucursales uq_sucursales_nombre; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sucursales
    ADD CONSTRAINT uq_sucursales_nombre UNIQUE (nombre);


--
-- Name: usuarios uq_usuarios_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT uq_usuarios_email UNIQUE (email);


--
-- Name: usuarios uq_usuarios_username; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT uq_usuarios_username UNIQUE (username);


--
-- Name: variantes uq_variantes_codigo_barras; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variantes
    ADD CONSTRAINT uq_variantes_codigo_barras UNIQUE (codigo_barras);


--
-- Name: variantes uq_variantes_producto_nombre; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variantes
    ADD CONSTRAINT uq_variantes_producto_nombre UNIQUE (id_producto, nombre_variante);


--
-- Name: variantes uq_variantes_sku; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variantes
    ADD CONSTRAINT uq_variantes_sku UNIQUE (sku);


--
-- Name: venta_devoluciones uq_venta_devolucion_item; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_devoluciones
    ADD CONSTRAINT uq_venta_devolucion_item UNIQUE (id_venta_item);


--
-- Name: usuario_roles usuario_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_roles
    ADD CONSTRAINT usuario_roles_pkey PRIMARY KEY (id_usuario, id_rol);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: variantes variantes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variantes
    ADD CONSTRAINT variantes_pkey PRIMARY KEY (id);


--
-- Name: venta_anulaciones venta_anulaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_anulaciones
    ADD CONSTRAINT venta_anulaciones_pkey PRIMARY KEY (id);


--
-- Name: venta_devoluciones venta_devoluciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_devoluciones
    ADD CONSTRAINT venta_devoluciones_pkey PRIMARY KEY (id);


--
-- Name: venta_item_devoluciones venta_item_devoluciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_item_devoluciones
    ADD CONSTRAINT venta_item_devoluciones_pkey PRIMARY KEY (id);


--
-- Name: venta_items venta_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_items
    ADD CONSTRAINT venta_items_pkey PRIMARY KEY (id);


--
-- Name: venta_reglas_aplicadas venta_reglas_aplicadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_reglas_aplicadas
    ADD CONSTRAINT venta_reglas_aplicadas_pkey PRIMARY KEY (id);


--
-- Name: ventas ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_pkey PRIMARY KEY (id);


--
-- Name: idx_agenda_taller_bicicleta_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agenda_taller_bicicleta_cliente ON public.agenda_taller USING btree (id_bicicleta_cliente);


--
-- Name: idx_agenda_taller_cliente_avisado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agenda_taller_cliente_avisado ON public.agenda_taller USING btree (cliente_avisado);


--
-- Name: idx_agenda_taller_fecha_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agenda_taller_fecha_estado ON public.agenda_taller USING btree (fecha, estado);


--
-- Name: idx_agenda_taller_fecha_prometida; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agenda_taller_fecha_prometida ON public.agenda_taller USING btree (fecha_prometida_entrega);


--
-- Name: idx_agenda_taller_historial_turno; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agenda_taller_historial_turno ON public.agenda_taller_historial USING btree (id_turno_agenda, created_at);


--
-- Name: idx_agenda_taller_orden_taller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agenda_taller_orden_taller ON public.agenda_taller USING btree (id_orden_taller);


--
-- Name: idx_agenda_taller_recordatorio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agenda_taller_recordatorio ON public.agenda_taller USING btree (recordatorio_enviado);


--
-- Name: idx_agenda_taller_sucursal_fecha_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agenda_taller_sucursal_fecha_estado ON public.agenda_taller USING btree (id_sucursal, fecha, estado);


--
-- Name: idx_auditoria_eventos_accion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_eventos_accion ON public.auditoria_eventos USING btree (accion);


--
-- Name: idx_auditoria_eventos_entidad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_eventos_entidad ON public.auditoria_eventos USING btree (entidad, entidad_id);


--
-- Name: idx_auditoria_eventos_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_eventos_fecha ON public.auditoria_eventos USING btree (fecha);


--
-- Name: idx_auditoria_eventos_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_eventos_usuario ON public.auditoria_eventos USING btree (id_usuario);


--
-- Name: idx_bicicletas_clientes_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bicicletas_clientes_cliente ON public.bicicletas_clientes USING btree (id_cliente);


--
-- Name: idx_bicicletas_clientes_numero_cuadro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bicicletas_clientes_numero_cuadro ON public.bicicletas_clientes USING btree (numero_cuadro);


--
-- Name: idx_bicicletas_serializadas_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bicicletas_serializadas_estado ON public.bicicletas_serializadas USING btree (estado);


--
-- Name: idx_bicicletas_serializadas_sucursal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bicicletas_serializadas_sucursal ON public.bicicletas_serializadas USING btree (id_sucursal_actual);


--
-- Name: idx_bicicletas_serializadas_variante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bicicletas_serializadas_variante ON public.bicicletas_serializadas USING btree (id_variante);


--
-- Name: idx_caja_mov_caja; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caja_mov_caja ON public.caja_movimientos USING btree (id_caja);


--
-- Name: idx_caja_mov_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caja_mov_fecha ON public.caja_movimientos USING btree (fecha);


--
-- Name: idx_caja_mov_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caja_mov_origen ON public.caja_movimientos USING btree (origen_tipo, origen_id);


--
-- Name: idx_cajas_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cajas_fecha ON public.cajas USING btree (fecha);


--
-- Name: idx_cajas_sucursal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cajas_sucursal ON public.cajas USING btree (id_sucursal);


--
-- Name: idx_capital_movimientos_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capital_movimientos_estado ON public.capital_movimientos USING btree (estado);


--
-- Name: idx_capital_movimientos_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capital_movimientos_fecha ON public.capital_movimientos USING btree (fecha DESC);


--
-- Name: idx_capital_movimientos_participante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capital_movimientos_participante ON public.capital_movimientos USING btree (id_participante);


--
-- Name: idx_capital_movimientos_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capital_movimientos_tipo ON public.capital_movimientos USING btree (tipo_movimiento);


--
-- Name: idx_cierres_rentabilidad_periodo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cierres_rentabilidad_periodo ON public.cierres_rentabilidad USING btree (periodo_mes);


--
-- Name: idx_cierres_rentabilidad_sucursal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cierres_rentabilidad_sucursal ON public.cierres_rentabilidad USING btree (id_sucursal);


--
-- Name: idx_clientes_dni; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_dni ON public.clientes USING btree (dni);


--
-- Name: idx_clientes_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_nombre ON public.clientes USING btree (nombre);


--
-- Name: idx_clientes_telefono; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_telefono ON public.clientes USING btree (telefono);


--
-- Name: idx_crd_cierre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crd_cierre ON public.cierres_rentabilidad_distribuciones USING btree (id_cierre);


--
-- Name: idx_credito_movimientos_id_credito; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credito_movimientos_id_credito ON public.credito_movimientos USING btree (id_credito);


--
-- Name: idx_creditos_cliente_id_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creditos_cliente_id_cliente ON public.creditos_cliente USING btree (id_cliente);


--
-- Name: idx_creditos_cliente_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creditos_cliente_origen ON public.creditos_cliente USING btree (origen_tipo, origen_id);


--
-- Name: idx_deuda_mov_deuda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deuda_mov_deuda ON public.deuda_movimientos USING btree (id_deuda);


--
-- Name: idx_deuda_mov_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deuda_mov_fecha ON public.deuda_movimientos USING btree (fecha);


--
-- Name: idx_deudas_cliente_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deudas_cliente_cliente ON public.deudas_cliente USING btree (id_cliente);


--
-- Name: idx_deudas_cliente_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deudas_cliente_estado ON public.deudas_cliente USING btree (estado);


--
-- Name: idx_deudas_cliente_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deudas_cliente_origen ON public.deudas_cliente USING btree (origen_tipo, origen_id);


--
-- Name: idx_gastos_movimientos_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_movimientos_fecha ON public.gastos_movimientos USING btree (created_at);


--
-- Name: idx_gastos_movimientos_gasto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_movimientos_gasto ON public.gastos_movimientos USING btree (id_gasto);


--
-- Name: idx_gastos_movimientos_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_movimientos_origen ON public.gastos_movimientos USING btree (origen_tipo, origen_id);


--
-- Name: idx_gastos_operativos_categoria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_operativos_categoria ON public.gastos_operativos USING btree (id_categoria_gasto);


--
-- Name: idx_gastos_operativos_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_operativos_estado ON public.gastos_operativos USING btree (estado);


--
-- Name: idx_gastos_operativos_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_operativos_fecha ON public.gastos_operativos USING btree (fecha);


--
-- Name: idx_gastos_operativos_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_operativos_origen ON public.gastos_operativos USING btree (origen_tipo, origen_id);


--
-- Name: idx_gastos_operativos_periodo_mes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_operativos_periodo_mes ON public.gastos_operativos USING btree (periodo_mes);


--
-- Name: idx_gastos_operativos_sucursal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_operativos_sucursal ON public.gastos_operativos USING btree (id_sucursal);


--
-- Name: idx_ingresos_stock_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ingresos_stock_fecha ON public.ingresos_stock USING btree (fecha);


--
-- Name: idx_ingresos_stock_proveedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ingresos_stock_proveedor ON public.ingresos_stock USING btree (id_proveedor);


--
-- Name: idx_ingresos_stock_sucursal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ingresos_stock_sucursal ON public.ingresos_stock USING btree (id_sucursal);


--
-- Name: idx_ingresos_stock_variante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ingresos_stock_variante ON public.ingresos_stock USING btree (id_variante);


--
-- Name: idx_movimientos_stock_bici; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimientos_stock_bici ON public.movimientos_stock USING btree (id_bicicleta_serializada);


--
-- Name: idx_movimientos_stock_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimientos_stock_fecha ON public.movimientos_stock USING btree (fecha);


--
-- Name: idx_movimientos_stock_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimientos_stock_origen ON public.movimientos_stock USING btree (origen_tipo, origen_id);


--
-- Name: idx_movimientos_stock_sucursal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimientos_stock_sucursal ON public.movimientos_stock USING btree (id_sucursal);


--
-- Name: idx_movimientos_stock_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimientos_stock_tipo ON public.movimientos_stock USING btree (tipo_movimiento);


--
-- Name: idx_movimientos_stock_variante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimientos_stock_variante ON public.movimientos_stock USING btree (id_variante);


--
-- Name: idx_ordenes_taller_bicicleta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_taller_bicicleta ON public.ordenes_taller USING btree (id_bicicleta_cliente);


--
-- Name: idx_ordenes_taller_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_taller_cliente ON public.ordenes_taller USING btree (id_cliente);


--
-- Name: idx_ordenes_taller_cliente_avisado_retiro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_taller_cliente_avisado_retiro ON public.ordenes_taller USING btree (cliente_avisado_retiro);


--
-- Name: idx_ordenes_taller_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_taller_estado ON public.ordenes_taller USING btree (estado);


--
-- Name: idx_ordenes_taller_eventos_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_taller_eventos_fecha ON public.ordenes_taller_eventos USING btree (fecha);


--
-- Name: idx_ordenes_taller_eventos_orden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_taller_eventos_orden ON public.ordenes_taller_eventos USING btree (id_orden_taller);


--
-- Name: idx_ordenes_taller_eventos_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_taller_eventos_tipo ON public.ordenes_taller_eventos USING btree (tipo_evento);


--
-- Name: idx_ordenes_taller_fecha_ingreso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_taller_fecha_ingreso ON public.ordenes_taller USING btree (fecha_ingreso);


--
-- Name: idx_ordenes_taller_fecha_prometida; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_taller_fecha_prometida ON public.ordenes_taller USING btree (fecha_prometida);


--
-- Name: idx_ordenes_taller_items_etapa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_taller_items_etapa ON public.ordenes_taller_items USING btree (etapa);


--
-- Name: idx_ordenes_taller_items_orden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_taller_items_orden ON public.ordenes_taller_items USING btree (id_orden_taller);


--
-- Name: idx_ordenes_taller_items_variante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_taller_items_variante ON public.ordenes_taller_items USING btree (id_variante);


--
-- Name: idx_ordenes_taller_prioridad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_taller_prioridad ON public.ordenes_taller USING btree (prioridad);


--
-- Name: idx_ordenes_taller_sucursal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_taller_sucursal ON public.ordenes_taller USING btree (id_sucursal);


--
-- Name: idx_pagos_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagos_cliente ON public.pagos USING btree (id_cliente);


--
-- Name: idx_pagos_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagos_fecha ON public.pagos USING btree (fecha);


--
-- Name: idx_pagos_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagos_origen ON public.pagos USING btree (origen_tipo, origen_id);


--
-- Name: idx_pagos_tarjeta_pago; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagos_tarjeta_pago ON public.pagos_tarjeta_detalle USING btree (id_pago);


--
-- Name: idx_pagos_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagos_usuario ON public.pagos USING btree (id_usuario);


--
-- Name: idx_precios_movimientos_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_precios_movimientos_fecha ON public.precios_movimientos USING btree (created_at);


--
-- Name: idx_precios_movimientos_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_precios_movimientos_origen ON public.precios_movimientos USING btree (origen_tipo, origen_id);


--
-- Name: idx_precios_movimientos_variante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_precios_movimientos_variante ON public.precios_movimientos USING btree (id_variante);


--
-- Name: idx_producto_ficha_tecnica_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producto_ficha_tecnica_producto ON public.producto_ficha_tecnica USING btree (id_producto);


--
-- Name: idx_producto_ficha_tecnica_producto_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producto_ficha_tecnica_producto_activo ON public.producto_ficha_tecnica USING btree (id_producto, activo);


--
-- Name: idx_productos_categoria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productos_categoria ON public.productos USING btree (id_categoria);


--
-- Name: idx_productos_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productos_nombre ON public.productos USING btree (nombre);


--
-- Name: idx_productos_nombre_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productos_nombre_lookup ON public.productos USING btree (nombre);


--
-- Name: idx_rdr_items_regla; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rdr_items_regla ON public.reglas_distribucion_resultado_items USING btree (id_regla);


--
-- Name: idx_reglas_comerciales_activa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reglas_comerciales_activa ON public.reglas_comerciales USING btree (activa);


--
-- Name: idx_reglas_comerciales_tipo_medio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reglas_comerciales_tipo_medio ON public.reglas_comerciales USING btree (tipo, medio_pago, activa);


--
-- Name: idx_reglas_precio_categoria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reglas_precio_categoria ON public.reglas_precio USING btree (id_categoria);


--
-- Name: idx_reglas_precio_marca; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reglas_precio_marca ON public.reglas_precio USING btree (id_marca);


--
-- Name: idx_reglas_precio_tipo_cliente_activa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reglas_precio_tipo_cliente_activa ON public.reglas_precio USING btree (tipo_cliente, activa);


--
-- Name: idx_reserva_eventos_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reserva_eventos_fecha ON public.reserva_eventos USING btree (fecha);


--
-- Name: idx_reserva_eventos_reserva; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reserva_eventos_reserva ON public.reserva_eventos USING btree (id_reserva);


--
-- Name: idx_reserva_eventos_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reserva_eventos_tipo ON public.reserva_eventos USING btree (tipo_evento);


--
-- Name: idx_reserva_items_bici; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reserva_items_bici ON public.reserva_items USING btree (id_bicicleta_serializada);


--
-- Name: idx_reserva_items_reserva; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reserva_items_reserva ON public.reserva_items USING btree (id_reserva);


--
-- Name: idx_reserva_items_variante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reserva_items_variante ON public.reserva_items USING btree (id_variante);


--
-- Name: idx_reservas_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservas_cliente ON public.reservas USING btree (id_cliente);


--
-- Name: idx_reservas_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservas_estado ON public.reservas USING btree (estado);


--
-- Name: idx_reservas_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservas_fecha ON public.reservas USING btree (fecha_reserva);


--
-- Name: idx_reservas_sucursal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservas_sucursal ON public.reservas USING btree (id_sucursal);


--
-- Name: idx_reservas_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservas_tipo ON public.reservas USING btree (tipo_reserva);


--
-- Name: idx_reservas_vencimiento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservas_vencimiento ON public.reservas USING btree (fecha_vencimiento);


--
-- Name: idx_reversion_pago_original; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reversion_pago_original ON public.pagos_reversiones USING btree (id_pago_original);


--
-- Name: idx_stock_sucursal_sucursal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_sucursal_sucursal ON public.stock_sucursal USING btree (id_sucursal);


--
-- Name: idx_stock_sucursal_variante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_sucursal_variante ON public.stock_sucursal USING btree (id_variante);


--
-- Name: idx_variantes_codigo_barras_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variantes_codigo_barras_lookup ON public.variantes USING btree (codigo_barras);


--
-- Name: idx_variantes_codigo_proveedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variantes_codigo_proveedor ON public.variantes USING btree (codigo_proveedor);


--
-- Name: idx_variantes_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variantes_nombre ON public.variantes USING btree (nombre_variante);


--
-- Name: idx_variantes_nombre_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variantes_nombre_lookup ON public.variantes USING btree (nombre_variante);


--
-- Name: idx_variantes_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variantes_producto ON public.variantes USING btree (id_producto);


--
-- Name: idx_variantes_proveedor_codigo_proveedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variantes_proveedor_codigo_proveedor ON public.variantes USING btree (proveedor_preferido_id, codigo_proveedor);


--
-- Name: idx_variantes_proveedor_preferido; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variantes_proveedor_preferido ON public.variantes USING btree (proveedor_preferido_id);


--
-- Name: idx_variantes_sku_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variantes_sku_lookup ON public.variantes USING btree (sku);


--
-- Name: idx_venta_anulaciones_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venta_anulaciones_fecha ON public.venta_anulaciones USING btree (fecha);


--
-- Name: idx_venta_anulaciones_venta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venta_anulaciones_venta ON public.venta_anulaciones USING btree (id_venta);


--
-- Name: idx_venta_devoluciones_bicicleta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venta_devoluciones_bicicleta ON public.venta_devoluciones USING btree (id_bicicleta_serializada);


--
-- Name: idx_venta_devoluciones_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venta_devoluciones_fecha ON public.venta_devoluciones USING btree (fecha);


--
-- Name: idx_venta_devoluciones_venta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venta_devoluciones_venta ON public.venta_devoluciones USING btree (id_venta);


--
-- Name: idx_venta_item_devoluciones_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venta_item_devoluciones_item ON public.venta_item_devoluciones USING btree (id_venta_item);


--
-- Name: idx_venta_item_devoluciones_variante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venta_item_devoluciones_variante ON public.venta_item_devoluciones USING btree (id_variante);


--
-- Name: idx_venta_item_devoluciones_venta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venta_item_devoluciones_venta ON public.venta_item_devoluciones USING btree (id_venta);


--
-- Name: idx_venta_items_bici; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venta_items_bici ON public.venta_items USING btree (id_bicicleta_serializada);


--
-- Name: idx_venta_items_variante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venta_items_variante ON public.venta_items USING btree (id_variante);


--
-- Name: idx_venta_items_venta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venta_items_venta ON public.venta_items USING btree (id_venta);


--
-- Name: idx_venta_reglas_aplicadas_regla; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venta_reglas_aplicadas_regla ON public.venta_reglas_aplicadas USING btree (id_regla_comercial);


--
-- Name: idx_venta_reglas_aplicadas_venta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venta_reglas_aplicadas_venta ON public.venta_reglas_aplicadas USING btree (id_venta);


--
-- Name: idx_ventas_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ventas_cliente ON public.ventas USING btree (id_cliente);


--
-- Name: idx_ventas_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ventas_estado ON public.ventas USING btree (estado);


--
-- Name: idx_ventas_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ventas_fecha ON public.ventas USING btree (fecha);


--
-- Name: idx_ventas_reserva_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ventas_reserva_origen ON public.ventas USING btree (id_reserva_origen);


--
-- Name: idx_ventas_sucursal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ventas_sucursal ON public.ventas USING btree (id_sucursal);


--
-- Name: idx_ventas_usuario_creador; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ventas_usuario_creador ON public.ventas USING btree (id_usuario_creador);


--
-- Name: ix_venta_items_id_orden_taller_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_venta_items_id_orden_taller_item ON public.venta_items USING btree (id_orden_taller_item);


--
-- Name: ux_ordenes_taller_id_venta_generada; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_ordenes_taller_id_venta_generada ON public.ordenes_taller USING btree (id_venta_generada) WHERE (id_venta_generada IS NOT NULL);


--
-- Name: ux_reglas_comerciales_nombre_tipo_medio_activa; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_reglas_comerciales_nombre_tipo_medio_activa ON public.reglas_comerciales USING btree (nombre, tipo, medio_pago, activa);


--
-- Name: ux_ventas_id_orden_taller; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_ventas_id_orden_taller ON public.ventas USING btree (id_orden_taller) WHERE (id_orden_taller IS NOT NULL);


--
-- Name: agenda_taller_historial agenda_taller_historial_id_turno_agenda_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_taller_historial
    ADD CONSTRAINT agenda_taller_historial_id_turno_agenda_fkey FOREIGN KEY (id_turno_agenda) REFERENCES public.agenda_taller(id) ON DELETE CASCADE;


--
-- Name: agenda_taller_historial agenda_taller_historial_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_taller_historial
    ADD CONSTRAINT agenda_taller_historial_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: agenda_taller agenda_taller_id_bicicleta_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_taller
    ADD CONSTRAINT agenda_taller_id_bicicleta_cliente_fkey FOREIGN KEY (id_bicicleta_cliente) REFERENCES public.bicicletas_clientes(id);


--
-- Name: agenda_taller agenda_taller_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_taller
    ADD CONSTRAINT agenda_taller_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id);


--
-- Name: agenda_taller agenda_taller_id_orden_taller_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_taller
    ADD CONSTRAINT agenda_taller_id_orden_taller_fkey FOREIGN KEY (id_orden_taller) REFERENCES public.ordenes_taller(id);


--
-- Name: agenda_taller agenda_taller_id_sucursal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_taller
    ADD CONSTRAINT agenda_taller_id_sucursal_fkey FOREIGN KEY (id_sucursal) REFERENCES public.sucursales(id);


--
-- Name: agenda_taller agenda_taller_id_usuario_creador_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_taller
    ADD CONSTRAINT agenda_taller_id_usuario_creador_fkey FOREIGN KEY (id_usuario_creador) REFERENCES public.usuarios(id);


--
-- Name: auditoria_eventos auditoria_eventos_id_sucursal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_eventos
    ADD CONSTRAINT auditoria_eventos_id_sucursal_fkey FOREIGN KEY (id_sucursal) REFERENCES public.sucursales(id);


--
-- Name: auditoria_eventos auditoria_eventos_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_eventos
    ADD CONSTRAINT auditoria_eventos_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: bicicletas_clientes bicicletas_clientes_id_bicicleta_serializada_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bicicletas_clientes
    ADD CONSTRAINT bicicletas_clientes_id_bicicleta_serializada_fkey FOREIGN KEY (id_bicicleta_serializada) REFERENCES public.bicicletas_serializadas(id);


--
-- Name: bicicletas_clientes bicicletas_clientes_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bicicletas_clientes
    ADD CONSTRAINT bicicletas_clientes_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id);


--
-- Name: bicicletas_clientes bicicletas_clientes_id_orden_service_gratis_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bicicletas_clientes
    ADD CONSTRAINT bicicletas_clientes_id_orden_service_gratis_fkey FOREIGN KEY (id_orden_service_gratis) REFERENCES public.ordenes_taller(id);


--
-- Name: bicicletas_clientes bicicletas_clientes_id_venta_origen_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bicicletas_clientes
    ADD CONSTRAINT bicicletas_clientes_id_venta_origen_fkey FOREIGN KEY (id_venta_origen) REFERENCES public.ventas(id);


--
-- Name: bicicletas_serializadas bicicletas_serializadas_id_sucursal_actual_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bicicletas_serializadas
    ADD CONSTRAINT bicicletas_serializadas_id_sucursal_actual_fkey FOREIGN KEY (id_sucursal_actual) REFERENCES public.sucursales(id);


--
-- Name: bicicletas_serializadas bicicletas_serializadas_id_variante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bicicletas_serializadas
    ADD CONSTRAINT bicicletas_serializadas_id_variante_fkey FOREIGN KEY (id_variante) REFERENCES public.variantes(id);


--
-- Name: caja_movimientos caja_movimientos_id_caja_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_movimientos
    ADD CONSTRAINT caja_movimientos_id_caja_fkey FOREIGN KEY (id_caja) REFERENCES public.cajas(id);


--
-- Name: caja_movimientos caja_movimientos_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_movimientos
    ADD CONSTRAINT caja_movimientos_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: cajas cajas_id_sucursal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cajas
    ADD CONSTRAINT cajas_id_sucursal_fkey FOREIGN KEY (id_sucursal) REFERENCES public.sucursales(id);


--
-- Name: cajas cajas_id_usuario_apertura_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cajas
    ADD CONSTRAINT cajas_id_usuario_apertura_fkey FOREIGN KEY (id_usuario_apertura) REFERENCES public.usuarios(id);


--
-- Name: cajas cajas_id_usuario_cierre_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cajas
    ADD CONSTRAINT cajas_id_usuario_cierre_fkey FOREIGN KEY (id_usuario_cierre) REFERENCES public.usuarios(id);


--
-- Name: capital_movimientos_historial capital_movimientos_historial_id_movimiento_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_movimientos_historial
    ADD CONSTRAINT capital_movimientos_historial_id_movimiento_fkey FOREIGN KEY (id_movimiento) REFERENCES public.capital_movimientos(id);


--
-- Name: capital_movimientos_historial capital_movimientos_historial_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_movimientos_historial
    ADD CONSTRAINT capital_movimientos_historial_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: capital_movimientos capital_movimientos_id_caja_movimiento_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_movimientos
    ADD CONSTRAINT capital_movimientos_id_caja_movimiento_fkey FOREIGN KEY (id_caja_movimiento) REFERENCES public.caja_movimientos(id);


--
-- Name: capital_movimientos capital_movimientos_id_participante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_movimientos
    ADD CONSTRAINT capital_movimientos_id_participante_fkey FOREIGN KEY (id_participante) REFERENCES public.capital_participantes(id);


--
-- Name: capital_movimientos capital_movimientos_id_sucursal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_movimientos
    ADD CONSTRAINT capital_movimientos_id_sucursal_fkey FOREIGN KEY (id_sucursal) REFERENCES public.sucursales(id);


--
-- Name: capital_movimientos capital_movimientos_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_movimientos
    ADD CONSTRAINT capital_movimientos_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: catalogo_imagenes catalogo_imagenes_id_producto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_imagenes
    ADD CONSTRAINT catalogo_imagenes_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id) ON DELETE CASCADE;


--
-- Name: catalogo_imagenes catalogo_imagenes_id_variante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_imagenes
    ADD CONSTRAINT catalogo_imagenes_id_variante_fkey FOREIGN KEY (id_variante) REFERENCES public.variantes(id) ON DELETE CASCADE;


--
-- Name: cierres_rentabilidad_distribuciones cierres_rentabilidad_distribuciones_id_cierre_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierres_rentabilidad_distribuciones
    ADD CONSTRAINT cierres_rentabilidad_distribuciones_id_cierre_fkey FOREIGN KEY (id_cierre) REFERENCES public.cierres_rentabilidad(id) ON DELETE CASCADE;


--
-- Name: cierres_rentabilidad_distribuciones cierres_rentabilidad_distribuciones_id_participante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierres_rentabilidad_distribuciones
    ADD CONSTRAINT cierres_rentabilidad_distribuciones_id_participante_fkey FOREIGN KEY (id_participante) REFERENCES public.capital_participantes(id);


--
-- Name: cierres_rentabilidad cierres_rentabilidad_id_regla_distribucion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierres_rentabilidad
    ADD CONSTRAINT cierres_rentabilidad_id_regla_distribucion_fkey FOREIGN KEY (id_regla_distribucion) REFERENCES public.reglas_distribucion_resultado(id);


--
-- Name: cierres_rentabilidad cierres_rentabilidad_id_sucursal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierres_rentabilidad
    ADD CONSTRAINT cierres_rentabilidad_id_sucursal_fkey FOREIGN KEY (id_sucursal) REFERENCES public.sucursales(id);


--
-- Name: credito_movimientos credito_movimientos_id_credito_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_movimientos
    ADD CONSTRAINT credito_movimientos_id_credito_fkey FOREIGN KEY (id_credito) REFERENCES public.creditos_cliente(id);


--
-- Name: credito_movimientos credito_movimientos_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_movimientos
    ADD CONSTRAINT credito_movimientos_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: creditos_cliente creditos_cliente_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creditos_cliente
    ADD CONSTRAINT creditos_cliente_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id);


--
-- Name: deuda_movimientos deuda_movimientos_id_deuda_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deuda_movimientos
    ADD CONSTRAINT deuda_movimientos_id_deuda_fkey FOREIGN KEY (id_deuda) REFERENCES public.deudas_cliente(id);


--
-- Name: deuda_movimientos deuda_movimientos_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deuda_movimientos
    ADD CONSTRAINT deuda_movimientos_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: deudas_cliente deudas_cliente_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deudas_cliente
    ADD CONSTRAINT deudas_cliente_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id);


--
-- Name: ordenes_taller_eventos fk_ordenes_taller_eventos_tipo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_taller_eventos
    ADD CONSTRAINT fk_ordenes_taller_eventos_tipo FOREIGN KEY (tipo_evento) REFERENCES public.tipos_evento_taller(codigo);


--
-- Name: ordenes_taller_items fk_oti_servicio; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_taller_items
    ADD CONSTRAINT fk_oti_servicio FOREIGN KEY (id_servicio_taller) REFERENCES public.servicios_taller(id);


--
-- Name: pagos_reversion_legacy fk_pago_original; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_reversion_legacy
    ADD CONSTRAINT fk_pago_original FOREIGN KEY (id_pago_original) REFERENCES public.pagos(id);


--
-- Name: pagos_reversion_legacy fk_pago_reversion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_reversion_legacy
    ADD CONSTRAINT fk_pago_reversion FOREIGN KEY (id_pago_reversion) REFERENCES public.pagos(id);


--
-- Name: pagos_tarjeta_detalle fk_pagos_tarjeta_detalle_tarjeta_plan; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_tarjeta_detalle
    ADD CONSTRAINT fk_pagos_tarjeta_detalle_tarjeta_plan FOREIGN KEY (id_tarjeta_plan) REFERENCES public.tarjeta_planes(id);


--
-- Name: rol_permisos fk_rol_permisos_permiso; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol_permisos
    ADD CONSTRAINT fk_rol_permisos_permiso FOREIGN KEY (id_permiso) REFERENCES public.permisos(id) ON DELETE CASCADE;


--
-- Name: rol_permisos fk_rol_permisos_rol; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol_permisos
    ADD CONSTRAINT fk_rol_permisos_rol FOREIGN KEY (id_rol) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: venta_items fk_venta_items_servicio_taller; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_items
    ADD CONSTRAINT fk_venta_items_servicio_taller FOREIGN KEY (id_servicio_taller) REFERENCES public.servicios_taller(id);


--
-- Name: venta_item_devoluciones fk_vid_servicio_taller; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_item_devoluciones
    ADD CONSTRAINT fk_vid_servicio_taller FOREIGN KEY (id_servicio_taller) REFERENCES public.servicios_taller(id);


--
-- Name: gastos_movimientos gastos_movimientos_id_gasto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_movimientos
    ADD CONSTRAINT gastos_movimientos_id_gasto_fkey FOREIGN KEY (id_gasto) REFERENCES public.gastos_operativos(id);


--
-- Name: gastos_movimientos gastos_movimientos_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_movimientos
    ADD CONSTRAINT gastos_movimientos_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: gastos_operativos gastos_operativos_id_caja_movimiento_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_operativos
    ADD CONSTRAINT gastos_operativos_id_caja_movimiento_fkey FOREIGN KEY (id_caja_movimiento) REFERENCES public.caja_movimientos(id);


--
-- Name: gastos_operativos gastos_operativos_id_categoria_gasto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_operativos
    ADD CONSTRAINT gastos_operativos_id_categoria_gasto_fkey FOREIGN KEY (id_categoria_gasto) REFERENCES public.gasto_categorias(id);


--
-- Name: gastos_operativos gastos_operativos_id_sucursal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_operativos
    ADD CONSTRAINT gastos_operativos_id_sucursal_fkey FOREIGN KEY (id_sucursal) REFERENCES public.sucursales(id);


--
-- Name: gastos_operativos gastos_operativos_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_operativos
    ADD CONSTRAINT gastos_operativos_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: ingresos_stock ingresos_stock_id_proveedor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos_stock
    ADD CONSTRAINT ingresos_stock_id_proveedor_fkey FOREIGN KEY (id_proveedor) REFERENCES public.proveedores(id);


--
-- Name: ingresos_stock ingresos_stock_id_sucursal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos_stock
    ADD CONSTRAINT ingresos_stock_id_sucursal_fkey FOREIGN KEY (id_sucursal) REFERENCES public.sucursales(id);


--
-- Name: ingresos_stock ingresos_stock_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos_stock
    ADD CONSTRAINT ingresos_stock_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: ingresos_stock ingresos_stock_id_variante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos_stock
    ADD CONSTRAINT ingresos_stock_id_variante_fkey FOREIGN KEY (id_variante) REFERENCES public.variantes(id);


--
-- Name: movimientos_stock movimientos_stock_id_bicicleta_serializada_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_stock
    ADD CONSTRAINT movimientos_stock_id_bicicleta_serializada_fkey FOREIGN KEY (id_bicicleta_serializada) REFERENCES public.bicicletas_serializadas(id);


--
-- Name: movimientos_stock movimientos_stock_id_sucursal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_stock
    ADD CONSTRAINT movimientos_stock_id_sucursal_fkey FOREIGN KEY (id_sucursal) REFERENCES public.sucursales(id);


--
-- Name: movimientos_stock movimientos_stock_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_stock
    ADD CONSTRAINT movimientos_stock_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: movimientos_stock movimientos_stock_id_variante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_stock
    ADD CONSTRAINT movimientos_stock_id_variante_fkey FOREIGN KEY (id_variante) REFERENCES public.variantes(id);


--
-- Name: ordenes_taller_eventos ordenes_taller_eventos_id_orden_taller_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_taller_eventos
    ADD CONSTRAINT ordenes_taller_eventos_id_orden_taller_fkey FOREIGN KEY (id_orden_taller) REFERENCES public.ordenes_taller(id) ON DELETE CASCADE;


--
-- Name: ordenes_taller_eventos ordenes_taller_eventos_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_taller_eventos
    ADD CONSTRAINT ordenes_taller_eventos_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: ordenes_taller ordenes_taller_id_bicicleta_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_taller
    ADD CONSTRAINT ordenes_taller_id_bicicleta_cliente_fkey FOREIGN KEY (id_bicicleta_cliente) REFERENCES public.bicicletas_clientes(id);


--
-- Name: ordenes_taller ordenes_taller_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_taller
    ADD CONSTRAINT ordenes_taller_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id);


--
-- Name: ordenes_taller ordenes_taller_id_sucursal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_taller
    ADD CONSTRAINT ordenes_taller_id_sucursal_fkey FOREIGN KEY (id_sucursal) REFERENCES public.sucursales(id);


--
-- Name: ordenes_taller ordenes_taller_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_taller
    ADD CONSTRAINT ordenes_taller_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: ordenes_taller ordenes_taller_id_venta_generada_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_taller
    ADD CONSTRAINT ordenes_taller_id_venta_generada_fkey FOREIGN KEY (id_venta_generada) REFERENCES public.ventas(id);


--
-- Name: ordenes_taller_items ordenes_taller_items_id_orden_taller_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_taller_items
    ADD CONSTRAINT ordenes_taller_items_id_orden_taller_fkey FOREIGN KEY (id_orden_taller) REFERENCES public.ordenes_taller(id) ON DELETE CASCADE;


--
-- Name: ordenes_taller_items ordenes_taller_items_id_variante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_taller_items
    ADD CONSTRAINT ordenes_taller_items_id_variante_fkey FOREIGN KEY (id_variante) REFERENCES public.variantes(id);


--
-- Name: pagos pagos_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id);


--
-- Name: pagos pagos_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: pagos_reversiones pagos_reversiones_id_pago_original_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_reversiones
    ADD CONSTRAINT pagos_reversiones_id_pago_original_fkey FOREIGN KEY (id_pago_original) REFERENCES public.pagos(id);


--
-- Name: pagos_reversiones pagos_reversiones_id_pago_reversion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_reversiones
    ADD CONSTRAINT pagos_reversiones_id_pago_reversion_fkey FOREIGN KEY (id_pago_reversion) REFERENCES public.pagos(id);


--
-- Name: pagos_tarjeta_detalle pagos_tarjeta_detalle_id_pago_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_tarjeta_detalle
    ADD CONSTRAINT pagos_tarjeta_detalle_id_pago_fkey FOREIGN KEY (id_pago) REFERENCES public.pagos(id) ON DELETE CASCADE;


--
-- Name: precios_movimientos precios_movimientos_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios_movimientos
    ADD CONSTRAINT precios_movimientos_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: precios_movimientos precios_movimientos_id_variante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios_movimientos
    ADD CONSTRAINT precios_movimientos_id_variante_fkey FOREIGN KEY (id_variante) REFERENCES public.variantes(id);


--
-- Name: producto_ficha_tecnica producto_ficha_tecnica_id_producto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_ficha_tecnica
    ADD CONSTRAINT producto_ficha_tecnica_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id);


--
-- Name: productos productos_id_categoria_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_id_categoria_fkey FOREIGN KEY (id_categoria) REFERENCES public.categorias(id);


--
-- Name: productos productos_id_familia_precio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_id_familia_precio_fkey FOREIGN KEY (id_familia_precio) REFERENCES public.familias_precio(id);


--
-- Name: productos productos_id_marca_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_id_marca_fkey FOREIGN KEY (id_marca) REFERENCES public.marcas(id);


--
-- Name: reglas_distribucion_resultado_items reglas_distribucion_resultado_items_id_participante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_distribucion_resultado_items
    ADD CONSTRAINT reglas_distribucion_resultado_items_id_participante_fkey FOREIGN KEY (id_participante) REFERENCES public.capital_participantes(id);


--
-- Name: reglas_distribucion_resultado_items reglas_distribucion_resultado_items_id_regla_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_distribucion_resultado_items
    ADD CONSTRAINT reglas_distribucion_resultado_items_id_regla_fkey FOREIGN KEY (id_regla) REFERENCES public.reglas_distribucion_resultado(id);


--
-- Name: reglas_precio reglas_precio_id_categoria_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_precio
    ADD CONSTRAINT reglas_precio_id_categoria_fkey FOREIGN KEY (id_categoria) REFERENCES public.categorias(id);


--
-- Name: reglas_precio reglas_precio_id_familia_precio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_precio
    ADD CONSTRAINT reglas_precio_id_familia_precio_fkey FOREIGN KEY (id_familia_precio) REFERENCES public.familias_precio(id);


--
-- Name: reglas_precio reglas_precio_id_marca_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_precio
    ADD CONSTRAINT reglas_precio_id_marca_fkey FOREIGN KEY (id_marca) REFERENCES public.marcas(id);


--
-- Name: reglas_precio reglas_precio_id_proveedor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_precio
    ADD CONSTRAINT reglas_precio_id_proveedor_fkey FOREIGN KEY (id_proveedor) REFERENCES public.proveedores(id);


--
-- Name: reserva_eventos reserva_eventos_id_reserva_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva_eventos
    ADD CONSTRAINT reserva_eventos_id_reserva_fkey FOREIGN KEY (id_reserva) REFERENCES public.reservas(id) ON DELETE CASCADE;


--
-- Name: reserva_eventos reserva_eventos_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva_eventos
    ADD CONSTRAINT reserva_eventos_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: reserva_items reserva_items_id_bicicleta_serializada_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva_items
    ADD CONSTRAINT reserva_items_id_bicicleta_serializada_fkey FOREIGN KEY (id_bicicleta_serializada) REFERENCES public.bicicletas_serializadas(id);


--
-- Name: reserva_items reserva_items_id_reserva_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva_items
    ADD CONSTRAINT reserva_items_id_reserva_fkey FOREIGN KEY (id_reserva) REFERENCES public.reservas(id) ON DELETE CASCADE;


--
-- Name: reserva_items reserva_items_id_variante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva_items
    ADD CONSTRAINT reserva_items_id_variante_fkey FOREIGN KEY (id_variante) REFERENCES public.variantes(id);


--
-- Name: reservas reservas_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id);


--
-- Name: reservas reservas_id_sucursal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_id_sucursal_fkey FOREIGN KEY (id_sucursal) REFERENCES public.sucursales(id);


--
-- Name: reservas reservas_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: stock_sucursal stock_sucursal_id_sucursal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_sucursal
    ADD CONSTRAINT stock_sucursal_id_sucursal_fkey FOREIGN KEY (id_sucursal) REFERENCES public.sucursales(id);


--
-- Name: stock_sucursal stock_sucursal_id_variante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_sucursal
    ADD CONSTRAINT stock_sucursal_id_variante_fkey FOREIGN KEY (id_variante) REFERENCES public.variantes(id);


--
-- Name: usuario_roles usuario_roles_id_rol_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_roles
    ADD CONSTRAINT usuario_roles_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: usuario_roles usuario_roles_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_roles
    ADD CONSTRAINT usuario_roles_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: variantes variantes_id_producto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variantes
    ADD CONSTRAINT variantes_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id);


--
-- Name: variantes variantes_proveedor_preferido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variantes
    ADD CONSTRAINT variantes_proveedor_preferido_id_fkey FOREIGN KEY (proveedor_preferido_id) REFERENCES public.proveedores(id);


--
-- Name: venta_anulaciones venta_anulaciones_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_anulaciones
    ADD CONSTRAINT venta_anulaciones_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: venta_anulaciones venta_anulaciones_id_venta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_anulaciones
    ADD CONSTRAINT venta_anulaciones_id_venta_fkey FOREIGN KEY (id_venta) REFERENCES public.ventas(id) ON DELETE CASCADE;


--
-- Name: venta_devoluciones venta_devoluciones_id_bicicleta_serializada_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_devoluciones
    ADD CONSTRAINT venta_devoluciones_id_bicicleta_serializada_fkey FOREIGN KEY (id_bicicleta_serializada) REFERENCES public.bicicletas_serializadas(id);


--
-- Name: venta_devoluciones venta_devoluciones_id_sucursal_reingreso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_devoluciones
    ADD CONSTRAINT venta_devoluciones_id_sucursal_reingreso_fkey FOREIGN KEY (id_sucursal_reingreso) REFERENCES public.sucursales(id);


--
-- Name: venta_devoluciones venta_devoluciones_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_devoluciones
    ADD CONSTRAINT venta_devoluciones_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: venta_devoluciones venta_devoluciones_id_venta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_devoluciones
    ADD CONSTRAINT venta_devoluciones_id_venta_fkey FOREIGN KEY (id_venta) REFERENCES public.ventas(id);


--
-- Name: venta_devoluciones venta_devoluciones_id_venta_item_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_devoluciones
    ADD CONSTRAINT venta_devoluciones_id_venta_item_fkey FOREIGN KEY (id_venta_item) REFERENCES public.venta_items(id);


--
-- Name: venta_item_devoluciones venta_item_devoluciones_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_item_devoluciones
    ADD CONSTRAINT venta_item_devoluciones_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: venta_item_devoluciones venta_item_devoluciones_id_variante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_item_devoluciones
    ADD CONSTRAINT venta_item_devoluciones_id_variante_fkey FOREIGN KEY (id_variante) REFERENCES public.variantes(id);


--
-- Name: venta_item_devoluciones venta_item_devoluciones_id_venta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_item_devoluciones
    ADD CONSTRAINT venta_item_devoluciones_id_venta_fkey FOREIGN KEY (id_venta) REFERENCES public.ventas(id);


--
-- Name: venta_item_devoluciones venta_item_devoluciones_id_venta_item_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_item_devoluciones
    ADD CONSTRAINT venta_item_devoluciones_id_venta_item_fkey FOREIGN KEY (id_venta_item) REFERENCES public.venta_items(id);


--
-- Name: venta_items venta_items_id_bicicleta_serializada_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_items
    ADD CONSTRAINT venta_items_id_bicicleta_serializada_fkey FOREIGN KEY (id_bicicleta_serializada) REFERENCES public.bicicletas_serializadas(id);


--
-- Name: venta_items venta_items_id_orden_taller_item_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_items
    ADD CONSTRAINT venta_items_id_orden_taller_item_fkey FOREIGN KEY (id_orden_taller_item) REFERENCES public.ordenes_taller_items(id);


--
-- Name: venta_items venta_items_id_variante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_items
    ADD CONSTRAINT venta_items_id_variante_fkey FOREIGN KEY (id_variante) REFERENCES public.variantes(id);


--
-- Name: venta_items venta_items_id_venta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_items
    ADD CONSTRAINT venta_items_id_venta_fkey FOREIGN KEY (id_venta) REFERENCES public.ventas(id) ON DELETE CASCADE;


--
-- Name: venta_reglas_aplicadas venta_reglas_aplicadas_id_regla_comercial_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_reglas_aplicadas
    ADD CONSTRAINT venta_reglas_aplicadas_id_regla_comercial_fkey FOREIGN KEY (id_regla_comercial) REFERENCES public.reglas_comerciales(id);


--
-- Name: venta_reglas_aplicadas venta_reglas_aplicadas_id_venta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_reglas_aplicadas
    ADD CONSTRAINT venta_reglas_aplicadas_id_venta_fkey FOREIGN KEY (id_venta) REFERENCES public.ventas(id);


--
-- Name: ventas ventas_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id);


--
-- Name: ventas ventas_id_orden_taller_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_id_orden_taller_fkey FOREIGN KEY (id_orden_taller) REFERENCES public.ordenes_taller(id);


--
-- Name: ventas ventas_id_reserva_origen_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_id_reserva_origen_fkey FOREIGN KEY (id_reserva_origen) REFERENCES public.reservas(id);


--
-- Name: ventas ventas_id_sucursal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_id_sucursal_fkey FOREIGN KEY (id_sucursal) REFERENCES public.sucursales(id);


--
-- Name: ventas ventas_id_usuario_autorizador_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_id_usuario_autorizador_fkey FOREIGN KEY (id_usuario_autorizador) REFERENCES public.usuarios(id);


--
-- Name: ventas ventas_id_usuario_creador_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_id_usuario_creador_fkey FOREIGN KEY (id_usuario_creador) REFERENCES public.usuarios(id);


--
-- PostgreSQL database dump complete
--

\unrestrict cATzwE2WDSdcaj9yT9lJosPlwM4RJSf8lnvwZFruvpo6FPNIgwXiZlLhfPffcur

