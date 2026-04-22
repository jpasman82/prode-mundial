"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

export default function Fixture() {
  const [partidos, setPartidos] = useState<any[]>([]);
  const [equipos, setEquipos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [predicciones, setPredicciones] = useState<Record<string, { a: string, b: string }>>({});
  const [guardandoPartido, setGuardandoPartido] = useState<string | null>(null);

  const [vistaActiva, setVistaActiva] = useState<'grupos' | 'eliminatorias'>('grupos');
  const [grupoSeleccionado, setGrupoSeleccionado] = useState('A');

  const letrasGrupos = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  useEffect(() => {
    const inicializar = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);

      const { data: equiposData } = await supabase
        .from('equipos')
        .select('*')
        .order('nombre');

      if (equiposData) setEquipos(equiposData);

      const { data: partidosData } = await supabase
        .from('partidos')
        .select(`
          id, fecha_hora, fase, estado, goles_a, goles_b, estadio, ciudad, placeholder_a, placeholder_b,
          equipo_a_id, equipo_b_id,
          equipo_a:equipos!equipo_a_id(id, nombre, bandera_url),
          equipo_b:equipos!equipo_b_id(id, nombre, bandera_url)
        `)
        .order('fecha_hora', { ascending: true });

      if (partidosData) setPartidos(partidosData);

      const { data: misPronosticos } = await supabase
        .from('pronosticos')
        .select('*')
        .eq('usuario_id', session.user.id);

      if (misPronosticos) {
        const prediccionesCargadas: Record<string, { a: string, b: string }> = {};
        misPronosticos.forEach((p) => {
          prediccionesCargadas[p.partido_id] = {
            a: p.prediccion_goles_a.toString(),
            b: p.prediccion_goles_b.toString(),
          };
        });
        setPredicciones(prediccionesCargadas);
      }

      setCargando(false);
    };

    inicializar();
  }, []);

  const handleCambio = (partidoId: string, equipo: 'a' | 'b', valor: string) => {
    setPredicciones((prev) => ({
      ...prev,
      [partidoId]: {
        a: prev[partidoId]?.a ?? '',
        b: prev[partidoId]?.b ?? '',
        [equipo]: valor,
      },
    }));
  };

  const guardarPronostico = async (partidoId: string) => {
    if (!userId) return;
    
    const pred = predicciones[partidoId];
    if (!pred || pred.a === undefined || pred.b === undefined || pred.a === '' || pred.b === '') {
      alert('¡Tenés que poner los dos resultados antes de guardar!');
      return;
    }

    setGuardandoPartido(partidoId);

    try {
      const { data: existe } = await supabase
        .from('pronosticos')
        .select('id')
        .eq('usuario_id', userId)
        .eq('partido_id', partidoId)
        .maybeSingle();

      if (existe) {
        const { error } = await supabase.from('pronosticos').update({
          prediccion_goles_a: parseInt(pred.a),
          prediccion_goles_b: parseInt(pred.b)
        }).eq('id', existe.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pronosticos').insert([{
          usuario_id: userId,
          partido_id: partidoId,
          prediccion_goles_a: parseInt(pred.a),
          prediccion_goles_b: parseInt(pred.b)
        }]);
        if (error) throw error;
      }
      alert('¡Pronóstico guardado con éxito! ✅');
    } catch (error: any) {
      alert('Hubo un error al guardar: ' + error.message);
    } finally {
      setGuardandoPartido(null);
    }
  };

  const calcularTablaPosiciones = (grupo: string) => {
    const stats: Record<string, any> = {};
    
    equipos.filter(eq => eq.grupo === grupo).forEach(eq => {
      stats[eq.id] = { ...eq, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 };
    });

    partidos.forEach(p => {
      if (p.estado === 'Finalizado' && p.equipo_a_id && p.equipo_b_id) {
        const a = p.equipo_a_id;
        const b = p.equipo_b_id;
        
        if (stats[a] && stats[b]) {
          stats[a].pj += 1;
          stats[b].pj += 1;
          stats[a].gf += p.goles_a;
          stats[a].gc += p.goles_b;
          stats[b].gf += p.goles_b;
          stats[b].gc += p.goles_a;
          
          if (p.goles_a > p.goles_b) {
            stats[a].pg += 1;
            stats[a].pts += 3;
            stats[b].pp += 1;
          } else if (p.goles_b > p.goles_a) {
            stats[b].pg += 1;
            stats[b].pts += 3;
            stats[a].pp += 1;
          } else {
            stats[a].pe += 1;
            stats[b].pe += 1;
            stats[a].pts += 1;
            stats[b].pts += 1;
          }
        }
      }
    });

    return Object.values(stats).sort((a: any, b: any) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const difB = b.gf - b.gc;
      const difA = a.gf - a.gc;
      if (difB !== difA) return difB - difA;
      return b.gf - a.gf;
    });
  };

  const formatearFecha = (fechaUtc: string) => {
    const fecha = new Date(fechaUtc);
    return fecha.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const renderizarPartido = (partido: any) => {
    const pred = predicciones[partido.id] || { a: '', b: '' };
    const estaGuardando = guardandoPartido === partido.id;
    const equiposDefinidos = partido.equipo_a && partido.equipo_b;
    const nombreA = partido.equipo_a ? partido.equipo_a.nombre : partido.placeholder_a;
    const banderaA = partido.equipo_a ? partido.equipo_a.bandera_url : '🛡️';
    const nombreB = partido.equipo_b ? partido.equipo_b.nombre : partido.placeholder_b;
    const banderaB = partido.equipo_b ? partido.equipo_b.bandera_url : '🛡️';

    return (
      <div key={partido.id} className={`bg-white p-4 rounded-xl shadow-sm border-t-4 ${equiposDefinidos ? 'border-green-500' : 'border-gray-300 opacity-75'}`}>
        <div className="text-center mb-4 flex flex-col items-center gap-1">
          <span className={`text-xs font-bold py-1 px-3 rounded-full uppercase tracking-wider ${equiposDefinidos ? 'bg-gray-200 text-gray-700' : 'bg-orange-100 text-orange-800'}`}>
            {partido.fase}
          </span>
          <span className="text-xs text-gray-500 font-bold">
            🗓️ {formatearFecha(partido.fecha_hora)}
          </span>
          {partido.estadio && (
            <span className="text-xs text-gray-500 font-medium">
              📍 {partido.estadio}, {partido.ciudad}
            </span>
          )}
        </div>
        
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-col items-center w-1/3">
            <span className={`text-4xl mb-2 ${!partido.equipo_a && 'grayscale opacity-50'}`}>{banderaA}</span>
            <span className="font-bold text-sm text-center leading-tight">{nombreA}</span>
          </div>
          <div className="flex items-center gap-2 w-1/3 justify-center">
            <input 
              type="number" value={pred.a ?? ''} onChange={(e) => handleCambio(partido.id, 'a', e.target.value)}
              disabled={!equiposDefinidos}
              className="w-14 h-14 text-center text-2xl font-bold border border-gray-300 rounded-lg outline-none focus:border-green-500 bg-gray-50 disabled:bg-gray-200"
              min="0"
            />
            <span className="font-bold text-gray-400">-</span>
            <input 
              type="number" value={pred.b ?? ''} onChange={(e) => handleCambio(partido.id, 'b', e.target.value)}
              disabled={!equiposDefinidos}
              className="w-14 h-14 text-center text-2xl font-bold border border-gray-300 rounded-lg outline-none focus:border-green-500 bg-gray-50 disabled:bg-gray-200"
              min="0"
            />
          </div>
          <div className="flex flex-col items-center w-1/3">
            <span className={`text-4xl mb-2 ${!partido.equipo_b && 'grayscale opacity-50'}`}>{banderaB}</span>
            <span className="font-bold text-sm text-center leading-tight">{nombreB}</span>
          </div>
        </div>
        <button 
          onClick={() => guardarPronostico(partido.id)}
          disabled={estaGuardando || !equiposDefinidos}
          className={`w-full font-bold py-3 rounded-lg transition ${equiposDefinidos ? 'bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
        >
          {estaGuardando ? 'Guardando...' : equiposDefinidos ? 'Guardar Pronóstico' : 'Equipos sin definir'}
        </button>
      </div>
    );
  };

  const partidosDelGrupo = partidos.filter(p => 
    p.fase === 'Fase de Grupos' && 
    (p.equipo_a?.grupo === grupoSeleccionado || p.equipo_b?.grupo === grupoSeleccionado)
  );

  const partidosEliminatorias = partidos.filter(p => p.fase !== 'Fase de Grupos');

  return (
    <div className="min-h-screen bg-gray-100 pb-10">
      <div className="bg-white shadow-sm p-4 sticky top-0 z-10">
        <header className="flex items-center gap-4 max-w-2xl mx-auto">
          <Link href="/dashboard" className="text-blue-600 font-bold text-xl">
            ← Volver
          </Link>
          <h1 className="text-xl font-bold text-gray-800 flex-1">Torneo</h1>
        </header>
        
        <div className="flex bg-gray-200 p-1 rounded-lg mt-4 max-w-2xl mx-auto">
          <button 
            onClick={() => setVistaActiva('grupos')}
            className={`flex-1 py-2 font-bold rounded-md transition ${vistaActiva === 'grupos' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:bg-gray-300'}`}
          >
            Fase de Grupos
          </button>
          <button 
            onClick={() => setVistaActiva('eliminatorias')}
            className={`flex-1 py-2 font-bold rounded-md transition ${vistaActiva === 'eliminatorias' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:bg-gray-300'}`}
          >
            Eliminatorias
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 mt-4">
        {cargando ? (
          <p className="text-center text-gray-500 font-bold mt-10">Cargando base de datos...</p>
        ) : vistaActiva === 'grupos' ? (
          <div className="flex flex-col gap-6">
            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
              {letrasGrupos.map(letra => (
                <button
                  key={letra}
                  onClick={() => setGrupoSeleccionado(letra)}
                  className={`min-w-[48px] h-12 rounded-full font-bold text-lg flex items-center justify-center transition border-2 ${grupoSeleccionado === letra ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                >
                  {letra}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
              <div className="bg-blue-600 text-white p-3">
                <h2 className="font-bold text-lg">Posiciones Grupo {grupoSeleccionado}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 border-b">
                    <tr>
                      <th className="px-4 py-3">País</th>
                      <th className="px-2 py-3 text-center">PTS</th>
                      <th className="px-2 py-3 text-center text-gray-400">PJ</th>
                      <th className="px-2 py-3 text-center text-gray-400">GF</th>
                      <th className="px-2 py-3 text-center text-gray-400">GC</th>
                      <th className="px-2 py-3 text-center text-gray-400">DIF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calcularTablaPosiciones(grupoSeleccionado).map((eq: any, index: number) => (
                      <tr key={eq.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 flex items-center gap-2 font-bold">
                          <span>{index + 1}.</span>
                          <span className="text-xl">{eq.bandera_url}</span>
                          {eq.nombre}
                        </td>
                        <td className="px-2 py-3 text-center font-bold text-blue-600">{eq.pts}</td>
                        <td className="px-2 py-3 text-center text-gray-500">{eq.pj}</td>
                        <td className="px-2 py-3 text-center text-gray-500">{eq.gf}</td>
                        <td className="px-2 py-3 text-center text-gray-500">{eq.gc}</td>
                        <td className="px-2 py-3 text-center text-gray-500">{eq.gf - eq.gc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="font-bold text-gray-700 mb-4 text-lg">Partidos del Grupo {grupoSeleccionado}</h3>
              <div className="flex flex-col gap-4">
                {partidosDelGrupo.length > 0 
                  ? partidosDelGrupo.map(renderizarPartido)
                  : <p className="text-gray-500">No hay partidos cargados para este grupo.</p>
                }
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {['16vos de Final', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Tercer Puesto', 'Final'].map(fase => {
              const partidosFase = partidosEliminatorias.filter(p => p.fase === fase);
              if (partidosFase.length === 0) return null;
              
              return (
                <div key={fase}>
                  <h3 className="font-bold text-xl text-gray-800 mb-4 border-b-2 border-gray-300 pb-2">{fase}</h3>
                  <div className="flex flex-col gap-4">
                    {partidosFase.map(renderizarPartido)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}