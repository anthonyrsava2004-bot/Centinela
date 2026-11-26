# Informe de Pruebas y Efectividad — CENTINELA

_Generado automáticamente el 2026-11-26 02:16:17 por `backend/tests/test_efectividad.py` (datos 100 % sintéticos)._

## 1. Resumen ejecutivo

- Muestras evaluadas: **120** expedientes sembrados + **18** casos etiquetados en vivo + **18** pruebas de adulteración SHA-256.
- Decisiones regla×muestra: TP=29 · FP=0 · FN=0 · TN=1219.
- Falsos positivos totales: **0** · Falsos negativos totales: **0**.
- Compras limpias sembradas evaluadas: **110** → con alerta indebida: **0**.

## 2. Matriz de confusión por regla

| Regla | TP | FP | FN | TN | Precisión | Recall | F1 | Tasa FP |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| R-01-FRACCIONAMIENTO | 4 | 0 | 0 | 152 | 100.0 % | 100.0 % | 100.0 % | 0.0 % |
| R-02-SEGREGACION | 3 | 0 | 0 | 153 | 100.0 % | 100.0 % | 100.0 % | 0.0 % |
| R-03-PAGO-SIN-CONF | 5 | 0 | 0 | 151 | 100.0 % | 100.0 % | 100.0 % | 0.0 % |
| R-04-COLUSION-GRAFO | 4 | 0 | 0 | 152 | 100.0 % | 100.0 % | 100.0 % | 0.0 % |
| R-05-TDR-NLP | 2 | 0 | 0 | 154 | 100.0 % | 100.0 % | 100.0 % | 0.0 % |
| R-06-SHA256 | 6 | 0 | 0 | 150 | 100.0 % | 100.0 % | 100.0 % | 0.0 % |
| R-07-CRONO-VERSION | 3 | 0 | 0 | 153 | 100.0 % | 100.0 % | 100.0 % | 0.0 % |
| R-08-CONFLICTO-INTERES | 2 | 0 | 0 | 154 | 100.0 % | 100.0 % | 100.0 % | 0.0 % |

## 3. Casos etiquetados en vivo (incluye fronteras de 8 UIT y TDR legítimos)

| Caso | Esperado | Detectado | Resultado |
|---|---|---|---|
| N1 Compra limpia estándar | — | — | ✅ |
| N2 Contratación menor aislada (40 000, sin hermanas) | — | — | ✅ |
| N3 Frontera 8 UIT: 21 400 + 21 400 = 42 800 (no excede) (orden previa 1) | — | — | ✅ |
| N3 Frontera 8 UIT: 21 400 + 21 400 = 42 800 (no excede) | — | — | ✅ |
| N4 Mismo mes, proveedores distintos (sin fraccionamiento) (orden previa 1) | — | — | ✅ |
| N4 Mismo mes, proveedores distintos (sin fraccionamiento) | — | — | ✅ |
| N5 TDR legítimo de equipamiento TI (sin copia de catálogo) | — | — | ✅ |
| P1 Frontera 8 UIT: 21 400 + 21 401 = 42 801 (excede) (orden previa 1) | — | — | ✅ |
| P1 Frontera 8 UIT: 21 400 + 21 401 = 42 801 (excede) | R-01-FRACCIONAMIENTO | R-01-FRACCIONAMIENTO | ✅ |
| P2 Pago sin conformidad | R-03-PAGO-SIN-CONF | R-03-PAGO-SIN-CONF | ✅ |
| P3 Entregable obligatorio incompleto (pozo a tierra) | R-03-PAGO-SIN-CONF | R-03-PAGO-SIN-CONF | ✅ |
| P4 Segregación de funciones vulnerada | R-02-SEGREGACION | R-02-SEGREGACION | ✅ |
| P5 TDR v2.1 extemporáneo sin sustento | R-07-CRONO-VERSION | R-07-CRONO-VERSION | ✅ |
| P6 Conflicto de interés familiar con adjudicatario | R-08-CONFLICTO-INTERES | R-08-CONFLICTO-INTERES | ✅ |
| P7 Colusión: postores con representante compartido | R-04-COLUSION-GRAFO | R-04-COLUSION-GRAFO | ✅ |
| P8 TDR copiado literal del catálogo de un proveedor | R-05-TDR-NLP | R-05-TDR-NLP | ✅ |
| M1 Combinada: v2.1 extemporáneo + mismo funcionario | R-02-SEGREGACION, R-07-CRONO-VERSION | R-02-SEGREGACION, R-07-CRONO-VERSION | ✅ |
| M2 Combinada: colusión + pago sin conformidad | R-03-PAGO-SIN-CONF, R-04-COLUSION-GRAFO | R-03-PAGO-SIN-CONF, R-04-COLUSION-GRAFO | ✅ |

## 4. Rendimiento (milisegundos, sobre SQLite local)

| Operación | Muestras | p50 | p95 | Máx |
|---|---:|---:|---:|---:|
| Detalle de expediente (6 etapas + NLP + alertas) | 10 | 7 | 9 | 9 |
| Dashboard de indicadores | 8 | 3 | 4 | 4 |
| Grafo de colusión (NetworkX) | 8 | 5 | 66 | 66 |
| Registrar expediente + sellar 6 etapas + 8 reglas XAI | 18 | 39 | 41 | 41 |

## 5. Control de accesos (RBAC) verificado

| Verificación | Esperado | Obtenido | Resultado |
|---|---:|---:|---|
| ESPECIALISTA_DEC → PATCH gestión de denuncia | 403 | 403 | ✅ |
| CONSULTA_TRANSPARENCIA → PATCH gestión de denuncia | 403 | 403 | ✅ |
| CONSULTA → PATCH verificar entregable | 403 | 403 | ✅ |
| ESPECIALISTA_DEC → POST simular-alteracion | 403 | 403 | ✅ |
| ESPECIALISTA_DEC → POST restaurar-integridad | 403 | 403 | ✅ |
| CONSULTA_TRANSPARENCIA → POST simular-alteracion | 403 | 403 | ✅ |
| CONSULTA_TRANSPARENCIA → POST restaurar-integridad | 403 | 403 | ✅ |
| DEC → PATCH alerta ARCHIVADA_SUSTENTADA | 403 | 403 | ✅ |
| CONSULTA → PATCH alerta | 403 | 403 | ✅ |
| DEC → PATCH alerta EN_DESCARGO | 200 | 200 | ✅ |
| ESPECIALISTA_DEC → POST /api/seed/regenerar | 403 | 403 | ✅ |
| ESPECIALISTA_DEC → GET /api/auditoria | 403 | 403 | ✅ |
| ESPECIALISTA_DEC → GET /api/denuncias (bandeja OCI) | 403 | 403 | ✅ |
| CONSULTA_TRANSPARENCIA → POST /api/seed/regenerar | 403 | 403 | ✅ |
| CONSULTA_TRANSPARENCIA → GET /api/auditoria | 403 | 403 | ✅ |
| CONSULTA_TRANSPARENCIA → GET /api/denuncias (bandeja OCI) | 403 | 403 | ✅ |
| OCI → GET /api/auditoria | 200 | 200 | ✅ |
| OCI → GET /api/denuncias | 200 | 200 | ✅ |
| CONSULTA → POST simular-registro | 403 | 403 | ✅ |

## 6. Pruebas automatizadas ejecutadas

- ✅ `TestBitacoraReinicioYReportes.test_reinicio_es_determinista_y_preserva_bitacora`
- ✅ `TestBitacoraReinicioYReportes.test_rendimiento_de_consultas`
- ✅ `TestBitacoraReinicioYReportes.test_reportes_pdf_y_csv`
- ✅ `TestCanalDenuncia.test_codigo_inexistente_devuelve_404`
- ✅ `TestCanalDenuncia.test_consulta_publica_no_expone_datos_internos`
- ✅ `TestCanalDenuncia.test_descripcion_muy_corta_es_rechazada`
- ✅ `TestCanalDenuncia.test_publico_y_dec_no_pueden_gestionar_denuncias`
- ✅ `TestCandadoDePago.test_verificar_y_reobservar_entregable`
- ✅ `TestDeteccionDatasetBase.test_cero_falsos_positivos_en_compras_limpias`
- ✅ `TestDeteccionDatasetBase.test_dataset_tiene_120_expedientes`
- ✅ `TestDeteccionDatasetBase.test_forenses_detectan_exactamente_las_reglas_esperadas`
- ✅ `TestDeteccionDatasetBase.test_kpi_salud_preventiva_coherente`
- ✅ `TestDeteccionEnVivo.test_caso_aulas_activa_candado_de_pago`
- ✅ `TestDeteccionEnVivo.test_casos_etiquetados`
- ✅ `TestDeteccionEnVivo.test_registro_en_vivo_nace_con_cadena_integra`
- ✅ `TestIntegridadSHA256.test_adulteracion_de_cada_etapa_rompe_la_cadena_en_cascada`
- ✅ `TestIntegridadSHA256.test_dec_y_publico_no_pueden_adulterar_ni_restaurar`
- ✅ `TestRBAC.test_dec_no_puede_cerrar_alertas_ni_publico_modificarlas`
- ✅ `TestRBAC.test_dec_si_puede_responder_descargo`
- ✅ `TestRBAC.test_endpoints_exclusivos_de_oci_devuelven_403_a_dec_y_publico`
- ✅ `TestRBAC.test_intentos_bloqueados_quedan_registrados_en_bitacora`
- ✅ `TestRBAC.test_oci_accede_a_endpoints_exclusivos`
- ✅ `TestRBAC.test_publico_no_puede_registrar_compras`

## 7. Alcance y limitaciones honestas

- La verdad de terreno de los 10 forenses proviene del diseño del dataset sintético; los casos en vivo son etiquetados manualmente por el equipo.
- Las métricas describen el desempeño sobre datos sintéticos; en un piloto real se recalibrarán umbrales con el OCI y la Oficina de Integridad.
- Las alertas son señales preventivas para revisión humana (Presunción de Licitud, Art. 248 Ley N° 27444), no acusaciones.
