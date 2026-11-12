from sqlalchemy.orm import Session
from .crypto_audit import GENESIS_HASH, calcular_hash_actuacion
from .models import Actuacion, AlertaGestion, Expediente, Postulacion, Proveedor
from .rules_engine import ejecutar_motor_reglas_xai


def crear_actuaciones_secuenciales(
    db: Session,
    expediente: Expediente,
    etapas_data: list[dict],
):
    """
    Crea los 6 eslabones secuenciales (Requerimiento, TDR, Cotizaciones, Buena Pro, Conformidad, Pago)
    calculando determinísticamente el hash SHA-256 encadenado para cada uno.
    """
    hash_prev = GENESIS_HASH
    for idx, item in enumerate(etapas_data, start=1):
        hash_actual = calcular_hash_actuacion(
            id_exp=expediente.codigo,
            etapa=item["etapa"],
            usuario_rol=item["usuario_rol"],
            timestamp=item["timestamp"],
            documento_texto=item["documento_texto"],
            hash_anterior=hash_prev,
        )
        act = Actuacion(
            expediente_id=expediente.id,
            orden=idx,
            etapa=item["etapa"],
            usuario_rol=item["usuario_rol"],
            timestamp=item["timestamp"],
            documento_texto=item["documento_texto"],
            hash_anterior=hash_prev,
            hash_actual=hash_actual,
        )
        db.add(act)
        hash_prev = hash_actual


def poblar_base_datos_sintetica(db: Session) -> dict:
    """
    Generador determinista de 120 expedientes sintéticos (112 limpios + 8 casos trampa de auditoría)
    cumpliendo estrictamente con la Ley N° 29733 (Privacidad por Diseño - códigos anonimizados)
    y la Ley N° 32069 (Ley General de Contrataciones Públicas).
    """
    # Limpiar tablas en orden de dependencias
    db.query(AlertaGestion).delete()
    db.query(Postulacion).delete()
    db.query(Actuacion).delete()
    db.query(Expediente).delete()
    db.query(Proveedor).delete()
    db.commit()

    # -------------------------------------------------------------------------
    # 1. CREAR 24 PROVEEDORES SINTÉTICOS ANONIMIZADOS (PROV-SYN-001 a 024)
    # -------------------------------------------------------------------------
    rubros_base = [
        "Tecnología y Equipamiento Computacional",
        "Equipamiento Científico y de Laboratorio",
        "Infraestructura y Mantenimiento Eléctrico",
        "Mobiliario Académico y Administrativo",
        "Suministros Médicos y Bioseguridad",
        "Servicios de Conectividad y Ciberseguridad",
    ]

    proveedores_lista: list[Proveedor] = []

    for i in range(1, 25):
        codigo = f"PROV-SYN-{i:03d}"
        rubro = rubros_base[(i - 1) % len(rubros_base)]
        rep_id = f"REP-HASH-{1000 + i * 37:04d}X"
        dir_id = f"DIR-HASH-TRUJ-{200 + i * 13:03d}"
        tel_id = f"TEL-HASH-944-{300 + i * 19:03d}"
        es_colusorio = False

        catalogo = (
            f"Catálogo comercial estándar del proveedor {codigo} especializado en {rubro}. "
            f"Ofrece soluciones compatibles con normas técnicas peruanas INACAL, ISO 9001, "
            f"garantía comercial de 24 meses, soporte técnico local en Trujillo, entrega inmediata "
            f"en almacén central institucional y componentes multimarca abiertos."
        )

        # Configurar Anillo de Colusión #1 (PROV-SYN-004, PROV-SYN-005, PROV-SYN-006)
        if i in (4, 5):
            rep_id = "REP-HASH-9981A"
            rubro = "Equipamiento Científico y de Laboratorio"
            es_colusorio = True
        if i in (5, 6):
            dir_id = "DIR-HASH-TRUJ-772"
            tel_id = "TEL-HASH-944-881"
            rubro = "Equipamiento Científico y de Laboratorio"
            es_colusorio = True

        # Configurar Anillo de Colusión #2 (PROV-SYN-007, PROV-SYN-008, PROV-SYN-009)
        if i in (7, 8):
            rep_id = "REP-HASH-4420B"
            rubro = "Infraestructura y Mantenimiento Eléctrico"
            es_colusorio = True
        if i in (8, 9):
            dir_id = "DIR-HASH-TRUJ-509"
            tel_id = "TEL-HASH-944-612"
            rubro = "Infraestructura y Mantenimiento Eléctrico"
            es_colusorio = True

        # Configurar Proveedor con Catálogo Propietario Idéntico al TDR Direccionado (PROV-SYN-014)
        if i == 14:
            rubro = "Tecnología y Equipamiento Computacional"
            es_colusorio = True
            catalogo = (
                "Solución exclusiva de identificación biométrica con arquitectura propietaria BioCore-X99 Quantum, "
                "equipada con sensor multiespectral NanoVein-770 de lectura subcutánea infrarroja a 940nm, "
                "protocolo cerrado de sincronización encriptada SyncLock-UNT v4.8, chasis blindado en aleación "
                "de magnesio anodizado IP69K serie Z-940 con procesador neuronal embebido TensorEdge-Pro 16 TOPS, "
                "fuente redundante HotSwap-550W y licencia perpetua del motor propietario OmniTrack-Enterprise."
            )

        prov = Proveedor(
            codigo=codigo,
            alias_comercial=f"Corporación Proveedora Sintética {i:02d} [{codigo}]",
            rubro=rubro,
            representante_id=rep_id,
            direccion_hash=dir_id,
            telefono_hash=tel_id,
            catalogo_texto=catalogo,
            es_colusorio=es_colusorio,
        )
        db.add(prov)
        proveedores_lista.append(prov)

    db.flush()
    prov_por_codigo = {p.codigo: p for p in proveedores_lista}

    # -------------------------------------------------------------------------
    # 2. DEFINIR LOS 8 CASOS TRAMPA (EXP-2025-UNT-0001 AL EXP-2025-UNT-0008)
    # -------------------------------------------------------------------------
    trampas_spec = [
        # Caso 1, 2 y 3: Fraccionamiento Indebido <= 8 UIT en AREA-TI-03 (mismo mes y rubro)
        {
            "num": 1,
            "objeto": "Adquisición de Módulos de Almacenamiento SAN para Servidores Académicos - Lote I",
            "rubro": "Tecnología y Equipamiento Computacional",
            "area_usuaria": "AREA-TI-03",
            "modalidad": "Contratación Menor (<= 8 UIT)",
            "monto": 41500.00,
            "fecha": "2025-02-04T09:10:00",
            "prov_ganador": "PROV-SYN-014",
            "postores": [("PROV-SYN-014", 41500.00, True), ("PROV-SYN-001", 42600.00, False)],
            "tipo_trampa": "FRACCIONAMIENTO_8UIT",
            "tdr": (
                "Requerimiento técnico para adquisición de arreglos de discos estado sólido empresariales "
                "con interfaz estándar SAS 12Gbps, capacidad 15TB brutos y soporte multiprotocolo estándar."
            ),
        },
        {
            "num": 2,
            "objeto": "Adquisición de Unidades de Expansión y Controladoras SAN para Servidores - Lote II",
            "rubro": "Tecnología y Equipamiento Computacional",
            "area_usuaria": "AREA-TI-03",
            "modalidad": "Contratación Menor (<= 8 UIT)",
            "monto": 40900.00,
            "fecha": "2025-02-11T10:30:00",
            "prov_ganador": "PROV-SYN-014",
            "postores": [("PROV-SYN-014", 40900.00, True), ("PROV-SYN-019", 42100.00, False)],
            "tipo_trampa": "FRACCIONAMIENTO_8UIT",
            "tdr": (
                "Especificaciones técnicas para bandejas de expansión de almacenamiento institucional "
                "compatibles con gabinetes rack estándar de 19 pulgadas y fuentes redundantes estándar."
            ),
        },
        {
            "num": 3,
            "objeto": "Adquisición de Switches de Fibra Canal y Transceptores SAN para Servidores - Lote III",
            "rubro": "Tecnología y Equipamiento Computacional",
            "area_usuaria": "AREA-TI-03",
            "modalidad": "Contratación Menor (<= 8 UIT)",
            "monto": 42100.00,
            "fecha": "2025-02-19T11:45:00",
            "prov_ganador": "PROV-SYN-014",
            "postores": [("PROV-SYN-014", 42100.00, True), ("PROV-SYN-013", 42750.00, False)],
            "tipo_trampa": "FRACCIONAMIENTO_8UIT",
            "tdr": (
                "Requerimiento de conmutadores de red de área de almacenamiento con 24 puertos activos "
                "ópticos SFP+ bajo estándares abiertos IEEE para centro de procesamiento de datos."
            ),
        },
        # Caso 4: Colusión de Proveedores en Grafos (Anillo #1: PROV-SYN-004, 005, 006)
        {
            "num": 4,
            "objeto": "Adquisición de Espectrofotómetros UV-Vis y Centrífugas Refrigeradas para Facultad de Ciencias",
            "rubro": "Equipamiento Científico y de Laboratorio",
            "area_usuaria": "AREA-LAB-01",
            "modalidad": "Licitación Pública Abreviada",
            "monto": 218500.00,
            "fecha": "2025-03-03T08:40:00",
            "prov_ganador": "PROV-SYN-004",
            "postores": [
                ("PROV-SYN-004", 218500.00, True),
                ("PROV-SYN-005", 221900.00, False),
                ("PROV-SYN-006", 224000.00, False),
            ],
            "tipo_trampa": "COLUSION_PROVEEDORES",
            "tdr": (
                "Equipamiento analítico de laboratorio con rango espectral 190-1100 nm, ancho de banda "
                "variable, certificación ISO 17025 y calibración trazable para investigación universitaria."
            ),
        },
        # Caso 5: Colusión de Proveedores en Grafos (Anillo #2: PROV-SYN-007, 008, 009)
        {
            "num": 5,
            "objeto": "Servicio de Mantenimiento Preventivo y Correctivo de Subestaciones Eléctricas de Media Tensión",
            "rubro": "Infraestructura y Mantenimiento Eléctrico",
            "area_usuaria": "AREA-INFRA-02",
            "modalidad": "Concurso Público Abreviado",
            "monto": 174200.00,
            "fecha": "2025-03-08T09:20:00",
            "prov_ganador": "PROV-SYN-007",
            "postores": [
                ("PROV-SYN-007", 174200.00, True),
                ("PROV-SYN-008", 177500.00, False),
                ("PROV-SYN-009", 179800.00, False),
            ],
            "tipo_trampa": "COLUSION_PROVEEDORES",
            "tdr": (
                "Servicio integral de mantenimiento de celdas de media tensión 10/22.9 kV, análisis "
                "cromatográfico de aceite dieléctrico y pruebas de relés de protección según Código Nacional de Electricidad."
            ),
        },
        # Caso 6: Direccionamiento Semántico de TDR (>85% similitud TF-IDF con PROV-SYN-014)
        {
            "num": 6,
            "objeto": "Adquisición de Plataforma Biométrica Híbrida y Terminales Ópticos de Control Patrimonial",
            "rubro": "Tecnología y Equipamiento Computacional",
            "area_usuaria": "AREA-TI-03",
            "modalidad": "Licitación Pública Abreviada",
            "monto": 185400.00,
            "fecha": "2025-03-12T10:00:00",
            "prov_ganador": "PROV-SYN-014",
            "postores": [
                ("PROV-SYN-014", 185400.00, True),
                ("PROV-SYN-001", 198000.00, False),
                ("PROV-SYN-007", 204000.00, False),
            ],
            "tipo_trampa": "DIRECCIONAMIENTO_TDR",
            "tdr": (
                "TÉRMINOS DE REFERENCIA OBLIGATORIOS: Se requiere solución exclusiva de identificación biométrica "
                "con arquitectura propietaria BioCore-X99 Quantum, equipada con sensor multiespectral NanoVein-770 "
                "de lectura subcutánea infrarroja a 940nm, protocolo cerrado de sincronización encriptada SyncLock-UNT v4.8, "
                "chasis blindado en aleación de magnesio anodizado IP69K serie Z-940 con procesador neuronal embebido "
                "TensorEdge-Pro 16 TOPS, fuente redundante HotSwap-550W y licencia perpetua del motor propietario OmniTrack-Enterprise."
            ),
        },
        # Caso 7: Vulneración de Segregación de Funciones (Mismo funcionario FUNC-LOG-01 en todas las fases críticas)
        {
            "num": 7,
            "objeto": "Adquisición de Licencias Corporativas de Software Estadístico y Simulación Numérica",
            "rubro": "Tecnología y Equipamiento Computacional",
            "area_usuaria": "AREA-LAB-02",
            "modalidad": "Licitación Pública Abreviada",
            "monto": 96400.00,
            "fecha": "2025-03-15T08:50:00",
            "prov_ganador": "PROV-SYN-002",
            "postores": [
                ("PROV-SYN-002", 96400.00, True),
                ("PROV-SYN-010", 99200.00, False),
                ("PROV-SYN-016", 101500.00, False),
            ],
            "tipo_trampa": "CONFLICTO_SEGREGACION",
            "tdr": (
                "Suministro de 150 licencias concurrentes en red académica para procesamiento estadístico "
                "multivariado, econometría y modelamiento matemático compatible con Windows y Linux."
            ),
        },
        # Caso 8: Pago Ejecutado sin Conformidad Válida
        {
            "num": 8,
            "objeto": "Suministro e Instalación de Sistema de Climatización de Precisión para Data Center Central",
            "rubro": "Infraestructura y Mantenimiento Eléctrico",
            "area_usuaria": "AREA-INFRA-01",
            "modalidad": "Licitación Pública Abreviada",
            "monto": 148500.00,
            "fecha": "2025-03-18T09:15:00",
            "prov_ganador": "PROV-SYN-003",
            "postores": [
                ("PROV-SYN-003", 148500.00, True),
                ("PROV-SYN-011", 152000.00, False),
                ("PROV-SYN-015", 155800.00, False),
            ],
            "tipo_trampa": "PAGO_SIN_CONFORMIDAD",
            "tdr": (
                "Sistema de aire acondicionado de precisión tipo In-Row de 35 kW con control higrométrico "
                "electrónico, compresor inverter modulante y monitoreo SNMP integrado para centro de datos."
            ),
        },
    ]

    for spec in trampas_spec:
        codigo_exp = f"EXP-2025-UNT-{spec['num']:04d}"
        exp = Expediente(
            codigo=codigo_exp,
            objeto=spec["objeto"],
            rubro=spec["rubro"],
            area_usuaria=spec["area_usuaria"],
            modalidad=spec["modalidad"],
            monto_estimado=spec["monto"],
            fecha_creacion=spec["fecha"],
            estado_expediente="En Revisión OCI",
            tdr_texto=spec["tdr"],
            proveedor_adjudicado_codigo=spec["prov_ganador"],
            nivel_riesgo="ALTO",
            puntaje_riesgo=92,
            integridad_valida=True,
            es_caso_trampa=True,
            tipo_trampa=spec["tipo_trampa"],
        )
        db.add(exp)
        db.flush()

        fecha_dia = spec["fecha"][:10]
        es_segregacion_rota = spec["tipo_trampa"] == "CONFLICTO_SEGREGACION"
        es_pago_sin_conf = spec["tipo_trampa"] == "PAGO_SIN_CONFORMIDAD"

        etapas_data = [
            {
                "etapa": "Requerimiento",
                "usuario_rol": "FUNC-LOG-01" if es_segregacion_rota else f"FUNC-{spec['area_usuaria'].split('-')[1]}-01",
                "timestamp": f"{fecha_dia}T09:00:00",
                "documento_texto": (
                    f"Pedido SIGA N° {1000 + spec['num']} formulado por {spec['area_usuaria']} "
                    f"para '{spec['objeto']}'. Presupuesto estimado: S/ {spec['monto']:,.2f}."
                ),
            },
            {
                "etapa": "TDR",
                "usuario_rol": "FUNC-LOG-01" if es_segregacion_rota else "FUNC-ESP-TEC-02",
                "timestamp": f"{fecha_dia}T11:30:00",
                "documento_texto": spec["tdr"],
            },
            {
                "etapa": "Cotizaciones",
                "usuario_rol": "FUNC-LOG-01",
                "timestamp": f"{fecha_dia}T14:15:00",
                "documento_texto": (
                    f"Indagación de mercado con postores: "
                    + ", ".join([f"{c} (S/ {m:,.2f})" for c, m, _ in spec["postores"]])
                    + "."
                ),
            },
            {
                "etapa": "Buena Pro",
                "usuario_rol": "FUNC-LOG-01" if es_segregacion_rota else "FUNC-COM-SEL-01",
                "timestamp": f"{fecha_dia}T16:45:00",
                "documento_texto": (
                    f"Acta de Otorgamiento de Buena Pro del proceso {codigo_exp} a favor del postor "
                    f"{spec['prov_ganador']} por el monto adjudicado de S/ {spec['monto']:,.2f}."
                ),
            },
            {
                "etapa": "Conformidad",
                "usuario_rol": "FUNC-LOG-01" if es_segregacion_rota else f"FUNC-{spec['area_usuaria'].split('-')[1]}-01",
                "timestamp": f"{fecha_dia}T18:20:00" if not es_pago_sin_conf else f"{fecha_dia}T19:40:00",
                "documento_texto": (
                    "OBSERVADO - SIN ACTA DE RECEPCIÓN DEFINITIVA: Equipos pendientes de prueba de carga térmica; "
                    "pendiente de verificación técnica por el área usuaria."
                    if es_pago_sin_conf
                    else f"Acta de Conformidad Técnica N° {500 + spec['num']}-2025 suscrita tras verificación en almacén."
                ),
            },
            {
                "etapa": "Pago",
                "usuario_rol": "FUNC-TES-02",
                "timestamp": f"{fecha_dia}T17:50:00" if es_pago_sin_conf else f"{fecha_dia}T19:30:00",
                "documento_texto": (
                    f"Comprobante de Pago SIAF N° {8000 + spec['num']} girado a favor de {spec['prov_ganador']} "
                    f"por S/ {spec['monto']:,.2f}."
                ),
            },
        ]
        crear_actuaciones_secuenciales(db, exp, etapas_data)

        for cod_p, monto_of, ganador in spec["postores"]:
            prov_obj = prov_por_codigo[cod_p]
            db.add(
                Postulacion(
                    expediente_id=exp.id,
                    proveedor_id=prov_obj.id,
                    monto_ofertado=monto_of,
                    es_ganador=ganador,
                    fecha_presentacion=f"{fecha_dia}T13:30:00",
                )
            )

    # -------------------------------------------------------------------------
    # 3. GENERAR 112 EXPEDIENTES LIMPIOS (EXP-2025-UNT-0009 AL EXP-2025-UNT-0120)
    # -------------------------------------------------------------------------
    areas_limpias = [
        "AREA-ACAD-01",
        "AREA-BIB-02",
        "AREA-MED-03",
        "AREA-ADM-04",
        "AREA-INV-05",
        "AREA-BIEN-06",
    ]
    objetos_limpios = [
        (
            "Adquisición de Mobiliario Ergonómico y Pizarras Acrílicas para Aulas Universitarias",
            "Mobiliario Académico y Administrativo",
            28400.00,
            "Contratación Menor (<= 8 UIT)",
        ),
        (
            "Suministro de Reactivos Químicos Estandarizados y Material de Vidrio Borosilicato",
            "Suministros Médicos y Bioseguridad",
            64200.00,
            "Licitación Pública Abreviada",
        ),
        (
            "Servicio de Enlace Dedicado de Fibra Óptica Redundante y Protección Anti-DDoS",
            "Servicios de Conectividad y Ciberseguridad",
            112000.00,
            "Concurso Público Abreviado",
        ),
        (
            "Adquisición de Estaciones de Trabajo Estándar para Laboratorios de Cómputo",
            "Tecnología y Equipamiento Computacional",
            89500.00,
            "Licitación Pública Abreviada",
        ),
        (
            "Mantenimiento Preventivo de Coberturas, Pintura e Iluminación LED en Pabellones",
            "Infraestructura y Mantenimiento Eléctrico",
            73800.00,
            "Concurso Público Abreviado",
        ),
        (
            "Adquisición de Microscopios Binoculares Ópticos para Prácticas de Biología",
            "Equipamiento Científico y de Laboratorio",
            94600.00,
            "Licitación Pública Abreviada",
        ),
    ]

    proveedores_limpios = [
        p for p in proveedores_lista if not p.es_colusorio
    ]

    for num in range(9, 121):
        idx_item = (num - 9) % len(objetos_limpios)
        obj_base, rubro, monto_base, modalidad = objetos_limpios[idx_item]
        area = areas_limpias[(num - 9) % len(areas_limpias)]
        variacion = ((num * 17) % 19) * 450.0
        monto_final = round(monto_base + variacion, 2)
        if "Menor" in modalidad and monto_final > 36000.0:
            monto_final = round(18500.0 + ((num * 313) % 14000), 2)

        mes = ((num - 9) % 9) + 1
        dia = ((num * 3) % 27) + 1
        fecha_iso = f"2025-{mes:02d}-{dia:02d}T08:30:00"
        fecha_dia = f"2025-{mes:02d}-{dia:02d}"

        p_ganador = proveedores_limpios[(num - 9) % len(proveedores_limpios)]
        p_segundo = proveedores_limpios[(num - 8) % len(proveedores_limpios)]

        codigo_exp = f"EXP-2025-UNT-{num:04d}"
        tdr_generico = (
            f"Especificaciones técnicas neutrales del proceso {codigo_exp} para '{obj_base}'. "
            f"Cumplimiento de normas técnicas nacionales, pluralidad de marcas y postores verificada, "
            f"garantía comercial mínima de 12 meses y entrega en sede central universitaria."
        )

        exp = Expediente(
            codigo=codigo_exp,
            objeto=f"{obj_base} - Sede Lote #{num - 8}",
            rubro=rubro,
            area_usuaria=area,
            modalidad=modalidad,
            monto_estimado=monto_final,
            fecha_creacion=fecha_iso,
            estado_expediente="Pagado",
            tdr_texto=tdr_generico,
            proveedor_adjudicado_codigo=p_ganador.codigo,
            nivel_riesgo="LIMPIO",
            puntaje_riesgo=6 + (num % 10),
            integridad_valida=True,
            es_caso_trampa=False,
            tipo_trampa=None,
        )
        db.add(exp)
        db.flush()

        etapas_limpias = [
            {
                "etapa": "Requerimiento",
                "usuario_rol": f"FUNC-{area.split('-')[1]}-01",
                "timestamp": f"{fecha_dia}T08:30:00",
                "documento_texto": f"Requerimiento institucional SIGA {codigo_exp} emitido por {area}.",
            },
            {
                "etapa": "TDR",
                "usuario_rol": "FUNC-ESP-TEC-01",
                "timestamp": f"{fecha_dia}T10:15:00",
                "documento_texto": tdr_generico,
            },
            {
                "etapa": "Cotizaciones",
                "usuario_rol": "FUNC-LOG-02",
                "timestamp": f"{fecha_dia}T13:00:00",
                "documento_texto": (
                    f"Estudio de mercado plural con cotizaciones válidas de {p_ganador.codigo} "
                    f"(S/ {monto_final:,.2f}) y {p_segundo.codigo} (S/ {monto_final * 1.04:,.2f})."
                ),
            },
            {
                "etapa": "Buena Pro",
                "usuario_rol": "FUNC-COM-SEL-02",
                "timestamp": f"{fecha_dia}T15:30:00",
                "documento_texto": (
                    f"Adjudicación de Buena Pro a {p_ganador.codigo} por S/ {monto_final:,.2f} "
                    f"cumpliendo principios de Ley N° 32069."
                ),
            },
            {
                "etapa": "Conformidad",
                "usuario_rol": f"FUNC-{area.split('-')[1]}-01",
                "timestamp": f"{fecha_dia}T17:10:00",
                "documento_texto": (
                    f"Acta de Recepción y Conformidad Técnica favorable suscrita por {area} "
                    f"sin observaciones pendientes."
                ),
            },
            {
                "etapa": "Pago",
                "usuario_rol": "FUNC-TES-01",
                "timestamp": f"{fecha_dia}T18:45:00",
                "documento_texto": f"Devengado y Giro SIAF ejecutado conforme a normativa por S/ {monto_final:,.2f}.",
            },
        ]
        crear_actuaciones_secuenciales(db, exp, etapas_limpias)

        db.add(
            Postulacion(
                expediente_id=exp.id,
                proveedor_id=p_ganador.id,
                monto_ofertado=monto_final,
                es_ganador=True,
                fecha_presentacion=f"{fecha_dia}T12:20:00",
            )
        )
        db.add(
            Postulacion(
                expediente_id=exp.id,
                proveedor_id=p_segundo.id,
                monto_ofertado=round(monto_final * 1.045, 2),
                es_ganador=False,
                fecha_presentacion=f"{fecha_dia}T12:40:00",
            )
        )

    db.commit()

    # 4. Ejecutar el motor de reglas explicables (XAI) sobre los 120 expedientes recién creados
    resumen_reglas = ejecutar_motor_reglas_xai(db)

    return {
        "mensaje": "Dataset sintético CENTINELA regenerado exitosamente (120 expedientes: 112 limpios + 8 casos trampa).",
        "total_expedientes": 120,
        "expedientes_limpios": 112,
        "expedientes_trampa": 8,
        "proveedores_sinteticos": len(proveedores_lista),
        "auditoria_xai": resumen_reglas,
    }
