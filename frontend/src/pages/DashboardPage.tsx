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

  // Estilo visual del Hero Banner diferenciado por perfil
  const heroGradient = profile.canDictaminarOci
    ? 'from-white via-emerald-50/40 to-blue-50/70 border-emerald-200/80 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/40 dark:border-emerald-500/30'
    : profile.canSubmitDescargo
    ? 'from-white via-blue-50/50 to-indigo-50/80 border-blue-200 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/50 dark:border-cyan-500/30'
    : 'from-white via-amber-50/40 to-orange-50/60 border-amber-200 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/35 dark:border-amber-500/30';

  const heroTitle = profile.canDictaminarOci
    ? 'Panel de Control Preventivo y Auditoría (OCI)'
    : profile.canSubmitDescargo
    ? 'Panel de Gestión de Compras y Respuestas (DEC)'
    : 'Portal Público de Transparencia en Compras';

  const heroSubtitle = profile.canDictaminarOci
    ? 'Revise alertas tempranas en compras simuladas, compruebe que ningún documento fue alterado (SHA-256), gestione conflictos de interés y derive casos a las áreas responsables.'
    : profile.canSubmitDescargo
    ? 'Registre nuevas compras para detectar riesgos antes de adjudicar, verifique entregables antes de pagar y responda a las alertas con sustento técnico.'
    : 'Consulta ciudadana abierta (Ley N° 27806) con indicadores públicos de compras y datos anonimizados conforme a la Ley N° 29733.';

  return (
    <div className="space-y-7">
      {/* Encabezado Hero Diferenciado por Perfil */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r ${heroGradient} p-6 rounded-2xl border shadow-sm dark:shadow-none transition-colors`}
      >
        <div className="space-y-1.5">
          <div
            className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-semibold ${profile.accentBarClass}`}
          >
            {profile.canDictaminarOci ? (
              <ShieldCheck className="w-3.5 h-3.5" />
            ) : profile.canSubmitDescargo ? (
              <Briefcase className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            {profile.workspaceTitle} • {profile.userCode}
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {heroTitle}
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
            {heroSubtitle}
          </p>
        </div>

        {/* Acciones Propias del Rol (sin botones inútiles deshabilitados) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {profile.canDictaminarOci && (
            <>
              <button
                onClick={() => navigate('/compliance')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-extrabold text-xs shadow-sm transition"
              >
                <BellRing className="w-4 h-4" />
                Revisar Alertas ({kpis.alertas_pendientes})
              </button>
              <a
                href={centinelaApi.obtenerUrlReporteInstitucionalPdf()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-blue-800 dark:text-cyan-300 font-bold text-xs shadow-sm dark:shadow-none transition"
              >
                <FileDown className="w-4 h-4" />
                Reporte PDF
              </a>
              <a
                href={centinelaApi.obtenerUrlIndicadoresCsv()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-sm dark:shadow-none transition"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                CSV
              </a>
              <button
                onClick={handleRegenerar}
                disabled={regenerating}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition"
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
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-extrabold text-xs shadow-sm transition"
              >
                <PlusCircle className="w-4 h-4" />
                Registrar Nueva Compra
              </button>
              <button
                onClick={() => navigate('/compliance')}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-blue-300 dark:border-slate-700 text-blue-800 dark:text-cyan-300 font-bold text-xs shadow-sm dark:shadow-none transition"
              >
                <ClipboardCheck className="w-4 h-4" />
                Responder Alertas ({kpis.alertas_pendientes})
              </button>
              <a
                href={centinelaApi.obtenerUrlReporteInstitucionalPdf()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-sm dark:shadow-none transition"
              >
                <FileDown className="w-4 h-4" />
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
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 font-extrabold text-xs shadow-sm transition"
              >
                <FileDown className="w-4 h-4" />
                Descargar Reporte Público (PDF)
              </a>
              <a
                href={centinelaApi.obtenerUrlIndicadoresCsv()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-amber-300 dark:border-slate-700 text-amber-900 dark:text-amber-200 font-bold text-xs shadow-sm dark:shadow-none transition"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Datos Abiertos (CSV)
              </a>
            </>
          )}
        </div>
      </div>

      {/* Franja Contextual Exclusiva por Rol */}
      {profile.canDictaminarOci && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/compliance')}
            className="text-left p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-emerald-200/80 dark:border-emerald-500/30 hover:border-emerald-400 transition shadow-sm dark:shadow-none flex items-center justify-between gap-3"
          >
            <div>
              <div className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                Acceso Rápido #1
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                {kpis.alertas_pendientes} alertas pendientes de revisar
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Confirmadas OCI: {kpis.alertas_validadas_oci} • Con respuesta Compras: {kpis.alertas_en_descargo}
              </div>
            </div>
            <BellRing className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </button>

          <button
            onClick={() => navigate('/grafo-colusion')}
            className="text-left p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-cyan-500/50 transition shadow-sm dark:shadow-none flex items-center justify-between gap-3"
          >
            <div>
              <div className="text-[11px] font-bold uppercase text-blue-700 dark:text-cyan-400">
                Acceso Rápido #2
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                Ver empresas con datos repetidos
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Proveedores que comparten dueño, dirección o teléfono
              </div>
            </div>
            <Network className="w-5 h-5 text-blue-700 dark:text-cyan-400 shrink-0" />
          </button>

          <button
            onClick={() => navigate('/trazabilidad?id=6')}
            className="text-left p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-500/50 transition shadow-sm dark:shadow-none flex items-center justify-between gap-3"
          >
            <div>
              <div className="text-[11px] font-bold uppercase text-rose-700 dark:text-rose-400">
                Acceso Rápido #3
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                Probar detección de cambios ocultos
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Simula editar un documento antiguo y verifica la alerta SHA-256
              </div>
            </div>
            <Lock className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          </button>
        </div>
      )}

      {profile.canSubmitDescargo && (
        <div className="p-5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/25 border border-blue-200 dark:border-blue-800/60 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-extrabold uppercase tracking-wider text-blue-800 dark:text-cyan-300">
              Pendientes del Área de Compras / Logística (DEC)
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300">
              Tiene <strong className="text-rose-700 dark:text-rose-300">{kpis.alertas_pendientes} alertas pendientes de respuesta</strong>,{' '}
              <strong className="text-blue-800 dark:text-cyan-300">{kpis.alertas_en_descargo} enviadas a revisión OCI</strong> y{' '}
              <strong className="text-emerald-700 dark:text-emerald-300">{kpis.alertas_archivadas} archivadas con sustento</strong>. Recuerde que la decisión final corresponde exclusivamente al OCI.
            </p>
          </div>
          <button
            onClick={() => navigate('/compliance')}
            className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition shrink-0"
          >
            Ir a Alertas por Responder <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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

      {/* Tarjetas de KPIs Ejecutivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Compras Revisadas
            </span>
            <Layers className="w-5 h-5 text-blue-700 dark:text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
            {kpis.total_expedientes}{' '}
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Procesos
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
              {kpis.expedientes_limpios} Sin alerta ({kpis.porcentaje_limpios.toFixed(1)}%)
            </span>
            <span className="text-rose-700 dark:text-rose-400 font-semibold">
              {kpis.expedientes_observados} Con alerta
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Monto Total Revisado
            </span>
            <Scale className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
            S/{' '}
            {kpis.monto_total_auditado.toLocaleString('es-PE', {
              minimumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            Monto en compras con alerta:{' '}
            <span className="text-amber-700 dark:text-amber-300 font-mono font-semibold">
              S/ {kpis.monto_en_riesgo_preventivo.toLocaleString('es-PE')}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-500/30 shadow-sm dark:shadow-none space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Ahorro Preventivo Estimado
            </span>
            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
            S/{' '}
            {kpis.ahorro_preventivo_estimado.toLocaleString('es-PE', {
              minimumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-emerald-200/70 dark:border-slate-800/80">
            Detección temprana de sobrecostos, compras partidas y direccionamiento
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Documentos Protegidos
            </span>
            <Lock className="w-5 h-5 text-blue-700 dark:text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {kpis.expedientes_integridad_rota === 0 ? (
              <span className="text-blue-700 dark:text-cyan-300" title="Verificación criptográfica SHA-256 al 100%">
                100% Sin cambios
              </span>
            ) : (
              <span className="text-rose-700 dark:text-rose-400">
                {kpis.expedientes_integridad_rota} Con alteración
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-slate-600 dark:text-slate-400">
              Alertas activas:{' '}
              <b className="text-slate-900 dark:text-white">{kpis.total_alertas_xai}</b>
            </span>
            <span className="text-amber-700 dark:text-amber-300 font-semibold">
              {kpis.alertas_pendientes} Por revisar
            </span>
          </div>
        </div>
      </div>

      {/* Distribución de Señales + Garantías Éticas y Legales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Alertas Detectadas por Tipo de Riesgo
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cada alerta explica en lenguaje claro qué ocurrió, cuál es la evidencia y la base legal (Ley N° 32069 / D.S. N° 009-2025-EF)
              </p>
            </div>
            {!profile.isReadOnly && (
              <button
                onClick={() => navigate('/compliance')}
                className="text-xs font-bold text-blue-700 hover:text-blue-800 dark:text-emerald-400 dark:hover:text-emerald-300 inline-flex items-center gap-1 shrink-0"
              >
                {profile.canSubmitDescargo ? 'Ir a Descargos' : 'Ir a Alertas'}{' '}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-3 pt-2">
            {kpis.alertas_por_categoria.map((cat) => {
              const porcentaje = Math.min(
                100,
                Math.round((cat.cantidad / Math.max(1, kpis.total_alertas_xai)) * 100),
              );
              return (
                <div key={cat.categoria} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {cat.categoria}
                    </span>
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      {cat.cantidad} señal(es) • {porcentaje}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        profile.canDictaminarOci
                          ? 'bg-gradient-to-r from-[#0B1F3A] to-emerald-600 dark:from-emerald-500 dark:to-cyan-400'
                          : profile.canSubmitDescargo
                          ? 'bg-gradient-to-r from-blue-800 to-cyan-500'
                          : 'bg-gradient-to-r from-amber-600 to-orange-400'
                      }`}
                      style={{ width: `${Math.max(12, porcentaje)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Garantías Éticas y Legales
          </h2>
          <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <li className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80">
              <strong className="text-emerald-700 dark:text-emerald-300 block mb-0.5">
                1. Sin Caja Negra (100% Explicable):
              </strong>
              Ninguna alerta acusa de delito; expone la evidencia objetiva para revisión humana.
            </li>
            <li className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80">
              <strong className="text-blue-700 dark:text-cyan-300 block mb-0.5">
                2. Privacidad por Diseño (Ley N° 29733):
              </strong>
              Seudonimización nativa (<code className="font-mono text-slate-800 dark:text-slate-200">FUNC-*</code>, <code className="font-mono text-slate-800 dark:text-slate-200">PROV-SYN-*</code>) sobre datos 100% sintéticos.
            </li>
            <li className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80">
              <strong className="text-amber-700 dark:text-amber-300 block mb-0.5">
                3. Integridad Documental & Versiones:
              </strong>
              Encadenamiento SHA-256 en las 6 etapas para detectar ediciones ex-post y falta de sustentos.
            </li>
            <li className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80">
              <strong className="text-indigo-700 dark:text-indigo-300 block mb-0.5">
                4. Modelo de Integridad & Capa No Intrusiva:
              </strong>
              Alineado al D.S. N° 148-2024-PCM, R.S. N° 002-2026-PCM/SIP y R.R. N° 0490-2026/UNT sin reemplazar SEACE, SIGA ni SIAF.
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
