import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Lock,
  Activity,
  CheckCircle2,
  Ban,
  Zap,
} from 'lucide-react';
import { centinelaApi } from '../api/client';
import { AuditLogResumen, RolUsuario } from '../types';
import { ROLE_PROFILES } from '../config/roles';

interface AuditoriaPageProps {
  rolActivo: RolUsuario;
}

const ACCION_LABELS: Record<string, string> = {
  INICIO_SISTEMA: 'Inicio de Sistema',
  AUDITORIA_INICIAL_XAI: 'Auditoría Inicial XAI',
  REGISTRO_EXPEDIENTE: 'Registro de Expediente',
  REVISION_ALERTA: 'Revisión / Dictamen Alerta',
  SIMULACION_ALTERACION: 'Prueba Alteración SHA-256',
  RESTAURACION_INTEGRIDAD: 'Restauración SHA-256',
  EXPORTACION_PDF_EXPEDIENTE: 'Descarga PDF Expediente',
  EXPORTACION_REPORTE_INSTITUCIONAL: 'Descarga Reporte Institucional',
  EXPORTACION_DATOS_CSV: 'Exportación Datos CSV',
  EXPORTACION_BITACORA_CSV: 'Exportación Bitácora CSV',
  REINICIO_DATASET: 'Reinicio Dataset Demo',
  VERIFICACION_ENTREGABLE_TDR: 'Verificación Entregable TDR',
  DECLARACION_CONFLICTO_INTERES: 'Declaración Conflicto de Interés',
  ABSTENCION_Y_REASIGNACION: 'Abstención y Reasignación',
  REGISTRO_DENUNCIA_RESERVADA: 'Nueva Denuncia Reservada',
  GESTION_DENUNCIA_RESERVADA: 'Gestión / Derivación Denuncia',
  ACCESO_DENEGADO_RBAC: 'Intento Bloqueado (RBAC)',
};

export const AuditoriaPage: React.FC<AuditoriaPageProps> = ({ rolActivo }) => {
  const profile = ROLE_PROFILES[rolActivo];

  const [resumen, setResumen] = useState<AuditLogResumen | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulando, setSimulando] = useState<boolean>(false);
  const [filtroResultado, setFiltroResultado] = useState<string>('TODOS');
  const [filtroAccion, setFiltroAccion] = useState<string>('TODAS');
  const [busqueda, setBusqueda] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cargarBitacora = async () => {
    if (!profile.canDictaminarOci) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await centinelaApi.obtenerAuditoria({
        resultado: filtroResultado !== 'TODOS' ? filtroResultado : undefined,
        accion: filtroAccion !== 'TODAS' ? filtroAccion : undefined,
        busqueda: busqueda || undefined,
      });
      setResumen(data);
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.detail ||
          'No se pudo cargar la bitácora global de auditoría.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarBitacora();
    }, 150);
    return () => clearTimeout(timer);
  }, [rolActivo, filtroResultado, filtroAccion, busqueda]);

  const handleSimularIntentoBloqueado = async () => {
    try {
      setSimulando(true);
      await centinelaApi.simularIntentoNoAutorizado();
      await cargarBitacora();
    } finally {
      setSimulando(false);
    }
  };

  if (!profile.canDictaminarOci) {
    return (
      <div className="p-8 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700/60 text-amber-950 dark:text-amber-200 space-y-3 max-w-2xl mx-auto mt-10">
        <div className="flex items-center gap-2.5 text-lg font-extrabold">
          <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          Acceso Restringido — Exclusivo Auditor OCI
        </div>
        <p className="text-xs leading-relaxed">
          Por control interno y separación de competencias (Ley N° 27785 y Ley N° 32069), la Bitácora Global de Auditoría solo puede ser inspeccionada por el Órgano de Control Institucional (OCI).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-white via-emerald-50/40 to-white dark:from-slate-900 dark:to-emerald-950/30 p-6 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 shadow-sm dark:shadow-none">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs font-semibold">
            <Activity className="w-3.5 h-3.5" />
            Trazabilidad Total de Usuarios • Encadenamiento SHA-256 Inmutable
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            Bitácora Global de Auditoría del Sistema (Quién, Qué y Cuándo)
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl">
            Registro inmutable (append-only) de toda acción crítica ejecutada en CENTINELA —incluyendo registros, descargos, dictámenes, exportaciones e intentos bloqueados por control de roles (HTTP 403)— usando códigos funcionales seudonimizados (Ley N° 29733).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSimularIntentoBloqueado}
            disabled={simulando}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
            title="Simula a FUNC-DEC-02 intentando archivar indebidamente una alerta para ver cómo RBAC lo bloquea (403) y lo deja grabado aquí"
          >
            <Zap className="w-4 h-4" />
            {simulando ? 'Registrando bloqueo...' : 'Simular Intento No Autorizado (403)'}
          </button>

          <a
            href={centinelaApi.obtenerUrlAuditoriaCsv()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs shadow-sm dark:shadow-none transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Exportar Bitácora (CSV)
          </a>

          <button
            onClick={cargarBitacora}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition"
            title="Actualizar bitácora"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-200 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Banner de Integridad Criptográfica de la Bitácora */}
      {resumen && (
        <>
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
              resumen.cadena_integra
                ? 'bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-500 text-rose-950 dark:text-rose-100 animate-pulse'
            }`}
          >
            {resumen.cadena_integra ? (
              <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldX className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5 text-xs">
              <div className="font-extrabold uppercase tracking-wide">
                {resumen.cadena_integra
                  ? 'Cadena de Auditoría SHA-256 Verificada (Sin Manipulaciones ni Borrados)'
                  : `¡Alerta Crítica! Alteración Detectada en Evento #${resumen.evento_comprometido_id}`}
              </div>
              <p className="opacity-90">{resumen.mensaje_integridad}</p>
            </div>
          </div>

          {/* 4 KPIs de Auditoría */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none">
              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                Total Eventos Encadenados
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">
                {resumen.total_eventos}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none">
              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                Acciones Permitidas
              </div>
              <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1 font-mono">
                {resumen.total_permitidos}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/35 shadow-sm dark:shadow-none">
              <div className="text-[11px] font-bold uppercase text-rose-800 dark:text-rose-300">
                Intentos Bloqueados (403)
              </div>
              <div className="text-2xl font-extrabold text-rose-700 dark:text-rose-400 mt-1 font-mono">
                {resumen.total_bloqueados}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none">
              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                Último Sello SHA-256
              </div>
              <div
                className="text-xs font-mono font-bold text-blue-700 dark:text-cyan-300 mt-2 truncate"
                title={resumen.ultimo_hash}
              >
                {resumen.ultimo_hash}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Filtros */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por usuario (FUNC-OCI-01, FUNC-DEC-02), expediente, acción o detalle..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500"
          />
        </div>

        <select
          value={filtroResultado}
          onChange={(e) => setFiltroResultado(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200"
        >
          <option value="TODOS">Resultado: Todos</option>
          <option value="PERMITIDO">Permitidos</option>
          <option value="BLOQUEADO_403">Bloqueados por RBAC (403)</option>
        </select>

        <select
          value={filtroAccion}
          onChange={(e) => setFiltroAccion(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200"
        >
          <option value="TODAS">Acción: Todas</option>
          {Object.entries(ACCION_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla Cronológica de Eventos */}
      <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none overflow-hidden">
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <span>
            Mostrando{' '}
            <strong className="text-slate-900 dark:text-white">
              {resumen?.eventos.length ?? 0}
            </strong>{' '}
            evento(s) de auditoría (más recientes primero)
          </span>
          <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
            Identidades seudonimizadas (Ley N° 29733)
          </span>
        </div>

        {loading && !resumen ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-7 h-7 text-blue-700 dark:text-emerald-400 animate-spin" />
            <span className="text-xs text-slate-500">Verificando sellos SHA-256 de bitácora...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Fecha / Hora (UTC)</th>
                  <th className="py-3 px-4">Usuario</th>
                  <th className="py-3 px-4">Acción</th>
                  <th className="py-3 px-4">Recurso</th>
                  <th className="py-3 px-4">Resultado</th>
                  <th className="py-3 px-4">Detalle Auditado</th>
                  <th className="py-3 px-4">IP / Sello SHA-256</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {(resumen?.eventos || []).map((ev) => {
                  const esBloqueado = ev.resultado === 'BLOQUEADO_403';
                  return (
                    <tr
                      key={ev.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        esBloqueado ? 'bg-rose-50/60 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {ev.timestamp}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-blue-800 dark:text-cyan-300">
                          {ev.usuario_codigo}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {ev.rol_usuario}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-[11px] text-slate-800 dark:text-slate-200">
                          {ACCION_LABELS[ev.accion] || ev.accion}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {ev.recurso}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {esBloqueado ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40">
                            <Ban className="w-3 h-3" /> BLOQUEADO 403
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> PERMITIDO
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-md">
                        {ev.detalle}
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] whitespace-nowrap">
                        <div className="text-slate-500 dark:text-slate-400">IP: {ev.ip_origen}</div>
                        <div
                          className={`flex items-center gap-1 ${
                            ev.es_integro
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-700 dark:text-rose-400 font-bold'
                          }`}
                          title={ev.hash_actual}
                        >
                          {ev.es_integro ? (
                            <ShieldCheck className="w-3 h-3 shrink-0" />
                          ) : (
                            <ShieldAlert className="w-3 h-3 shrink-0" />
                          )}
                          {ev.hash_actual.slice(0, 14)}...
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
