import axios from 'axios';
import {
  AlertaGestion,
  AuditLogResumen,
  ConflictoInteresItem,
  DashboardKPIs,
  DenunciaConsultaPublica,
  DenunciaItem,
  DenunciaResumenPublico,
  EntregableTdrItem,
  ExpedienteCreatePayload,
  ExpedienteDetalle,
  ExpedienteListItem,
  GrafoColusionData,
  MapaRiesgosData,
  ProveedorItem,
  ReporteValidacion,
  RolUsuario,
  VerificacionCadena,
} from '../types';
import { ROLE_PROFILES } from '../config/roles';

const rawBaseUrl =
  import.meta.env.VITE_API_URL !== undefined
    ? import.meta.env.VITE_API_URL
    : import.meta.env.DEV
    ? 'http://localhost:8000'
    : '';
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

function toAsciiRoleHeader(rol: RolUsuario): string {
  if (rol.startsWith('Auditor OCI')) return 'AUDITOR_OCI';
  if (rol.startsWith('Especialista Logística')) return 'ESPECIALISTA_DEC';
  return 'CONSULTA_TRANSPARENCIA';
}

function getActiveActor(): { rol: RolUsuario; roleCode: string; usuario: string } {
  try {
    const saved = localStorage.getItem('centinela-rol') as RolUsuario | null;
    if (saved && saved in ROLE_PROFILES) {
      return {
        rol: saved,
        roleCode: toAsciiRoleHeader(saved),
        usuario: ROLE_PROFILES[saved].userCode,
      };
    }
  } catch {
    // Ignore storage access issues
  }
  const defaultRol: RolUsuario = 'Auditor OCI (Control Institucional)';
  return {
    rol: defaultRol,
    roleCode: 'AUDITOR_OCI',
    usuario: ROLE_PROFILES[defaultRol].userCode,
  };
}

function buildAuditQuery(): string {
  const { roleCode, usuario } = getActiveActor();
  const params = new URLSearchParams({ usuario, rol: roleCode });
  return params.toString();
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const { roleCode, usuario } = getActiveActor();
  if (!config.headers['X-Centinela-Role']) {
    config.headers['X-Centinela-Role'] = roleCode;
  }
  if (!config.headers['X-Centinela-User']) {
    config.headers['X-Centinela-User'] = usuario;
  }
  return config;
});

export const centinelaApi = {
  getDashboardKPIs: async (): Promise<DashboardKPIs> => {
    const { data } = await apiClient.get<DashboardKPIs>('/api/dashboard');
    return data;
  },

  regenerarDataset: async (): Promise<{ mensaje: string; total_expedientes: number }> => {
    const { data } = await apiClient.post('/api/seed/regenerar');
    return data;
  },

  listarExpedientes: async (params?: {
    busqueda?: string;
    nivel_riesgo?: string;
    integridad?: string;
    solo_trampas?: boolean;
  }): Promise<ExpedienteListItem[]> => {
    const { data } = await apiClient.get<ExpedienteListItem[]>('/api/expedientes', {
      params,
    });
    return data;
  },

  obtenerExpedienteDetalle: async (id: number): Promise<ExpedienteDetalle> => {
    const { data } = await apiClient.get<ExpedienteDetalle>(`/api/expedientes/${id}`);
    return data;
  },

  simularAlteracionExPost: async (
    expedienteId: number,
    etapaObjetivo: string = 'Cotizaciones',
  ): Promise<VerificacionCadena> => {
    const { data } = await apiClient.post<VerificacionCadena>(
      `/api/expedientes/${expedienteId}/simular-alteracion`,
      { etapa_objetivo: etapaObjetivo },
    );
    return data;
  },

  restaurarIntegridad: async (expedienteId: number): Promise<VerificacionCadena> => {
    const { data } = await apiClient.post<VerificacionCadena>(
      `/api/expedientes/${expedienteId}/restaurar-integridad`,
    );
    return data;
  },

  obtenerUrlReportePdf: (expedienteId: number): string => {
    return `${API_BASE_URL}/api/expedientes/${expedienteId}/reporte-pdf?${buildAuditQuery()}`;
  },

  obtenerUrlReporteInstitucionalPdf: (): string => {
    return `${API_BASE_URL}/api/reportes/institucional-pdf?${buildAuditQuery()}`;
  },

  obtenerUrlIndicadoresCsv: (): string => {
    return `${API_BASE_URL}/api/reportes/indicadores-csv?${buildAuditQuery()}`;
  },

  obtenerUrlAuditoriaCsv: (): string => {
    return `${API_BASE_URL}/api/auditoria/csv?${buildAuditQuery()}`;
  },

  listarProveedores: async (): Promise<ProveedorItem[]> => {
    const { data } = await apiClient.get<ProveedorItem[]>('/api/proveedores');
    return data;
  },

  registrarExpedienteVivo: async (
    payload: ExpedienteCreatePayload,
  ): Promise<ExpedienteDetalle> => {
    const { data } = await apiClient.post<ExpedienteDetalle>(
      '/api/expedientes/simular-registro',
      payload,
    );
    return data;
  },

  obtenerGrafoColusion: async (soloRiesgo: boolean = true): Promise<GrafoColusionData> => {
    const { data } = await apiClient.get<GrafoColusionData>('/api/grafo-colusion', {
      params: { solo_riesgo: soloRiesgo },
    });
    return data;
  },

  listarAlertas: async (params?: {
    estado_revision?: string;
    categoria?: string;
  }): Promise<AlertaGestion[]> => {
    const { data } = await apiClient.get<AlertaGestion[]>('/api/alertas', { params });
    return data;
  },

  actualizarAlerta: async (
    alertaId: number,
    payload: {
      estado_revision: string;
      comentario_descargo: string;
      rol_usuario: string;
      area_asignada?: string;
      accion_correctiva?: string;
      fecha_limite?: string;
    },
  ): Promise<AlertaGestion> => {
    const { data } = await apiClient.patch<AlertaGestion>(
      `/api/alertas/${alertaId}`,
      payload,
    );
    return data;
  },

  obtenerAuditoria: async (params?: {
    resultado?: string;
    accion?: string;
    busqueda?: string;
  }): Promise<AuditLogResumen> => {
    const { data } = await apiClient.get<AuditLogResumen>('/api/auditoria', { params });
    return data;
  },

  simularIntentoNoAutorizado: async (): Promise<void> => {
    try {
      await apiClient.patch(
        '/api/alertas/1',
        {
          estado_revision: 'ARCHIVADA_SUSTENTADA',
          comentario_descargo: 'Intento no autorizado simulado de auto-archivo desde DEC.',
          rol_usuario: 'Especialista Logística (DEC)',
        },
        {
          headers: {
            'X-Centinela-Role': 'ESPECIALISTA_DEC',
            'X-Centinela-User': 'FUNC-DEC-02',
          },
        },
      );
    } catch {
      // Se espera HTTP 403 y el backend ya registró el evento BLOQUEADO_403 en la bitácora
    }
  },

  obtenerMapaRiesgos: async (): Promise<MapaRiesgosData> => {
    const { data } = await apiClient.get<MapaRiesgosData>('/api/mapa-riesgos');
    return data;
  },

  verificarEntregableTdr: async (
    entregableId: number,
    payload: { cumplido: boolean; evidencia_tecnica: string; rol_usuario?: string },
  ): Promise<EntregableTdrItem> => {
    const { data } = await apiClient.patch<EntregableTdrItem>(
      `/api/entregables/${entregableId}/verificar`,
      payload,
    );
    return data;
  },

  listarConflictosInteres: async (): Promise<ConflictoInteresItem[]> => {
    const { data } = await apiClient.get<ConflictoInteresItem[]>('/api/conflictos-interes');
    return data;
  },

  declararConflictoInteres: async (payload: {
    expediente_id: number;
    funcionario_codigo: string;
    proveedor_vinculado_codigo: string;
    tipo_vinculo: string;
    descripcion: string;
    abstenerse_de_inmediato: boolean;
    funcionario_reasignado?: string;
  }): Promise<ConflictoInteresItem> => {
    const { data } = await apiClient.post<ConflictoInteresItem>(
      '/api/conflictos-interes',
      payload,
    );
    return data;
  },

  abstenerYReasignarConflicto: async (
    conflictoId: number,
    payload: { funcionario_reasignado: string; comentario?: string },
  ): Promise<ConflictoInteresItem> => {
    const { data } = await apiClient.patch<ConflictoInteresItem>(
      `/api/conflictos-interes/${conflictoId}/abstener-reasignar`,
      payload,
    );
    return data;
  },

  obtenerResumenDenuncias: async (): Promise<DenunciaResumenPublico> => {
    const { data } = await apiClient.get<DenunciaResumenPublico>('/api/denuncias/resumen');
    return data;
  },

  consultarDenunciaPorCodigo: async (codigo: string): Promise<DenunciaConsultaPublica> => {
    const { data } = await apiClient.get<DenunciaConsultaPublica>(
      `/api/denuncias/consultar/${encodeURIComponent(codigo.trim())}`,
    );
    return data;
  },

  registrarDenunciaReservada: async (payload: {
    categoria: string;
    area_involucrada: string;
    expediente_codigo?: string;
    descripcion_hechos: string;
    sustento_verificable: string;
    solicita_proteccion: boolean;
  }): Promise<DenunciaConsultaPublica> => {
    const { data } = await apiClient.post<DenunciaConsultaPublica>('/api/denuncias', payload);
    return data;
  },

  listarDenunciasConfidenciales: async (): Promise<DenunciaItem[]> => {
    const { data } = await apiClient.get<DenunciaItem[]>('/api/denuncias');
    return data;
  },

  gestionarDenunciaReservada: async (
    denunciaId: number,
    payload: {
      estado: string;
      organo_derivado: string;
      medida_proteccion: string;
      fecha_limite_sla?: string;
      respuesta_seguimiento: string;
      nota_interna_oci: string;
    },
  ): Promise<DenunciaItem> => {
    const { data } = await apiClient.patch<DenunciaItem>(
      `/api/denuncias/${denunciaId}`,
      payload,
    );
    return data;
  },

  obtenerReporteValidacion: async (): Promise<ReporteValidacion> => {
    const { data } = await apiClient.get<ReporteValidacion>('/api/validacion');
    return data;
  },
};
