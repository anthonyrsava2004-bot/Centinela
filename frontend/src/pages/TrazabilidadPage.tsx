import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldX,
  FileDown,
  Zap,
  RotateCcw,
  Link2,
  Cpu,
  Scale,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Users,
} from 'lucide-react';
import { centinelaApi } from '../api/client';
import { ExpedienteDetalle, ExpedienteListItem, RolUsuario } from '../types';
import { IntegrityBadge, RiskBadge } from '../components/AlertBadge';

interface TrazabilidadPageProps {
  rolActivo: RolUsuario;
}

export const TrazabilidadPage: React.FC<TrazabilidadPageProps> = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = Number(searchParams.get('id')) || 6; // Por defecto EXP-2025-UNT-0006 (caso estrella TDR / o el seleccionado)

  const [listaExpedientes, setListaExpedientes] = useState<ExpedienteListItem[]>([]);
  const [expedienteId, setExpedienteId] = useState<number>(initialId);
  const [detalle, setDetalle] = useState<ExpedienteDetalle | null>(null);
  const [etapaSimulacion, setEtapaSimulacion] = useState<string>('Cotizaciones');
  const [loading, setLoading] = useState<boolean>(true);
  const [procesandoAccion, setProcesandoAccion] = useState<boolean>(false);

  useEffect(() => {
    centinelaApi.listarExpedientes().then((lista) => {
      setListaExpedientes(lista);
    });
  }, []);

  const cargarDetalle = async (idToLoad: number) => {
    try {
      setLoading(true);
      const data = await centinelaApi.obtenerExpedienteDetalle(idToLoad);
      setDetalle(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const paramId = Number(searchParams.get('id'));
    if (paramId && paramId !== expedienteId) {
      setExpedienteId(paramId);
      cargarDetalle(paramId);
    } else {
      cargarDetalle(expedienteId);
    }
  }, [searchParams]);

  const handleSelectExpediente = (newId: number) => {
    setExpedienteId(newId);
    setSearchParams({ id: String(newId) });
    cargarDetalle(newId);
  };

  const handleSimularAlteracion = async () => {
    if (!detalle) return;
    try {
      setProcesandoAccion(true);
      await centinelaApi.simularAlteracionExPost(detalle.id, etapaSimulacion);
      await cargarDetalle(detalle.id);
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleRestaurarIntegridad = async () => {
    if (!detalle) return;
    try {
      setProcesandoAccion(true);
      await centinelaApi.restaurarIntegridad(detalle.id);
      await cargarDetalle(detalle.id);
    } finally {
      setProcesandoAccion(false);
    }
  };

  if (loading && !detalle) {
    return (
      <div className="h-96 flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-xs font-mono text-slate-400">
          Recalculando hashes SHA-256 y similitud coseno TF-IDF...
        </p>
      </div>
    );
  }

  if (!detalle) return null;

  const cadena = detalle.verificacion_sha256;
  const nlp = detalle.analisis_nlp;

  return (
    <div className="space-y-8">
      {/* Barra Superior: Selector de Expediente + Acciones Forenses */}
      <div className="p-6 rounded-2xl bg-slate-900/95 border border-slate-800 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono uppercase px-2.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                Auditoría Forense Digital
              </span>
              <IntegrityBadge integra={cadena.integridad_global} />
              <RiskBadge nivel={detalle.nivel_riesgo} puntaje={detalle.puntaje_riesgo} />
            </div>
            <h1 className="text-xl font-extrabold text-white mt-1">
              {detalle.codigo} — {detalle.objeto}
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Área Usuaria: <strong className="text-slate-200">{detalle.area_usuaria}</strong> |
              Modalidad: <strong className="text-slate-200">{detalle.modalidad}</strong> | Monto:{' '}
              <strong className="text-emerald-300">
                S/ {detalle.monto_estimado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </strong>{' '}
              | Proveedor Adjudicado:{' '}
              <strong className="text-cyan-300">{detalle.proveedor_adjudicado_codigo}</strong>
            </p>
          </div>

          {/* Botones Oficiales: Simular Alteración Ex Post + Descargar Reporte PDF */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              <select
                value={etapaSimulacion}
                onChange={(e) => setEtapaSimulacion(e.target.value)}
                className="bg-slate-900 text-xs text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none"
                title="Seleccionar etapa donde simular alteración clandestina en BD"
              >
                <option value="Requerimiento">Etapa 1: Requerimiento</option>
                <option value="TDR">Etapa 2: TDR</option>
                <option value="Cotizaciones">Etapa 3: Cotizaciones</option>
                <option value="Buena Pro">Etapa 4: Buena Pro</option>
                <option value="Conformidad">Etapa 5: Conformidad</option>
              </select>

              <button
                onClick={handleSimularAlteracion}
                disabled={procesandoAccion}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-rose-600/25 transition"
              >
                <Zap className="w-4 h-4" />
                Simular Alteración Ex Post
              </button>

              {!cadena.integridad_global && (
                <button
                  onClick={handleRestaurarIntegridad}
                  disabled={procesandoAccion}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold text-xs transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar Cadena
                </button>
              )}
            </div>

            <a
              href={centinelaApi.obtenerUrlReportePdf(detalle.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition"
            >
              <FileDown className="w-4 h-4" />
              Descargar Reporte PDF
            </a>
          </div>
        </div>

        {/* Selector Rápido de Expediente */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-slate-400">
            Cambiar Expediente Inspeccionado:
          </label>
          <select
            value={expedienteId}
            onChange={(e) => handleSelectExpediente(Number(e.target.value))}
            className="flex-1 min-w-[280px] px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
          >
            {listaExpedientes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.codigo} | {item.nivel_riesgo}{' '}
                {item.tipo_trampa ? `[${item.tipo_trampa}]` : '[LIMPIO]'} —{' '}
                {item.objeto.slice(0, 68)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Banner de Estado Criptográfico SHA-256 */}
      <div
        className={`p-5 rounded-2xl border flex items-start gap-4 ${
          cadena.integridad_global
            ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-200'
            : 'bg-rose-950/40 border-rose-500 text-rose-100 animate-pulse'
        }`}
      >
        {cadena.integridad_global ? (
          <ShieldCheck className="w-7 h-7 text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <ShieldX className="w-7 h-7 text-rose-400 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1">
          <h2 className="text-sm font-extrabold uppercase tracking-wide">
            {cadena.integridad_global
              ? 'Verificación Criptográfica SHA-256 Exitosa (Cadena Inmutable Intacta)'
              : `¡Alerta Forense Crítica! Ruptura de Cadena Detectada desde Eslabón #${cadena.orden_comprometido} (${cadena.etapa_comprometida})`}
          </h2>
          <p className="text-xs leading-relaxed opacity-90">{cadena.mensaje_forense}</p>
        </div>
      </div>

      {/* SECCIÓN 1: CADENA VISUAL SHA-256 (6 ETAPAS SECUENCIALES) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Link2 className="w-5 h-5 text-cyan-400" />
              Cadena Secuencial de Trazabilidad SHA-256 (Blockchain-Lite)
            </h2>
            <p className="text-xs text-slate-400">
              Fórmula forense:{' '}
              <code className="text-cyan-300 font-mono">
                hash_actual = SHA256(id_exp + etapa + usuario_rol + timestamp + documento_texto + hash_anterior)
              </code>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cadena.eslabones.map((eslabon) => {
            const integroTotal = eslabon.es_integro && eslabon.enlace_anterior_valido;
            return (
              <div
                key={eslabon.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                  !eslabon.es_integro
                    ? 'bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-500/15'
                    : !eslabon.enlace_anterior_valido
                    ? 'bg-amber-950/30 border-amber-500/60'
                    : 'bg-slate-900/90 border-slate-800'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-white">
                      <span className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-mono text-cyan-300">
                        {eslabon.orden}
                      </span>
                      {eslabon.etapa}
                    </span>

                    {integroTotal ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" /> ÍNTEGRO
                      </span>
                    ) : !eslabon.es_integro ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500 text-white">
                        <ShieldX className="w-3 h-3" /> ADULTERADO EX-POST
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        <AlertTriangle className="w-3 h-3" /> CASCADA ROTA
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-950/70 px-3 py-1.5 rounded-lg border border-slate-800/80">
                    <span>
                      Rol: <strong className="text-cyan-300">{eslabon.usuario_rol}</strong>
                    </span>
                    <span>{eslabon.timestamp}</span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800/60">
                    {eslabon.documento_texto}
                  </p>
                </div>

                {/* Hashes Criptográficos */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-[10px] font-mono">
                  <div className="text-slate-500 truncate" title={eslabon.hash_anterior}>
                    <span className="text-slate-400">Hash Prev:</span> {eslabon.hash_anterior}
                  </div>
                  <div className="text-emerald-300 truncate" title={eslabon.hash_actual}>
                    <span className="text-slate-400">Sellado BD:</span> {eslabon.hash_actual}
                  </div>
                  <div
                    className={`truncate ${
                      integroTotal ? 'text-cyan-300' : 'text-rose-400 font-bold'
                    }`}
                    title={eslabon.hash_recalculado}
                  >
                    <span className="text-slate-400">Auditoría:</span> {eslabon.hash_recalculado}
                  </div>
                  <p className="text-[11px] font-sans text-slate-400 pt-1">
                    {eslabon.detalle_estado}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECCIÓN 2: DETECTOR SEMÁNTICO DE DIRECCIONAMIENTO EN TDR (TF-IDF + COSENO) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-400" />
              Detector Semántico de Direccionamiento en TDR (Scikit-Learn TF-IDF)
            </h3>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                nlp.alerta_detectada
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              Máx. Similitud: {nlp.max_similitud}% (Umbral: {nlp.umbral_alerta}%)
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-[11px] font-mono uppercase text-cyan-400 font-semibold">
              Texto Íntegro de los Términos de Referencia (TDR) del Expediente:
            </span>
            <p className="text-xs text-slate-200 leading-relaxed">{detalle.tdr_texto}</p>
          </div>

          <div
            className={`p-4 rounded-xl border text-xs leading-relaxed ${
              nlp.alerta_detectada
                ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                : 'bg-slate-950/70 border-slate-800 text-slate-300'
            }`}
          >
            <strong className="block mb-1 font-bold">
              Diagnóstico Explicable XAI (100% Local Offline):
            </strong>
            {nlp.explicacion_xai}
          </div>
        </div>

        {/* Barras Comparativas de Similitud Coseno contra Catálogos de Proveedores */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div>
            <h3 className="text-base font-bold text-white">
              Matriz de Similitud Coseno: TDR vs. Catálogos Técnicos de Proveedores
            </h3>
            <p className="text-xs text-slate-400">
              Una similitud superior al {nlp.umbral_alerta}% alerta sobre posible copia de especificaciones técnicas exclusivas de un proveedor
            </p>
          </div>

          <div className="space-y-3.5">
            {nlp.comparaciones.slice(0, 5).map((comp) => (
              <div
                key={comp.proveedor_codigo}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-cyan-300">
                      {comp.proveedor_codigo}
                    </span>
                    {comp.es_adjudicado && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                        PROVEEDOR ADJUDICADO
                      </span>
                    )}
                  </div>
                  <span
                    className={`font-mono font-extrabold ${
                      comp.alerta_direccionamiento ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {comp.porcentaje_similitud}% Similitud
                  </span>
                </div>

                <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      comp.alerta_direccionamiento
                        ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                        : 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                    }`}
                    style={{ width: `${Math.max(6, comp.porcentaje_similitud)}%` }}
                  />
                </div>

                {comp.terminos_coincidentes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-500">N-gramas coincidentes:</span>
                    {comp.terminos_coincidentes.map((term) => (
                      <span
                        key={term}
                        className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300"
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: SEÑALES EXPLICABLES XAI ACTIVAS Y POSTORES DEL PROCESO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-400" />
            Señales de Riesgo que Ameritan Revisión Humana (Motor XAI)
          </h3>

          {detalle.alertas.length === 0 ? (
            <div className="p-6 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-200">
              Este expediente no registra señales de riesgo activas. Todas las etapas cumplen con la segregación funcional, topes de 8 UIT y pluralidad efectiva de postores.
            </div>
          ) : (
            <div className="space-y-4">
              {detalle.alertas.map((al) => (
                <div
                  key={al.id}
                  className="p-4 rounded-xl bg-slate-950 border border-rose-500/40 space-y-2.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-bold text-rose-300">
                      [{al.codigo_regla}] {al.categoria}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold text-[11px]">
                      Estado: {al.estado_revision}
                    </span>
                  </div>
                  <h4 className="font-bold text-white text-sm">{al.titulo}</h4>
                  <div className="space-y-1.5 text-slate-300 pt-1">
                    <p>
                      <strong className="text-cyan-300">(a) Regla Activada:</strong>{' '}
                      {al.regla_activada}
                    </p>
                    <p>
                      <strong className="text-emerald-300">(b) Evidencia Exacta:</strong>{' '}
                      {al.evidencia_exacta}
                    </p>
                    <p>
                      <strong className="text-amber-300">(c) Base Normativa Exacta:</strong>{' '}
                      {al.base_normativa}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Postores y Atributos Hash (Ley N° 29733) */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            Postores Cotizantes (Ley 29733)
          </h3>
          <div className="space-y-3">
            {detalle.postulaciones.map((post) => (
              <div
                key={post.id}
                className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                  post.es_ganador
                    ? 'bg-emerald-950/20 border-emerald-500/40'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-cyan-300">
                    {post.proveedor_codigo}
                  </span>
                  <span className="font-mono font-bold text-white">
                    S/ {post.monto_ofertado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">{post.proveedor_alias}</div>
                <div className="pt-1 border-t border-slate-800/80 font-mono text-[10px] text-slate-400 space-y-0.5">
                  <div>Rep. Legal: <span className="text-amber-300">{post.representante_id}</span></div>
                  <div>Dirección: <span className="text-amber-300">{post.direccion_hash}</span></div>
                  <div>Teléfono: <span className="text-amber-300">{post.telefono_hash}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
