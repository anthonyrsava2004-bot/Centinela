import { RolUsuario } from '../types';

export interface RoleProfile {
  id: RolUsuario;
  shortLabel: string;
  userCode: string;
  area: string;
  workspaceTitle: string;
  workspaceSubtitle: string;
  badgeText: string;
  sidebarBgLight: string;
  sidebarBorderLight: string;
  accentBarClass: string;
  chipClass: string;
  activeNavClass: string;
  permisos: string[];
  restricciones: string[];
  canRegenerateDataset: boolean;
  canSimulateTamper: boolean;
  canRegisterExpediente: boolean;
  canDictaminarOci: boolean;
  canSubmitDescargo: boolean;
  isReadOnly: boolean;
}

export const ROLE_PROFILES: Record<RolUsuario, RoleProfile> = {
  'Auditor OCI (Control Institucional)': {
    id: 'Auditor OCI (Control Institucional)',
    shortLabel: 'Auditor OCI',
    userCode: 'FUNC-OCI-01',
    area: 'Órgano de Control Institucional',
    workspaceTitle: 'Espacio de Control Institucional (OCI)',
    workspaceSubtitle: 'Control preventivo, auditoría forense SHA-256, derivación de alertas y dictámenes.',
    badgeText: 'Control & Dictamen',
    sidebarBgLight: 'bg-[#0B1F3A] dark:bg-slate-900/95',
    sidebarBorderLight: 'border-[#16335B] dark:border-slate-800/90',
    accentBarClass:
      'bg-emerald-600/10 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    chipClass:
      'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/40',
    activeNavClass:
      'bg-emerald-500/20 text-white border-emerald-400/60 shadow-sm',
    permisos: [
      'Derivar alertas a áreas responsables y fijar plazos SLA',
      'Validar alertas (Hito de Control) o archivar con sustento',
      'Ejecutar pruebas de integridad criptográfica SHA-256',
      'Auditar red de proveedores vinculados y exportar reportes',
    ],
    restricciones: [
      'Datos personales protegidos por seudonimización (Ley N° 29733)',
    ],
    canRegenerateDataset: true,
    canSimulateTamper: true,
    canRegisterExpediente: true,
    canDictaminarOci: true,
    canSubmitDescargo: false,
    isReadOnly: false,
  },
  'Especialista Logística (DEC)': {
    id: 'Especialista Logística (DEC)',
    shortLabel: 'Especialista DEC',
    userCode: 'FUNC-DEC-02',
    area: 'Dependencia Encargada de Contrataciones',
    workspaceTitle: 'Espacio Operativo de Contrataciones (DEC)',
    workspaceSubtitle: 'Registro de expedientes, evaluación preventiva de TDR y presentación de descargos técnicos.',
    badgeText: 'Gestión & Descargos',
    sidebarBgLight: 'bg-[#172554] dark:bg-[#0F172A]',
    sidebarBorderLight: 'border-blue-900 dark:border-blue-900/70',
    accentBarClass:
      'bg-blue-600/10 text-blue-800 border-blue-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30',
    chipClass:
      'bg-blue-50 text-blue-900 border-blue-200 dark:bg-cyan-500/15 dark:text-cyan-200 dark:border-cyan-500/40',
    activeNavClass:
      'bg-cyan-500/20 text-white border-cyan-400/60 shadow-sm',
    permisos: [
      'Registrar nuevos expedientes y validar TDR antes de adjudicar',
      'Presentar descargos técnicos y planes de acción correctiva',
      'Consultar historial documental y reportes de sus procesos',
    ],
    restricciones: [
      'No puede validar ni auto-archivar alertas (exclusivo OCI)',
      'No puede ejecutar pruebas de alteración forense ni reiniciar la base',
    ],
    canRegenerateDataset: false,
    canSimulateTamper: false,
    canRegisterExpediente: true,
    canDictaminarOci: false,
    canSubmitDescargo: true,
    isReadOnly: false,
  },
  'Consulta Transparencia (Solo Lectura)': {
    id: 'Consulta Transparencia (Solo Lectura)',
    shortLabel: 'Transparencia',
    userCode: 'CIUD-PUB-00',
    area: 'Portal de Transparencia (Ley N° 27806)',
    workspaceTitle: 'Portal Público de Transparencia — Solo Lectura',
    workspaceSubtitle: 'Consulta abierta de indicadores agregados, trazabilidad anonimizada y datos abiertos.',
    badgeText: 'Solo Lectura',
    sidebarBgLight: 'bg-[#1E293B] dark:bg-slate-900',
    sidebarBorderLight: 'border-slate-700 dark:border-amber-900/50',
    accentBarClass:
      'bg-amber-500/15 text-amber-900 border-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/40',
    chipClass:
      'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/40',
    activeNavClass:
      'bg-amber-400/20 text-white border-amber-400/70 shadow-sm',
    permisos: [
      'Consultar indicadores agregados de integridad institucional',
      'Descargar Reporte Institucional (PDF) y Datos Abiertos (CSV)',
      'Inspeccionar trazabilidad anonimizada de expedientes públicos',
    ],
    restricciones: [
      'Sin permisos de registro, edición, descargo ni dictamen (Solo Lectura)',
      'Sin acceso a herramientas internas de control forense',
    ],
    canRegenerateDataset: false,
    canSimulateTamper: false,
    canRegisterExpediente: false,
    canDictaminarOci: false,
    canSubmitDescargo: false,
    isReadOnly: true,
  },
};

export const ROLE_LIST: RoleProfile[] = [
  ROLE_PROFILES['Auditor OCI (Control Institucional)'],
  ROLE_PROFILES['Especialista Logística (DEC)'],
  ROLE_PROFILES['Consulta Transparencia (Solo Lectura)'],
];
