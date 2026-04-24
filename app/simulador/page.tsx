"use client";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { ChevronRight, ChevronLeft, Trophy, ArrowRight, ShieldAlert, Dices } from 'lucide-react';

export default function Simulador({ userId }: { userId: string | null }) {
  const [partidos, setPartidos] = useState<any[]>([]);
  const [equipos, setEquipos] = useState<any[]>([]);
  const [simulacion, setSimulacion] = useState<Record<string, { a: string, b: string }>>({});
  const [cargando, setCargando] = useState(true);

  const letrasGrupos = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const fasesEliminatorias = ['16vos de Final', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Tercer Puesto', 'Final'];
  const pasosTotales = [...letrasGrupos.map(l => `Grupo ${l}`), ...fasesEliminatorias, 'Resumen'];
  const [pasoIndex, setPasoIndex] = useState(0);

  const pasoActual = pasosTotales[pasoIndex];

  useEffect(() => {
    const cargarDatos = async () => {
      const { data: eq } = await supabase.from('equipos').select('*').order('nombre');
      const { data: par } = await supabase.from('partidos').select('*, equipo_a:equipos!equipo_a_id(*), equipo_b:equipos!equipo_b_id(*)').order('fecha_hora');
      if (eq) setEquipos(eq);
      if (par) setPartidos(par);
      setCargando(false);
    };
    cargarDatos();
  }, []);

  const handleScore = (id: string, equipo: 'a' | 'b', valor: string) => {
    setSimulacion(prev => ({
      ...prev,
      [id]: { ...prev[id], [equipo]: valor }
    }));
  };

  const llenarAlAzar = () => {
    const nuevaSimulacion: Record<string, { a: string, b: string }> = { ...simulacion };
    partidos.forEach(p => {
      let ga = Math.floor(Math.random() * 4);
      let gb = Math.floor(Math.random() * 4);
      if (p.fase !== 'Fase de Grupos' && ga === gb) {
        if (Math.random() > 0.5) ga++; else gb++;
      }
      nuevaSimulacion[p.id] = { a: ga.toString(), b: gb.toString() };
    });
    setSimulacion(nuevaSimulacion);
  };

  const calcularTabla = (grupo: string) => {
    const stats: Record<string, any> = {};
    equipos.filter(e => e.grupo === grupo).forEach(e => {
      stats[e.id] = { ...e, pts: 0, gd: 0, gf: 0 };
    });

    partidos.filter(p => p.fase === 'Fase de Grupos' && p.equipo_a?.grupo === grupo).forEach(p => {
      const res = simulacion[p.id];
      if (res && res.a !== '' && res.b !== '') {
        const ga = parseInt(res.a); const gb = parseInt(res.b);
        if (stats[p.equipo_a_id] && stats[p.equipo_b_id]) {
          stats[p.equipo_a_id].gf += ga; stats[p.equipo_b_id].gf += gb;
          stats[p.equipo_a_id].gd += (ga - gb); stats[p.equipo_b_id].gd += (gb - ga);
          if (ga > gb) stats[p.equipo_a_id].pts += 3;
          else if (gb > ga) stats[p.equipo_b_id].pts += 3;
          else { stats[p.equipo_a_id].pts += 1; stats[p.equipo_b_id].pts += 1; }
        }
      }
    });

    return Object.values(stats).sort((a: any, b: any) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  };

  const datosSimulados = useMemo(() => {
    if (equipos.length === 0 || partidos.length === 0) return { partidos: [], clasificados: {} };

    const clasificados: Record<string, any> = {};
    const terceros: any[] = [];

    letrasGrupos.forEach(grupo => {
      const tabla = calcularTabla(grupo);
      if (tabla.length >= 3) {
        clasificados[`1ro ${grupo}`] = tabla[0];
        clasificados[`2do ${grupo}`] = tabla[1];
        terceros.push(tabla[2]);
      }
    });

    terceros.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    const mejoresTerceros = terceros.slice(0, 8);
    let indexTercero = 0;

    const partidosProyectados = partidos.map(p => {
      const partido = { ...p };

      if (partido.fase !== 'Fase de Grupos') {
        if (partido.placeholder_a) {
          if (partido.placeholder_a.includes('Mejor 3ro')) {
            partido.equipo_a_simulado = mejoresTerceros[indexTercero % 8];
            indexTercero++;
          } else {
            partido.equipo_a_simulado = clasificados[partido.placeholder_a];
          }
        }
        if (partido.placeholder_b) {
          if (partido.placeholder_b.includes('Mejor 3ro')) {
            partido.equipo_b_simulado = mejoresTerceros[indexTercero % 8];
            indexTercero++;
          } else {
            partido.equipo_b_simulado = clasificados[partido.placeholder_b];
          }
        }

        const res = simulacion[partido.id];
        if (res && res.a !== '' && res.b !== '' && partido.equipo_a_simulado && partido.equipo_b_simulado) {
          const ga = parseInt(res.a); const gb = parseInt(res.b);
          let ganador = partido.equipo_a_simulado;
          let perdedor = partido.equipo_b_simulado;
          
          if (gb > ga) { ganador = partido.equipo_b_simulado; perdedor = partido.equipo_a_simulado; }

          clasificados[`Ganador ${partido.codigo_partido}`] = ganador;
          clasificados[`Perdedor ${partido.codigo_partido}`] = perdedor;
        }
      } else {
        partido.equipo_a_simulado = partido.equipo_a;
        partido.equipo_b_simulado = partido.equipo_b;
      }

      return partido;
    });

    return { partidos: partidosProyectados, clasificados };
  }, [partidos, simulacion, equipos]);

  const renderFilaPartido = (p: any, esEliminatoria: boolean) => {
    const eqA = p.equipo_a_simulado;
    const eqB = p.equipo_b_simulado;
    const listos = eqA && eqB;

    return (
      <div key={p.id} className="bg-white p-4 rounded-xl border border-gray-300 shadow-sm mb-3">
        <div className="flex items-center justify-between gap-2">
          <div className={`flex-1 min-w-0 text-right font-bold text-sm flex items-center justify-end gap-2 ${listos ? 'text-gray-900' : 'text-gray-400'}`}>
            <span className="leading-tight">{eqA ? eqA.nombre : p.placeholder_a}</span>
            <span className="text-2xl flex-shrink-0">{eqA ? eqA.bandera_url : '🛡️'}</span>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <input
              type="number"
              disabled={!listos}
              value={simulacion[p.id]?.a || ''}
              onChange={(e) => handleScore(p.id, 'a', e.target.value)}
              className="w-12 h-14 text-center border-2 border-gray-400 rounded-lg font-black text-xl text-rose-900 bg-gray-50 focus:border-rose-700 focus:bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200"
            />
            <input
              type="number"
              disabled={!listos}
              value={simulacion[p.id]?.b || ''}
              onChange={(e) => handleScore(p.id, 'b', e.target.value)}
              className="w-12 h-14 text-center border-2 border-gray-400 rounded-lg font-black text-xl text-rose-900 bg-gray-50 focus:border-rose-700 focus:bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200"
            />
          </div>

          <div className={`flex-1 min-w-0 text-left font-bold text-sm flex items-center gap-2 ${listos ? 'text-gray-900' : 'text-gray-400'}`}>
            <span className="text-2xl flex-shrink-0">{eqB ? eqB.bandera_url : '🛡️'}</span>
            <span className="leading-tight">{eqB ? eqB.nombre : p.placeholder_b}</span>
          </div>
        </div>
        
        {esEliminatoria && listos && simulacion[p.id]?.a === simulacion[p.id]?.b && simulacion[p.id]?.a !== '' && (
          <div className="mt-2 text-center text-xs font-bold text-orange-600 bg-orange-50 py-1 rounded">
            ⚠️ En eliminatorias no hay empate. Modificá el resultado sumando los penales.
          </div>
        )}
      </div>
    );
  };

  if (cargando) return <div className="p-10 text-center font-bold text-gray-700">Cargando Motor de Simulación...</div>;

  const esGrupo = pasoActual.startsWith('Grupo');
  const esResumen = pasoActual === 'Resumen';
  
  const partidosA_Mostrar = esGrupo 
    ? datosSimulados.partidos.filter(p => p.fase === 'Fase de Grupos' && p.equipo_a?.grupo === pasoActual.split(' ')[1])
    : datosSimulados.partidos.filter(p => p.fase === pasoActual);

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10">
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          <button 
            onClick={() => setPasoIndex(p => Math.max(0, p - 1))} 
            className={`p-2 ${pasoIndex === 0 ? 'text-transparent' : 'text-rose-800'}`}
          >
            <ChevronLeft size={28} />
          </button>
          
          <div className="text-center">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-widest">
              Paso {pasoIndex + 1} de {pasosTotales.length}
            </span>
            <h2 className="font-black text-gray-900 text-lg">
              {pasoActual}
            </h2>
          </div>
          
          <button 
            onClick={() => setPasoIndex(p => Math.min(pasosTotales.length - 1, p + 1))} 
            className={`p-2 ${pasoIndex === pasosTotales.length - 1 ? 'text-transparent' : 'text-rose-800'}`}
          >
            <ChevronRight size={28} />
          </button>
        </div>
        <div className="w-full bg-gray-200 h-1.5 mt-3 rounded-full overflow-hidden max-w-2xl mx-auto">
          <div className="bg-rose-800 h-full transition-all duration-300" style={{ width: `${((pasoIndex + 1) / pasosTotales.length) * 100}%` }}></div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto mt-2">
        {esGrupo ? (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 text-white text-[10px] uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">Clasificación en Vivo</th>
                    <th className="px-1 py-2 text-center">PTS</th>
                    <th className="px-1 py-2 text-center">DIF</th>
                  </tr>
                </thead>
                <tbody>
                  {calcularTabla(pasoActual.split(' ')[1]).map((eq: any, i) => (
                    <tr key={eq.id} className={`border-b border-gray-100 ${i < 2 ? 'bg-green-50' : i === 2 ? 'bg-rose-50' : ''}`}>
                      <td className="px-3 py-2 font-bold text-gray-900 flex items-center gap-2">
                        <span className="text-gray-400 w-4 text-right">{i + 1}.</span> {eq.bandera_url} {eq.nombre}
                      </td>
                      <td className="text-center font-black text-amber-600">{eq.pts}</td>
                      <td className="text-center font-bold text-gray-600">{eq.gd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-gray-50 p-2 text-[10px] text-gray-500 text-center font-medium border-t">
                Los 2 primeros y los 8 mejores terceros avanzan.
              </div>
            </div>

            <div className="space-y-1">
              {partidosA_Mostrar.map(p => renderFilaPartido(p, false))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={llenarAlAzar}
                className="w-full bg-purple-100 text-purple-700 border-2 border-purple-200 py-4 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition flex items-center justify-center gap-2"
              >
                <Dices size={20} /> Autocompletar Todo
              </button>
              <button 
                onClick={() => setPasoIndex(p => p + 1)}
                className="w-full bg-rose-900 text-white py-4 rounded-xl font-bold text-sm shadow-md active:scale-95 transition flex items-center justify-center gap-2"
              >
                Siguiente Grupo <ArrowRight size={18} />
              </button>
            </div>
          </div>
        ) : esResumen ? (
          <div className="space-y-6 text-center">
            {datosSimulados.clasificados['Ganador F_1'] ? (
              <div className="bg-gradient-to-b from-yellow-50 to-white p-8 rounded-2xl shadow-lg border border-yellow-200">
                <Trophy size={80} className="mx-auto text-yellow-500 mb-4 drop-shadow-md" />
                <h3 className="text-sm font-bold text-yellow-700 uppercase tracking-widest mb-2">Campeón del Mundo 2026</h3>
                <div className="text-6xl mb-2">{datosSimulados.clasificados['Ganador F_1'].bandera_url}</div>
                <h1 className="text-3xl font-black text-gray-900">{datosSimulados.clasificados['Ganador F_1'].nombre}</h1>
              </div>
            ) : (
              <div className="bg-orange-50 p-6 rounded-xl border border-orange-200 flex flex-col items-center">
                <ShieldAlert size={40} className="text-orange-500 mb-2" />
                <p className="font-bold text-orange-800 text-lg">Falta completar partidos</p>
                <p className="text-orange-600 text-sm">Completá todos los resultados hasta la final para ver a tu campeón.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={llenarAlAzar}
                className="w-full bg-purple-100 text-purple-700 border-2 border-purple-200 py-3 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition flex items-center justify-center gap-2"
              >
                <Dices size={18} /> Tirar Dados de Nuevo
              </button>
              <button 
                onClick={() => setPasoIndex(0)}
                className="w-full bg-white text-gray-700 py-3 rounded-xl font-bold text-sm border-2 border-gray-300"
              >
                Volver al inicio
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              {partidosA_Mostrar.map(p => renderFilaPartido(p, true))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={llenarAlAzar}
                className="w-full bg-purple-100 text-purple-700 border-2 border-purple-200 py-4 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition flex items-center justify-center gap-2"
              >
                <Dices size={20} /> Autocompletar Todo
              </button>
              <button 
                onClick={() => setPasoIndex(p => p + 1)}
                className="w-full bg-rose-900 text-white py-4 rounded-xl font-bold text-sm shadow-md active:scale-95 transition flex items-center justify-center gap-2"
              >
                Avanzar de Fase <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}