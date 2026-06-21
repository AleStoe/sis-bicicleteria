from pydantic import BaseModel, Field


class ConfiguracionNegocioBase(BaseModel):
    nombre_negocio: str = Field(min_length=1, max_length=120)
    direccion: str | None = None
    telefono: str | None = None
    horarios_retiro: str = Field(min_length=1)
    whatsapp_cierre: str = Field(min_length=1)
    texto_beneficio_pago: str = Field(min_length=1)
    porcentaje_descuento_contado_calculadora_precios: float = Field(default=10, ge=0, lt=100)
    whatsapp_retiro_mostrar_total: bool = True
    whatsapp_retiro_mostrar_trabajos: bool = True
    plantilla_turno_confirmacion: str = Field(min_length=1)
    plantilla_turno_recordatorio: str = Field(min_length=1)
    plantilla_turno_aviso: str = Field(min_length=1)
    plantilla_retiro_taller: str = Field(min_length=1)
    plantilla_cotizacion_whatsapp: str = Field(min_length=1)
    condiciones_presupuesto_taller: str = Field(min_length=1)
    condiciones_cotizacion: str = Field(min_length=1)


class ConfiguracionNegocioUpdate(ConfiguracionNegocioBase):
    pass


class ConfiguracionNegocioOutput(ConfiguracionNegocioBase):
    id: int = 1
