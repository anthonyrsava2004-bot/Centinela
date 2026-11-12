import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  FolderSearch,
  Link2,
  Network,
  Scale,
  Lock,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { RolUsuario } from '../types';

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
  const navItems = [
    {
      to: '/',
      label: 'Dashboard Ejecutivo',
      sub: 'KPIs & Ahorro Preventivo',
      icon: LayoutDashboard,
    },
    {
      to: '/expedientes',
      label: 'Expedientes (120)',
      sub: 'Buscador & Riesgo XAI',
      icon: FolderSearch,
    },
    {
      to: '/trazabilidad',
      label: 'Trazabilidad Forense',
      sub: 'Cadena SHA-256 & NLP TDR',
      icon: Link2,
    },
    {
      to: '/grafo-colusion',
      label: 'Grafo de Colusión',
      sub: 'NetworkX + Cytoscape',
      icon: Network,
    },
    {
      to: '/compliance',
      label: 'Bandeja Compliance XAI',
      sub: 'Descargos & Dictamen OCI',
      icon: Scale,
    },
  ];

  const esAuditor = rolActivo.startsWith('Auditor OCI');

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      {/* Sidebar Fijo */}
      <aside className="w-72 bg-slate-900/95 border-r border-slate-800/90 flex flex-col justify-between shrink-0">
        <div>
          {/* Branding CENTINELA */}
          <div className="p-6 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Shield className="w-6 h-6 text-slate-950 stroke-[2.3]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-extrabold tracking-tight text-white">
                    CENTINELA
                  </span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    TRL-4
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  Auditoría Forense & XAI GovTech
                </p>
              </div>
            </div>

            {/* Badges Normativos */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-800 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-300">
                  Ley N° 32069
                </span>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-800 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-300">
                  Ley N° 29733
                </span>
              </div>
            </div>
          </div>

          {/* Menú de Navegación */}
          <nav className="p-4 space-y-1.5">
            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Módulos de Integridad
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/10 text-emerald-300 border border-emerald-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <div className="leading-tight">
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="text-[11px] text-slate-500">{item.sub}</div>
                  </div>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer de Privacidad por Diseño */}
        <div className="p-4 m-4 rounded-xl bg-slate-950/90 border border-slate-800/90 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
            <Sparkles className="w-4 h-4" />
            Privacidad por Diseño Activa
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Identidades protegidas mediante seudonimización funcional (
            <code className="text-cyan-300 font-mono">FUNC-*</code>,{' '}
            <code className="text-cyan-300 font-mono">PROV-SYN-*</code>) en
            cumplimiento de la Ley N° 29733 y presunción de licitud (Ley N°
            27444).
          </p>
          <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Innova Norte 3G</span>
            <span>UNT • Desafío 2</span>
          </div>
        </div>
      </aside>

      {/* Contenedor Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar Institucional con Selector de Rol */}
        <header className="h-18 px-8 py-3.5 bg-slate-900/75 backdrop-blur-md border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Nodo Criptográfico SHA-256 & Motor XAI En Línea
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              D.S. N° 009-2025-EF (Reglamento Ley N° 32069) • Señales preventivas no punitivas sujetas a revisión humana
            </p>
          </div>

          {/* Selector Rápido de Rol */}
          <div className="flex items-center gap-3 bg-slate-950/90 p-1.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1.5 pl-2.5 pr-1 text-xs font-semibold text-slate-400">
              <UserCheck className="w-4 h-4 text-cyan-400" />
              <span>Rol Activo:</span>
            </div>
            <button
              type="button"
              onClick={() => setRolActivo('Auditor OCI (Control Institucional)')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                esAuditor
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Auditor OCI
            </button>
            <button
              type="button"
              onClick={() => setRolActivo('Especialista Logística (DEC)')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                !esAuditor
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Especialista Logística
            </button>
          </div>
        </header>

        {/* Contenido de la Página */}
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};
