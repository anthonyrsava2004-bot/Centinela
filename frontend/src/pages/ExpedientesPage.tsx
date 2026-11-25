import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  FileSearch,
  FileDown,
  RefreshCw,
  ShieldAlert,
  PlusCircle,
  Eye,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { centinelaApi } from '../api/client';
import {
  ExpedienteListItem,
  ProveedorItem,
  RolUsuario,
} from '../types';
import { IntegrityBadge, RiskBadge } from '../components/AlertBadge';
import { Modal } from '../components/Modal';
import { formatTipologia } from '../utils/formatters';
import { ROLE_PROFILES } from '../config/roles';

interface ExpedientesPageProps {
  rolActivo: RolUsuario;
}

const RUBROS_DISPONIBLES = [
  'Tecnología y Equipamiento Computacional',
  'Equipamiento Científico y de Laboratorio',
  'Infraestructura y Mantenimiento Eléctrico',
  'Mobiliario Académico y Administrativo',
  'Suministros Médicos y Bioseguridad',
  'Servicios de Conectividad y Ciberseguridad',
];

const AREAS_DISPONIBLES = [
  'AREA-TI-03',
  'AREA-LAB-02',
  'AREA-INFRA-01',
  'AREA-ACAD-01',
  'AREA-BIB-02',
  'AREA-ADM-04',
];

const MODALIDADES_DISPONIBLES = [
  'Contratación Menor (<= 8 UIT)',
  'Licitación Pública Abreviada',
  'Concurso Público Abreviado',
];

export const ExpedientesPage: React.FC<ExpedientesPageProps> = ({ rolActivo }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const profile = ROLE_PROFILES[rolActivo];
  const esSoloLectura = profile.isReadOnly;

  const [expedientes, setExpedientes] = useState<ExpedienteListItem[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busqueda, setBusqueda] = useState<string>('');
  const [nivelRiesgo, setNivelRiesgo] = useState<string>('TODOS');
  const [integridad, setIntegridad] = useState<string>('TODAS');
  const [soloTrampas, setSoloTrampas] = useState<boolean>(false);

  // Modal de Registro y Auditoría en Vivo
  const [modalAbierto, setModalAbierto] = useState<boolean>(false);
  const [creando, setCreando] = useState<boolean>(false);
  const [errorRegistro, setErrorRegistro] = useState<string | null>(null);

  const [objeto, setObjeto] = useState<string>(
    'Adquisición de Estaciones de Trabajo Estándar para Laboratorio de Innovación',
  );
  const [rubro, setRubro] = useState<string>(RUBROS_DISPONIBLES[0]);
  const [areaUsuaria, setAreaUsuaria] = useState<string>('AREA-ACAD-01');
  const [modalidad, setModalidad] = useState<string>(MODALIDADES_DISPONIBLES[1]);
  const [montoEstimado, setMontoEstimado] = useState<string>('85000');
  const [fechaCreacion, setFechaCreacion] = useState<string>('2025-04-10T09:00:00');
  const [provGanador, setProvGanador] = useState<string>('PROV-SYN-001');
  const [provSegundo, setProvSegundo] = useState<string>('PROV-SYN-002');
  const [tdrTexto, setTdrTexto] = useState<string>(
    'Especificaciones técnicas neutrales para adquisición de estaciones de trabajo con procesadores multinúcleo estándar, garantía comercial de 24 meses y pluralidad de marcas verificada.',
  );
  const [mismoFuncionario, setMismoFuncionario] = useState<boolean>(false);
  const [pagoSinConformidad, setPagoSinConformidad] = useState<boolean>(false);
  const [modExtemporaneaTdr, setModExtemporaneaTdr] = useState<boolean>(false);
  const [sinSustentoDoc, setSinSustentoDoc] = useState<boolean>(false);
  const [entregableIncompletoObra, setEntregableIncompletoObra] = useState<boolean>(false);
  const [conflictoInteresFamiliar, setConflictoInteresFamiliar] = useState<boolean>(false);

  const cargarExpedientes = async () => {
    try {
      setLoading(true);
      const data = await centinelaApi.listarExpedientes({
        busqueda: busqueda || undefined,
        nivel_riesgo: nivelRiesgo !== 'TODOS' ? nivelRiesgo : undefined,
        integridad: integridad !== 'TODAS' ? integridad : undefined,
        solo_trampas: soloTrampas,
      });
      setExpedientes(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    centinelaApi.listarProveedores().then(setProveedores).catch(() => {});
  }, []);

  useEffect(() => {
    if (searchParams.get('nuevo') === '1' && !esSoloLectura) {
      setModalAbierto(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, esSoloLectura]);

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarExpedientes();
    }, 180);
    return () => clearTimeout(timer);
  }, [busqueda, nivelRiesgo, integridad, soloTrampas]);

  const aplicarPlantilla = (tipo: string) => {
    setErrorRegistro(null);
    if (tipo === 'LIMPIO') {
      setObjeto('Adquisición de Mobiliario Ergonómico Certificado para Biblioteca Central');
      setRubro('Mobiliario Académico y Administrativo');
      setAreaUsuaria('AREA-BIB-02');
      setModalidad('Licitación Pública Abreviada');
      setMontoEstimado('68500');
      setFechaCreacion('2025-05-12T09:00:00');
      setProvGanador('PROV-SYN-001');
      setProvSegundo('PROV-SYN-002');
      setTdrTexto(
        'Especificaciones técnicas genéricas para mobiliario ergonómico institucional con certificación ergonómica abierta, pluralidad de marcas y garantía mínima de 24 meses.',
      );
      setMismoFuncionario(false);
      setPagoSinConformidad(false);
      setModExtemporaneaTdr(false);
      setSinSustentoDoc(false);
      setEntregableIncompletoObra(false);
      setConflictoInteresFamiliar(false);
    } else if (tipo === 'CASO_1_PROYECTORES') {
      setObjeto('Caso 1 UNT — Adquisición de Proyectores Multimedia para Laboratorios (Orden Adicional en 10 días)');
      setRubro('Tecnología y Equipamiento Computacional');
      setAreaUsuaria('AREA-TI-03');
      setModalidad('Contratación Menor (<= 8 UIT)');
      setMontoEstimado('40200');
      setFechaCreacion('2025-02-14T10:00:00');
      setProvGanador('PROV-SYN-014');
      setProvSegundo('PROV-SYN-001');
      setTdrTexto(
        'Solución exclusiva de identificación biométrica con arquitectura propietaria BioCore-X99 Quantum, equipada con sensor multiespectral NanoVein-770 de lectura subcutánea infrarroja a 940nm, protocolo cerrado de sincronización encriptada SyncLock-UNT v4.8, chasis blindado en aleación de magnesio anodizado IP69K serie Z-940 con procesador neuronal embebido TensorEdge-Pro 16 TOPS, fuente redundante HotSwap-550W y licencia perpetua del motor propietario OmniTrack-Enterprise.',
      );
      setMismoFuncionario(false);
      setPagoSinConformidad(false);
      setModExtemporaneaTdr(false);
      setSinSustentoDoc(false);
      setEntregableIncompletoObra(false);
      setConflictoInteresFamiliar(true);
    } else if (tipo === 'CASO_2_AULAS') {
      setObjeto('Caso 2 UNT — Renovación del Sistema Eléctrico y Pintado de 8 Aulas (Sin Pruebas de Pozo a Tierra)');
      setRubro('Infraestructura y Mantenimiento Eléctrico');
      setAreaUsuaria('AREA-INFRA-01');
      setModalidad('Concurso Público Abreviado');
      setMontoEstimado('136400');
      setFechaCreacion('2025-04-22T09:15:00');
      setProvGanador('PROV-SYN-015');
      setProvSegundo('PROV-SYN-018');
      setTdrTexto(
        'Renovación integral del sistema eléctrico y pintado general de 8 aulas académicas con 3 entregables obligatorios: diagnóstico técnico, instalación de tableros con pruebas de pozo a tierra y pintado general.',
      );
      setMismoFuncionario(false);
      setPagoSinConformidad(false);
      setModExtemporaneaTdr(false);
      setSinSustentoDoc(false);
      setEntregableIncompletoObra(true);
      setConflictoInteresFamiliar(false);
    } else if (tipo === 'TDR_COPIADO') {
      setObjeto('Adquisición de Controladores Biométricos Avanzados para Campus Universitario');
      setRubro('Tecnología y Equipamiento Computacional');
      setAreaUsuaria('AREA-TI-03');
      setModalidad('Licitación Pública Abreviada');
      setMontoEstimado('164000');
      setFechaCreacion('2025-04-15T09:00:00');
      setProvGanador('PROV-SYN-014');
      setProvSegundo('PROV-SYN-001');
      setTdrTexto(
        'Solución exclusiva de identificación biométrica con arquitectura propietaria BioCore-X99 Quantum, equipada con sensor multiespectral NanoVein-770 de lectura subcutánea infrarroja a 940nm, protocolo cerrado de sincronización encriptada SyncLock-UNT v4.8, chasis blindado en aleación de magnesio anodizado IP69K serie Z-940 con procesador neuronal embebido TensorEdge-Pro 16 TOPS, fuente redundante HotSwap-550W y licencia perpetua del motor propietario OmniTrack-Enterprise.',
      );
      setMismoFuncionario(false);
      setPagoSinConformidad(false);
      setModExtemporaneaTdr(false);
      setSinSustentoDoc(false);
      setEntregableIncompletoObra(false);
      setConflictoInteresFamiliar(false);
    } else if (tipo === 'FRACCIONAMIENTO') {
      setObjeto('Adquisición de Módulos de Almacenamiento SAN - Lote IV Adicional');
      setRubro('Tecnología y Equipamiento Computacional');
      setAreaUsuaria('AREA-TI-03');
      setModalidad('Contratación Menor (<= 8 UIT)');
      setMontoEstimado('39800');
      setFechaCreacion('2025-02-22T09:30:00');
      setProvGanador('PROV-SYN-014');
      setProvSegundo('PROV-SYN-001');
      setTdrTexto(
        'Requerimiento técnico para adquisición complementaria de discos sólidos empresariales con compatibilidad abierta y garantía estándar de 24 meses.',
      );
      setMismoFuncionario(false);
      setPagoSinConformidad(false);
      setModExtemporaneaTdr(false);
      setSinSustentoDoc(false);
      setEntregableIncompletoObra(false);
      setConflictoInteresFamiliar(false);
    } else if (tipo === 'VERSION_EXTEMPORANEA') {
      setObjeto('Servicio de Modernización de Subestación Eléctrica - Pabellón Central');
      setRubro('Infraestructura y Mantenimiento Eléctrico');
      setAreaUsuaria('AREA-INFRA-01');
      setModalidad('Concurso Público Abreviado');
      setMontoEstimado('132500');
      setFechaCreacion('2025-04-18T09:00:00');
      setProvGanador('PROV-SYN-012');
      setProvSegundo('PROV-SYN-018');
      setTdrTexto(
        'Servicio de mantenimiento y modernización eléctrica con tableros certificados bajo Código Nacional de Electricidad y pruebas de aislamiento.',
      );
      setMismoFuncionario(false);
      setPagoSinConformidad(false);
      setModExtemporaneaTdr(true);
      setSinSustentoDoc(true);
      setEntregableIncompletoObra(false);
      setConflictoInteresFamiliar(false);
    } else if (tipo === 'COLUSION_Y_PAGO') {
      setObjeto('Adquisición de Equipos Analizadores de Calidad de Agua para Laboratorio');
      setRubro('Equipamiento Científico y de Laboratorio');
      setAreaUsuaria('AREA-LAB-02');
      setModalidad('Licitación Pública Abreviada');
      setMontoEstimado('195000');
      setFechaCreacion('2025-04-20T09:00:00');
      setProvGanador('PROV-SYN-004');
      setProvSegundo('PROV-SYN-005');
      setTdrTexto(
        'Equipos multiparamétricos estándar para análisis fisicoquímico de laboratorio universitario con calibración trazable INACAL.',
      );
      setMismoFuncionario(false);
      setPagoSinConformidad(true);
      setModExtemporaneaTdr(false);
      setSinSustentoDoc(false);
      setEntregableIncompletoObra(false);
      setConflictoInteresFamiliar(false);
    }
  };

  const handleRegistrarVivo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (esSoloLectura) return;
    try {
      setCreando(true);
      setErrorRegistro(null);
      const creado = await centinelaApi.registrarExpedienteVivo({
        objeto,
        rubro,
        area_usuaria: areaUsuaria,
        modalidad,
        monto_estimado: Number(montoEstimado),
        tdr_texto: tdrTexto,
        proveedor_adjudicado_codigo: provGanador,
        proveedores_postores: [provGanador, provSegundo].filter(Boolean),
        fecha_creacion: fechaCreacion,
        mismo_funcionario_etapas: mismoFuncionario,
        pago_sin_conformidad: pagoSinConformidad,
        modificacion_extemporanea_tdr: modExtemporaneaTdr,
        sin_sustento_documental: sinSustentoDoc,
        entregable_incompleto_obra: entregableIncompletoObra,
        conflicto_interes_familiar: conflictoInteresFamiliar,
        rol_usuario: rolActivo,
      });
      setModalAbierto(false);
      await cargarExpedientes();
      navigate(`/trazabilidad?id=${creado.id}`);
    } catch (err: any) {
      setErrorRegistro(
        err?.response?.data?.detail ||
          'No se pudo registrar y auditar el expediente sintético.',
      );
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Lista de Compras y Procesos (Ley N° 32069)
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Consulte los 120 expedientes simulados o registre una compra nueva para evaluarla en tiempo real (SHA-256, NLP y reglas XAI)
          </p>
        </div>

        <div data-tour="exp-acciones" className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setSoloTrampas(!soloTrampas)}
            className={`btn-tactile inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border ${
              soloTrampas
                ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-500/50 shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            {soloTrampas
              ? 'Mostrando Solo Compras con Alerta'
              : 'Ver Solo Compras con Alerta'}
          </button>

          {esSoloLectura ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-700 text-xs font-bold">
              <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Vista Pública (Solo Lectura)
            </span>
          ) : (
            <button
              onClick={() => setModalAbierto(true)}
              title="Registrar un nuevo expediente sintético y evaluarlo en vivo con XAI + SHA-256 + NLP"
              className="btn-tactile inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B1F3A] hover:bg-[#14335D] dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-extrabold text-xs shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              Registrar Nueva Compra
            </button>
          )}
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div
        data-tour="exp-filtros"
        className="animate-card-up stagger-1 p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <div className="md:col-span-2 relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código (EXP-2025-UNT-0001), área (AREA-TI-03), proveedor o descripción..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={nivelRiesgo}
            onChange={(e) => setNivelRiesgo(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500 transition-colors"
          >
            <option value="TODOS">Nivel de Riesgo: Todos</option>
            <option value="ALTO">Riesgo Alto (Con Señal XAI)</option>
            <option value="MEDIO">Riesgo Medio</option>
            <option value="LIMPIO">Limpio (Cumplimiento Verificado)</option>
          </select>
        </div>

        <div>
          <select
            value={integridad}
            onChange={(e) => setIntegridad(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500 transition-colors"
          >
            <option value="TODAS">Integridad SHA-256: Todas</option>
            <option value="INTEGRA">Cadena SHA-256 Íntegra</option>
            <option value="ROTA">Cadena SHA-256 Rota (Alteración Ex-Post)</option>
          </select>
        </div>
      </div>

      {/* Tabla de Expedientes (7 Columnas Compactas Sin Desborde Horizontal en 1280px–1440px) */}
      <div
        data-tour="exp-tabla"
        className="animate-card-up stagger-2 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none overflow-hidden"
      >
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <span>
            Resultados encontrados:{' '}
            <strong className="text-slate-900 dark:text-white tabular-nums">
              {expedientes.length}
            </strong>{' '}
            expediente(s)
          </span>
          <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            Anonimización Ley N° 29733 Activa
          </span>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-7 h-7 text-blue-700 dark:text-emerald-400 animate-spin" />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Consultando expedientes...
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 pl-4 pr-2.5 whitespace-nowrap">Código</th>
                  <th className="py-3 px-2.5 w-full">Compra / Modalidad</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">Área / Proveedor</th>
                  <th className="py-3 px-2.5 text-right whitespace-nowrap">Monto (S/)</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">SHA-256</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">Riesgo</th>
                  <th className="py-3 pl-2.5 pr-4 text-right whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {expedientes.map((exp) => (
                  <tr
                    key={exp.id}
                    className={`group border-l-2 border-l-transparent hover:border-l-emerald-600 dark:hover:border-l-emerald-400 hover:bg-slate-50/90 dark:hover:bg-slate-800/45 transition-colors ${
                      exp.es_caso_trampa ? 'bg-rose-50/45 dark:bg-rose-950/15' : ''
                    }`}
                  >
                    <td className="py-3 pl-4 pr-2.5 w-[1%] whitespace-nowrap align-middle">
                      <div className="font-mono text-[11px] font-bold text-blue-700 dark:text-cyan-300">
                        {exp.codigo}
                      </div>
                      {exp.es_caso_trampa && (
                        <span className="block font-sans text-[10px] leading-tight text-amber-800 dark:text-amber-300 font-semibold mt-0.5 whitespace-normal max-w-[132px]">
                          {formatTipologia(exp.tipo_trampa)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2.5 w-full max-w-0 align-middle">
                      <div
                        className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate"
                        title={exp.objeto}
                      >
                        {exp.objeto}
                      </div>
                      <div
                        className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5"
                        title={exp.modalidad}
                      >
                        {exp.modalidad}
                      </div>
                    </td>
                    <td className="py-3 px-2.5 w-[1%] whitespace-nowrap align-middle">
                      <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                        {exp.area_usuaria}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {exp.proveedor_adjudicado_codigo || '—'}
                      </div>
                    </td>
                    <td className="py-3 px-2.5 w-[1%] text-right font-mono text-[11px] font-bold tabular-nums text-slate-900 dark:text-white whitespace-nowrap align-middle">
                      S/ {exp.monto_estimado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-2.5 w-[1%] whitespace-nowrap align-middle">
                      <IntegrityBadge integra={exp.integridad_valida} compact />
                    </td>
                    <td className="py-3 px-2.5 w-[1%] whitespace-nowrap align-middle">
                      <RiskBadge nivel={exp.nivel_riesgo} puntaje={exp.puntaje_riesgo} compact />
                    </td>
                    <td className="py-3 pl-2.5 pr-4 w-[1%] text-right whitespace-nowrap align-middle">
                      <div className="inline-flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => navigate(`/trazabilidad?id=${exp.id}`)}
                          className="btn-tactile inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-semibold"
                          title="Inspeccionar Cadena SHA-256 y NLP"
                        >
                          <FileSearch className="w-3 h-3" />
                          {esSoloLectura ? 'Ver' : 'Auditar'}
                        </button>
                        <a
                          href={centinelaApi.obtenerUrlReportePdf(exp.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-tactile inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold"
                          title="Descargar Reporte Forense Oficial en PDF"
                        >
                          <FileDown className="w-3 h-3 text-blue-700 dark:text-cyan-400" />
                          PDF
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Evaluador y Registro de Expediente Sintético en Vivo */}
      <Modal
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        title="Evaluador y Registro de Expediente Sintético en Vivo"
        subtitle="Sella los 6 eslabones SHA-256 y ejecuta en tiempo real el Motor XAI (8 reglas), NLP TF-IDF y Grafos NetworkX"
      >
        <form onSubmit={handleRegistrarVivo} className="space-y-4 text-xs">
          {/* Plantillas rápidas de 1 clic para demostración ante el jurado */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-800 dark:text-emerald-300 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Escenarios Rápidos para Demostración en Vivo:
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => aplicarPlantilla('CASO_1_PROYECTORES')}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Caso 1 UNT: Proyectores (Fracc. + TDR + Conflicto)
              </button>
              <button
                type="button"
                onClick={() => aplicarPlantilla('CASO_2_AULAS')}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                Caso 2 UNT: 8 Aulas (Sin Pozo a Tierra)
              </button>
              <button
                type="button"
                onClick={() => aplicarPlantilla('LIMPIO')}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-semibold"
              >
                Limpio (Cumple)
              </button>
              <button
                type="button"
                onClick={() => aplicarPlantilla('TDR_COPIADO')}
                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 font-semibold"
              >
                TDR Copiado (NLP &gt; 85%)
              </button>
              <button
                type="button"
                onClick={() => aplicarPlantilla('FRACCIONAMIENTO')}
                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 font-semibold"
              >
                Fraccionamiento (&le; 8 UIT)
              </button>
              <button
                type="button"
                onClick={() => aplicarPlantilla('VERSION_EXTEMPORANEA')}
                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-cyan-500/15 dark:hover:bg-cyan-500/25 text-blue-800 dark:text-cyan-300 border border-blue-200 dark:border-cyan-500/30 font-semibold"
              >
                TDR v2.1 Extemporáneo / Sin Sustento
              </button>
              <button
                type="button"
                onClick={() => aplicarPlantilla('COLUSION_Y_PAGO')}
                className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/15 dark:hover:bg-purple-500/25 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 font-semibold"
              >
                Colusión + Pago sin Conformidad
              </button>
            </div>
          </div>

          {errorRegistro && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/50 text-rose-800 dark:text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{errorRegistro}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block font-bold text-slate-700 dark:text-slate-200">
              Objeto de Contratación:
            </label>
            <input
              type="text"
              required
              value={objeto}
              onChange={(e) => setObjeto(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Área Usuaria (Ley 29733):
              </label>
              <select
                value={areaUsuaria}
                onChange={(e) => setAreaUsuaria(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                {AREAS_DISPONIBLES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Modalidad (Ley 32069):
              </label>
              <select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                {MODALIDADES_DISPONIBLES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Monto Estimado (S/):
              </label>
              <input
                type="number"
                min="100"
                step="0.01"
                required
                value={montoEstimado}
                onChange={(e) => setMontoEstimado(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-200">Rubro:</label>
              <select
                value={rubro}
                onChange={(e) => setRubro(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                {RUBROS_DISPONIBLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Proveedor Adjudicado:
              </label>
              <select
                value={provGanador}
                onChange={(e) => setProvGanador(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
              >
                {(proveedores.length > 0
                  ? proveedores
                  : [{ codigo: 'PROV-SYN-001', es_colusorio: false } as ProveedorItem]
                ).map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.codigo} {p.es_colusorio ? '(Red/Exclusivo)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                2.° Postor Cotizante:
              </label>
              <select
                value={provSegundo}
                onChange={(e) => setProvSegundo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
              >
                {(proveedores.length > 0
                  ? proveedores
                  : [{ codigo: 'PROV-SYN-002', es_colusorio: false } as ProveedorItem]
                ).map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.codigo} {p.es_colusorio ? '(Red/Exclusivo)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-slate-700 dark:text-slate-200">
              Texto de Términos de Referencia (TDR — evaluado en vivo por Scikit-Learn TF-IDF):
            </label>
            <textarea
              rows={3}
              required
              value={tdrTexto}
              onChange={(e) => setTdrTexto(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={mismoFuncionario}
                onChange={(e) => setMismoFuncionario(e.target.checked)}
                className="rounded border-slate-400 dark:border-slate-600"
              />
              Mismo funcionario (FUNC-LOG-01) en etapas incompatibles (R-02)
            </label>
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={pagoSinConformidad}
                onChange={(e) => setPagoSinConformidad(e.target.checked)}
                className="rounded border-slate-400 dark:border-slate-600"
              />
              Devengado/Pago previo a Conformidad observada (R-03)
            </label>
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={modExtemporaneaTdr}
                onChange={(e) => setModExtemporaneaTdr(e.target.checked)}
                className="rounded border-slate-400 dark:border-slate-600"
              />
              Modificación extemporánea TDR v2.1 posterior a cotizaciones (R-07)
            </label>
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={sinSustentoDoc}
                onChange={(e) => setSinSustentoDoc(e.target.checked)}
                className="rounded border-slate-400 dark:border-slate-600"
              />
              Ausencia de sustento documental adjunto (R-07)
            </label>
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={entregableIncompletoObra}
                onChange={(e) => setEntregableIncompletoObra(e.target.checked)}
                className="rounded border-slate-400 dark:border-slate-600"
              />
              Entregable obligatorio TDR sin pruebas/evidencia (Caso 2 UNT — R-03)
            </label>
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={conflictoInteresFamiliar}
                onChange={(e) => setConflictoInteresFamiliar(e.target.checked)}
                className="rounded border-slate-400 dark:border-slate-600"
              />
              Vínculo familiar sin abstención (Conflicto de Interés — R-08)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalAbierto(false)}
              className="btn-tactile px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creando}
              className="btn-tactile inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-extrabold shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              {creando ? 'Sellando SHA-256 y Auditando...' : 'Sellar Cadena y Ejecutar Auditoría XAI'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
