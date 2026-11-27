import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  ArrowRight,
  Zap,
  ShieldCheck,
  ShieldAlert,
  PlusCircle,
  BellRing,
  Network,
  History,
  FileSearch,
  CornerDownLeft,
  RefreshCw,
  ClipboardCheck,
  FlaskConical,
} from 'lucide-react';
import { centinelaApi } from '../api/client';
import { ExpedienteListItem, RolUsuario } from '../types';
import { ROLE_PROFILES } from '../config/roles';
import { RiskBadge } from './AlertBadge';
import { formatTipologia } from '../utils/formatters';

interface QuickCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  rolActivo: RolUsuario;
}

interface QuickShortcut {
  id: string;
  label: string;
  subtitle: string;
  to: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
  tag: string;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export const QuickCommandPalette: React.FC<QuickCommandPaletteProps> = ({
  isOpen,
  onClose,
  rolActivo,
}) => {
  const navigate = useNavigate();
  const profile = ROLE_PROFILES[rolActivo];

  const [query, setQuery] = useState<string>('');
  const [expedientes, setExpedientes] = useState<ExpedienteListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Cargar expedientes en vivo cada vez que se abre la paleta
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveIndex(0);

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 20);

    let cancelled = false;
    setLoading(true);
    centinelaApi
      .listarExpedientes()
      .then((data) => {
        if (!cancelled) setExpedientes(data);
      })
      .catch(() => {
        // Mantener último listado disponible si falla la carga
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(focusTimer);
    };
  }, [isOpen]);

  // Atajos rápidos filtrados estrictamente según permisos del rolActivo
  const allShortcuts = useMemo<QuickShortcut[]>(() => {
    const items: QuickShortcut[] = [
      {
        id: 'shortcut-caso-1',
        label: 'Caso 1 UNT — 15 Proyectores (Fracc. + TDR + Conflicto)',
        subtitle: 'EXP-2025-UNT-0001 • Estación de auditoría, NLP TDR y conflicto R-08',
        to: '/trazabilidad?id=1',
        keywords: 'caso 1 unt proyectores fraccionamiento tdr conflicto 0001 r-08',
        icon: ShieldAlert,
        accentClass: 'text-rose-600 dark:text-rose-400',
        tag: 'Caso 1',
      },
      {
        id: 'shortcut-caso-2',
        label: 'Caso 2 UNT — 8 Aulas (Candado de Pago Pozo a Tierra)',
        subtitle: 'EXP-2025-UNT-0010 • Bloqueo preventivo en Tesorería por entregable TDR',
        to: '/trazabilidad?id=10',
        keywords: 'caso 2 unt aulas candado pago pozo tierra tesoreria entregable 0010',
        icon: ClipboardCheck,
        accentClass: 'text-amber-600 dark:text-amber-400',
        tag: 'Caso 2',
      },
      {
        id: 'shortcut-sha256',
        label: profile.canDictaminarOci
          ? 'Probar Alteración Oculta SHA-256 (EXP-2025-UNT-0006)'
          : 'Inspeccionar Cadena SHA-256 (EXP-2025-UNT-0006)',
        subtitle: profile.canDictaminarOci
          ? 'Simulación forense ex-post sobre las 6 etapas selladas (exclusivo OCI)'
          : 'Verificación criptográfica de las 6 etapas del expediente',
        to: '/trazabilidad?id=6',
        keywords: 'sha-256 alteracion oculta cadena integridad 0006 forense sello',
        icon: Zap,
        accentClass: 'text-blue-700 dark:text-cyan-400',
        tag: 'SHA-256',
      },
    ];

    if (!profile.isReadOnly) {
      items.push(
        {
          id: 'shortcut-nueva-compra',
          label: 'Registrar Nueva Compra en Vivo',
          subtitle: 'Abrir formulario con plantillas de 1 clic y evaluación XAI inmediata',
          to: '/expedientes?nuevo=1',
          keywords: 'registrar nueva compra vivo expediente plantilla simular',
          icon: PlusCircle,
          accentClass: 'text-emerald-600 dark:text-emerald-400',
          tag: 'En Vivo',
        },
        {
          id: 'shortcut-compliance',
          label: 'Alertas y Conflictos de Interés',
          subtitle: 'Bandeja XAI priorizada, descargos DEC, dictámenes OCI y abstenciones',
          to: '/compliance',
          keywords: 'alertas conflictos interes compliance descargos dictamen abstencion',
          icon: BellRing,
          accentClass: 'text-amber-600 dark:text-amber-400',
          tag: 'Bandeja',
        },
        {
          id: 'shortcut-grafo',
          label: 'Empresas Vinculadas (Grafo de Colusión)',
          subtitle: 'Red interactiva de proveedores con representantes o domicilios compartidos',
          to: '/grafo-colusion',
          keywords: 'empresas vinculadas grafo colusion red proveedores r-04',
          icon: Network,
          accentClass: 'text-blue-700 dark:text-cyan-400',
          tag: 'Grafo',
        },
      );
    }

    items.push(
      {
        id: 'shortcut-denuncias',
        label: 'Canal de Denuncia Anónimo (D.L. 1327)',
        subtitle: 'Registro con reserva de identidad, código cifrado y protección al denunciante',
        to: '/denuncias',
        keywords: 'canal denuncia anonimo dl 1327 proteccion codigo reservado',
        icon: ShieldCheck,
        accentClass: 'text-emerald-600 dark:text-emerald-400',
        tag: 'D.L. 1327',
      },
      {
        id: 'shortcut-validacion',
        label: 'Validación Técnica y Efectividad (28 Pruebas)',
        subtitle: 'Matriz de confusión (10 reglas), fronteras 8 UIT/+25%, latencias y 21 controles RBAC',
        to: '/validacion',
        keywords:
          'validacion tecnica efectividad pruebas matriz confusion f1 precision recall rbac latencia unittest',
        icon: FlaskConical,
        accentClass: 'text-emerald-600 dark:text-emerald-400',
        tag: 'Métricas',
      },
    );

    if (profile.canDictaminarOci) {
      items.push({
        id: 'shortcut-auditoria',
        label: 'Registro de Actividad Inmutable y Bloqueo 403',
        subtitle: 'Bitácora global SHA-256 append-only y prueba de control RBAC (OCI)',
        to: '/auditoria',
        keywords: 'registro actividad bitacora inmutable bloqueo 403 rbac auditoria oci',
        icon: History,
        accentClass: 'text-slate-700 dark:text-slate-300',
        tag: 'OCI',
      });
    }

    return items;
  }, [profile.canDictaminarOci, profile.isReadOnly]);

  const normalizedQuery = useMemo(() => normalizeText(query.trim()), [query]);

  const filteredShortcuts = useMemo(() => {
    if (!normalizedQuery) return allShortcuts;
    return allShortcuts.filter((item) => {
      const haystack = normalizeText(`${item.label} ${item.subtitle} ${item.keywords}`);
      return haystack.includes(normalizedQuery);
    });
  }, [allShortcuts, normalizedQuery]);

  const filteredExpedientes = useMemo(() => {
    if (!normalizedQuery) {
      // Sin búsqueda: mostrar primero expedientes nuevos en vivo (id > 120) y casos observados principales
      const prioritized = [...expedientes].sort((a, b) => {
        const aLive = a.id > 120 ? 1 : 0;
        const bLive = b.id > 120 ? 1 : 0;
        if (aLive !== bLive) return bLive - aLive;
        if (aLive && bLive) return b.id - a.id;
        const aRisk = a.nivel_riesgo === 'ALTO' ? 0 : a.nivel_riesgo === 'MEDIO' ? 1 : 2;
        const bRisk = b.nivel_riesgo === 'ALTO' ? 0 : b.nivel_riesgo === 'MEDIO' ? 1 : 2;
        if (aRisk !== bRisk) return aRisk - bRisk;
        return a.id - b.id;
      });
      return prioritized.slice(0, 8);
    }

    return expedientes
      .filter((exp) => {
        const tipologiaLabel = formatTipologia(exp.tipo_trampa);
        const haystack = normalizeText(
          `${exp.codigo} ${exp.objeto} ${exp.area_usuaria} ${exp.proveedor_adjudicado_codigo || ''} ${tipologiaLabel} ${exp.tipo_trampa || ''}`,
        );
        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        const aCodeMatch = normalizeText(a.codigo).includes(normalizedQuery) ? 0 : 1;
        const bCodeMatch = normalizeText(b.codigo).includes(normalizedQuery) ? 0 : 1;
        if (aCodeMatch !== bCodeMatch) return aCodeMatch - bCodeMatch;
        return b.id - a.id;
      })
      .slice(0, 8);
  }, [expedientes, normalizedQuery]);

  const flatDestinations = useMemo(() => {
    const list: { key: string; to: string }[] = [];
    for (const s of filteredShortcuts) {
      list.push({ key: s.id, to: s.to });
    }
    for (const e of filteredExpedientes) {
      list.push({ key: `exp-${e.id}`, to: `/trazabilidad?id=${e.id}` });
    }
    return list;
  }, [filteredShortcuts, filteredExpedientes]);

  useEffect(() => {
    setActiveIndex(0);
  }, [normalizedQuery, isOpen]);

  useEffect(() => {
    if (activeIndex >= flatDestinations.length && flatDestinations.length > 0) {
      setActiveIndex(flatDestinations.length - 1);
    }
  }, [activeIndex, flatDestinations.length]);

  useEffect(() => {
    if (!isOpen) return;
    const activeEl = itemRefs.current[activeIndex];
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, isOpen]);

  const handleSelectRoute = (to: string) => {
    onClose();
    navigate(to);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (flatDestinations.length > 0) {
          setActiveIndex((prev) => (prev + 1) % flatDestinations.length);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (flatDestinations.length > 0) {
          setActiveIndex(
            (prev) => (prev - 1 + flatDestinations.length) % flatDestinations.length,
          );
        }
      } else if (e.key === 'Enter') {
        const chosen = flatDestinations[activeIndex];
        if (chosen) {
          e.preventDefault();
          handleSelectRoute(chosen.to);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatDestinations, activeIndex, onClose]);

  if (!isOpen) return null;

  const totalResults = flatDestinations.length;
  itemRefs.current = [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[9vh] sm:pt-[11vh] px-4 bg-slate-900/55 dark:bg-slate-950/80 backdrop-blur-sm animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscador rápido y atajos de CENTINELA"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/90 border-t-[3px] border-t-[#0B1F3A] dark:border-t-emerald-500 shadow-2xl overflow-hidden animate-modal-pop"
      >
        {/* Cabecera de búsqueda */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-blue-700 dark:text-emerald-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar expediente (0001, proyectores, pozo...), caso o sección..."
            aria-label="Buscar expediente, caso o sección"
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="px-2 py-1 rounded-md text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800"
            >
              Limpiar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="btn-tactile p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-800"
            aria-label="Cerrar buscador rápido"
            title="Cerrar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lista de resultados */}
        <div className="max-h-[62vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
          {totalResults === 0 && !loading ? (
            <div className="p-8 text-center space-y-1.5">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Sin coincidencias para "{query}"
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pruebe con un código (0001, 0006, 0010), un rubro (proyectores, aulas) o un área usuaria.
              </p>
            </div>
          ) : (
            <>
              {/* Sección 1: Atajos Rápidos (1 clic) */}
              {filteredShortcuts.length > 0 && (
                <div className="p-3 space-y-1">
                  <div className="px-2.5 py-1 flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Atajos Rápidos (1 clic)
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                      Perfil: {profile.shortLabel}
                    </span>
                  </div>
                  {filteredShortcuts.map((shortcut, idx) => {
                    const Icon = shortcut.icon;
                    const isSelected = activeIndex === idx;
                    return (
                      <button
                        key={shortcut.id}
                        ref={(el) => {
                          itemRefs.current[idx] = el;
                        }}
                        type="button"
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => handleSelectRoute(shortcut.to)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                          isSelected
                            ? 'bg-[#0B1F3A] text-white dark:bg-emerald-500/20 dark:text-white ring-1 ring-[#0B1F3A] dark:ring-emerald-500/50'
                            : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                              isSelected
                                ? 'bg-white/15 border-white/20 text-white dark:bg-emerald-500/20 dark:border-emerald-400/40 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <Icon
                              className={`w-4 h-4 ${
                                isSelected ? 'text-white dark:text-emerald-300' : shortcut.accentClass
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{shortcut.label}</div>
                            <div
                              className={`text-[11px] truncate ${
                                isSelected
                                  ? 'text-blue-100/85 dark:text-slate-300'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {shortcut.subtitle}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                              isSelected
                                ? 'bg-white/15 text-white border-white/25 dark:bg-emerald-500/25 dark:text-emerald-200 dark:border-emerald-400/40'
                                : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            {shortcut.tag}
                          </span>
                          <ArrowRight
                            className={`w-3.5 h-3.5 ${
                              isSelected ? 'text-white dark:text-emerald-300' : 'text-slate-400'
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Sección 2: Expedientes en Vivo */}
              <div className="p-3 space-y-1">
                <div className="px-2.5 py-1 flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <FileSearch className="w-3.5 h-3.5 text-blue-700 dark:text-cyan-400" />
                    Expedientes en Vivo
                  </span>
                  {loading ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Sincronizando...
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                      {filteredExpedientes.length} mostrados de {expedientes.length}
                    </span>
                  )}
                </div>

                {filteredExpedientes.length === 0 && !loading ? (
                  <p className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                    No se encontraron expedientes que coincidan con el criterio ingresado.
                  </p>
                ) : (
                  filteredExpedientes.map((exp, expIdx) => {
                    const globalIdx = filteredShortcuts.length + expIdx;
                    const isSelected = activeIndex === globalIdx;
                    return (
                      <button
                        key={exp.id}
                        ref={(el) => {
                          itemRefs.current[globalIdx] = el;
                        }}
                        type="button"
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                        onClick={() => handleSelectRoute(`/trazabilidad?id=${exp.id}`)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                          isSelected
                            ? 'bg-[#0B1F3A] text-white dark:bg-emerald-500/20 dark:text-white ring-1 ring-[#0B1F3A] dark:ring-emerald-500/50'
                            : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono text-xs font-extrabold shrink-0 ${
                                isSelected
                                  ? 'text-emerald-300 dark:text-emerald-300'
                                  : 'text-blue-700 dark:text-cyan-300'
                              }`}
                            >
                              {exp.codigo}
                            </span>
                            <span className="text-xs font-semibold truncate">{exp.objeto}</span>
                          </div>
                          <div
                            className={`text-[11px] font-mono truncate mt-0.5 ${
                              isSelected
                                ? 'text-blue-100/80 dark:text-slate-300'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {exp.area_usuaria}
                            {exp.proveedor_adjudicado_codigo
                              ? ` • ${exp.proveedor_adjudicado_codigo}`
                              : ''}
                            {exp.tipo_trampa ? ` • ${formatTipologia(exp.tipo_trampa)}` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span
                            className={`hidden sm:inline font-mono text-[11px] font-bold tabular-nums ${
                              isSelected
                                ? 'text-white dark:text-emerald-200'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            S/{' '}
                            {exp.monto_estimado.toLocaleString('es-PE', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          <RiskBadge nivel={exp.nivel_riesgo} puntaje={exp.puntaje_riesgo} compact />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Pie con leyenda de teclado */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-[10px] font-bold">
                ↑↓
              </kbd>
              Navegar
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-[10px] font-bold inline-flex items-center">
                <CornerDownLeft className="w-2.5 h-2.5" />
              </kbd>
              Abrir
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-[10px] font-bold">
                Esc
              </kbd>
              Cerrar
            </span>
          </div>
          <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
            {profile.userCode} • RBAC Activo
          </span>
        </div>
      </div>
    </div>
  );
};
