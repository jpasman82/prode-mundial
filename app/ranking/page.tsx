"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Trophy, Medal, Target, CheckCircle2 } from 'lucide-react';

const FASES_EVOLUCION = ['Fecha 1', 'Fecha 2', 'Fecha 3', '16vos de Final', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Finales'];

function determinarFase(faseReal: string, fechaHoraUtc: string) {
  if (faseReal === 'Fase de Grupos') {
    const dia = new Date(fechaHoraUtc).getDate();
    if (dia <= 15) return 'Fecha 1';
    if (dia <= 21) return 'Fecha 2';
    return 'Fecha 3';
  }
  if (faseReal === 'Final' || faseReal === 'Tercer Puesto') return 'Finales';
  return faseReal;
}

function calcularPuntos(p: any, pr: any) {
  const ga = p.goles_a, gb = p.goles_b, pa = pr.prediccion_goles_a, pb = pr.prediccion_goles_b;
  if (ga === pa && gb === pb) return { pts: 3, plenos: 1, aciertos: 0 };
  if (Math.sign(ga - gb) === Math.sign(pa - pb)) return { pts: 1, plenos: 0, aciertos: 1 };
  return { pts: 0, plenos: 0, aciertos: 0 };
}

export default function Ranking() {
  const [ranking, setRanking] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroFase, setFiltroFase] = useState('General');
  const [miUsuarioId, setMiUsuarioId] = useState<string | null>(null);
  const [faseEvolucion, setFaseEvolucion] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [mostrarInfo, setMostrarInfo] = useState(false);

  const fasesFiltro = ['General', 'Fecha 1', 'Fecha 2', 'Fecha 3', '16vos de Final', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Finales'];

  useEffect(() => {
    const calcularRanking = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setMiUsuarioId(session.user.id);

      const { data: usuarios } = await supabase.from('usuarios').select('id, nombre_jugador');
      const { data: partidos } = await supabase.from('partidos').select('*').eq('estado', 'Finalizado');
      const { data: pronosticos } = await supabase.from('pronosticos').select('*');

      if (!usuarios || !partidos || !pronosticos) return;

      const mapaRanking: Record<string, any> = {};

      usuarios.forEach((u: any) => {
        mapaRanking[u.id] = {
          id: u.id,
          nombre: u.nombre_jugador || 'Jugador',
          puntosTotales: 0,
          plenosTotales: 0,
          aciertosTotales: 0,
          puntosPorFase: {},
          posicionAnterior: null,
        };
        fasesFiltro.forEach(f => mapaRanking[u.id].puntosPorFase[f] = { pts: 0, plenos: 0, aciertos: 0 });
      });

      partidos.forEach((p: any) => {
        const faseDelPartido = determinarFase(p.fase, p.fecha_hora);
        pronosticos.filter((pr: any) => pr.partido_id === p.id).forEach((pr: any) => {
          const uId = pr.usuario_id;
          if (!mapaRanking[uId]) return;
          const { pts, plenos, aciertos } = calcularPuntos(p, pr);
          mapaRanking[uId].puntosTotales += pts;
          mapaRanking[uId].plenosTotales += plenos;
          mapaRanking[uId].aciertosTotales += aciertos;
          if (mapaRanking[uId].puntosPorFase[faseDelPartido]) {
            mapaRanking[uId].puntosPorFase[faseDelPartido].pts += pts;
            mapaRanking[uId].puntosPorFase[faseDelPartido].plenos += plenos;
            mapaRanking[uId].puntosPorFase[faseDelPartido].aciertos += aciertos;
          }
        });
      });

      // Calcular evolución: posición antes de la fase más reciente
      const fasesPresentes = FASES_EVOLUCION.filter(f =>
        partidos.some(p => determinarFase(p.fase, p.fecha_hora) === f)
      );

      if (fasesPresentes.length >= 2) {
        const faseMasReciente = fasesPresentes[fasesPresentes.length - 1];
        setFaseEvolucion(faseMasReciente);

        // Ranking SIN la fase más reciente
        const ptsSinFase: Record<string, { pts: number; plenos: number; aciertos: number }> = {};
        usuarios.forEach((u: any) => { ptsSinFase[u.id] = { pts: 0, plenos: 0, aciertos: 0 }; });

        partidos
          .filter((p: any) => determinarFase(p.fase, p.fecha_hora) !== faseMasReciente)
          .forEach((p: any) => {
            pronosticos.filter((pr: any) => pr.partido_id === p.id).forEach((pr: any) => {
              if (!ptsSinFase[pr.usuario_id]) return;
              const { pts, plenos, aciertos } = calcularPuntos(p, pr);
              ptsSinFase[pr.usuario_id].pts += pts;
              ptsSinFase[pr.usuario_id].plenos += plenos;
              ptsSinFase[pr.usuario_id].aciertos += aciertos;
            });
          });

        const rankingAnterior = Object.entries(ptsSinFase)
          .sort(([, a], [, b]) => b.pts - a.pts || b.plenos - a.plenos || b.aciertos - a.aciertos);

        rankingAnterior.forEach(([id], i) => {
          if (mapaRanking[id]) mapaRanking[id].posicionAnterior = i;
        });
      }

      setRanking(Object.values(mapaRanking));
      setCargando(false);
    };

    calcularRanking();
  }, []);

  const rankingOrdenado = [...ranking].sort((a, b) => {
    const ptsA = filtroFase === 'General' ? a.puntosTotales : a.puntosPorFase[filtroFase].pts;
    const ptsB = filtroFase === 'General' ? b.puntosTotales : b.puntosPorFase[filtroFase].pts;
    
    if (ptsB !== ptsA) return ptsB - ptsA; // 1. Desempata por Puntos
    
    const plenosA = filtroFase === 'General' ? a.plenosTotales : a.puntosPorFase[filtroFase].plenos;
    const plenosB = filtroFase === 'General' ? b.plenosTotales : b.puntosPorFase[filtroFase].plenos;
    
    if (plenosB !== plenosA) return plenosB - plenosA; // 2. Desempata por Exactos
    
    const aciertosA = filtroFase === 'General' ? a.aciertosTotales : a.puntosPorFase[filtroFase].aciertos;
    const aciertosB = filtroFase === 'General' ? b.aciertosTotales : b.puntosPorFase[filtroFase].aciertos;
    
    return aciertosB - aciertosA; // 3. Desempata por Aciertos simples
  });

  const obtenerMedalla = (index: number) => {
    if (index === 0) return <Medal className="text-yellow-500" size={24} />;
    if (index === 1) return <Medal className="text-gray-400" size={24} />;
    if (index === 2) return <Medal className="text-amber-600" size={24} />;
    return <span className="text-gray-500 font-bold w-6 text-center">{index + 1}°</span>;
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">

      {/* Modal de ayuda */}
      {mostrarInfo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setMostrarInfo(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-xl text-gray-900 mb-5">¿Cómo se puntúa?</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-3xl font-black text-blue-700 w-10 text-center">3</span>
                <div>
                  <p className="font-bold text-gray-800">Resultado exacto</p>
                  <p className="text-sm text-gray-500">Acertaste el marcador exacto</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 bg-green-50 rounded-xl border border-green-100">
                <span className="text-3xl font-black text-green-700 w-10 text-center">1</span>
                <div>
                  <p className="font-bold text-gray-800">Tendencia correcta</p>
                  <p className="text-sm text-gray-500">Acertaste quién ganó o que fue empate, pero no el marcador</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-3xl font-black text-gray-300 w-10 text-center">0</span>
                <div>
                  <p className="font-bold text-gray-800">Sin puntos</p>
                  <p className="text-sm text-gray-500">La tendencia fue incorrecta</p>
                </div>
              </div>
            </div>
            <button onClick={() => setMostrarInfo(false)} className="mt-5 w-full bg-blue-600 text-white font-bold py-3 rounded-xl">
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Filtros de fase */}
      <div className="bg-white shadow-sm p-3 sticky top-0 z-10 border-b border-gray-200">
        <div className="flex overflow-x-auto gap-2 scrollbar-hide pb-1">
          {fasesFiltro.map(fase => (
            <button
              key={fase} onClick={() => setFiltroFase(fase)}
              className={`whitespace-nowrap px-4 py-2 font-bold rounded-lg border-2 transition-all ${filtroFase === fase ? 'bg-blue-800 text-white border-blue-800 shadow-md' : 'bg-gray-50 text-gray-700 border-gray-300 hover:border-blue-400'}`}
            >
              {fase}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-2xl p-5 text-white shadow-lg mb-4 flex items-center gap-4">
          <Trophy size={40} className="text-yellow-400 opacity-90 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black uppercase tracking-wider">Tabla de Posiciones</h2>
            <p className="text-blue-200 text-sm font-medium">Clasificación: <span className="text-white font-bold">{filtroFase}</span></p>
            {filtroFase === 'General' && faseEvolucion && (
              <p className="text-blue-300 text-xs font-medium mt-0.5">↑↓ movimiento vs {faseEvolucion}</p>
            )}
          </div>
          <button
            onClick={() => setMostrarInfo(true)}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white font-black text-sm flex items-center justify-center flex-shrink-0 transition-colors"
            title="¿Cómo se calculan los puntos?"
          >
            ?
          </button>
        </div>

        {/* Lista */}
        {cargando ? (
          <p className="text-center font-bold text-gray-500 py-10">Calculando puntos...</p>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {rankingOrdenado.map((user, index) => {
              const esYo = user.id === miUsuarioId;
              const expandido = expandidoId === user.id;
              const puntosMostrar = filtroFase === 'General' ? user.puntosTotales : user.puntosPorFase[filtroFase].pts;
              const plenosMostrar = filtroFase === 'General' ? user.plenosTotales : user.puntosPorFase[filtroFase].plenos;
              const aciertosMostrar = filtroFase === 'General' ? user.aciertosTotales : user.puntosPorFase[filtroFase].aciertos;
              const delta = filtroFase === 'General' && user.posicionAnterior !== null
                ? user.posicionAnterior - index : null;

              return (
                <div
                  key={user.id}
                  className={`cursor-pointer transition-colors ${esYo ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  onClick={() => setExpandidoId(expandido ? null : user.id)}
                >
                  {/* Fila principal */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Posición + delta */}
                    <div className="w-10 flex flex-col items-center flex-shrink-0">
                      {obtenerMedalla(index)}
                      {delta !== null && (
                        delta > 0
                          ? <span className="text-[10px] font-black text-green-600 leading-none">↑{delta}</span>
                          : delta < 0
                            ? <span className="text-[10px] font-black text-red-500 leading-none">↓{Math.abs(delta)}</span>
                            : <span className="text-[10px] font-bold text-gray-300 leading-none">—</span>
                      )}
                    </div>

                    {/* Nombre */}
                    <div className="flex-1 min-w-0">
                      <span className={`font-bold text-base leading-tight ${esYo ? 'text-blue-900' : 'text-gray-800'}`}>
                        {user.nombre}
                      </span>
                      {esYo && <span className="ml-2 text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold uppercase align-middle">Vos</span>}
                    </div>

                    {/* Puntos */}
                    <span className="font-black text-2xl text-blue-700 flex-shrink-0">{puntosMostrar}</span>
                  </div>

                  {/* Detalle expandible */}
                  {expandido && (
                    <div className="px-4 pb-3 flex gap-6 border-t border-gray-100 pt-2">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-green-600" />
                        <span className="text-sm font-bold text-green-700">{aciertosMostrar} aciertos</span>
                        <span className="text-xs text-gray-400">(1 pt c/u)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Target size={14} className="text-blue-600" />
                        <span className="text-sm font-bold text-blue-700">{plenosMostrar} exactos</span>
                        <span className="text-xs text-gray-400">(3 pts c/u)</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}