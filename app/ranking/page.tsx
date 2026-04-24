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

      <div className="max-w-3xl mx-auto p-4">
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-2xl p-6 text-white shadow-lg mb-6 flex items-center gap-4">
          <Trophy size={48} className="text-yellow-400 opacity-90" />
          <div>
            <h2 className="text-2xl font-black uppercase tracking-wider">Tabla de Posiciones</h2>
            <p className="text-blue-200 text-sm font-medium">Clasificación: <span className="text-white font-bold">{filtroFase}</span></p>
            {filtroFase === 'General' && faseEvolucion && (
              <p className="text-blue-300 text-xs font-medium mt-1">↑↓ movimiento vs fase anterior ({faseEvolucion})</p>
            )}
          </div>
        </div>

        {cargando ? (
          <p className="text-center font-bold text-gray-500 py-10">Calculando puntos...</p>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[500px]">
                <thead className="bg-gray-100 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-3 py-3 text-gray-500 font-bold w-12 text-center">#</th>
                    <th className="px-2 py-3 text-gray-800 font-bold uppercase text-sm">Jugador</th>
                    <th className="px-2 py-3 text-center text-green-700 font-bold uppercase text-[10px] tracking-widest" title="Aciertos Simples (1 pt)">
                      <CheckCircle2 size={16} className="mx-auto mb-1" /> Aciertos
                    </th>
                    <th className="px-2 py-3 text-center text-red-600 font-bold uppercase text-[10px] tracking-widest" title="Resultados Exactos (3 pts)">
                      <Target size={16} className="mx-auto mb-1" /> Exactos
                    </th>
                    <th className="px-4 py-3 text-center text-blue-800 font-black uppercase text-sm">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {rankingOrdenado.map((user, index) => {
                    const esYo = user.id === miUsuarioId;
                    const puntosMostrar = filtroFase === 'General' ? user.puntosTotales : user.puntosPorFase[filtroFase].pts;
                    const plenosMostrar = filtroFase === 'General' ? user.plenosTotales : user.puntosPorFase[filtroFase].plenos;
                    const aciertosMostrar = filtroFase === 'General' ? user.aciertosTotales : user.puntosPorFase[filtroFase].aciertos;

                    const delta = filtroFase === 'General' && user.posicionAnterior !== null
                      ? user.posicionAnterior - index
                      : null;

                    return (
                      <tr key={user.id} className={`border-b border-gray-100 last:border-0 ${esYo ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-3 py-4 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            {obtenerMedalla(index)}
                            {delta !== null && (
                              delta > 0
                                ? <span className="text-[10px] font-black text-green-600">↑{delta}</span>
                                : delta < 0
                                  ? <span className="text-[10px] font-black text-red-500">↓{Math.abs(delta)}</span>
                                  : <span className="text-[10px] font-bold text-gray-300">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-4">
                          <span className={`font-bold text-lg ${esYo ? 'text-blue-900' : 'text-gray-800'}`}>
                            {user.nombre}
                          </span>
                          {esYo && <span className="ml-2 text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold uppercase">Vos</span>}
                        </td>
                        <td className="px-2 py-4 text-center font-bold text-green-700 bg-green-50/50">
                          {aciertosMostrar}
                        </td>
                        <td className="px-2 py-4 text-center font-bold text-red-600 bg-red-50/50">
                          {plenosMostrar}
                        </td>
                        <td className="px-4 py-4 text-center font-black text-2xl text-blue-700 bg-blue-50/30">
                          {puntosMostrar}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}