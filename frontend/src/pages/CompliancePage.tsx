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
  Scale,
  UserX,
  ArrowRightLeft,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { centinelaApi } from '../api/client';
import {
  AlertaGestion,
  ConflictoInteresItem,
  ExpedienteListItem,
  ProveedorItem,
  RolUsuario,
} from '../types';
import { RevisionStatusBadge } from '../components/AlertBadge';
import { Modal } from '../components/Modal';

interface CompliancePageProps {
  rolActivo: RolUsuario;
}

const AREAS_DERIVACION = [
  'OCI — Órgano de Control Institucional',
  'OCI — Control Simultáneo (Hito de Control)',
  'OCI — Unidad de Análisis de Redes y Compliance',
  'Oficina de Integridad / OCI — Abstención y Reasignación',
  'DEC — Dependencia Encargada de Contrataciones',
  'Área Usuaria / DEC — Subsanación Documental',
  'Tesorería / Control Previo + OCI',
  'Oficina de Asesoría Jurídica',
];

const TIPOS_VINCULO = [
  'Vínculo Familiar Directo con Representante Legal',
  'Ex-Socio / Participación Societaria Previa',
  'Relación Laboral o Consultoría Previa con el Postor',
  'Vínculo Personal / Interés Económico Indirecto',
];

export const CompliancePage: React.FC<CompliancePageProps> = ({ rolActivo }) => {
  const navigate = useNavigate();
  const [tabActivo, setTabActivo] = useState<'alertas' | 'conflictos'>('alertas');

  // Estado Tab 1: Señales Preventivas XAI
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

  // Estado Tab 2: Conflictos de Interés (Declaración, Abstención y Reasignación)
  const [conflictos, setConflictos] = useState<ConflictoInteresItem[]>([]);
  const [loadingConflictos, setLoadingConflictos] = useState<boolean>(true);
  const [expedientesCatalogo, setExpedientesCatalogo] = useState<ExpedienteListItem[]>([]);
  const [proveedoresCatalogo, setProveedoresCatalogo] = useState<ProveedorItem[]>([]);

  // Modal Declarar Conflicto de Interés
  const [modalDeclararAbierto, setModalDeclararAbierto] = useState<boolean>(false);
  const [ciExpedienteId, setCiExpedienteId] = useState<number>(1);
  const [ciFuncionario, setCiFuncionario] = useState<string>('FUNC-COM-SEL-02');
  const [ciProveedor, setCiProveedor] = useState<string>('PROV-SYN-014');
  const [ciTipoVinculo, setCiTipoVinculo] = useState<string>(TIPOS_VINCULO[0]);
  const [ciDescripcion, setCiDescripcion] = useState<string>(
    'Declaración preventiva oportuna: el interviniente informa relación previa con el representante legal del postor y solicita revisión de causal de abstención.',
  );
  const [ciAbstenerInmediato, setCiAbstenerInmediato] = useState<boolean>(true);
  const [ciFuncionarioReasignado, setCiFuncionarioReasignado] = useState<string>('FUNC-COM-ALT-04');
  const [guardandoCi, setGuardandoCi] = useState<boolean>(false);
  const [errorCiModal, setErrorCiModal] = useState<string | null>(null);

  // Modal Abstención y Reasignación
  const [conflictoParaAbstener, setConflictoParaAbstener] = useState<ConflictoInteresItem | null>(
    null,
  );
  const [alternoReasignado, setAlternoReasignado] = useState<string>('FUNC-COM-ALT-05');
  const [comentarioAbstencion, setComentarioAbstencion] = useState<string>(
    'Conforme al Art. 99 de la Ley N° 27444, Ley N° 27815 y la R.R. N° 0490-2026/UNT, se formaliza la abstención preventiva y se reasigna el expediente al interviniente alterno sin vínculo con los postores.',
  );
  const [guardandoAbstencion, setGuardandoAbstencion] = useState<boolean>(false);
  const [errorAbstencion, setErrorAbstencion] = useState<string | null>(null);

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

  const cargarConflictos = async () => {
    try {
      setLoadingConflictos(true);
      const data = await centinelaApi.listarConflictosInteres();
      setConflictos(data);
    } finally {
      setLoadingConflictos(false);
    }
  };

  useEffect(() => {
    cargarAlertas();
  }, [filtroEstado, filtroCategoria]);

  useEffect(() => {
    cargarConflictos();
    Promise.all([centinelaApi.listarExpedientes(), centinelaApi.listarProveedores()])
      .then(([exps, provs]) => {
        setExpedientesCatalogo(exps);
        setProveedoresCatalogo(provs);
        if (exps.length > 0) setCiExpedienteId(exps[0].id);
        if (provs.length > 0) setCiProveedor(provs[0].codigo);
      })
      .catch(() => {
        // Silencioso; se usan valores por defecto en el formulario
      });
  }, []);

  const conflictosDetectados = conflictos.filter((c) => c.estado === 'DETECTADO').length;
  const conflictosDeclarados = conflictos.filter((c) => c.estado === 'DECLARADO_OPORTUNO').length;
  const conflictosAbstenidos = conflictos.filter(
    (c) => c.estado === 'ABSTENIDO_Y_REASIGNADO',
  ).length;

  // Priorizar arriba los conflictos pendientes de atención (DETECTADO -> DECLARADO -> ABSTENIDO)
  const conflictosOrdenados = [...conflictos].sort((a, b) => {
    const prioridad: Record<string, number> = {
      DETECTADO: 0,
      DECLARADO_OPORTUNO: 1,
      ABSTENIDO_Y_REASIGNADO: 2,
    };
    const pa = prioridad[a.estado] ?? 3;
    const pb = prioridad[b.estado] ?? 3;
    if (pa !== pb) return pa - pb;
    return b.id - a.id;
  });

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

  const handleDeclararConflicto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (esSoloLectura) return;
    try {
      setGuardandoCi(true);
      setErrorCiModal(null);
      await centinelaApi.declararConflictoInteres({
        expediente_id: Number(ciExpedienteId),
        funcionario_codigo: ciFuncionario.trim(),
        proveedor_vinculado_codigo: ciProveedor.trim(),
        tipo_vinculo: ciTipoVinculo,
        descripcion: ciDescripcion.trim(),
        abstenerse_de_inmediato: ciAbstenerInmediato,
        funcionario_reasignado: ciAbstenerInmediato ? ciFuncionarioReasignado.trim() : undefined,
      });
      setModalDeclararAbierto(false);
      await Promise.all([cargarConflictos(), cargarAlertas()]);
    } catch (err: any) {
      setErrorCiModal(
        err?.response?.data?.detail ||
          'No se pudo registrar la declaración de conflicto de interés.',
      );
    } finally {
      setGuardandoCi(false);
    }
  };

  const handleConfirmarAbstencion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conflictoParaAbstener || esSoloLectura) return;
    try {
      setGuardandoAbstencion(true);
      setErrorAbstencion(null);
      await centinelaApi.abstenerYReasignarConflicto(conflictoParaAbstener.id, {
        funcionario_reasignado: alternoReasignado.trim(),
        comentario: comentarioAbstencion.trim(),
      });
      setConflictoParaAbstener(null);
      await Promise.all([cargarConflictos(), cargarAlertas()]);
    } catch (err: any) {
      setErrorAbstencion(
        err?.response?.data?.detail ||
          'No se pudo formalizar la abstención y reasignación. Verifique los permisos del rol activo.',
      );
    } finally {
      setGuardandoAbstencion(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Diferenciado por Rol (Superficie Sólida Limpia) */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-t-[3px] shadow-sm dark:shadow-none ${
          esAuditorOCI
            ? 'border-t-[#0B1F3A] dark:border-t-emerald-500'
            : esSoloLectura
            ? 'border-t-amber-600 dark:border-t-amber-400'
            : 'border-t-blue-700 dark:border-t-cyan-500'
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
                ? 'Competencia OCI: Derivación, Plazo SLA, Conflictos y Dictamen'
                : esSoloLectura
                ? 'Modo Solo Lectura (RBAC Activo)'
                : 'Competencia DEC: Descargos Técnicos, Declaraciones y Subsanación'}
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            {esAuditorOCI
              ? 'Alertas Preventivas y Conflictos de Interés (OCI)'
              : esSoloLectura
              ? 'Consulta Pública de Alertas Preventivas y Conflictos'
              : 'Alertas por Responder y Declaraciones (Compras / DEC)'}
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl">
            Ninguna alerta acusa un delito (Presunción de Licitud, Art. 248 Ley N° 27444). Cada caso muestra su evidencia para revisión humana, gestión de conflictos de interés y seguimiento bajo el Modelo de Integridad (D.S. N° 148-2024-PCM y R.R. N° 0490-2026/UNT).
          </p>
        </div>

        {/* Filtros (Tab 1) o Acción Declarar (Tab 2) */}
        {tabActivo === 'alertas' ? (
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
              <option value="Ejecución Contractual / Pago">Pago sin Conformidad / TDR</option>
              <option value="Trazabilidad / Versiones y Sustentos">Versiones y Sustentos</option>
              <option value="Conflicto de Interés">Conflicto de Interés (R-08)</option>
              <option value="Integridad Criptográfica SHA-256">Ruptura SHA-256</option>
            </select>
          </div>
        ) : esSoloLectura ? (
          <span
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-semibold cursor-not-allowed"
            title="El perfil Consulta Transparencia tiene permisos de solo lectura (Ley N° 27806)"
          >
            <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Solo Lectura (Sin Registro)
          </span>
        ) : (
          <button
            onClick={() => {
              setErrorCiModal(null);
              setModalDeclararAbierto(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-bold text-xs shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Declarar Conflicto de Interés
          </button>
        )}
      </div>

      {/* Selector de Pestañas: Señales XAI vs Conflictos de Interés */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-fit">
        <button
          onClick={() => setTabActivo('alertas')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            tabActivo === 'alertas'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <ClipboardCheck className="w-4 h-4 text-blue-700 dark:text-cyan-400" />
          Alertas con Explicación (XAI)
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {alertas.length}
          </span>
        </button>

        <button
          onClick={() => setTabActivo('conflictos')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            tabActivo === 'conflictos'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Scale className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          Conflictos de Interés (Abstención y Reasignación)
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
              conflictosDetectados > 0
                ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/40 font-extrabold'
                : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
            }`}
          >
            {conflictosDetectados > 0
              ? `${conflictosDetectados} pendiente${conflictosDetectados > 1 ? 's' : ''}`
              : `${conflictos.length} gestionado${conflictos.length === 1 ? '' : 's'}`}
          </span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: LISTADO DE SEÑALES EXPLICABLES XAI                             */}
      {/* ===================================================================== */}
      {tabActivo === 'alertas' && (
        <>
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
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => navigate(`/trazabilidad?id=${alerta.expediente_id}`)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition"
                      >
                        <FileSearch className="w-3.5 h-3.5 text-blue-700 dark:text-cyan-400" />
                        Ver Detalle y Seguridad
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
                      {alerta.codigo_regla === 'R-08-CONFLICTO-INTERES' && (
                        <button
                          onClick={() => setTabActivo('conflictos')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-amber-200 dark:border-amber-500/35 text-amber-800 dark:text-amber-300 text-xs font-bold transition"
                        >
                          <Scale className="w-3.5 h-3.5" />
                          Gestionar Abstención / Reasignación
                        </button>
                      )}
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
        </>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: GESTIÓN DE CONFLICTOS DE INTERÉS (ABSTENCIÓN Y REASIGNACIÓN)   */}
      {/* ===================================================================== */}
      {tabActivo === 'conflictos' && (
        <div className="space-y-5">
          {/* Resumen normativo y métricas del flujo de Conflictos de Interés */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-1 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-500/30">
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                Detectados sin Abstención
              </div>
              <div className="text-2xl font-extrabold text-rose-800 dark:text-rose-200 mt-1 font-mono">
                {conflictosDetectados}
              </div>
              <div className="text-[11px] text-rose-700/80 dark:text-rose-300/80 mt-0.5">
                Activan Regla XAI R-08
              </div>
            </div>

            <div className="lg:col-span-1 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-500/30">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Declarados Oportunamente
              </div>
              <div className="text-2xl font-extrabold text-amber-900 dark:text-amber-200 mt-1 font-mono">
                {conflictosDeclarados}
              </div>
              <div className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                Pendientes de reasignación formal
              </div>
            </div>

            <div className="lg:col-span-1 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-500/30">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Abstenidos y Reasignados
              </div>
              <div className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-200 mt-1 font-mono">
                {conflictosAbstenidos}
              </div>
              <div className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                Riesgo mitigado preventivamente
              </div>
            </div>

            <div className="lg:col-span-1 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-cyan-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                Ciclo Preventivo UNT
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Declaración Oportuna → Evaluación → Abstención y Reasignación (Art. 39 Const., Ley N° 27815, Art. 99 Ley N° 27444, R.R. N° 0490-2026/UNT). Códigos 100% seudonimizados.
              </p>
            </div>
          </div>

          {loadingConflictos ? (
            <div className="p-12 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-700 dark:text-emerald-400 animate-spin" />
              <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                Cargando registro preventivo de conflictos de interés...
              </span>
            </div>
          ) : conflictos.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
              No existen conflictos de interés registrados en el periodo actual.
            </div>
          ) : (
            <div className="space-y-4">
              {conflictosOrdenados.map((ci) => {
                const esResuelto = ci.estado === 'ABSTENIDO_Y_REASIGNADO';
                const esDetectado = ci.estado === 'DETECTADO';
                return (
                  <div
                    key={ci.id}
                    className={`p-6 rounded-2xl bg-white dark:bg-slate-900/95 border shadow-sm dark:shadow-none space-y-4 ${
                      esDetectado
                        ? 'border-rose-200 dark:border-rose-500/40'
                        : esResuelto
                        ? 'border-emerald-200 dark:border-emerald-500/35'
                        : 'border-amber-200 dark:border-amber-500/40'
                    }`}
                  >
                    {/* Encabezado de tarjeta */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold">
                          CI-#{ci.id}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-cyan-500/15 text-blue-800 dark:text-cyan-300 border border-blue-200 dark:border-cyan-500/30 font-mono text-xs font-bold">
                          {ci.expediente_codigo}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {ci.expediente_objeto}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                          esDetectado
                            ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-500/40'
                            : esResuelto
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40'
                            : 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/40'
                        }`}
                      >
                        {esDetectado ? (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        ) : esResuelto ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Scale className="w-3.5 h-3.5" />
                        )}
                        {esDetectado
                          ? 'DETECTADO SIN ABSTENCIÓN'
                          : esResuelto
                          ? 'ABSTENIDO Y REASIGNADO'
                          : 'DECLARADO OPORTUNAMENTE'}
                      </span>
                    </div>

                    {/* Grilla de actores seudonimizados */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Funcionario Interviniente
                        </div>
                        <div className="font-mono font-extrabold text-slate-900 dark:text-white mt-1">
                          {ci.funcionario_codigo}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Proveedor / Postor Vinculado
                        </div>
                        <div className="font-mono font-extrabold text-rose-700 dark:text-rose-300 mt-1">
                          {ci.proveedor_vinculado_codigo}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Tipo de Vínculo
                        </div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
                          {ci.tipo_vinculo}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Funcionario Alterno Reasignado
                        </div>
                        <div
                          className={`font-mono font-extrabold mt-1 ${
                            ci.funcionario_reasignado
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {ci.funcionario_reasignado || 'Pendiente de reasignación'}
                        </div>
                      </div>
                    </div>

                    {/* Descripción y metadatos de resolución */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        {ci.descripcion}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/70 dark:border-slate-800">
                        <span>Registrado: {ci.fecha_registro}</span>
                        {ci.fecha_resolucion && (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            Resuelto: {ci.fecha_resolucion}
                          </span>
                        )}
                        {ci.resuelto_por && (
                          <span className="text-blue-700 dark:text-cyan-400">
                            Autorizado por: {ci.resuelto_por}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <button
                        onClick={() => navigate(`/trazabilidad?id=${ci.expediente_id}`)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition"
                      >
                        <FileSearch className="w-3.5 h-3.5 text-blue-700 dark:text-cyan-400" />
                        Ver Expediente {ci.expediente_codigo}
                      </button>

                      {esResuelto ? (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          Abstención Formalizada — Competencia Transferida a {ci.funcionario_reasignado}
                        </span>
                      ) : esSoloLectura ? (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-semibold cursor-not-allowed">
                          <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          Solo Lectura (Sin Gestión)
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setErrorAbstencion(null);
                            setConflictoParaAbstener(ci);
                            setAlternoReasignado('FUNC-COM-ALT-05');
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-bold text-xs shadow-sm transition"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                          Registrar Abstención y Reasignar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal 1: Registrar Descargo, Derivación, Acción Correctiva o Dictamen (Tab 1) */}
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

      {/* Modal 2: Declarar Conflicto de Interés Oportuno */}
      <Modal
        isOpen={modalDeclararAbierto}
        onClose={() => setModalDeclararAbierto(false)}
        title="Declaración Preventiva de Conflicto de Interés"
        subtitle="Ley N° 27815 • Art. 99 Ley N° 27444 • D.S. N° 148-2024-PCM • Códigos Seudonimizados (Ley N° 29733)"
      >
        <form onSubmit={handleDeclararConflicto} className="space-y-4 text-xs">
          {errorCiModal && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/50 text-rose-800 dark:text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{errorCiModal}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-200">
              Expediente de Contratación:
            </label>
            <select
              value={ciExpedienteId}
              onChange={(e) => setCiExpedienteId(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            >
              {expedientesCatalogo.slice(0, 25).map((exp) => (
                <option key={exp.id} value={exp.id}>
                  {exp.codigo} — {exp.objeto.slice(0, 68)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Código del Funcionario (Seudonimizado):
              </label>
              <input
                type="text"
                required
                value={ciFuncionario}
                onChange={(e) => setCiFuncionario(e.target.value)}
                placeholder="Ej. FUNC-COM-SEL-02"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Proveedor / Postor Vinculado:
              </label>
              <select
                value={ciProveedor}
                onChange={(e) => setCiProveedor(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
              >
                {proveedoresCatalogo.map((p) => (
                  <option key={p.id} value={p.codigo}>
                    {p.codigo} — {p.alias_comercial}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-200">
              Tipo de Vínculo Declarado:
            </label>
            <select
              value={ciTipoVinculo}
              onChange={(e) => setCiTipoVinculo(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            >
              {TIPOS_VINCULO.map((tv) => (
                <option key={tv} value={tv}>
                  {tv}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-200">
              Detalle de la Declaración Oportuna:
            </label>
            <textarea
              rows={3}
              required
              value={ciDescripcion}
              onChange={(e) => setCiDescripcion(e.target.value)}
              className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-500/30 space-y-3">
            <label className="flex items-center gap-2.5 font-bold text-emerald-900 dark:text-emerald-200 cursor-pointer">
              <input
                type="checkbox"
                checked={ciAbstenerInmediato}
                onChange={(e) => setCiAbstenerInmediato(e.target.checked)}
                className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
              />
              Formalizar abstención inmediata y reasignación a interviniente alterno
            </label>

            {ciAbstenerInmediato && (
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Código del Funcionario Alterno Reasignado:
                </label>
                <input
                  type="text"
                  required
                  value={ciFuncionarioReasignado}
                  onChange={(e) => setCiFuncionarioReasignado(e.target.value)}
                  placeholder="Ej. FUNC-COM-ALT-04"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-emerald-300 dark:border-emerald-500/40 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalDeclararAbierto(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardandoCi}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-extrabold shadow-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              {guardandoCi ? 'Registrando...' : 'Registrar Declaración en Bitácora'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 3: Formalizar Abstención y Reasignación de un Conflicto Activo */}
      <Modal
        isOpen={Boolean(conflictoParaAbstener)}
        onClose={() => setConflictoParaAbstener(null)}
        title={`Formalizar Abstención y Reasignación — ${conflictoParaAbstener?.expediente_codigo}`}
        subtitle={`CI-#${conflictoParaAbstener?.id} • Registro inmutable en Bitácora Global SHA-256`}
      >
        {conflictoParaAbstener && (
          <form onSubmit={handleConfirmarAbstencion} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/35 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-800 dark:text-rose-300">
                <UserX className="w-4 h-4" />
                Interviniente con Vínculo: {conflictoParaAbstener.funcionario_codigo} ↔{' '}
                {conflictoParaAbstener.proveedor_vinculado_codigo}
              </div>
              <p className="text-slate-700 dark:text-slate-300">
                {conflictoParaAbstener.tipo_vinculo} — {conflictoParaAbstener.descripcion}
              </p>
            </div>

            {errorAbstencion && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/50 text-rose-800 dark:text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{errorAbstencion}</span>
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
                placeholder="Ej. FUNC-COM-ALT-05"
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
                onClick={() => setConflictoParaAbstener(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoAbstencion}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-extrabold shadow-sm"
              >
                <ArrowRightLeft className="w-4 h-4" />
                {guardandoAbstencion
                  ? 'Formalizando...'
                  : 'Formalizar Abstención y Reasignar'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
