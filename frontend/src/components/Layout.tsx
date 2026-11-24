import React, { useEffect, useState } from 'react';
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
  LogOut,
  CheckCircle2,
  XCircle,
  Scale,
  Eye,
  Briefcase,
  ShieldCheck,
  History,
} from 'lucide-react';
import { RolUsuario } from '../types';
import { useTheme } from '../context/ThemeContext';
import { ROLE_LIST, ROLE_PROFILES } from '../config/roles';
import { Modal } from './Modal';
import { centinelaApi } from '../api/client';

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
  const [alertasPendientes, setAlertasPendientes] = useState<number>(0);

  useEffect(() => {
    centinelaApi
      .getDashboardKPIs()
      .then((d) => setAlertasPendientes(d.alertas_pendientes))
      .catch(() => {});
  }, [location.pathname, rolActivo]);

  const navItems = [
    {
      to: '/',
      label: profile.isReadOnly
        ? 'Resumen Público'
        : profile.canSubmitDescargo
        ? 'Panel Operativo'
        : 'Resumen General',
      sub: profile.isReadOnly
        ? 'Indicadores y datos abiertos'
        : 'Indicadores y ahorro',
      icon: LayoutDashboard,
      visible: true,
      badge: undefined as number | undefined,
    },
    {
      to: '/compliance',
      label: profile.canSubmitDescargo ? 'Descargos Pendientes' : 'Alertas y Descargos',
      sub: profile.canSubmitDescargo
        ? 'Responder y subsanar'
        : 'Revisión y seguimiento',
      icon: BellRing,
      visible: !profile.isReadOnly,
      badge: alertasPendientes > 0 ? alertasPendientes : undefined,
    },
    {
      to: '/expedientes',
      label: 'Expedientes',
      sub: profile.isReadOnly
        ? 'Padrón público anonimizado'
        : 'Buscar y evaluar procesos',
      icon: FolderSearch,
      visible: true,
      badge: undefined,
    },
    {
      to: '/trazabilidad',
      label: 'Historial e Integridad',
      sub: 'Cadena documental y TDR',
      icon: Link2,
      visible: true,
      badge: undefined,
    },
    {
      to: '/grafo-colusion',
      label: 'Red de Proveedores',
      sub: 'Vínculos y posible colusión',
      icon: Network,
      visible: !profile.isReadOnly,
      badge: undefined,
    },
    {
      to: '/auditoria',
      label: 'Bitácora de Auditoría',
      sub: 'Quién hizo qué y cuándo',
      icon: History,
      visible: profile.canDictaminarOci,
      badge: undefined,
    },
  ].filter((item) => item.visible);

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
      {/* Sidebar con Identidad Dinámica por Rol */}
      <aside
        className={`w-72 ${profile.sidebarBgLight} border-r ${profile.sidebarBorderLight} text-slate-100 flex flex-col justify-between shrink-0 shadow-lg dark:shadow-none transition-colors duration-300`}
      >
        <div>
          {/* Branding CENTINELA */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg ${
                  profile.canDictaminarOci
                    ? 'bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-emerald-500/20'
                    : profile.canSubmitDescargo
                    ? 'bg-gradient-to-br from-blue-400 to-cyan-400 shadow-blue-500/20'
                    : 'bg-gradient-to-br from-amber-400 to-orange-400 shadow-amber-500/20'
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
              <div className="min-w-0 leading-tight">
                <div className="text-xs font-bold text-white truncate">
                  {profile.shortLabel}
                </div>
                <div className="text-[10px] text-white/65 truncate">{profile.area}</div>
              </div>
            </div>

            {/* Badges Normativos */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="px-2.5 py-1.5 rounded-lg bg-black/20 border border-white/10 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <span className="text-[11px] font-semibold text-white/85">
                  Ley N° 32069
                </span>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-black/20 border border-white/10 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                <span className="text-[11px] font-semibold text-white/85">
                  Ley N° 29733
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
                  className={({ isActive }) =>
                    `flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                      isActive
                        ? `${profile.activeNavClass} border`
                        : 'text-white/75 hover:text-white hover:bg-white/10 border border-transparent'
                    }`
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-5 h-5 shrink-0" />
                    <div className="leading-tight min-w-0">
                      <div className="text-sm font-semibold truncate">{item.label}</div>
                      <div className="text-[11px] text-white/55 truncate">{item.sub}</div>
                    </div>
                  </div>
                  {item.badge !== undefined && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono text-[11px] font-bold shrink-0">
                      {item.badge}
                    </span>
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
        {/* Topbar Institucional con Sesión Autenticada + Toggle Claro/Oscuro */}
        <header className="px-6 py-2.5 bg-white/95 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 sticky top-0 z-30 shadow-sm dark:shadow-none">
          <div className="min-w-0 flex items-center gap-2.5 overflow-hidden">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold min-w-0 max-w-full ${profile.accentBarClass}`}
              title={profile.workspaceTitle}
            >
              <RoleIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{profile.workspaceTitle}</span>
            </span>
            <p className="hidden 2xl:block text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Capa externa no intrusiva (no reemplaza SEACE/SIGA/SIAF)
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Tarjeta de Usuario Autenticado + Botón Cambiar Sesión */}
            <div
              className={`flex items-center gap-2.5 pl-3 pr-1.5 py-1 rounded-xl border ${profile.chipClass}`}
            >
              <div className="leading-tight">
                <div className="text-xs font-extrabold flex items-center gap-1.5">
                  <span className="font-mono">{profile.userCode}</span>
                  <span className="opacity-50">•</span>
                  <span>{profile.shortLabel}</span>
                </div>
                <div className="text-[10px] opacity-75">{profile.badgeText}</div>
              </div>
              <button
                type="button"
                onClick={() => setModalSesionAbierto(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/90 hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-100 border border-black/10 dark:border-white/10 text-[11px] font-bold transition whitespace-nowrap"
                title="Cambiar perfil de sesión institucional (Demo RBAC)"
              >
                <LogOut className="w-3.5 h-3.5" />
                Cambiar sesión
              </button>
            </div>

            {/* Botón Toggle Modo Claro / Oscuro */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition whitespace-nowrap"
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

        {/* Contenido de la Página */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">{children}</main>
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
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
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
    </div>
  );
};
