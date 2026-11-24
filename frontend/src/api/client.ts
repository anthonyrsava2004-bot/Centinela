import axios from 'axios';
import {
  AlertaGestion,
  DashboardKPIs,
  ExpedienteCreatePayload,
  ExpedienteDetalle,
  ExpedienteListItem,
  GrafoColusionData,
  ProveedorItem,
  VerificacionCadena,
} from '../types';

const rawBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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
    return `${API_BASE_URL}/api/expedientes/${expedienteId}/reporte-pdf`;
  },

  obtenerUrlReporteInstitucionalPdf: (): string => {
    return `${API_BASE_URL}/api/reportes/institucional-pdf`;
  },

  obtenerUrlIndicadoresCsv: (): string => {
    return `${API_BASE_URL}/api/reportes/indicadores-csv`;
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
};
