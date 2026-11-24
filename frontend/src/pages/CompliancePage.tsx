import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSearch,
  FileDown,
  MessageSquarePlus,
  CheckCircle2,
  RefreshCw,
  UserCheck,
  Building2,
  CalendarClock,
  ClipboardCheck,
  History,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { centinelaApi } from '../api/client';
import { AlertaGestion, RolUsuario } from '../types';
import { RevisionStatusBadge } from '../components/AlertBadge';
import { Modal } from '../components/Modal';

interface CompliancePageProps {
  rolActivo: RolUsuario;
}

const AREAS_DERIVACION = [
  'OCI — Órgano de Control Institucional',
  'OCI — Control Simultáneo (Hito de Control)',
  'OCI — Unidad de Análisis de Redes y Compliance',
  'DEC — Dependencia Encargada de Contrataciones',
  'Área Usuaria / DEC — Subsanación Documental',
  'Tesorería / Control Previo + OCI',
  'Oficina de Asesoría Jurídica',
];

export const CompliancePage: React.FC<CompliancePageProps> = ({ rolActivo }) => {
  const navigate = useNavigate();
  const [alertas, setAlertas] = useState<AlertaGestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');

  // Estado del Modal de Revisión Humana / Descargo / Derivación
  const [alertaSeleccionada, setAlertaSeleccionada] = useState<AlertaGestion | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState<string>('EN_DESCARGO');
  const [areaAsignada, setAreaAsignada] = useState<string>(AREAS_DERIVACION[0]);
  const [fechaLimite, setFechaLimite] = useState<string>('');
  const [accionCorrectiva, setAccionCorrectiva] = useState<string>('');
  const [comentario, setComentario] = useState<string>('');
  const [guardando, setGuardando] = useState<boolean>(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const esAuditorOCI = rolActivo.startsWith('Auditor OCI');
  const esSoloLectura = rolActivo.startsWith('Consulta Transparencia');

  const cargarAlertas = async () => {
    try {
      setLoading(true);
      const data = await centinelaApi.listarAlertas({
        estado_revision: filtroEstado !== 'TODOS' ? filtroEstado : undefined,
        categoria: filtroCategoria !== 'TODAS' ? filtroCategoria : undefined,
      });
      setAlertas(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarAlertas();
  }, [filtroEstado, filtroCategoria]);

  const abrirModalRevision = (alerta: AlertaGestion) => {
    if (esSoloLectura) return;
    setErrorModal(null);
    setAlertaSeleccionada(alerta);
    setNuevoEstado(esAuditorOCI ? 'VALIDADA_OCI' : 'EN_DESCARGO');
    setAreaAsignada(alerta.area_asignada || AREAS_DERIVACION[0]);
    setFechaLimite(
      alerta.fecha_limite || new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    );
    setAccionCorrectiva(
      alerta.accion_correctiva ||
        (esAuditorOCI
          ? 'Emitir Informe de Hito de Control y requerir plan de acción correctiva en 5 días hábiles.'
          : 'Reprogramar proceso mediante procedimiento competitivo consolidado y adjuntar sustento técnico en SIGA.'),
    );
    setComentario(
      esAuditorOCI
        ? 'Se valida la señal preventiva XAI, se deriva al área competente y se dispone seguimiento de acción correctiva conforme a Ley N° 32069 y Ley N° 27785.'
        : 'Se adjunta informe técnico sustentatorio de la Dependencia Encargada de las Contrataciones (DEC) detallando la subsanación y medidas preventivas adoptadas.',
    );
  };

  const handleGuardarRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertaSeleccionada || esSoloLectura) return;
    try {
      setGuardando(true);
      setErrorModal(null);
      await centinelaApi.actualizarAlerta(alertaSeleccionada.id, {
        estado_revision: nuevoEstado,
        comentario_descargo: comentario,
        rol_usuario: rolActivo,
        area_asignada: esAuditorOCI ? areaAsignada : undefined,
        fecha_limite: esAuditorOCI ? fechaLimite : undefined,
        accion_correctiva: accionCorrectiva,
      });
      setAlertaSeleccionada(null);
      await cargarAlertas();
    } catch (err: any) {
      setErrorModal(
        err?.response?.data?.detail ||
          'No se pudo guardar la revisión. Verifique los permisos del rol activo.',
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Diferenciado por Rol */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 p-6 rounded-2xl border shadow-sm dark:shadow-none ${
          esAuditorOCI
            ? 'bg-gradient-to-r from-white via-emerald-50/40 to-white dark:from-slate-900 dark:to-emerald-950/25 border-emerald-200 dark:border-emerald-500/30'
            : esSoloLectura
            ? 'bg-gradient-to-r from-white via-amber-50/40 to-white dark:from-slate-900 dark:to-amber-950/25 border-amber-200 dark:border-amber-500/30'
            : 'bg-gradient-to-r from-white via-blue-50/50 to-white dark:from-slate-900 dark:to-blue-950/30 border-blue-200 dark:border-cyan-500/30'
        }`}
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-semibold ${
                esAuditorOCI
                  ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                  : esSoloLectura
                  ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                  : 'bg-blue-50 dark:bg-cyan-500/15 text-blue-800 dark:text-cyan-300 border-blue-200 dark:border-cyan-500/30'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              {esAuditorOCI
                ? 'Competencia OCI: Derivación, Plazo SLA y Dictamen'
                : esSoloLectura
                ? 'Modo Solo Lectura (RBAC Activo)'
                : 'Competencia DEC: Descargos Técnicos y Acciones Correctivas'}
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            {esAuditorOCI
              ? 'Alertas Preventivas, Derivación y Dictámenes (OCI)'
              : esSoloLectura
              ? 'Consulta Pública de Señales Preventivas'
              : 'Descargos Técnicos y Planes de Subsanación (DEC)'}
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl">
            En cumplimiento del Principio de Presunción de Licitud (Art. 248 Ley N° 27444), ninguna señal algorítmica es punitiva por sí misma. Requiere asignación, evaluación humana con niveles de acceso diferenciados, descargos y bitácora auditable.
          </p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="TODOS">Estado de Revisión: Todos</option>
            <option value="PENDIENTE">Pendientes de Revisión</option>
            <option value="EN_DESCARGO">Con Descargo Técnico (DEC)</option>
            <option value="VALIDADA_OCI">Validadas para Control OCI</option>
            <option value="ARCHIVADA_SUSTENTADA">Sustentadas y Archivadas</option>
          </select>

          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="TODAS">Categoría XAI: Todas</option>
            <option value="Fraccionamiento Indebido">Fraccionamiento (&lt;= 8 UIT)</option>
            <option value="Colusión en Grafos">Colusión en Grafos</option>
            <option value="Direccionamiento Semántico TDR">Direccionamiento TDR (NLP)</option>
            <option value="Segregación de Funciones">Segregación de Funciones</option>
            <option value="Ejecución Contractual / Pago">Pago sin Conformidad</option>
            <option value="Trazabilidad / Versiones y Sustentos">Versiones y Sustentos</option>
            <option value="Integridad Criptográfica SHA-256">Ruptura SHA-256</option>
          </select>
        </div>
      </div>

      {/* Listado de Tarjetas Explicables XAI */}
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-700 dark:text-emerald-400 animate-spin" />
          <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
            Cargando bandeja de señales explicables XAI...
          </span>
        </div>
      ) : alertas.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
          No se encontraron señales para los filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-4">
          {alertas.map((alerta) => (
            <div
              key={alerta.id}
              className="p-6 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm dark:shadow-none transition space-y-4"
            >
              {/* Fila superior */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 font-mono text-xs font-bold">
                    {alerta.codigo_regla}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-slate-800 text-blue-800 dark:text-cyan-300 border border-blue-200 dark:border-slate-700 font-mono text-xs font-bold">
                    {alerta.expediente_codigo}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                    Área:{' '}
                    <strong className="text-slate-900 dark:text-slate-200">
                      {alerta.area_usuaria}
                    </strong>{' '}
                    • Monto:{' '}
                    <strong className="text-emerald-700 dark:text-emerald-300">
                      S/{' '}
                      {(alerta.expediente_monto || 0).toLocaleString('es-PE', {
                        minimumFractionDigits: 2,
                      })}
                    </strong>
                  </span>
                </div>

                <RevisionStatusBadge estado={alerta.estado_revision} />
              </div>

              {/* Barra de Derivación y Plazo SLA */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] bg-slate-50 dark:bg-slate-950/75 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800/80">
                <span className="inline-flex items-center gap-1.5 text-slate-800 dark:text-slate-300">
                  <Building2 className="w-3.5 h-3.5 text-blue-700 dark:text-cyan-400" />
                  <strong className="text-slate-500 dark:text-slate-400">Derivada a:</strong>{' '}
                  {alerta.area_asignada}
                </span>
                {alerta.fecha_limite && (
                  <span className="inline-flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-mono font-semibold">
                    <CalendarClock className="w-3.5 h-3.5" />
                    Plazo SLA: {alerta.fecha_limite}
                  </span>
                )}
              </div>

              {/* Título No Punitivo */}
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {alerta.titulo}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Proceso: {alerta.expediente_objeto}
                </p>
              </div>

              {/* Estructura Tripartita Obligatoria XAI: (a) Regla, (b) Evidencia, (c) Base Normativa */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800/90 space-y-1.5">
                  <div className="font-bold text-blue-800 dark:text-cyan-400 uppercase tracking-wider text-[11px]">
                    (a) Regla Algorítmica Activada
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {alerta.regla_activada}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800/90 space-y-1.5">
                  <div className="font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider text-[11px]">
                    (b) Evidencia Forense Exacta
                  </div>
                  <p className="text-slate-900 dark:text-slate-200 leading-relaxed font-medium">
                    {alerta.evidencia_exacta}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800/90 space-y-1.5">
                  <div className="font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider text-[11px]">
                    (c) Base Normativa Exacta
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {alerta.base_normativa}
                  </p>
                </div>
              </div>

              {/* Acción Correctiva Registrada */}
              {alerta.accion_correctiva && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-500/35 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold">
                    <ClipboardCheck className="w-4 h-4" />
                    Acción Correctiva / Plan de Subsanación Registrado
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                    {alerta.accion_correctiva}
                  </p>
                </div>
              )}

              {/* Último Pronunciamiento o Descargo */}
              {alerta.comentario_descargo && (
                <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-500/40 text-xs space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sky-900 dark:text-sky-300 font-bold">
                    <span>
                      Último Pronunciamiento / Descargo Registrado por: {alerta.rol_ultimo_cambio}
                    </span>
                    <span className="font-mono text-[11px]">{alerta.fecha_actualizacion}</span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                    {alerta.comentario_descargo}
                  </p>
                </div>
              )}

              {/* Bitácora Inmutable de Revisiones Humanas */}
              {alerta.historial && alerta.historial.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/85 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    <History className="w-3.5 h-3.5 text-blue-700 dark:text-cyan-400" />
                    Bitácora Cronológica de Revisiones y Derivaciones ({alerta.historial.length})
                  </div>
                  <div className="space-y-2">
                    {alerta.historial.map((h) => (
                      <div
                        key={h.id}
                        className="pl-3 border-l-2 border-blue-600/40 dark:border-cyan-500/40 text-[11px] space-y-0.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-blue-800 dark:text-cyan-300">
                            {h.rol_usuario}{' '}
                            <span className="text-slate-500 dark:text-slate-400 font-mono">
                              ({h.estado_anterior || 'INICIO'} → {h.estado_nuevo})
                            </span>
                          </span>
                          <span className="font-mono text-slate-500">{h.timestamp}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300">{h.comentario}</p>
                        {h.accion_correctiva && (
                          <p className="text-emerald-700 dark:text-emerald-300/90 font-medium">
                            Acción correctiva: {h.accion_correctiva}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botones de Acción por Rol */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/trazabilidad?id=${alerta.expediente_id}`)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition"
                  >
                    <FileSearch className="w-3.5 h-3.5 text-blue-700 dark:text-cyan-400" />
                    Inspeccionar Cadena SHA-256
                  </button>
                  <a
                    href={centinelaApi.obtenerUrlReportePdf(alerta.expediente_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition"
                  >
                    <FileDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Reporte PDF Oficial
                  </a>
                </div>

                {esSoloLectura ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-semibold cursor-not-allowed"
                    title="El perfil Consulta Transparencia tiene permisos de solo lectura (Ley N° 27806)"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Solo Lectura (Sin Edición)
                  </span>
                ) : (
                  <button
                    onClick={() => abrirModalRevision(alerta)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs shadow-sm transition ${
                      esAuditorOCI
                        ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950'
                        : 'bg-blue-700 hover:bg-blue-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950'
                    }`}
                  >
                    <MessageSquarePlus className="w-4 h-4" />
                    {esAuditorOCI
                      ? 'Derivar / Emitir Dictamen OCI'
                      : 'Registrar Descargo y Acción Correctiva (DEC)'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal para Registrar Descargo, Derivación, Acción Correctiva o Dictamen */}
      <Modal
        isOpen={Boolean(alertaSeleccionada)}
        onClose={() => setAlertaSeleccionada(null)}
        title={
          esAuditorOCI
            ? `Dictamen y Derivación OCI — ${alertaSeleccionada?.expediente_codigo}`
            : `Descargo Técnico y Acción Correctiva (DEC) — ${alertaSeleccionada?.expediente_codigo}`
        }
        subtitle={`Actuando bajo el rol: ${rolActivo} • Control de Acceso Diferenciado (RBAC)`}
      >
        {alertaSeleccionada && (
          <form onSubmit={handleGuardarRevision} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="font-mono text-rose-700 dark:text-rose-300 font-bold">
                [{alertaSeleccionada.codigo_regla}] {alertaSeleccionada.titulo}
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                {alertaSeleccionada.evidencia_exacta}
              </p>
            </div>

            {errorModal && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/50 text-rose-800 dark:text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{errorModal}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Nuevo Estado de la Señal Preventiva:
              </label>
              <select
                value={nuevoEstado}
                onChange={(e) => setNuevoEstado(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500"
              >
                {esAuditorOCI ? (
                  <>
                    <option value="VALIDADA_OCI">
                      VALIDADA_OCI — Observación Confirmada por Auditor OCI para Hito de Control
                    </option>
                    <option value="ARCHIVADA_SUSTENTADA">
                      ARCHIVADA_SUSTENTADA — Desestimada con Sustento Técnico-Legal Firme
                    </option>
                    <option value="EN_DESCARGO">
                      EN_DESCARGO — Solicitar Ampliación de Descargo al Área / DEC
                    </option>
                    <option value="PENDIENTE">
                      PENDIENTE — Retornar a Estado Pendiente de Revisión
                    </option>
                  </>
                ) : (
                  <option value="EN_DESCARGO">
                    EN_DESCARGO — Descargo Técnico Presentado por Especialista Logística (DEC)
                  </option>
                )}
              </select>
              {!esAuditorOCI && (
                <p className="text-[11px] text-amber-800 dark:text-amber-300/90">
                  Separación de competencias (Ley N° 32069 / Ley N° 27785): El rol DEC solo registra descargos y acciones correctivas; únicamente el Auditor OCI puede validar o archivar alertas.
                </p>
              )}
            </div>

            {esAuditorOCI && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700 dark:text-slate-200">
                    Derivar / Asignar a Área Responsable:
                  </label>
                  <select
                    value={areaAsignada}
                    onChange={(e) => setAreaAsignada(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500"
                  >
                    {AREAS_DERIVACION.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700 dark:text-slate-200">
                    Plazo Límite de Atención (SLA):
                  </label>
                  <input
                    type="date"
                    value={fechaLimite}
                    onChange={(e) => setFechaLimite(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Acción Correctiva / Medida de Subsanación:
              </label>
              <input
                type="text"
                required
                value={accionCorrectiva}
                onChange={(e) => setAccionCorrectiva(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500"
                placeholder="Ej. Consolidar requerimiento, subsanar acta o emitir informe de control..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Sustento Técnico-Normativo / Descargo Oficial:
              </label>
              <textarea
                rows={4}
                required
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500"
                placeholder="Ingrese el fundamento técnico o normativo de la revisión humana..."
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAlertaSeleccionada(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-extrabold shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                {guardando ? 'Guardando en Bitácora...' : 'Firmar y Registrar en Bitácora'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
