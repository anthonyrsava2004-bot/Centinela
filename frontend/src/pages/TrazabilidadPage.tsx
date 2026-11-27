import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldX,
  FileDown,
  Zap,
  RotateCcw,
  Link2,
  Cpu,
  Scale,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Users,
  ClipboardCheck,
  Ban,
  Camera,
  Building2,
  CalendarClock,
  MessageSquarePlus,
  Network,
  ArrowRightLeft,
  UserX,
  Lock,
  History,
} from 'lucide-react';
import { centinelaApi } from '../api/client';
import {
  AlertaGestion,
  ConflictoInteresItem,
  EntregableTdrItem,
  EstadoRevisionAlerta,
  ExpedienteDetalle,
  ExpedienteListItem,
  RolUsuario,
} from '../types';
import { IntegrityBadge, RevisionStatusBadge, RiskBadge } from '../components/AlertBadge';
import { Modal } from '../components/Modal';
import { formatTipologia } from '../utils/formatters';
import {
  AREAS_DERIVACION,
  getAlertRevisionDefaults,
  getCardAccionCorrectivaHeading,
  getDefaultSlaDate,
  getHistorialAccionPrefix,
  getInitialTargetEstado,
  getModalAccionCorrectivaLabel,
  isAlertaCerradaPorOci,
} from '../utils/alertWorkflow';

interface TrazabilidadPageProps {
  rolActivo: RolUsuario;
}

export const TrazabilidadPage: React.FC<TrazabilidadPageProps> = ({ rolActivo }) => {
  const navigate = useNavigate();
  const esAuditorOCI = rolActivo.startsWith('Auditor OCI');
  const esSoloLectura = rolActivo.startsWith('Consulta Transparencia');
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = Number(searchParams.get('id')) || 6;

  const [listaExpedientes, setListaExpedientes] = useState<ExpedienteListItem[]>([]);
  const [expedienteId, setExpedienteId] = useState<number>(initialId);
  const [detalle, setDetalle] = useState<ExpedienteDetalle | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [etapaSimulacion, setEtapaSimulacion] = useState<string>('Cotizaciones');
  const [loading, setLoading] = useState<boolean>(true);
  const [procesandoAccion, setProcesandoAccion] = useState<boolean>(false);
  const [entregableEdit, setEntregableEdit] = useState<EntregableTdrItem | null>(null);
  const [evidenciaInput, setEvidenciaInput] = useState<string>('');

  // Modal inline: Derivar / Dictaminar (OCI) o Responder Descargo (DEC)
  const [alertaEdit, setAlertaEdit] = useState<AlertaGestion | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState<EstadoRevisionAlerta>('EN_DESCARGO');
  const [areaAsignada, setAreaAsignada] = useState<string>(AREAS_DERIVACION[0]);
  const [fechaLimite, setFechaLimite] = useState<string>('');
  const [accionCorrectiva, setAccionCorrectiva] = useState<string>('');
  const [comentarioAlerta, setComentarioAlerta] = useState<string>('');
  const [errorAlertaModal, setErrorAlertaModal] = useState<string | null>(null);

  // Modal inline: Abstención y Reasignación de Conflicto de Interés (Ley N° 27815 / R-08)
  const [conflictoEdit, setConflictoEdit] = useState<ConflictoInteresItem | null>(null);
  const [alternoReasignado, setAlternoReasignado] = useState<string>('FUNC-LOG-09');
  const [comentarioAbstencion, setComentarioAbstencion] = useState<string>(
    'Conforme al Art. 99 de la Ley N° 27444, Ley N° 27815 y la R.R. N° 0490-2026/UNT, se formaliza la abstención preventiva y se reasigna el expediente al interviniente alterno sin vínculo con los postores.',
  );
  const [errorConflictoModal, setErrorConflictoModal] = useState<string | null>(null);

  // Proteger estado de modales ante cambios de rol en 1 clic
  useEffect(() => {
    if (esSoloLectura) {
      setEntregableEdit(null);
      setAlertaEdit(null);
      setConflictoEdit(null);
    } else if (alertaEdit) {
      if (!esAuditorOCI && isAlertaCerradaPorOci(alertaEdit.estado_revision)) {
        setAlertaEdit(null);
      } else {
        const targetEstado = getInitialTargetEstado(alertaEdit.estado_revision, esAuditorOCI);
        const tpl = getAlertRevisionDefaults(targetEstado, esAuditorOCI);
        setNuevoEstado(targetEstado);
        setAreaAsignada(tpl.areaAsignada);
        setAccionCorrectiva(tpl.accionCorrectiva);
        setComentarioAlerta(tpl.comentario);
        setFechaLimite(
          targetEstado === 'ARCHIVADA_SUSTENTADA'
            ? ''
            : alertaEdit.fecha_limite || getDefaultSlaDate(5),
        );
      }
    } else if (!esAuditorOCI) {
      setNuevoEstado('EN_DESCARGO');
    }
  }, [rolActivo, esSoloLectura, esAuditorOCI]);

  const cargarDetalle = async (idToLoad: number, listaFallback?: ExpedienteListItem[]) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await centinelaApi.obtenerExpedienteDetalle(idToLoad);
      setDetalle(data);
    } catch {
      const lista = listaFallback ?? listaExpedientes;
      const fallback = lista.find((e) => e.codigo === 'EXP-2025-UNT-0006') ?? lista[0];
      if (fallback && fallback.id !== idToLoad) {
        setExpedienteId(fallback.id);
        setSearchParams({ id: String(fallback.id) }, { replace: true });
        try {
          const data = await centinelaApi.obtenerExpedienteDetalle(fallback.id);
          setDetalle(data);
          return;
        } catch {
          // Fall through to error state below
        }
      }
      setDetalle(null);
      setErrorMsg('No se pudo cargar el detalle forense del expediente seleccionado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    centinelaApi.listarExpedientes().then((lista) => {
      setListaExpedientes(lista);
      if (!searchParams.get('id') && lista.length > 0) {
        const defaultExp =
          lista.find((e) => e.codigo === 'EXP-2025-UNT-0006') ?? lista[0];
        if (defaultExp && defaultExp.id !== expedienteId) {
          setExpedienteId(defaultExp.id);
          cargarDetalle(defaultExp.id, lista);
        }
      }
    });
  }, []);

  useEffect(() => {
    setEntregableEdit(null);
    setAlertaEdit(null);
    setConflictoEdit(null);
    const paramId = Number(searchParams.get('id'));
    if (paramId && paramId !== expedienteId) {
      setExpedienteId(paramId);
      cargarDetalle(paramId);
    } else {
      cargarDetalle(expedienteId);
    }
  }, [searchParams]);

  const handleSelectExpediente = (newId: number) => {
    setExpedienteId(newId);
    setSearchParams({ id: String(newId) });
    cargarDetalle(newId);
  };

  const handleSimularAlteracion = async () => {
    if (!detalle || !esAuditorOCI) return;
    try {
      setProcesandoAccion(true);
      await centinelaApi.simularAlteracionExPost(detalle.id, etapaSimulacion);
      await cargarDetalle(detalle.id);
      window.dispatchEvent(new Event('centinela:data-updated'));
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleRestaurarIntegridad = async () => {
    if (!detalle || !esAuditorOCI) return;
    try {
      setProcesandoAccion(true);
      await centinelaApi.restaurarIntegridad(detalle.id);
      await cargarDetalle(detalle.id);
      window.dispatchEvent(new Event('centinela:data-updated'));
    } finally {
      setProcesandoAccion(false);
    }
  };

  const abrirVerificacionEntregable = (ent: EntregableTdrItem) => {
    setEntregableEdit(ent);
    setEvidenciaInput(
      ent.evidencia_tecnica ||
        'Certificado Técnico de Pruebas de Pozo a Tierra CNE-2025 (< 5 Ohm) + Registro Fotográfico (6 fotos georreferenciadas)',
    );
  };

  const handleGuardarEntregable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entregableEdit || !detalle) return;
    try {
      setProcesandoAccion(true);
      await centinelaApi.verificarEntregableTdr(entregableEdit.id, {
        cumplido: true,
        evidencia_tecnica: evidenciaInput,
        rol_usuario: rolActivo,
      });
      setEntregableEdit(null);
      await cargarDetalle(detalle.id);
      window.dispatchEvent(new Event('centinela:data-updated'));
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleRevertirEntregable = async (ent: EntregableTdrItem) => {
    if (!detalle) return;
    try {
      setProcesandoAccion(true);
      await centinelaApi.verificarEntregableTdr(ent.id, {
        cumplido: false,
        evidencia_tecnica: '',
        rol_usuario: rolActivo,
      });
      await cargarDetalle(detalle.id);
      window.dispatchEvent(new Event('centinela:data-updated'));
    } finally {
      setProcesandoAccion(false);
    }
  };

  const abrirModalAlerta = (alerta: AlertaGestion) => {
    if (esSoloLectura || (!esAuditorOCI && isAlertaCerradaPorOci(alerta.estado_revision))) {
      return;
    }
    setErrorAlertaModal(null);
    setAlertaEdit(alerta);
    const targetEstado = getInitialTargetEstado(alerta.estado_revision, esAuditorOCI);
    const tpl = getAlertRevisionDefaults(targetEstado, esAuditorOCI);
    setNuevoEstado(targetEstado);
    setAreaAsignada(tpl.areaAsignada);
    setFechaLimite(
      targetEstado === 'ARCHIVADA_SUSTENTADA'
        ? ''
        : alerta.fecha_limite || getDefaultSlaDate(5),
    );
    setAccionCorrectiva(tpl.accionCorrectiva);
    setComentarioAlerta(tpl.comentario);
  };

  const handleCambiarEstadoAlerta = (nextEstado: EstadoRevisionAlerta) => {
    setNuevoEstado(nextEstado);
    const tpl = getAlertRevisionDefaults(nextEstado, esAuditorOCI);
    setAreaAsignada(tpl.areaAsignada);
    setAccionCorrectiva(tpl.accionCorrectiva);
    setComentarioAlerta(tpl.comentario);
    if (nextEstado === 'ARCHIVADA_SUSTENTADA') {
      setFechaLimite('');
    } else if (!fechaLimite) {
      setFechaLimite(alertaEdit?.fecha_limite || getDefaultSlaDate(5));
    }
  };

  const handleGuardarAlerta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertaEdit || !detalle || esSoloLectura) return;
    try {
      setProcesandoAccion(true);
      setErrorAlertaModal(null);
      const esCierreArchivo = esAuditorOCI && nuevoEstado === 'ARCHIVADA_SUSTENTADA';
      await centinelaApi.actualizarAlerta(alertaEdit.id, {
        estado_revision: esAuditorOCI ? nuevoEstado : 'EN_DESCARGO',
        comentario_descargo: comentarioAlerta,
        rol_usuario: rolActivo,
        area_asignada: esAuditorOCI ? areaAsignada : undefined,
        fecha_limite: esAuditorOCI ? (esCierreArchivo ? '' : fechaLimite) : undefined,
        accion_correctiva: accionCorrectiva,
      });
      setAlertaEdit(null);
      await cargarDetalle(detalle.id);
      window.dispatchEvent(new Event('centinela:data-updated'));
    } catch (err: any) {
      setErrorAlertaModal(
        err?.response?.data?.detail ||
          'No se pudo guardar la revisión. Verifique los permisos del rol activo.',
      );
    } finally {
      setProcesandoAccion(false);
    }
  };

  const abrirModalConflicto = (ci: ConflictoInteresItem) => {
    if (esSoloLectura) return;
    setErrorConflictoModal(null);
    setConflictoEdit(ci);
    setAlternoReasignado('FUNC-LOG-09');
    setComentarioAbstencion(
      'Conforme al Art. 99 de la Ley N° 27444, Ley N° 27815 y la R.R. N° 0490-2026/UNT, se formaliza la abstención preventiva y se reasigna el expediente al interviniente alterno sin vínculo con los postores.',
    );
  };

  const handleConfirmarAbstencion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conflictoEdit || !detalle || esSoloLectura) return;
    try {
      setProcesandoAccion(true);
      setErrorConflictoModal(null);
      await centinelaApi.abstenerYReasignarConflicto(conflictoEdit.id, {
        funcionario_reasignado: alternoReasignado.trim(),
        comentario: comentarioAbstencion.trim(),
      });
      setConflictoEdit(null);
      await cargarDetalle(detalle.id);
      window.dispatchEvent(new Event('centinela:data-updated'));
    } catch (err: any) {
      setErrorConflictoModal(
        err?.response?.data?.detail ||
          'No se pudo formalizar la abstención y reasignación. Verifique los permisos del rol activo.',
      );
    } finally {
      setProcesandoAccion(false);
    }
  };

  if (loading && !detalle) {
    return (
      <div className="h-96 flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="w-8 h-8 text-blue-700 dark:text-emerald-400 animate-spin" />
        <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
          Recalculando hashes SHA-256 y similitud coseno TF-IDF...
        </p>
      </div>
    );
  }

  if (!detalle) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/40 text-rose-900 dark:text-rose-200 space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          {errorMsg || 'Expediente no disponible'}
        </div>
        <button
          onClick={() => cargarDetalle(expedienteId)}
          className="px-4 py-2 rounded-xl bg-rose-600 dark:bg-rose-500 text-white dark:text-slate-950 font-bold text-xs hover:bg-rose-500 dark:hover:bg-rose-400 transition"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const cadena = detalle.verificacion_sha256;
  const nlp = detalle.analisis_nlp;

  return (
    <div className="space-y-8">
      {/* Barra Superior: Selector de Expediente + Acciones Forenses */}
      <div className="animate-card-up p-6 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-mono uppercase px-2.5 py-0.5 rounded bg-blue-50 dark:bg-cyan-500/15 text-blue-800 dark:text-cyan-300 border border-blue-200 dark:border-cyan-500/30 font-semibold">
                Detalle del Proceso y Seguridad Documental
              </span>
              <IntegrityBadge integra={cadena.integridad_global} />
              <RiskBadge nivel={detalle.nivel_riesgo} puntaje={detalle.puntaje_riesgo} />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
              {detalle.codigo} — {detalle.objeto}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
              Área Usuaria:{' '}
              <strong className="text-slate-900 dark:text-slate-200">{detalle.area_usuaria}</strong>{' '}
              | Modalidad:{' '}
              <strong className="text-slate-900 dark:text-slate-200">{detalle.modalidad}</strong> |
              Monto:{' '}
              <strong className="text-emerald-700 dark:text-emerald-300">
                S/ {detalle.monto_estimado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </strong>{' '}
              | Proveedor Adjudicado:{' '}
              <strong className="text-blue-700 dark:text-cyan-300">
                {detalle.proveedor_adjudicado_codigo}
              </strong>
            </p>
          </div>

          {/* Botones Oficiales: Simulación Forense (solo OCI) + Descargar Reporte PDF */}
          <div data-tour="traz-acciones" className="flex flex-wrap items-center gap-3">
            {esAuditorOCI ? (
              <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <select
                  value={etapaSimulacion}
                  onChange={(e) => setEtapaSimulacion(e.target.value)}
                  className="bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none"
                  title="Seleccionar etapa donde simular alteración clandestina en BD"
                >
                  <option value="Requerimiento">Etapa 1: Requerimiento</option>
                  <option value="TDR">Etapa 2: TDR</option>
                  <option value="Cotizaciones">Etapa 3: Cotizaciones</option>
                  <option value="Buena Pro">Etapa 4: Buena Pro</option>
                  <option value="Conformidad">Etapa 5: Conformidad</option>
                </select>

                <button
                  onClick={handleSimularAlteracion}
                  disabled={procesandoAccion}
                  title="Simula editar un documento antiguo en base de datos para comprobar cómo la alerta SHA-256 detecta el cambio"
                  className="btn-tactile inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs shadow-sm"
                >
                  <Zap className="w-4 h-4" />
                  Probar Cambio Oculto
                </button>

                {!cadena.integridad_global && (
                  <button
                    onClick={handleRestaurarIntegridad}
                    disabled={procesandoAccion}
                    className="btn-tactile inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 font-bold text-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restaurar Documento
                  </button>
                )}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Modo Consulta (Simulación forense exclusiva de OCI)
              </span>
            )}

            <a
              href={centinelaApi.obtenerUrlReportePdf(detalle.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-tactile inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B1F3A] hover:bg-[#14335D] dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-extrabold text-xs shadow-sm"
            >
              <FileDown className="w-4 h-4" />
              Descargar Reporte PDF
            </a>
          </div>
        </div>

        {/* Selector Rápido de Expediente */}
        <div
          data-tour="traz-selector"
          className="pt-4 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center gap-3"
        >
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
            Cambiar Expediente Inspeccionado:
          </label>
          <select
            value={expedienteId}
            onChange={(e) => handleSelectExpediente(Number(e.target.value))}
            className="flex-1 min-w-[280px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500"
          >
            {listaExpedientes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.codigo} | {item.nivel_riesgo === 'LIMPIO' ? 'Sin alerta' : `Riesgo ${item.nivel_riesgo}`}
                {item.tipo_trampa ? ` (${formatTipologia(item.tipo_trampa)})` : ''} —{' '}
                {item.objeto.slice(0, 62)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Banner de Estado Criptográfico SHA-256 */}
      <div
        data-tour="traz-banner-sha256"
        className={`p-5 rounded-2xl border flex items-start gap-4 ${
          cadena.integridad_global
            ? 'bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-500 text-rose-950 dark:text-rose-100 animate-pulse'
        }`}
      >
        {cadena.integridad_global ? (
          <ShieldCheck className="w-7 h-7 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <ShieldX className="w-7 h-7 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1">
          <h2 className="text-sm font-extrabold uppercase tracking-wide">
            {cadena.integridad_global
              ? 'Documentos sin Alteraciones (Sello Criptográfico SHA-256 Verificado)'
              : `¡Alerta! Se Detectó un Cambio No Autorizado desde la Etapa #${cadena.orden_comprometido} (${cadena.etapa_comprometida})`}
          </h2>
          <p className="text-xs leading-relaxed opacity-90">{cadena.mensaje_forense}</p>
        </div>
      </div>

      {/* SECCIÓN 1: CADENA VISUAL SHA-256 (6 ETAPAS SECUENCIALES) */}
      <div data-tour="traz-etapas" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Link2 className="w-5 h-5 text-blue-700 dark:text-cyan-400" />
              Historial de las 6 Etapas del Proceso (Sellado SHA-256)
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Cada paso queda encadenado al anterior: si alguien altera un documento antiguo, el sello digital se rompe y alerta al instante.{' '}
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-500">
                (SHA-256 sobre etapa, responsable, fecha y contenido)
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cadena.eslabones.map((eslabon, idx) => {
            const integroTotal = eslabon.es_integro && eslabon.enlace_anterior_valido;
            const staggerClass = `stagger-${Math.min(idx + 1, 6)}`;
            return (
              <div
                key={`${detalle.id}-${eslabon.id}`}
                className={`animate-card-up ${staggerClass} card-elevate p-5 rounded-2xl border flex flex-col justify-between space-y-4 shadow-sm dark:shadow-none ${
                  !eslabon.es_integro
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-500 shadow-rose-200/60 dark:shadow-rose-500/15'
                    : !eslabon.enlace_anterior_valido
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-500/60'
                    : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                      <span className="w-6 h-6 rounded-lg bg-[#0B1F3A] dark:bg-slate-800 border border-[#16335B] dark:border-slate-700 flex items-center justify-center font-mono text-white dark:text-cyan-300">
                        {eslabon.orden}
                      </span>
                      {eslabon.etapa}
                    </span>

                    {integroTotal ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" /> ÍNTEGRO
                      </span>
                    ) : !eslabon.es_integro ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-600 dark:bg-rose-500 text-white">
                        <ShieldX className="w-3 h-3" /> ADULTERADO EX-POST
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                        <AlertTriangle className="w-3 h-3" /> CASCADA ROTA
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/70 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800/80">
                    <span>
                      Rol:{' '}
                      <strong className="text-blue-700 dark:text-cyan-300">
                        {eslabon.usuario_rol}
                      </strong>
                    </span>
                    <span>{eslabon.timestamp}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                    <span
                      className={`px-2 py-0.5 rounded border ${
                        eslabon.version_doc === 'v1.0'
                          ? 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          : 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 font-bold'
                      }`}
                    >
                      Versión: {eslabon.version_doc}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded border ${
                        eslabon.tiene_sustento
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/40 font-bold'
                      }`}
                    >
                      {eslabon.tiene_sustento ? 'Sustento Documental: OK' : 'SIN SUSTENTO DOCUMENTAL'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed bg-slate-50/80 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/60">
                    {eslabon.documento_texto}
                  </p>
                </div>

                {/* Hashes Criptográficos */}
                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-[10px] font-mono">
                  <div
                    className="text-slate-500 dark:text-slate-500 truncate"
                    title={eslabon.hash_anterior}
                  >
                    <span className="text-slate-600 dark:text-slate-400 font-semibold">
                      Hash Prev:
                    </span>{' '}
                    {eslabon.hash_anterior}
                  </div>
                  <div
                    className="text-emerald-700 dark:text-emerald-300 truncate"
                    title={eslabon.hash_actual}
                  >
                    <span className="text-slate-600 dark:text-slate-400 font-semibold">
                      Sellado BD:
                    </span>{' '}
                    {eslabon.hash_actual}
                  </div>
                  <div
                    className={`truncate ${
                      integroTotal
                        ? 'text-blue-700 dark:text-cyan-300'
                        : 'text-rose-700 dark:text-rose-400 font-bold'
                    }`}
                    title={eslabon.hash_recalculado}
                  >
                    <span className="text-slate-600 dark:text-slate-400 font-semibold">
                      Auditoría:
                    </span>{' '}
                    {eslabon.hash_recalculado}
                  </div>
                  <p className="text-[11px] font-sans text-slate-600 dark:text-slate-400 pt-1">
                    {eslabon.detalle_estado}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECCIÓN 1.5: CHECKLIST DE ENTREGABLES OBLIGATORIOS DEL TDR (BLOQUEO PREVENTIVO DE PAGO) */}
      {detalle.entregables_tdr && detalle.entregables_tdr.length > 0 && (
        <div
          data-tour="traz-candado-entregables"
          className="p-6 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-blue-700 dark:text-cyan-400" />
                Verificación de Entregables Obligatorios del TDR (Control Previo a Conformidad y Pago)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Impide conformidades genéricas exigiendo evidencia técnica y fotográfica por cada entregable antes de habilitar el desembolso en Tesorería
              </p>
            </div>

            {detalle.pago_bloqueado_preventivo ? (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-500/50 text-xs font-extrabold">
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                  <span className="animate-radar-ring absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600 dark:bg-rose-400" />
                </span>
                <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                DESEMBOLSO BLOQUEADO EN TESORERÍA
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                CONFORMIDAD HABILITADA PARA PAGO (100% VERIFICADO)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {detalle.entregables_tdr.map((ent) => (
              <div
                key={ent.id}
                className={`card-elevate p-4 rounded-xl border flex flex-col justify-between space-y-3 text-xs ${
                  ent.cumplido
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-500/30'
                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-500/50'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Entregable #{ent.orden} {ent.obligatorio ? '• OBLIGATORIO' : ''}
                    </span>
                    {ent.cumplido ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                        <CheckCircle2 className="w-3 h-3" /> VERIFICADO
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600 text-white font-bold text-[10px]">
                        <AlertTriangle className="w-3 h-3" /> PENDIENTE / SIN EVIDENCIA
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white leading-snug">
                    {ent.nombre}
                  </div>
                  {ent.evidencia_tecnica ? (
                    <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-1 font-semibold text-blue-700 dark:text-cyan-300 mb-0.5">
                        <Camera className="w-3 h-3" /> Sustento Técnico / Fotográfico:
                      </div>
                      {ent.evidencia_tecnica}
                      {ent.verificado_por && (
                        <div className="text-[10px] font-mono text-slate-500 mt-1">
                          Verificado por {ent.verificado_por} ({ent.fecha_verificacion})
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-rose-100/70 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/40 text-[11px] text-rose-900 dark:text-rose-200">
                      Sin sustento técnico ni registro fotográfico adjunto. Impide emitir conformidad válida y bloquea el giro en Tesorería.
                    </div>
                  )}
                </div>

                {!esSoloLectura && (
                  <div className="pt-1">
                    {!ent.cumplido ? (
                      <button
                        type="button"
                        onClick={() => abrirVerificacionEntregable(ent)}
                        disabled={procesandoAccion}
                        className="btn-tactile w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                      >
                        Verificar y Adjuntar Sustento Técnico
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRevertirEntregable(ent)}
                        disabled={procesandoAccion}
                        className="btn-tactile w-full py-1.5 px-3 rounded-lg bg-white hover:bg-rose-50 dark:bg-slate-900 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 font-semibold text-[11px]"
                      >
                        Observar / Marcar Sin Sustento
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECCIÓN 1.6: CONFLICTOS DE INTERÉS DETECTADOS EN ESTE PROCESO (LEY N° 27815 / R-08) */}
      {detalle.conflictos_interes && detalle.conflictos_interes.length > 0 && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                Conflictos de Interés Detectados en este Proceso (Ley N° 27815 / R-08)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Control preventivo de imparcialidad con códigos seudonimizados (Art. 99 Ley N° 27444, Ley N° 27815 y R.R. N° 0490-2026/UNT)
              </p>
            </div>

            {detalle.conflictos_interes.some((c) => c.estado !== 'ABSTENIDO_Y_REASIGNADO') ? (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/20 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-500/50 text-xs font-extrabold">
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                  <span className="animate-radar-ring absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600 dark:bg-rose-400" />
                </span>
                REQUIERE ABSTENCIÓN Y REASIGNACIÓN
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                CONFLICTO MITIGADO PREVENTIVAMENTE
              </span>
            )}
          </div>

          <div className="space-y-3">
            {detalle.conflictos_interes.map((ci) => {
              const esResuelto = ci.estado === 'ABSTENIDO_Y_REASIGNADO';
              const esDetectado = ci.estado === 'DETECTADO';
              return (
                <div
                  key={ci.id}
                  className={`p-4 rounded-xl border space-y-3 text-xs ${
                    esDetectado
                      ? 'bg-rose-50/50 dark:bg-rose-950/25 border-rose-200 dark:border-rose-500/40'
                      : esResuelto
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-500/35'
                      : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-500/40'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold">
                        CI-#{ci.id}
                      </span>
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {ci.funcionario_codigo}
                      </span>
                      <span className="text-slate-400">↔</span>
                      <span className="font-extrabold text-rose-700 dark:text-rose-300">
                        {ci.proveedor_vinculado_codigo}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-sans font-semibold">
                        {ci.tipo_vinculo}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        esDetectado
                          ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-500/40'
                          : esResuelto
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                          : 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
                      }`}
                    >
                      {esDetectado ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : esResuelto ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Scale className="w-3.5 h-3.5" />
                      )}
                      {ci.estado}
                    </span>
                  </div>

                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-white/80 dark:bg-slate-950/70 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800">
                    {ci.descripcion}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span>Registrado: {ci.fecha_registro}</span>
                      {ci.funcionario_reasignado && (
                        <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                          Reasignado a: {ci.funcionario_reasignado}
                        </span>
                      )}
                      {ci.resuelto_por && (
                        <span className="text-blue-700 dark:text-cyan-300">
                          Autorizado por: {ci.resuelto_por}
                        </span>
                      )}
                    </div>

                    {esResuelto ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/35 font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Abstención Formalizada ({ci.funcionario_reasignado})
                      </span>
                    ) : !esSoloLectura ? (
                      <button
                        type="button"
                        onClick={() => abrirModalConflicto(ci)}
                        disabled={procesandoAccion}
                        className="btn-tactile inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 disabled:opacity-40 text-white dark:text-slate-950 font-bold text-xs shadow-sm"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        Abstener y Reasignar
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECCIÓN 2: DETECTOR SEMÁNTICO DE DIRECCIONAMIENTO EN TDR (TF-IDF + COSENO) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Detector Semántico de Direccionamiento en TDR (Scikit-Learn TF-IDF)
            </h3>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                nlp.alerta_detectada
                  ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40'
                  : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
              }`}
            >
              Máx. Similitud: {nlp.max_similitud}% (Umbral: {nlp.umbral_alerta}%)
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-[11px] font-mono uppercase text-blue-700 dark:text-cyan-400 font-semibold">
              Texto Íntegro de los Términos de Referencia (TDR) del Expediente:
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
              {detalle.tdr_texto}
            </p>
          </div>

          <div
            className={`p-4 rounded-xl border text-xs leading-relaxed ${
              nlp.alerta_detectada
                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/40 text-rose-900 dark:text-rose-200'
                : 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <strong className="block mb-1 font-bold">
              Diagnóstico Explicable XAI (100% Local Offline):
            </strong>
            {nlp.explicacion_xai}
          </div>
        </div>

        {/* Barras Comparativas de Similitud Coseno contra Catálogos de Proveedores */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Matriz de Similitud Coseno: TDR vs. Catálogos Técnicos de Proveedores
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Una similitud superior al {nlp.umbral_alerta}% alerta sobre posible copia de especificaciones técnicas exclusivas de un proveedor
            </p>
          </div>

          <div className="space-y-3.5">
            {nlp.comparaciones.slice(0, 5).map((comp, idx) => (
              <div
                key={`${detalle.id}-${comp.proveedor_codigo}`}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/90 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-700 dark:text-cyan-300">
                      {comp.proveedor_codigo}
                    </span>
                    {comp.es_adjudicado && (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-500/30">
                        PROVEEDOR ADJUDICADO
                      </span>
                    )}
                  </div>
                  <span
                    className={`font-mono font-extrabold tabular-nums ${
                      comp.alerta_direccionamiento
                        ? 'text-rose-700 dark:text-rose-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {comp.porcentaje_similitud}% Similitud
                  </span>
                </div>

                <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full animate-bar-grow ${
                      comp.alerta_direccionamiento
                        ? 'bg-rose-600 dark:bg-rose-500'
                        : 'bg-emerald-600 dark:bg-emerald-400'
                    }`}
                    style={{
                      width: `${Math.max(6, comp.porcentaje_similitud)}%`,
                      animationDelay: `${100 + idx * 80}ms`,
                    }}
                  />
                </div>

                {comp.terminos_coincidentes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-500">N-gramas coincidentes:</span>
                    {comp.terminos_coincidentes.map((term) => (
                      <span
                        key={term}
                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-700 dark:text-slate-300"
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: SEÑALES EXPLICABLES XAI ACTIVAS Y POSTORES DEL PROCESO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            Señales de Riesgo que Ameritan Revisión Humana (Motor XAI)
          </h3>

          {detalle.alertas.length === 0 ? (
            <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 text-xs text-emerald-900 dark:text-emerald-200">
              Este expediente no registra señales de riesgo activas. Todas las etapas cumplen con la segregación funcional, topes de 8 UIT y pluralidad efectiva de postores.
            </div>
          ) : (
            <div className="space-y-4">
              {detalle.alertas.map((al) => {
                const esArchivada = al.estado_revision === 'ARCHIVADA_SUSTENTADA';
                const esEnDescargo = al.estado_revision === 'EN_DESCARGO';
                const esCerradaOci = isAlertaCerradaPorOci(al.estado_revision);
                const cardSurfaceClass = esArchivada
                  ? 'bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-500/35'
                  : esEnDescargo
                  ? 'bg-amber-50/35 dark:bg-slate-950 border-amber-200 dark:border-amber-500/40'
                  : 'bg-rose-50/40 dark:bg-slate-950 border-rose-200 dark:border-rose-500/40';
                const ruleTextClass = esArchivada
                  ? 'text-emerald-800 dark:text-emerald-300'
                  : esEnDescargo
                  ? 'text-amber-800 dark:text-amber-300'
                  : 'text-rose-700 dark:text-rose-300';
                const dividerClass = esArchivada
                  ? 'border-emerald-200/70 dark:border-slate-800'
                  : esEnDescargo
                  ? 'border-amber-200/70 dark:border-slate-800'
                  : 'border-rose-200/70 dark:border-slate-800';

                return (
                  <div
                    key={al.id}
                    className={`p-4 rounded-xl border space-y-3 text-xs ${cardSurfaceClass}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`font-mono font-bold ${ruleTextClass}`}>
                        [{al.codigo_regla}] {al.categoria}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <RevisionStatusBadge
                          estado={al.estado_revision}
                          rolUltimoCambio={al.rol_ultimo_cambio}
                        />
                      </div>
                    </div>

                    {/* Derivación y Plazo SLA */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] bg-white/85 dark:bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      {esArchivada ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <strong className="text-slate-600 dark:text-slate-400">
                            Estado de Control:
                          </strong>{' '}
                          Señal sustentada y archivada por OCI (Sin plazo SLA pendiente)
                        </span>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                            <Building2 className="w-3.5 h-3.5 text-blue-700 dark:text-cyan-400 shrink-0" />
                            <strong className="text-slate-500 dark:text-slate-400">
                              Derivada a:
                            </strong>{' '}
                            {al.area_asignada}
                          </span>
                          {al.fecha_limite && (
                            <span className="inline-flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-mono font-semibold">
                              <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                              Plazo SLA: {al.fecha_limite}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{al.titulo}</h4>
                    <div className="space-y-1.5 text-slate-700 dark:text-slate-300 pt-0.5">
                      <p>
                        <strong className="text-blue-800 dark:text-cyan-300">
                          (a) Regla Activada:
                        </strong>{' '}
                        {al.regla_activada}
                      </p>
                      <p>
                        <strong className="text-emerald-800 dark:text-emerald-300">
                          (b) Evidencia Exacta:
                        </strong>{' '}
                        {al.evidencia_exacta}
                      </p>
                      <p>
                        <strong className="text-amber-800 dark:text-amber-300">
                          (c) Base Normativa Exacta:
                        </strong>{' '}
                        {al.base_normativa}
                      </p>
                    </div>

                    {/* Acción Correctiva / Disposición Contextual */}
                    {al.accion_correctiva && (
                      <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-500/35 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
                          <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />
                          {getCardAccionCorrectivaHeading(
                            al.estado_revision,
                            al.rol_ultimo_cambio,
                          )}
                        </div>
                        <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                          {al.accion_correctiva}
                        </p>
                      </div>
                    )}

                    {/* Último Descargo / Pronunciamiento */}
                    {al.comentario_descargo && (
                      <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-500/40 space-y-0.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sky-900 dark:text-sky-300 font-bold text-[11px]">
                          <span>
                            Último Pronunciamiento / Descargo
                            {al.rol_ultimo_cambio ? ` — ${al.rol_ultimo_cambio}` : ''}
                          </span>
                          {al.fecha_actualizacion && (
                            <span className="font-mono text-[10px]">{al.fecha_actualizacion}</span>
                          )}
                        </div>
                        <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                          {al.comentario_descargo}
                        </p>
                      </div>
                    )}

                    {/* Bitácora Cronológica Compacta */}
                    {al.historial && al.historial.length > 0 && (
                      <div className="p-3 rounded-lg bg-white/85 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          <History className="w-3 h-3 text-blue-700 dark:text-cyan-400" />
                          Bitácora Cronológica ({al.historial.length})
                        </div>
                        <div className="space-y-1.5">
                          {al.historial.map((h) => (
                            <div
                              key={h.id}
                              className="pl-2.5 border-l-2 border-blue-600/40 dark:border-cyan-500/40 text-[11px] space-y-0.5"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-blue-800 dark:text-cyan-300">
                                  {h.rol_usuario}{' '}
                                  <span className="text-slate-500 dark:text-slate-400 font-mono">
                                    ({h.estado_anterior || 'INICIO'} → {h.estado_nuevo})
                                  </span>
                                </span>
                                <span className="font-mono text-[10px] text-slate-500">
                                  {h.timestamp}
                                </span>
                              </div>
                              <p className="text-slate-700 dark:text-slate-300">{h.comentario}</p>
                              {h.accion_correctiva && (
                                <p className="text-emerald-700 dark:text-emerald-300/90 font-medium">
                                  {getHistorialAccionPrefix(h.estado_nuevo, h.rol_usuario)}{' '}
                                  {h.accion_correctiva}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Acciones Directas Inline por Rol (Transparencia estrictamente solo lectura) */}
                    {!esSoloLectura && (
                      <div
                        className={`flex flex-wrap items-center justify-between gap-2 pt-2 border-t ${dividerClass}`}
                      >
                        <div>
                          {al.codigo_regla === 'R-04-COLUSION-GRAFO' && (
                            <button
                              type="button"
                              onClick={() => navigate('/grafo-colusion')}
                              className="btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-cyan-500/15 dark:hover:bg-cyan-500/25 border border-blue-200 dark:border-cyan-500/35 text-blue-800 dark:text-cyan-300 font-bold text-[11px]"
                            >
                              <Network className="w-3.5 h-3.5" />
                              Ver Red de Empresas
                            </button>
                          )}
                        </div>

                        {!esAuditorOCI && esCerradaOci ? (
                          esArchivada ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-emerald-800 dark:text-emerald-300 text-xs font-bold"
                              title="La señal fue archivada motivadamente por el Auditor OCI. Solo OCI puede reabrirla."
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              Cerrada y Archivada por OCI
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 text-xs font-bold"
                              title="El Auditor OCI ya emitió dictamen definitivo para Hito de Control. Solo OCI puede modificarlo."
                            >
                              <Lock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                              Dictamen Definitivo OCI Emitido
                            </span>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => abrirModalAlerta(al)}
                            disabled={procesandoAccion}
                            className={`btn-tactile inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm disabled:opacity-40 ${
                              esAuditorOCI
                                ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950'
                                : 'bg-blue-700 hover:bg-blue-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950'
                            }`}
                          >
                            <MessageSquarePlus className="w-3.5 h-3.5" />
                            {esAuditorOCI
                              ? esCerradaOci
                                ? 'Modificar Dictamen / Reabrir'
                                : 'Derivar / Dictaminar'
                              : 'Responder Descargo (DEC)'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Postores y Atributos Hash (Ley N° 29733) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-700 dark:text-cyan-400" />
            Postores Cotizantes (Ley 29733)
          </h3>
          <div className="space-y-3">
            {detalle.postulaciones.map((post) => (
              <div
                key={post.id}
                className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                  post.es_ganador
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/40'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-blue-700 dark:text-cyan-300">
                    {post.proveedor_codigo}
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    S/ {post.monto_ofertado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400">
                  {post.proveedor_alias}
                </div>
                <div className="pt-1 border-t border-slate-200 dark:border-slate-800/80 font-mono text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
                  <div>
                    Rep. Legal:{' '}
                    <span className="text-amber-700 dark:text-amber-300 font-semibold">
                      {post.representante_id}
                    </span>
                  </div>
                  <div>
                    Socio / Inversor:{' '}
                    <span className="text-amber-700 dark:text-amber-300 font-semibold">
                      {post.accionista_id}
                    </span>
                  </div>
                  <div>
                    Dirección:{' '}
                    <span className="text-amber-700 dark:text-amber-300 font-semibold">
                      {post.direccion_hash}
                    </span>
                  </div>
                  <div>
                    Teléfono:{' '}
                    <span className="text-amber-700 dark:text-amber-300 font-semibold">
                      {post.telefono_hash}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Modal: Verificar Entregable Obligatorio del TDR */}
      <Modal
        isOpen={Boolean(entregableEdit)}
        onClose={() => setEntregableEdit(null)}
        title={`Verificar Entregable #${entregableEdit?.orden} — ${detalle.codigo}`}
        subtitle="Adjunte la referencia de sustento técnico o registro fotográfico para habilitar la conformidad y desbloquear Tesorería"
      >
        {entregableEdit && (
          <form onSubmit={handleGuardarEntregable} className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white">
              {entregableEdit.nombre}
            </div>
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Sustento Técnico / Evidencia Fotográfica (Sintética):
              </label>
              <textarea
                rows={3}
                required
                value={evidenciaInput}
                onChange={(e) => setEvidenciaInput(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEntregableEdit(null)}
                className="btn-tactile px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={procesandoAccion}
                className="btn-tactile px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Confirmar Verificación y Registrar en Bitácora
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Derivar / Dictaminar Alerta XAI (OCI) o Responder Descargo (DEC) */}
      <Modal
        isOpen={Boolean(alertaEdit)}
        onClose={() => setAlertaEdit(null)}
        title={
          esAuditorOCI
            ? `Dictamen y Derivación OCI — ${detalle.codigo}`
            : `Responder Descargo Técnico (DEC) — ${detalle.codigo}`
        }
        subtitle={`Actuando bajo el rol: ${rolActivo} • Control de Acceso Diferenciado (RBAC)`}
      >
        {alertaEdit && (
          <form onSubmit={handleGuardarAlerta} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="font-mono text-rose-700 dark:text-rose-300 font-bold">
                [{alertaEdit.codigo_regla}] {alertaEdit.titulo}
              </div>
              <p className="text-slate-600 dark:text-slate-400">{alertaEdit.evidencia_exacta}</p>
            </div>

            {errorAlertaModal && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/50 text-rose-800 dark:text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{errorAlertaModal}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Nuevo Estado de la Señal Preventiva:
              </label>
              <select
                value={esAuditorOCI ? nuevoEstado : 'EN_DESCARGO'}
                onChange={(e) => handleCambiarEstadoAlerta(e.target.value as EstadoRevisionAlerta)}
                disabled={!esAuditorOCI}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500 disabled:opacity-90"
              >
                {esAuditorOCI ? (
                  <>
                    <option value="EN_DESCARGO">
                      EN_DESCARGO — Derivar al Área / DEC para Descargo Técnico
                    </option>
                    <option value="VALIDADA_OCI">
                      VALIDADA_OCI — Observación Confirmada por Auditor OCI para Hito de Control
                    </option>
                    <option value="ARCHIVADA_SUSTENTADA">
                      ARCHIVADA_SUSTENTADA — Desestimada con Sustento Técnico-Legal Firme
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
                  {nuevoEstado === 'ARCHIVADA_SUSTENTADA' ? (
                    <div className="w-full px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Sin SLA pendiente (Cierre de alerta)</span>
                    </div>
                  ) : (
                    <input
                      type="date"
                      value={fechaLimite}
                      onChange={(e) => setFechaLimite(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500"
                    />
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                {getModalAccionCorrectivaLabel(nuevoEstado, esAuditorOCI)}
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
                value={comentarioAlerta}
                onChange={(e) => setComentarioAlerta(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500"
                placeholder="Ingrese el fundamento técnico o normativo de la revisión humana..."
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAlertaEdit(null)}
                className="btn-tactile px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={procesandoAccion}
                className="btn-tactile inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-extrabold shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                {procesandoAccion ? 'Guardando...' : 'Firmar y Registrar en Bitácora'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Formalizar Abstención y Reasignación de Conflicto de Interés */}
      <Modal
        isOpen={Boolean(conflictoEdit)}
        onClose={() => setConflictoEdit(null)}
        title={`Formalizar Abstención y Reasignación — ${detalle.codigo}`}
        subtitle={`CI-#${conflictoEdit?.id} • Registro inmutable en Bitácora Global SHA-256`}
      >
        {conflictoEdit && (
          <form onSubmit={handleConfirmarAbstencion} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/35 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-800 dark:text-rose-300">
                <UserX className="w-4 h-4" />
                Interviniente con Vínculo: {conflictoEdit.funcionario_codigo} ↔{' '}
                {conflictoEdit.proveedor_vinculado_codigo}
              </div>
              <p className="text-slate-700 dark:text-slate-300">
                {conflictoEdit.tipo_vinculo} — {conflictoEdit.descripcion}
              </p>
            </div>

            {errorConflictoModal && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/50 text-rose-800 dark:text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{errorConflictoModal}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Código del Funcionario Alterno sin Conflicto (Seudonimizado):
              </label>
              <input
                type="text"
                required
                value={alternoReasignado}
                onChange={(e) => setAlternoReasignado(e.target.value)}
                placeholder="Ej. FUNC-LOG-09"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Resolución / Sustento de Abstención y Reasignación:
              </label>
              <textarea
                rows={3}
                required
                value={comentarioAbstencion}
                onChange={(e) => setComentarioAbstencion(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConflictoEdit(null)}
                className="btn-tactile px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={procesandoAccion}
                className="btn-tactile inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-extrabold shadow-sm"
              >
                <ArrowRightLeft className="w-4 h-4" />
                {procesandoAccion ? 'Formalizando...' : 'Formalizar Abstención y Reasignar'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
