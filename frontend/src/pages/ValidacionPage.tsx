import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  Scale,
  Gauge,
  Layers,
  FlaskConical,
  Lock,
  Terminal,
  AlertOctagon,
  Clock,
} from 'lucide-react';
import { centinelaApi } from '../api/client';
import { ReporteValidacion, RolUsuario } from '../types';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { ROLE_PROFILES } from '../config/roles';

interface ValidacionPageProps {
  rolActivo: RolUsuario;
}

type FiltroCasos = 'TODOS' | 'CONTROLES' | 'IRREGULARIDADES';

const REGLA_METADATA: Record<
  string,
  { titulo: string; corto: string; referencia: string }
> = {
  'R-01-FRACCIONAMIENTO': {
    titulo: 'Fraccionamiento Indebido (> 8 UIT)',
    corto: 'R-01 Fracc.',
    referencia: 'Art. 22 Ley N° 32069 • Tope S/ 42,800',
  },
  'R-02-SEGREGACION': {
    titulo: 'Segregación de Funciones Vulnerada',
    corto: 'R-02 Segreg.',
    referencia: 'Art. 11 y 25 Ley N° 32069',
  },
  'R-03-PAGO-SIN-CONF': {
    titulo: 'Pago sin Conformidad o Entregable Incompleto',
    corto: 'R-03 Conform.',
    referencia: 'Art. 67 Ley N° 32069 • Candado TDR',
  },
  'R-04-COLUSION-GRAFO': {
    titulo: 'Colusión entre Postores Vinculados (Grafos)',
    corto: 'R-04 Colusión',
    referencia: 'Art. 5 y 30 Ley N° 32069 • NetworkX',
  },
  'R-05-TDR-NLP': {
    titulo: 'Direccionamiento Semántico en TDR (TF-IDF)',
    corto: 'R-05 NLP TDR',
    referencia: 'D.S. N° 009-2025-EF • Similitud Coseno',
  },
  'R-06-SHA256': {
    titulo: 'Ruptura de Integridad Criptográfica SHA-256',
    corto: 'R-06 SHA-256',
    referencia: 'Encadenamiento secuencial de 6 etapas',
  },
  'R-07-CRONO-VERSION': {
    titulo: 'Modificación Extemporánea o Sin Sustento',
    corto: 'R-07 Versión',
    referencia: 'Control cronológico y sustento técnico',
  },
  'R-08-CONFLICTO-INTERES': {
    titulo: 'Conflicto de Interés sin Abstención',
    corto: 'R-08 Conflicto',
    referencia: 'Ley N° 27815 • D.S. N° 148-2024-PCM',
  },
  'R-09-CONTINUIDAD-RNP': {
    titulo: 'Historial RNP / Continuidad Económica (Empresa Reciclada)',
    corto: 'R-09 RNP/Suces.',
    referencia: 'Art. 30 Ley N° 32069 • Padrón RNP y Vínculos',
  },
  'R-10-SOBREPRECIO': {
    titulo: 'Sobreprecio frente a Estándar de Mercado (> +25 %)',
    corto: 'R-10 Sobreprecio',
    referencia: 'Art. 5 y 46 Ley N° 32069 • SEACE / Perú Compras',
  },
};

const SUITE_LABELS: Record<string, string> = {
  TestDeteccionDatasetBase: 'Dataset Base (120)',
  TestDeteccionEnVivo: 'Fronteras en Vivo',
  TestIntegridadSHA256: 'Cadena SHA-256',
  TestCandadoDePago: 'Candado de Pago',
  TestRBAC: 'Permisos RBAC',
  TestCanalDenuncia: 'Denuncia D.L. 1327',
  TestHistorialYSobreprecio: 'Historial RNP y Sobreprecio',
  TestBitacoraReinicioYReportes: 'Bitácora y API',
};

function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'n/a';
  }
  return `${(value * 100).toFixed(1)} %`;
}

function sameRuleSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((item, idx) => item === sortedB[idx]);
}

function classifyLiveCase(nombre: string, esperado: string[]): {
  etiqueta: string;
  clase: string;
} {
  const lower = nombre.toLowerCase();
  if (lower.includes('frontera')) {
    return {
      etiqueta: lower.includes('sobreprecio') ? 'Frontera +25%' : 'Frontera 8 UIT',
      clase:
        'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    };
  }
  if (esperado.length === 0) {
    return {
      etiqueta: 'Control Limpio',
      clase:
        'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    };
  }
  if (esperado.length > 1 || nombre.startsWith('M')) {
    return {
      etiqueta: 'Combinado',
      clase:
        'bg-blue-50 text-blue-800 border-blue-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30',
    };
  }
  return {
    etiqueta: 'Irregularidad',
    clase:
      'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
  };
}

function formatTestMethodName(fullName: string): {
  suite: string;
  metodoLegible: string;
} {
  const parts = fullName.split('.');
  const rawSuite = parts[0] || 'Suite';
  const rawMethod = parts[1] || fullName;
  const clean = rawMethod
    .replace(/^test_/, '')
    .replace(/_/g, ' ')
    .replace(/\bsha256\b/gi, 'SHA-256')
    .replace(/\brbac\b/gi, 'RBAC')
    .replace(/\boci\b/gi, 'OCI')
    .replace(/\bdec\b/gi, 'DEC')
    .replace(/\bkpi\b/gi, 'KPI')
    .replace(/\bpdf\b/gi, 'PDF')
    .replace(/\bcsv\b/gi, 'CSV')
    .replace(/\brnp\b/gi, 'RNP')
    .replace(/\b403\b/g, 'HTTP 403')
    .replace(/\b404\b/g, 'HTTP 404');
  const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
  return {
    suite: SUITE_LABELS[rawSuite] || rawSuite,
    metodoLegible: capitalized,
  };
}

export const ValidacionPage: React.FC<ValidacionPageProps> = ({ rolActivo }) => {
  const profile = ROLE_PROFILES[rolActivo];

  const [data, setData] = useState<ReporteValidacion | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [filtroCasos, setFiltroCasos] = useState<FiltroCasos>('TODOS');

  const cargarValidacion = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await centinelaApi.obtenerReporteValidacion();
      setData(res);
    } catch {
      setErrorMsg(
        'No se pudo obtener el reporte de validación técnica desde el backend de CENTINELA.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarValidacion();
  }, []);

  const handleCopyCommand = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.comando);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const reglasEntries = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.matriz_por_regla);
  }, [data]);

  const latenciasEntries = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.latencias_ms);
  }, [data]);

  const maxLatencyMs = useMemo(() => {
    if (latenciasEntries.length === 0) return 70;
    const peak = Math.max(...latenciasEntries.map(([, v]) => v.max));
    return Math.max(20, peak);
  }, [latenciasEntries]);

  const techoP95Ms = useMemo(() => {
    if (latenciasEntries.length === 0) return 70;
    const maxP95 = Math.max(...latenciasEntries.map(([, v]) => v.p95));
    return Math.max(70, Math.ceil(maxP95 / 10) * 10);
  }, [latenciasEntries]);

  const conteoCasos = useMemo(() => {
    const lista = data?.casos_en_vivo ?? [];
    const controles = lista.filter((c) => c.esperado.length === 0).length;
    const irregularidades = lista.filter((c) => c.esperado.length > 0).length;
    return {
      todos: lista.length,
      controles,
      irregularidades,
    };
  }, [data]);

  const casosFiltrados = useMemo(() => {
    const lista = data?.casos_en_vivo ?? [];
    if (filtroCasos === 'CONTROLES') {
      return lista.filter((c) => c.esperado.length === 0);
    }
    if (filtroCasos === 'IRREGULARIDADES') {
      return lista.filter((c) => c.esperado.length > 0);
    }
    return lista;
  }, [data, filtroCasos]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <RefreshCw className="w-10 h-10 text-blue-700 dark:text-emerald-400 animate-spin" />
        <p className="text-sm text-slate-600 dark:text-slate-400 font-mono">
          Cargando matriz de confusión, pruebas de frontera y controles RBAC...
        </p>
      </div>
    );
  }

  if (errorMsg && !data) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/40 text-rose-900 dark:text-rose-200 space-y-4">
        <div className="flex items-center gap-3">
          <AlertOctagon className="w-6 h-6 text-rose-600 dark:text-rose-400" />
          <h3 className="text-lg font-bold">Reporte de Validación No Disponible</h3>
        </div>
        <p className="text-sm text-rose-700 dark:text-rose-300">{errorMsg}</p>
        <button
          type="button"
          onClick={cargarValidacion}
          className="btn-tactile px-4 py-2 rounded-xl bg-rose-600 dark:bg-rose-500 text-white dark:text-slate-950 font-bold text-xs hover:bg-rose-500 dark:hover:bg-rose-400"
        >
          Reintentar Consulta
        </button>
      </div>
    );
  }

  if (!data) return null;

  const resumen = data.resumen_muestras;
  const totalMuestrasMatriz =
    resumen.expedientes_sembrados + resumen.casos_en_vivo + resumen.pruebas_sha256;
  const pctPruebasOk =
    resumen.total_pruebas > 0
      ? Math.round((resumen.pruebas_aprobadas / resumen.total_pruebas) * 100)
      : 100;

  const globalPrecision =
    data.totales.TP + data.totales.FP > 0
      ? data.totales.TP / (data.totales.TP + data.totales.FP)
      : null;
  const globalRecall =
    data.totales.TP + data.totales.FN > 0
      ? data.totales.TP / (data.totales.TP + data.totales.FN)
      : null;
  const globalF1 =
    globalPrecision && globalRecall
      ? (2 * globalPrecision * globalRecall) / (globalPrecision + globalRecall)
      : null;
  const globalFpr =
    data.totales.FP + data.totales.TN > 0
      ? data.totales.FP / (data.totales.FP + data.totales.TN)
      : null;

  return (
    <div className="space-y-6">
      {/* Cabecera de Comando Arquitectónica Sólida (Cero Degradados) */}
      <section
        data-tour="val-resumen"
        className="animate-card-up rounded-2xl border border-[#C6D4E5] dark:border-slate-700/90 border-t-[3px] border-t-[#0B1F3A] dark:border-t-emerald-500 bg-[#EAF0F7] dark:bg-[#07111F] bg-arch-grid-light dark:bg-arch-grid-dark shadow-sm dark:shadow-none overflow-hidden transition-colors"
      >
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2 max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold">
                  <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                    <span className="animate-radar-ring absolute inline-flex h-full w-full rounded-full bg-emerald-500 dark:bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600 dark:bg-emerald-400" />
                  </span>
                  <FlaskConical className="w-3.5 h-3.5 shrink-0" />
                  Evidencia Técnica Reproducible • 100 % Datos Sintéticos
                </span>
                <span className="px-2.5 py-1 rounded-md bg-white/85 dark:bg-slate-900 border border-[#CBD7E6] dark:border-slate-700 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300">
                  Vista abierta • {profile.shortLabel} ({profile.userCode})
                </span>
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight text-[#0B1F3A] dark:text-white leading-snug">
                Validación y Efectividad de Detección
              </h1>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                Auditoría técnica automatizada en base SQLite aislada sobre{' '}
                <strong className="text-[#0B1F3A] dark:text-white">
                  {resumen.expedientes_sembrados} expedientes base
                </strong>{' '}
                ({resumen.compras_limpias} compras limpias y{' '}
                {resumen.expedientes_sembrados - resumen.compras_limpias} casos forenses),{' '}
                <strong className="text-[#0B1F3A] dark:text-white">
                  {resumen.casos_en_vivo} casos borde etiquetados en vivo
                </strong>{' '}
                —incluyendo las fronteras exactas de 8 UIT (<span className="font-mono">S/ 42,800</span>) y sobreprecio (<span className="font-mono">+25.0 %</span>)—,{' '}
                <strong className="text-[#0B1F3A] dark:text-white">
                  {resumen.pruebas_sha256} verificaciones de ruptura SHA-256
                </strong>{' '}
                en las 6 etapas documentales y{' '}
                <strong className="text-[#0B1F3A] dark:text-white">
                  {data.rbac.length} controles RBAC
                </strong>{' '}
                y de reserva de identidad (<span className="font-mono">D.L. N° 1327</span>).
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-[#C5D3E3] dark:border-slate-700 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300">
                <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                Última ejecución: {data.generado}
              </span>
              <button
                type="button"
                onClick={cargarValidacion}
                className="btn-tactile p-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-[#C5D3E3] dark:border-slate-700 text-slate-700 dark:text-slate-200"
                title="Recargar métricas de validación (solo lectura)"
                aria-label="Recargar métricas de validación"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Barra de Comando Reproducible */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-[#040A14] border border-[#C5D3E3] dark:border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#0B1F3A] dark:bg-slate-800 text-white dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Terminal className="w-3.5 h-3.5" />
              </div>
              <code className="font-mono text-xs font-bold text-[#0B1F3A] dark:text-emerald-300 break-all">
                {data.comando}
              </code>
            </div>

            <button
              type="button"
              onClick={handleCopyCommand}
              className="btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#15315A] dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-bold text-xs shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Comando copiado
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar comando
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* 4 Tarjetas KPI Animadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="animate-card-up stagger-1 card-elevate p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pruebas Automatizadas
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 font-mono">
            <AnimatedNumber
              value={resumen.pruebas_aprobadas}
              className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight"
            />
            <span className="text-lg font-bold text-slate-500 dark:text-slate-400">
              / {resumen.total_pruebas}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px] pt-2.5 border-t border-slate-100 dark:border-slate-800">
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold font-mono">
              {pctPruebasOk} % aprobadas
            </span>
            <span className="text-slate-500 dark:text-slate-400">Suite unittest</span>
          </div>
        </div>

        <div className="animate-card-up stagger-2 card-elevate p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-[3px] border-l-emerald-600 dark:border-l-emerald-500 shadow-sm dark:shadow-none space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              Aciertos y Falsos Positivos
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </div>
          </div>
          <div className="text-[22px] font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
            <AnimatedNumber value={data.totales.TP} /> aciertos ·{' '}
            <span className="text-emerald-700 dark:text-emerald-400">
              {data.totales.FP} FP
            </span>
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-800">
            <strong className="text-emerald-700 dark:text-emerald-400 font-mono">
              {resumen.alertas_indebidas_en_limpias}
            </strong>{' '}
            alertas indebidas en {resumen.compras_limpias} compras limpias
          </div>
        </div>

        <div className="animate-card-up stagger-3 card-elevate p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Reglas y Etapas Evaluadas
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Layers className="w-4 h-4 text-slate-700 dark:text-cyan-400" />
            </div>
          </div>
          <div className="text-[22px] font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
            <AnimatedNumber value={reglasEntries.length} /> reglas · 6 etapas
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <span>{totalMuestrasMatriz} muestras evaluadas en matriz</span>
          </div>
        </div>

        <div className="animate-card-up stagger-4 card-elevate p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Seguridad y Latencia
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Gauge className="w-4 h-4 text-blue-700 dark:text-cyan-400" />
            </div>
          </div>
          <div className="text-[22px] font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
            <AnimatedNumber value={data.rbac.length} /> RBAC · &lt; {techoP95Ms} ms
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-800">
            Bloqueos HTTP 403 y p95 local
          </div>
        </div>
      </div>

      {/* Nota Metodológica Honesta y Transparente */}
      <div className="animate-card-up stagger-5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-[3px] border-l-[#0B1F3A] dark:border-l-emerald-500 flex items-start gap-3.5 shadow-sm dark:shadow-none">
        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
          <Scale className="w-4 h-4 text-[#0B1F3A] dark:text-emerald-400" />
        </div>
        <div className="space-y-1 text-xs leading-relaxed">
          <div className="font-extrabold text-slate-900 dark:text-white">
            Nota Metodológica y Presunción de Licitud (Art. 248, Ley N° 27444)
          </div>
          <p className="text-slate-600 dark:text-slate-300">
            Las métricas mostradas corresponden a una evaluación determinista sobre conjuntos de datos sintéticos controlados y escenarios de frontera etiquetados por el equipo técnico (Ley N° 29733). Las alertas constituyen señales preventivas para revisión humana —nunca acusaciones automatizadas— y su puesta en producción real contempla una fase de calibración de umbrales junto con el Órgano de Control Institucional (OCI) y la Oficina de Integridad.
          </p>
        </div>
      </div>

      {/* Sección 1 — Matriz de Confusión y Efectividad por Regla */}
      <section
        data-tour="val-matriz"
        className="animate-card-up rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none overflow-hidden"
      >
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              1. Matriz de Confusión y Efectividad por Regla Normativa
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Desempeño individual de las {reglasEntries.length} reglas explicables sobre las {totalMuestrasMatriz} muestras evaluadas ({resumen.expedientes_sembrados} base + {resumen.casos_en_vivo} en vivo + {resumen.pruebas_sha256} estados SHA-256)
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
            FN totales: {data.totales.FN} · FP totales: {data.totales.FP}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Regla Normativa Evaluada</th>
                <th className="py-2.5 px-2.5 text-right">VP (TP)</th>
                <th className="py-2.5 px-2.5 text-right">FP</th>
                <th className="py-2.5 px-2.5 text-right">FN</th>
                <th className="py-2.5 px-2.5 text-right">VN (TN)</th>
                <th className="py-2.5 px-2.5 text-right">Precisión</th>
                <th className="py-2.5 px-2.5 text-right">Recall</th>
                <th className="py-2.5 px-2.5 text-right">F1</th>
                <th className="py-2.5 px-4 text-right">Tasa FP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {reglasEntries.map(([codigo, m]) => {
                const meta = REGLA_METADATA[codigo];
                return (
                  <tr
                    key={codigo}
                    className="border-l-2 border-l-transparent hover:border-l-emerald-600 dark:hover:border-l-emerald-400 hover:bg-slate-50/90 dark:hover:bg-slate-800/45 transition-colors"
                  >
                    <td className="py-2.5 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-extrabold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[#0B1F3A] dark:text-cyan-300 border border-slate-200 dark:border-slate-700">
                          {codigo}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {meta ? meta.titulo : codigo}
                        </span>
                      </div>
                      {meta && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {meta.referencia}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      {m.TP}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono font-bold tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {m.FP}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono font-bold tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {m.FN}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {m.TN}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                      {formatPct(m.precision)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                      {formatPct(m.recall)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-mono text-[11px] font-bold tabular-nums">
                        {formatPct(m.f1)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      {formatPct(m.fpr)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 text-xs font-bold">
                <td className="py-3 px-4 text-slate-900 dark:text-white">
                  Consolidado Global ({reglasEntries.length} reglas × {totalMuestrasMatriz} muestras)
                </td>
                <td className="py-3 px-2.5 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                  {data.totales.TP}
                </td>
                <td className="py-3 px-2.5 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                  {data.totales.FP}
                </td>
                <td className="py-3 px-2.5 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                  {data.totales.FN}
                </td>
                <td className="py-3 px-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {data.totales.TN}
                </td>
                <td className="py-3 px-2.5 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                  {formatPct(globalPrecision)}
                </td>
                <td className="py-3 px-2.5 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                  {formatPct(globalRecall)}
                </td>
                <td className="py-3 px-2.5 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatPct(globalF1)}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatPct(globalFpr)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Sección 2 — Casos Etiquetados y Pruebas de Frontera en Vivo */}
      <section
        data-tour="val-casos"
        className="animate-card-up rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none overflow-hidden"
      >
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              2. Casos Etiquetados y Pruebas de Frontera en Vivo
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Verificación de los límites exactos de 8 UIT (S/ 42,800 vs. S/ 42,801) y sobreprecio (+25.0 % vs. +25.1 %), continuidad RNP e irregularidades combinadas
            </p>
          </div>

          {/* Píldoras Segmentadas de Filtro */}
          <div
            role="group"
            aria-label="Filtrar casos etiquetados en vivo"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
          >
            <button
              type="button"
              onClick={() => setFiltroCasos('TODOS')}
              className={`btn-tactile px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                filtroCasos === 'TODOS'
                  ? 'bg-[#0B1F3A] text-white dark:bg-emerald-500 dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              Todos ({conteoCasos.todos})
            </button>
            <button
              type="button"
              onClick={() => setFiltroCasos('CONTROLES')}
              className={`btn-tactile px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                filtroCasos === 'CONTROLES'
                  ? 'bg-[#0B1F3A] text-white dark:bg-emerald-500 dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              Controles Limpios y Fronteras ({conteoCasos.controles})
            </button>
            <button
              type="button"
              onClick={() => setFiltroCasos('IRREGULARIDADES')}
              className={`btn-tactile px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                filtroCasos === 'IRREGULARIDADES'
                  ? 'bg-[#0B1F3A] text-white dark:bg-emerald-500 dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              Irregularidades y Combinados ({conteoCasos.irregularidades})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Escenario Evaluado en Vivo</th>
                <th className="py-2.5 px-3">Reglas Esperadas</th>
                <th className="py-2.5 px-3">Reglas Detectadas</th>
                <th className="py-2.5 px-4 text-right">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {casosFiltrados.map((item) => {
                const esExacto = sameRuleSet(item.esperado, item.detectado);
                const tipo = classifyLiveCase(item.caso, item.esperado);
                return (
                  <tr
                    key={item.caso}
                    className="border-l-2 border-l-transparent hover:border-l-emerald-600 dark:hover:border-l-emerald-400 hover:bg-slate-50/90 dark:hover:bg-slate-800/45 transition-colors"
                  >
                    <td className="py-2.5 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-bold whitespace-nowrap ${tipo.clase}`}
                        >
                          {tipo.etiqueta}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {item.caso}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {item.esperado.length === 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-medium">
                          Ninguna (Compra limpia)
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {item.esperado.map((r) => (
                            <span
                              key={r}
                              title={REGLA_METADATA[r]?.titulo || r}
                              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px] font-bold text-[#0B1F3A] dark:text-cyan-300 whitespace-nowrap"
                            >
                              {REGLA_METADATA[r]?.corto || r}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {item.detectado.length === 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-medium">
                          Ninguna (Compra limpia)
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {item.detectado.map((r) => (
                            <span
                              key={r}
                              title={REGLA_METADATA[r]?.titulo || r}
                              className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 font-mono text-[11px] font-bold text-amber-900 dark:text-amber-300 whitespace-nowrap"
                            >
                              {REGLA_METADATA[r]?.corto || r}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      {esExacto ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Exacto
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-[11px] font-bold">
                          <XCircle className="w-3.5 h-3.5" />
                          Diferencia
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sección 3 — Latencias, Controles RBAC y Suite de Pruebas Unitarias */}
      <section
        data-tour="val-seguridad"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start"
      >
        {/* Columna Izquierda: Latencias + Lista de Pruebas Ejecutadas */}
        <div className="space-y-6 min-w-0">
          {/* Sub-bloque 3A: Tiempos de Respuesta */}
          <div className="animate-card-up rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  3A. Tiempos de Respuesta (SQLite Local)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                   Percentiles medidos en milisegundos sin dependencia de APIs externas
                </p>
              </div>
              <Gauge className="w-5 h-5 text-blue-700 dark:text-cyan-400 shrink-0" />
            </div>

            <div className="space-y-3.5">
              {latenciasEntries.map(([operacion, stats], idx) => {
                const barPct = Math.min(
                  100,
                  Math.max(8, Math.round((stats.p95 / maxLatencyMs) * 100)),
                );
                const barColors = [
                  'bg-[#0B1F3A] dark:bg-emerald-500',
                  'bg-blue-700 dark:bg-cyan-500',
                  'bg-emerald-600 dark:bg-emerald-400',
                  'bg-amber-600 dark:bg-amber-400',
                ];
                return (
                  <div
                    key={operacion}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2 text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200 leading-snug">
                        {operacion}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                        n={stats.n}
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full animate-bar-grow ${barColors[idx % barColors.length]}`}
                        style={{
                          width: `${barPct}%`,
                          animationDelay: `${100 + idx * 70}ms`,
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      <span>
                        p50:{' '}
                        <strong className="text-slate-900 dark:text-white">
                          {stats.p50.toFixed(1)} ms
                        </strong>
                      </span>
                      <span>
                        p95:{' '}
                        <strong className="text-emerald-700 dark:text-emerald-400">
                          {stats.p95.toFixed(1)} ms
                        </strong>
                      </span>
                      <span>
                        Máx:{' '}
                        <strong className="text-slate-900 dark:text-white">
                          {stats.max.toFixed(1)} ms
                        </strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sub-bloque 3B: Pruebas Unitarias e Integración */}
          <div className="animate-card-up rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  3B. {data.pruebas_ejecutadas.length} Pruebas Unitarias e Integración
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Registro completo de métodos verificados por <code className="font-mono">unittest</code>
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-mono text-[11px] font-bold shrink-0">
                {resumen.pruebas_aprobadas}/{resumen.total_pruebas} OK
              </span>
            </div>

            <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {data.pruebas_ejecutadas.map((prueba) => {
                const ok = prueba.estado === 'OK';
                const parsed = formatTestMethodName(prueba.nombre);
                return (
                  <li
                    key={prueba.nombre}
                    className="px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {ok ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white leading-snug break-words">
                          {parsed.metodoLegible}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 break-all">
                          {parsed.suite} • {prueba.nombre}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 ${
                        ok
                          ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                      }`}
                    >
                      {prueba.estado}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Columna Derecha: Matriz de Acceso RBAC (21 verificaciones) */}
        <div className="animate-card-up rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none overflow-hidden min-w-0">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                3C. {data.rbac.length} Verificaciones de Permisos por Rol (RBAC)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Comprobación de bloqueos HTTP 403 y separación estricta entre OCI, DEC y Consulta Pública
              </p>
            </div>
            <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Rol y Endpoint Evaluado</th>
                  <th className="py-2.5 px-2 text-center">Esp.</th>
                  <th className="py-2.5 px-2 text-center">Obt.</th>
                  <th className="py-2.5 px-4 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {data.rbac.map((item, idx) => {
                  const cumple = item.esperado === item.obtenido;
                  const esBloqueo = item.esperado === 403;
                  return (
                    <tr
                      key={`${item.verificacion}-${idx}`}
                      className="border-l-2 border-l-transparent hover:border-l-emerald-600 dark:hover:border-l-emerald-400 hover:bg-slate-50/90 dark:hover:bg-slate-800/45 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-800 dark:text-slate-200 break-words">
                        {item.verificacion}
                      </td>
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded font-mono text-[11px] font-bold ${
                            esBloqueo
                              ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                              : 'bg-blue-50 dark:bg-cyan-500/15 text-blue-800 dark:text-cyan-300 border border-blue-200 dark:border-cyan-500/30'
                          }`}
                        >
                          {item.esperado}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded font-mono text-[11px] font-bold ${
                            item.obtenido === 403
                              ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                              : 'bg-blue-50 dark:bg-cyan-500/15 text-blue-800 dark:text-cyan-300 border border-blue-200 dark:border-cyan-500/30'
                          }`}
                        >
                          {item.obtenido}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {cumple ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-[10px] font-bold">
                            <XCircle className="w-3 h-3" />
                            Fallo
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
