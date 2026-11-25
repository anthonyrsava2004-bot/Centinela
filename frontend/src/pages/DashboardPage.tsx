import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  AlertOctagon,
  TrendingUp,
  RefreshCw,
  FileSearch,
  ArrowRight,
  Layers,
  Lock,
  Scale,
  FileDown,
  FileSpreadsheet,
  PlusCircle,
  BellRing,
  Network,
  Eye,
  Briefcase,
  ClipboardCheck,
} from 'lucide-react';
import { centinelaApi } from '../api/client';
import { DashboardKPIs, MapaRiesgosData, RolUsuario } from '../types';
import { IntegrityBadge, RiskBadge } from '../components/AlertBadge';
import { MapaRiesgosPanel } from '../components/MapaRiesgosPanel';
import { ROLE_PROFILES } from '../config/roles';

interface DashboardPageProps {
  rolActivo: RolUsuario;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ rolActivo }) => {
  const navigate = useNavigate();
  const profile = ROLE_PROFILES[rolActivo];

  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [mapaRiesgos, setMapaRiesgos] = useState<MapaRiesgosData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [regenerating, setRegenerating] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cargarDashboard = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [data, mapa] = await Promise.all([
        centinelaApi.getDashboardKPIs(),
        centinelaApi.obtenerMapaRiesgos(),
      ]);
      setKpis(data);
      setMapaRiesgos(mapa);
    } catch {
      setErrorMsg(
        'No se pudo conectar con el motor backend de CENTINELA. Verifique que FastAPI esté ejecutándose.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDashboard();
  }, []);

  const handleRegenerar = async () => {
    if (!profile.canRegenerateDataset) return;
    try {
      setRegenerating(true);
      setFeedbackMsg(null);
      const res = await centinelaApi.regenerarDataset();
      setFeedbackMsg(res.mensaje);
      await cargarDashboard();
    } catch {
      setErrorMsg('Error al regenerar el dataset sintético.');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading && !kpis) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <RefreshCw className="w-10 h-10 text-blue-700 dark:text-emerald-400 animate-spin" />
        <p className="text-sm text-slate-600 dark:text-slate-400 font-mono">
          Verificando integridad documental y señales preventivas...
        </p>
      </div>
    );
  }

  if (errorMsg && !kpis) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/40 text-rose-900 dark:text-rose-200 space-y-4">
        <div className="flex items-center gap-3">
          <AlertOctagon className="w-6 h-6 text-rose-600 dark:text-rose-400" />
          <h3 className="text-lg font-bold">Conexión Pendiente con Backend</h3>
        </div>
        <p className="text-sm text-rose-700 dark:text-rose-300">{errorMsg}</p>
        <button
          onClick={cargarDashboard}
          className="px-4 py-2 rounded-xl bg-rose-600 dark:bg-rose-500 text-white dark:text-slate-950 font-bold text-xs hover:bg-rose-500 dark:hover:bg-rose-400 transition"
        >
          Reintentar Conexión
        </button>
      </div>
    );
  }

  if (!kpis) return null;

  // Acento sólido por perfil (sin degradados ni brillos genéricos)
  const heroTopAccent = profile.canDictaminarOci
    ? 'border-t-[#0B1F3A] dark:border-t-emerald-500'
    : profile.canSubmitDescargo
    ? 'border-t-blue-700 dark:border-t-cyan-500'
    : 'border-t-amber-600 dark:border-t-amber-400';

  const heroBadgeClass = profile.canDictaminarOci
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
    : profile.canSubmitDescargo
    ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30'
    : 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30';

  const heroTitle = profile.canDictaminarOci
    ? 'Panel de Control Preventivo y Auditoría (OCI)'
    : profile.canSubmitDescargo
    ? 'Panel de Gestión de Compras y Respuestas (DEC)'
    : 'Portal Público de Transparencia en Compras';

  const heroSubtitle = profile.canDictaminarOci
    ? 'Revise alertas tempranas, verifique integridad SHA-256, gestione conflictos de interés y derive casos antes del pago.'
    : profile.canSubmitDescargo
    ? 'Registre nuevas compras para detectar riesgos antes de adjudicar, verifique entregables y responda alertas con sustento.'
    : 'Consulta ciudadana abierta (Ley N° 27806) con indicadores públicos de compras y datos anonimizados (Ley N° 29733).';

  // Cálculos para el Medidor Circular de Cumplimiento (trazo sólido, sin degradado)
  const gaugeRadius = 40;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const pctLimpios = Math.min(100, Math.max(0, kpis.porcentaje_limpios));
  const gaugeOffset = gaugeCircumference - (pctLimpios / 100) * gaugeCircumference;
  const ahorroPct =
    kpis.monto_en_riesgo_preventivo > 0
      ? ((kpis.ahorro_preventivo_estimado / kpis.monto_en_riesgo_preventivo) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      {/* Cabecera Estructural Limpia (Superficies Sólidas + Grilla Divisoria, Cero Degradados) */}
      <section
        className={`rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-t-[3px] ${heroTopAccent} shadow-sm dark:shadow-none overflow-hidden`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:divide-x divide-slate-200 dark:divide-slate-800">
          {/* Bloque Izquierdo: Identidad, Título y Acciones */}
          <div className="lg:col-span-8 p-6 space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-bold ${heroBadgeClass}`}
                >
                  {profile.canDictaminarOci ? (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  ) : profile.canSubmitDescargo ? (
                    <Briefcase className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  {profile.workspaceTitle} • {profile.userCode}
                </span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  100% Datos Sintéticos • Ley N° 32069
                </span>
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-snug">
                {heroTitle}
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                {heroSubtitle}
              </p>
            </div>

            {/* Acciones Propias del Rol */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {profile.canDictaminarOci && (
                <>
                  <button
                    onClick={() => navigate('/compliance')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#15315A] dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-bold text-xs transition"
                  >
                    <BellRing className="w-3.5 h-3.5" />
                    Revisar Alertas ({kpis.alertas_pendientes})
                  </button>
                  <a
                    href={centinelaApi.obtenerUrlReporteInstitucionalPdf()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs transition"
                  >
                    <FileDown className="w-3.5 h-3.5 text-slate-600 dark:text-cyan-400" />
                    Reporte PDF
                  </a>
                  <a
                    href={centinelaApi.obtenerUrlIndicadoresCsv()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs transition"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    CSV
                  </a>
                  <button
                    onClick={handleRegenerar}
                    disabled={regenerating}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition"
                    title="Restaurar el dataset sintético base de 120 expedientes"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                    {regenerating ? 'Restaurando...' : 'Reiniciar Demo'}
                  </button>
                </>
              )}

              {profile.canSubmitDescargo && (
                <>
                  <button
                    onClick={() => navigate('/expedientes?nuevo=1')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-bold text-xs transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Registrar Nueva Compra
                  </button>
                  <button
                    onClick={() => navigate('/compliance')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs transition"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5 text-blue-700 dark:text-cyan-400" />
                    Responder Alertas ({kpis.alertas_pendientes})
                  </button>
                  <a
                    href={centinelaApi.obtenerUrlReporteInstitucionalPdf()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs transition"
                  >
                    <FileDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Reporte PDF
                  </a>
                </>
              )}

              {profile.isReadOnly && (
                <>
                  <a
                    href={centinelaApi.obtenerUrlReporteInstitucionalPdf()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 font-bold text-xs transition"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Descargar Reporte Público (PDF)
                  </a>
                  <a
                    href={centinelaApi.obtenerUrlIndicadoresCsv()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs transition"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Datos Abiertos (CSV)
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Bloque Derecho: Medidor Circular Sólido Integrado en la Grilla */}
          <div className="lg:col-span-4 p-6 bg-slate-50/70 dark:bg-slate-950/50 border-t lg:border-t-0 border-slate-200 dark:border-slate-800 flex items-center justify-center">
            <div className="flex items-center gap-4">
              <div className="relative w-[92px] h-[92px] shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r={gaugeRadius}
                    fill="none"
                    className="stroke-slate-200 dark:stroke-slate-800"
                    strokeWidth="9"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={gaugeRadius}
                    fill="none"
                    className="stroke-emerald-600 dark:stroke-emerald-400"
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={gaugeCircumference}
                    strokeDashoffset={gaugeOffset}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-extrabold font-mono tabular-nums text-slate-900 dark:text-white leading-none">
                    {pctLimpios.toFixed(1)}%
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                    Sin alerta
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Salud Preventiva
                </div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {kpis.expedientes_limpios} / {kpis.total_expedientes} compras
                </div>
                <div className="space-y-0.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                    {kpis.expedientes_integridad_rota === 0
                      ? 'SHA-256 100% íntegro'
                      : `${kpis.expedientes_integridad_rota} alteración(es)`}
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400" />
                    {kpis.expedientes_observados} en revisión preventiva
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Franja Inferior Plana de Accesos Rápidos (sin tarjetas anidadas) */}
        {profile.canDictaminarOci && (
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
            <button
              onClick={() => navigate('/compliance')}
              className="group text-left px-5 py-3 hover:bg-slate-100/80 dark:hover:bg-slate-900 transition flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {kpis.alertas_pendientes} alertas por revisar
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  OCI: {kpis.alertas_validadas_oci} • Compras: {kpis.alertas_en_descargo}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white group-hover:translate-x-0.5 transition shrink-0" />
            </button>

            <button
              onClick={() => navigate('/grafo-colusion')}
              className="group text-left px-5 py-3 hover:bg-slate-100/80 dark:hover:bg-slate-900 transition flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  Empresas con datos repetidos
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Dueño, dirección o teléfono
                </div>
              </div>
              <Network className="w-4 h-4 text-slate-400 group-hover:text-blue-700 dark:group-hover:text-cyan-400 transition shrink-0" />
            </button>

            <button
              onClick={() => navigate('/trazabilidad?id=6')}
              className="group text-left px-5 py-3 hover:bg-slate-100/80 dark:hover:bg-slate-900 transition flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  Probar cambios ocultos
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Verificación criptográfica SHA-256
                </div>
              </div>
              <Lock className="w-4 h-4 text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition shrink-0" />
            </button>
          </div>
        )}

        {profile.canSubmitDescargo && (
          <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300">
            <span>
              Tiene <strong className="text-rose-700 dark:text-rose-400">{kpis.alertas_pendientes} alertas pendientes de respuesta</strong>,{' '}
              <strong className="text-blue-800 dark:text-cyan-400">{kpis.alertas_en_descargo} enviadas a OCI</strong> y{' '}
              <strong className="text-emerald-700 dark:text-emerald-400">{kpis.alertas_archivadas} archivadas</strong>. La decisión final corresponde al OCI.
            </span>
          </div>
        )}
      </section>

      {feedbackMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200 text-xs font-medium flex items-center justify-between">
          <span>{feedbackMsg}</span>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-emerald-700 dark:text-emerald-300 underline ml-4 font-semibold"
          >
            Ocultar
          </button>
        </div>
      )}

      {/* Tarjetas de KPIs Ejecutivos — Superficies Sólidas Sin Degradados */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none hover:border-slate-300 dark:hover:border-slate-700 transition space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Compras Revisadas
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Layers className="w-4 h-4 text-slate-700 dark:text-cyan-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
              {kpis.total_expedientes}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              procesos
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-2.5 border-t border-slate-100 dark:border-slate-800">
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold">
              {kpis.expedientes_limpios} sin alerta
            </span>
            <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold">
              {kpis.expedientes_observados} con alerta
            </span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none hover:border-slate-300 dark:hover:border-slate-700 transition space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Monto Total Revisado
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Scale className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            </div>
          </div>
          <div className="text-[22px] font-extrabold text-slate-900 dark:text-white font-mono tabular-nums tracking-tight">
            S/{' '}
            {kpis.monto_total_auditado.toLocaleString('es-PE', {
              minimumFractionDigits: 2,
            })}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <span>En compras con alerta:</span>
            <span className="text-amber-700 dark:text-amber-300 font-mono font-bold tabular-nums">
              S/ {kpis.monto_en_riesgo_preventivo.toLocaleString('es-PE')}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-[3px] border-l-emerald-600 dark:border-l-emerald-500 shadow-sm dark:shadow-none hover:border-slate-300 dark:hover:border-slate-700 transition space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              Ahorro Preventivo Estimado
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </div>
          </div>
          <div className="text-[22px] font-extrabold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums tracking-tight">
            S/{' '}
            {kpis.ahorro_preventivo_estimado.toLocaleString('es-PE', {
              minimumFractionDigits: 2,
            })}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <span className="truncate">Sobrecosto evitado</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-mono font-bold whitespace-nowrap shrink-0">
              ~{ahorroPct}% riesgo
            </span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none hover:border-slate-300 dark:hover:border-slate-700 transition space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Documentos Protegidos
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Lock className="w-4 h-4 text-slate-700 dark:text-indigo-400" />
            </div>
          </div>
          <div className="text-[22px] font-extrabold text-slate-900 dark:text-white tracking-tight">
            {kpis.expedientes_integridad_rota === 0 ? (
              <span
                className="text-blue-700 dark:text-cyan-300"
                title="Verificación criptográfica SHA-256 al 100%"
              >
                100% Sin cambios
              </span>
            ) : (
              <span className="text-rose-700 dark:text-rose-400">
                {kpis.expedientes_integridad_rota} Con alteración
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-2.5 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400">
              Alertas activas:{' '}
              <b className="text-slate-900 dark:text-white tabular-nums">{kpis.total_alertas_xai}</b>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 font-semibold">
              {kpis.alertas_pendientes} por revisar
            </span>
          </div>
        </div>
      </div>

      {/* Distribución de Señales + Garantías Éticas y Legales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none flex flex-col justify-between space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Alertas Detectadas por Tipo de Riesgo
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Cada alerta explica en lenguaje claro qué ocurrió, cuál es la evidencia y la base legal (Ley N° 32069 / D.S. N° 009-2025-EF)
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!profile.isReadOnly && (
                <button
                  onClick={() => navigate('/compliance')}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1 transition"
                >
                  {profile.canSubmitDescargo ? 'Ir a Responder' : 'Ir a Alertas'}{' '}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => navigate('/denuncias')}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
              >
                Canal de Denuncia
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {kpis.alertas_por_categoria.map((cat, idx) => {
              const porcentaje = Math.min(
                100,
                Math.round((cat.cantidad / Math.max(1, kpis.total_alertas_xai)) * 100),
              );
              const barColors = [
                'bg-[#0B1F3A] dark:bg-emerald-500',
                'bg-blue-700 dark:bg-cyan-500',
                'bg-amber-600 dark:bg-amber-400',
                'bg-rose-600 dark:bg-rose-500',
                'bg-slate-600 dark:bg-slate-400',
              ];
              const barColor = barColors[idx % barColors.length];
              return (
                <div
                  key={cat.categoria}
                  className="p-2.5 -mx-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {cat.categoria}
                    </span>
                    <span className="inline-flex items-center gap-2 font-mono text-[11px] tabular-nums">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                        {cat.cantidad} alerta{cat.cantidad === 1 ? '' : 's'}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 w-9 text-right font-semibold">
                        {porcentaje}%
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${Math.max(10, porcentaje)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Garantías Éticas y Legales
            </h2>
          </div>

          <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <li className="py-3 first:pt-0 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-md bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <div>
                <strong className="text-slate-900 dark:text-white block mb-0.5">
                  Sin Caja Negra (100% Explicable)
                </strong>
                Ninguna alerta acusa delito; expone evidencia objetiva y ley para revisión humana.
              </div>
            </li>
            <li className="py-3 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-md bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <div>
                <strong className="text-slate-900 dark:text-white block mb-0.5">
                  Privacidad por Diseño (Ley N° 29733)
                </strong>
                Códigos seudonimizados (<code className="font-mono text-slate-800 dark:text-slate-200">FUNC-*</code>, <code className="font-mono text-slate-800 dark:text-slate-200">PROV-SYN-*</code>) y canal anónimo (D.L. 1327).
              </div>
            </li>
            <li className="py-3 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-md bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <div>
                <strong className="text-slate-900 dark:text-white block mb-0.5">
                  Seguridad Documental SHA-256
                </strong>
                Encadenamiento en las 6 etapas y bitácora global inmutable ante alteraciones.
              </div>
            </li>
            <li className="py-3 last:pb-0 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-md bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                4
              </span>
              <div>
                <strong className="text-slate-900 dark:text-white block mb-0.5">
                  Modelo de Integridad UNT
                </strong>
                Alineado al D.S. N° 148-2024-PCM, Directiva N° 001-2026-PCM/SIP y R.R. N° 0490-2026/UNT.
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Mapa de Riesgos de Integridad (Probabilidad x Impacto por Etapa Crítica) */}
      {mapaRiesgos && <MapaRiesgosPanel mapa={mapaRiesgos} />}

      {/* Tabla de Expedientes Prioritarios */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {profile.isReadOnly
                ? 'Compras Públicas en Revisión Preventiva (Datos Anonimizados)'
                : 'Compras con Alertas Prioritarias para Revisar'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Haga clic en Revisar para inspeccionar documentos, entregables antes de pago, análisis de requisitos o descargar su reporte PDF
            </p>
          </div>
          <button
            onClick={() => navigate('/expedientes')}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 transition"
          >
            Ver las {kpis.total_expedientes} Compras <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-2.5">Expediente y Objeto</th>
                <th className="py-2.5 px-2.5">Monto / Modalidad</th>
                <th className="py-2.5 px-2.5">Tipología Detectada</th>
                <th className="py-2.5 px-2.5">Riesgo e Integridad</th>
                <th className="py-2.5 px-2.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {kpis.casos_destacados.map((exp) => {
                const TIPOLOGIA_LABEL: Record<string, string> = {
                  CASO_1_PROYECTORES_UNT: 'Caso 1 UNT • Fracc. + Conflicto',
                  FRACCIONAMIENTO_8UIT: 'Fraccionamiento (<= 8 UIT)',
                  COLUSION_PROVEEDORES: 'Red de Colusión',
                  DIRECCIONAMIENTO_TDR: 'Direccionamiento TDR',
                  CONFLICTO_SEGREGACION: 'Segregación de Funciones',
                  PAGO_SIN_CONFORMIDAD: 'Pago sin Conformidad',
                  INCONSISTENCIA_VERSION_SUSTENTO: 'Versión / Sin Sustento',
                  ENTREGABLE_INCOMPLETO_CONFORMIDAD: 'Caso 2 UNT • Sin Pozo a Tierra',
                };
                const tipologiaTexto =
                  (exp.tipo_trampa && TIPOLOGIA_LABEL[exp.tipo_trampa]) ||
                  exp.tipo_trampa ||
                  'Señal Preventiva XAI';

                return (
                  <tr
                    key={exp.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-2.5 max-w-[330px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-700 dark:text-cyan-300 whitespace-nowrap">
                          {exp.codigo}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] font-semibold whitespace-nowrap">
                          {exp.area_usuaria}
                        </span>
                      </div>
                      <div
                        className="text-slate-700 dark:text-slate-300 text-[11px] truncate mt-0.5"
                        title={exp.objeto}
                      >
                        {exp.objeto}
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        S/ {exp.monto_estimado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {exp.modalidad}
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-slate-800 text-amber-800 dark:text-amber-300 font-semibold text-[11px] border border-amber-200 dark:border-slate-700">
                        {tipologiaTexto}
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <RiskBadge nivel={exp.nivel_riesgo} puntaje={exp.puntaje_riesgo} />
                        <IntegrityBadge integra={exp.integridad_valida} />
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/trazabilidad?id=${exp.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-semibold transition"
                      >
                        <FileSearch className="w-3.5 h-3.5" />
                        {profile.isReadOnly ? 'Ver Historial' : 'Auditar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
