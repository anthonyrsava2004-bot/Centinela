import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  FolderSearch,
  Link2,
  Network,
  BellRing,
  Lock,
  Sparkles,
  Sun,
  Moon,
  CheckCircle2,
  XCircle,
  Scale,
  Eye,
  Briefcase,
  ShieldCheck,
  History,
  HelpCircle,
  Search,
  SlidersHorizontal,
  FlaskConical,
} from 'lucide-react';
import { RolUsuario } from '../types';
import { useTheme } from '../context/ThemeContext';
import { ROLE_LIST, ROLE_PROFILES } from '../config/roles';
import { Modal } from './Modal';
import { OnboardingTour, TourMode, getPageTourTargets } from './OnboardingTour';
import { QuickCommandPalette } from './QuickCommandPalette';
import { centinelaApi } from '../api/client';

const TOUR_SKIP_ALL_KEY = 'centinela-tour-skip-all';
const getTourRouteKey = (pathname: string) => `centinela-tour-route:${pathname}`;

const QUICK_ROLE_OPTIONS: {
  id: RolUsuario;
  label: string;
  activeClass: string;
}[] = [
  {
    id: 'Auditor OCI (Control Institucional)',
    label: 'OCI',
    activeClass: 'bg-emerald-600 text-white shadow-sm',
  },
  {
    id: 'Especialista Logística (DEC)',
    label: 'DEC',
    activeClass: 'bg-blue-700 text-white shadow-sm',
  },
  {
    id: 'Consulta Transparencia (Solo Lectura)',
    label: 'Público',
    activeClass: 'bg-amber-500 text-slate-950 shadow-sm',
  },
];

interface LayoutProps {
  rolActivo: RolUsuario;
  setRolActivo: (rol: RolUsuario) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  rolActivo,
  setRolActivo,
  children,
}) => {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const profile = ROLE_PROFILES[rolActivo];

  const [modalSesionAbierto, setModalSesionAbierto] = useState<boolean>(false);
  const [paletteAbierta, setPaletteAbierta] = useState<boolean>(false);
  const [alertasPendientes, setAlertasPendientes] = useState<number>(0);
  const [totalPruebasVal, setTotalPruebasVal] = useState<number>(27);
  const [tourAbierto, setTourAbierto] = useState<boolean>(false);
  const [tourMode, setTourMode] = useState<TourMode>('page');
  const tourDelayRef = useRef<number | null>(null);
  const tourPollRef = useRef<number | null>(null);

  // Atajo global Ctrl+K / Cmd+K para abrir o cerrar la paleta rápida
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (tourDelayRef.current !== null) {
          window.clearTimeout(tourDelayRef.current);
          tourDelayRef.current = null;
        }
        if (tourPollRef.current !== null) {
          window.clearInterval(tourPollRef.current);
          tourPollRef.current = null;
        }
        setTourAbierto(false);
        setModalSesionAbierto(false);
        setPaletteAbierta((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const detenerEsperaTour = () => {
    if (tourDelayRef.current !== null) {
      window.clearTimeout(tourDelayRef.current);
      tourDelayRef.current = null;
    }
    if (tourPollRef.current !== null) {
      window.clearInterval(tourPollRef.current);
      tourPollRef.current = null;
    }
  };

  // Mostrar guía contextual automáticamente al entrar por primera vez a cada ruta
  useEffect(() => {
    detenerEsperaTour();
    setTourAbierto(false);

    const pathname = location.pathname;
    let silenciadoGlobal = false;
    let rutaVista = false;
    try {
      silenciadoGlobal = localStorage.getItem(TOUR_SKIP_ALL_KEY) === '1';
      rutaVista = localStorage.getItem(getTourRouteKey(pathname)) === '1';
    } catch {
      // Ignorar errores de almacenamiento
    }

    if (silenciadoGlobal || rutaVista) {
      return;
    }

    const targets = getPageTourTargets(pathname);
    if (targets.length === 0) {
      return;
    }

    const startedAt = Date.now();
    const POLL_MS = 250;
    const MAX_WAIT_MS = 3000;

    const tryOpenWhenReady = (): boolean => {
      const elapsed = Date.now() - startedAt;
      const hasMountedAnchor = targets.some((target) => {
        const el = document.querySelector(`[data-tour="${target}"]`) as HTMLElement | null;
        if (!el) return false;
        const box = el.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      });
      const mainHasSpinner = Boolean(document.querySelector('main .animate-spin'));

      if (hasMountedAnchor && (!mainHasSpinner || elapsed >= 1500)) {
        detenerEsperaTour();
        setTourMode('page');
        setTourAbierto(true);
        return true;
      }

      if (elapsed >= MAX_WAIT_MS) {
        detenerEsperaTour();
        return true;
      }

      return false;
    };

    tourDelayRef.current = window.setTimeout(() => {
      tourDelayRef.current = null;
      if (!tryOpenWhenReady()) {
        tourPollRef.current = window.setInterval(() => {
          tryOpenWhenReady();
        }, POLL_MS);
      }
    }, POLL_MS);

    return () => {
      detenerEsperaTour();
    };
  }, [location.pathname]);

  const abrirTourManual = () => {
    detenerEsperaTour();
    setTourMode('page');
    setTourAbierto(true);
  };

  const cerrarTour = () => {
    detenerEsperaTour();
    setTourAbierto(false);
    try {
      localStorage.setItem(getTourRouteKey(location.pathname), '1');
    } catch {
      // Ignorar errores de almacenamiento
    }
  };

  const silenciarTodosLosTours = () => {
    detenerEsperaTour();
    setTourAbierto(false);
    try {
      localStorage.setItem(TOUR_SKIP_ALL_KEY, '1');
      localStorage.setItem(getTourRouteKey(location.pathname), '1');
    } catch {
      // Ignorar errores de almacenamiento
    }
  };

  useEffect(() => {
    centinelaApi
      .obtenerReporteValidacion()
      .then((v) => {
        if (v?.resumen_muestras?.total_pruebas) {
          setTotalPruebasVal(v.resumen_muestras.total_pruebas);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const cargarPendientes = () => {
      centinelaApi
        .getDashboardKPIs()
        .then((d) => setAlertasPendientes(d.alertas_pendientes))
        .catch(() => {});
    };
    cargarPendientes();
    window.addEventListener('centinela:data-updated', cargarPendientes);
    return () => window.removeEventListener('centinela:data-updated', cargarPendientes);
  }, [location.pathname, rolActivo]);

  const navItems = [
    {
      to: '/',
      tourId: 'nav-resumen',
      label: profile.isReadOnly
        ? 'Resumen Público'
        : profile.canSubmitDescargo
        ? 'Panel de Compras'
        : 'Resumen General',
      sub: profile.isReadOnly ? 'Indicadores abiertos' : 'Indicadores y riesgos',
      icon: LayoutDashboard,
      visible: true,
      badge: undefined as number | undefined,
    },
    {
      to: '/compliance',
      tourId: 'nav-alertas',
      label: profile.canSubmitDescargo ? 'Alertas DEC' : 'Alertas y Conflictos',
      sub: profile.canSubmitDescargo
        ? 'Descargos y conflictos'
        : 'Revisar casos y conflictos',
      icon: BellRing,
      visible: !profile.isReadOnly,
      badge: alertasPendientes > 0 ? alertasPendientes : undefined,
    },
    {
      to: '/expedientes',
      tourId: 'nav-compras',
      label: 'Lista de Compras',
      sub: profile.isReadOnly ? 'Procesos públicos' : 'Buscar y registrar',
      icon: FolderSearch,
      visible: true,
      badge: undefined,
    },
    {
      to: '/trazabilidad',
      tourId: 'nav-detalle',
      label: 'Detalle y Seguridad',
      sub: 'Pagos y sello SHA-256',
      icon: Link2,
      visible: true,
      badge: undefined,
    },
    {
      to: '/grafo-colusion',
      tourId: 'nav-empresas',
      label: 'Empresas Vinculadas',
      sub: 'Datos compartidos',
      icon: Network,
      visible: !profile.isReadOnly,
      badge: undefined,
    },
    {
      to: '/denuncias',
      tourId: 'nav-denuncias',
      label: 'Canal de Denuncia',
      sub: 'Denuncia anónima',
      icon: ShieldCheck,
      visible: true,
      badge: undefined,
    },
    {
      to: '/auditoria',
      tourId: 'nav-auditoria',
      label: 'Registro de Actividad',
      sub: 'Quién hizo qué y cuándo',
      icon: History,
      visible: profile.canDictaminarOci,
      badge: undefined,
    },
    {
      to: '/validacion',
      tourId: 'nav-validacion',
      label: 'Validación',
      sub: `${totalPruebasVal} pruebas y métricas`,
      icon: FlaskConical,
      visible: true,
      badge: undefined,
    },
  ].filter((item) => item.visible);

  const activePillColor = profile.canDictaminarOci
    ? 'bg-emerald-400'
    : profile.canSubmitDescargo
    ? 'bg-cyan-400'
    : 'bg-amber-400';

  const handleSeleccionarRol = (nuevoRol: RolUsuario) => {
    setRolActivo(nuevoRol);
    setModalSesionAbierto(false);
    const nuevoPerfil = ROLE_PROFILES[nuevoRol];
    if (
      (nuevoPerfil.isReadOnly &&
        (location.pathname === '/compliance' ||
          location.pathname === '/grafo-colusion' ||
          location.pathname === '/auditoria')) ||
      (!nuevoPerfil.canDictaminarOci && location.pathname === '/auditoria')
    ) {
      navigate('/');
    }
  };

  const RoleIcon = profile.canDictaminarOci
    ? ShieldCheck
    : profile.canSubmitDescargo
    ? Briefcase
    : Eye;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
      {/* Sidebar con Identidad Dinámica por Rol (Fijo en altura de pantalla) */}
      <aside
        className={`w-72 sticky top-0 h-screen overflow-y-auto ${profile.sidebarBgLight} border-r ${profile.sidebarBorderLight} text-slate-100 flex flex-col justify-between shrink-0 shadow-lg dark:shadow-none transition-colors duration-300`}
      >
        <div>
          {/* Branding CENTINELA */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg ${
                  profile.canDictaminarOci
                    ? 'bg-emerald-400 shadow-emerald-500/20'
                    : profile.canSubmitDescargo
                    ? 'bg-sky-400 shadow-sky-500/20'
                    : 'bg-amber-400 shadow-amber-500/20'
                }`}
              >
                <Shield className="w-6 h-6 text-slate-950 stroke-[2.3]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-extrabold tracking-tight text-white">
                    CENTINELA
                  </span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/15 text-white border border-white/20">
                    TRL-4
                  </span>
                </div>
                <p className="text-xs text-blue-200/80 dark:text-slate-400 font-medium">
                  Integridad & Trazabilidad Pública
                </p>
              </div>
            </div>

            {/* Indicador del Espacio de Trabajo Activo */}
            <div className="mt-4 px-3 py-2 rounded-xl bg-black/25 border border-white/10 flex items-center gap-2.5">
              <RoleIcon className="w-4 h-4 text-white shrink-0" />
              <div className="min-w-0 leading-snug">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>{profile.shortLabel}</span>
                  <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/15 text-white/90">
                    {profile.userCode}
                  </span>
                </div>
                <div className="text-[10px] text-white/70 leading-tight">{profile.area}</div>
              </div>
            </div>

            {/* Badges Normativos */}
            <div className="mt-3 space-y-1.5">
              <div className="px-2.5 py-1.5 rounded-lg bg-black/20 border border-white/10 flex items-center gap-2">
                <Scale className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <span className="text-[10px] font-semibold text-white/90">
                  D.S. N° 148-2024-PCM • R.S. 002-2026
                </span>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-black/20 border border-white/10 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                <span className="text-[10px] font-semibold text-white/90">
                  R.R. N° 0490-2026/UNT • Ley N° 32069
                </span>
              </div>
            </div>
          </div>

          {/* Menú de Navegación Claro y Sin Jerga Técnica */}
          <nav className="p-4 space-y-1.5">
            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-white/50">
              {profile.isReadOnly ? 'Consulta Pública' : 'Menú Principal'}
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  data-tour={item.tourId}
                  className={({ isActive }) =>
                    `group relative flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                      isActive
                        ? `${profile.activeNavClass} border`
                        : 'text-white/75 hover:text-white hover:bg-white/10 border border-transparent'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span
                          className={`absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full ${activePillColor}`}
                          aria-hidden="true"
                        />
                      )}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="w-[18px] h-[18px] shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
                        <div className="leading-tight min-w-0">
                          <div className="text-sm font-semibold whitespace-nowrap">{item.label}</div>
                          <div className="text-[11px] text-white/60 whitespace-nowrap">{item.sub}</div>
                        </div>
                      </div>
                      {item.badge !== undefined && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono text-[11px] font-bold shrink-0 tabular-nums shadow-sm">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer de Privacidad por Diseño */}
        <div className="p-4 m-4 rounded-xl bg-black/25 border border-white/10 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
            <Sparkles className="w-4 h-4" />
            Privacidad por Diseño Activa
          </div>
          <p className="text-[11px] text-white/70 leading-relaxed">
            Datos 100% sintéticos y seudonimizados (
            <code className="text-cyan-300 font-mono">FUNC-*</code>,{' '}
            <code className="text-cyan-300 font-mono">PROV-SYN-*</code>) bajo Ley N° 29733 y presunción de licitud (Ley N° 27444).
          </p>
          <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[10px] text-white/50 font-mono">
            <span>Innova Norte 3G</span>
            <span>UNT • Desafío 2</span>
          </div>
        </div>
      </aside>

      {/* Contenedor Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar Institucional con Búsqueda Rápida, Selector 1-Clic RBAC + Toggle Claro/Oscuro */}
        <header className="px-5 xl:px-6 py-2.5 bg-white/95 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5 sticky top-0 z-30 shadow-sm dark:shadow-none">
          <div className="min-w-0 flex items-center gap-2.5 overflow-hidden">
            <span
              className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-bold min-w-0 max-w-full ${profile.accentBarClass}`}
              title={profile.workspaceTitle}
            >
              <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                <span className="animate-radar-ring absolute inline-flex h-full w-full rounded-full bg-emerald-500 dark:bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600 dark:bg-emerald-400" />
              </span>
              <RoleIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{profile.workspaceTitle}</span>
            </span>
            <p className="hidden xl:block text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Control concurrente sobre SIGA, SEACE y SIAF (sin reemplazarlos)
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Botón Buscador Rápido y Atajos (Ctrl+K) */}
            <button
              type="button"
              onClick={() => {
                detenerEsperaTour();
                setTourAbierto(false);
                setPaletteAbierta(true);
              }}
              className="btn-tactile inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold whitespace-nowrap"
              title="Buscador rápido y atajos (Ctrl+K)"
              aria-label="Abrir buscador rápido y atajos"
            >
              <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>Buscar</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-mono text-[10px] font-bold text-slate-500 dark:text-slate-300">
                Ctrl K
              </kbd>
            </button>

            {/* Selector Segmentado de Perfil RBAC en 1 Clic + Detalle de Permisos */}
            <div
              data-tour="session-switcher"
              role="group"
              aria-label="Selector rápido de rol RBAC"
              className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
            >
              {QUICK_ROLE_OPTIONS.map((item) => {
                const roleMeta = ROLE_PROFILES[item.id];
                const activo = rolActivo === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => handleSeleccionarRol(item.id)}
                    title={`${roleMeta.userCode} • ${roleMeta.shortLabel} (${roleMeta.badgeText})`}
                    className={`btn-tactile px-2.5 py-1 rounded-lg text-[11px] font-extrabold whitespace-nowrap ${
                      activo
                        ? item.activeClass
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}

              <span
                className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5"
                aria-hidden="true"
              />

              <button
                type="button"
                onClick={() => {
                  detenerEsperaTour();
                  setModalSesionAbierto(true);
                }}
                className="btn-tactile p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800"
                title="Ver detalle de permisos por perfil (RBAC)"
                aria-label="Detalle de roles RBAC"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Botón Guía Interactiva (Abrir guía contextual de la vista actual) */}
            <button
              type="button"
              onClick={abrirTourManual}
              className="btn-tactile inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold whitespace-nowrap"
              title="Iniciar guía interactiva paso a paso de esta sección"
            >
              <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Guía</span>
            </button>

            {/* Botón Toggle Modo Claro / Oscuro */}
            <button
              type="button"
              onClick={toggleTheme}
              className="btn-tactile inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold whitespace-nowrap"
              title={
                theme === 'light'
                  ? 'Cambiar a Modo Oscuro Forense'
                  : 'Cambiar a Modo Claro Institucional'
              }
              aria-label="Alternar modo claro y oscuro"
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-4 h-4 text-[#0B1F3A]" />
                  <span>Oscuro</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-amber-300" />
                  <span>Claro</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Banner destacado solo en Modo Portal Público de Transparencia */}
        {profile.isReadOnly && (
          <div className="px-6 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
            <span className="inline-flex items-center gap-2 font-semibold">
              <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Vista Pública de Transparencia (Ley N° 27806): acceso en modo solo lectura sobre datos anonimizados. Las funciones internas de dictamen y auditoría forense están ocultas.
            </span>
            <button
              type="button"
              onClick={() => setModalSesionAbierto(true)}
              className="font-bold underline hover:text-amber-700 dark:hover:text-amber-100"
            >
              Ingresar con perfil institucional
            </button>
          </div>
        )}

        {/* Contenido de la Página con Transición Fluida */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <div key={location.pathname} className="animate-page-enter">
            {children}
          </div>
        </main>
      </div>

      {/* Modal de Acceso Institucional / Cambio de Sesión (RBAC) */}
      <Modal
        isOpen={modalSesionAbierto}
        onClose={() => setModalSesionAbierto(false)}
        title="Acceso Institucional — Control de Roles (RBAC)"
        subtitle="Entorno simulado TRL-4: seleccione un perfil autenticado para demostrar los niveles de acceso diferenciados. En producción se integra con SSO / Directorio Institucional UNT."
      >
        <div className="space-y-3 text-xs">
          {ROLE_LIST.map((r) => {
            const activo = r.id === rolActivo;
            const CardIcon = r.canDictaminarOci
              ? ShieldCheck
              : r.canSubmitDescargo
              ? Briefcase
              : Eye;

            return (
              <div
                key={r.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  activo
                    ? 'bg-blue-50/70 dark:bg-slate-800/80 border-blue-500 dark:border-emerald-400 ring-1 ring-blue-500/30 dark:ring-emerald-400/30'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl border ${r.chipClass}`}>
                      <CardIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        {r.shortLabel}
                        <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {r.userCode}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {r.area}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSeleccionarRol(r.id)}
                    className={`btn-tactile px-3.5 py-2 rounded-xl text-xs font-bold ${
                      activo
                        ? 'bg-emerald-600 text-white cursor-default'
                        : 'bg-[#0B1F3A] hover:bg-[#14335D] dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950'
                    }`}
                  >
                    {activo ? 'Sesión Activa' : 'Ingresar con este perfil'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Permisos habilitados
                    </span>
                    {r.permisos.map((p) => (
                      <div
                        key={p}
                        className="flex items-start gap-1.5 text-[11px] text-slate-700 dark:text-slate-300"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                      Límites y restricciones
                    </span>
                    {r.restricciones.map((res) => (
                      <div
                        key={res}
                        className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-400"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span>{res}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* Paleta Global de Búsqueda Rápida y Atajos (Ctrl+K) */}
      <QuickCommandPalette
        isOpen={paletteAbierta}
        onClose={() => setPaletteAbierta(false)}
        rolActivo={rolActivo}
      />

      {/* Recorrido Guiado Interactivo Contextual por Sección y Menú General */}
      <OnboardingTour
        isOpen={tourAbierto}
        initialMode={tourMode}
        onClose={cerrarTour}
        onSkipAll={silenciarTodosLosTours}
      />
    </div>
  );
};
