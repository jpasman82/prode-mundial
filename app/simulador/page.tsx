"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ChevronRight, ChevronLeft, Save, Trophy, CheckCircle2 } from 'lucide-react';

export default function Simulador() {
  const [paso, setPaso] = useState(0); // 0-11: Grupos, 12: Llaves, 13: Resumen
  const [partidos, setPartidos] = useState<any[]>([]);
  const [equipos, setEquipos] = useState<any[]>([]);
  const [simulacion, setSimulacion] = useState<Record<string, { a: string, b: string }>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const letrasGrupos = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  useEffect(() => {
    const cargarDatos = async () => {
      const { data: eq } = await supabase.from('equipos').select('*');
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

  const calcularTabla = (grupo: string) => {
    const stats: Record<string, any> = {};
    equipos.filter(e => e.grupo === grupo).forEach(e => {
      stats[e.id] = { ...e, pts: 0, gd: 0, gf: 0 };
    });

    partidos.filter(p => p.fase === 'Fase de Grupos' && (p.equipo_a?.grupo === grupo)).forEach(p => {
      const res = simulacion[p.id];
      if (res && res.a !== '' && res.b !== '') {
        const ga = parseInt(res.a);
        const gb = parseInt(res.b);
        stats[p.equipo_a_id].gf += ga;
        stats[p.equipo_b_id].gf += gb;
        stats[p.equipo_a_id].gd += (ga - gb);
        stats[p.equipo_b_id].gd += (gb - ga);
        if (ga > gb) stats[p.equipo_a_id].pts += 3;
        else if (gb > ga) stats[p.equipo_b_id].pts += 3;
        else { stats[p.equipo_a_id].pts += 1; stats[p.equipo_b_id].pts += 1; }
      }
    });

    return Object.values(stats).sort((a: any, b: any) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  };

  const obtenerClasificados = () => {
    let clasificados: any[] = [];
    let terceros: any[] = [];

    letrasGrupos.forEach(l => {
      const tabla = calcularTabla(l);
      clasificados.push({ pos: `1${l}`, equipo: tabla[0] });
      clasificados.push({ pos: `2${l}`, equipo: tabla[1] });
      terceros.push({ pos: `3${l}`, equipo: tabla[2], pts: tabla[2].pts, gd: tabla[2].gd, gf: tabla[2].gf });
    });

    // Los 8 mejores terceros
    const mejoresTerceros = terceros
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
      .slice(0, 8);

    return { principales: clasificados, mejoresTerceros };
  };

  const guardarComoPronostico = async () => {
    setGuardando(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return alert("Debes iniciar sesión");

    const inserts = Object.entries(simulacion).map(([partido_id, res]) => ({
      usuario_id: session.user.id,
      partido_id,
      prediccion_goles_a: parseInt(res.a),
      prediccion_goles_b: parseInt(res.b)
    }));

    const { error } = await supabase.from('pronosticos').upsert(inserts, { onConflict: 'usuario_id,partido_id' });
    
    setGuardando(false);
    if (error) alert("Error al guardar");
    else alert("¡Simulación guardada como tu Prode oficial! 🏆");
  };

  if (cargando) return <div className="p-10 text-center font-bold text-gray-700">Cargando simulador...</div>;

  const esGrupo = paso < 12;
  const letraActual = letrasGrupos[paso];
  const partidosActuales = esGrupo ? partidos.filter(p => p.fase === 'Fase de Grupos' && p.equipo_a?.grupo === letraActual) : [];

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      {/* Cabecera Progreso */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10">
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          <button onClick={() => setPaso(p => Math.max(0, p - 1))} className="p-2 text-gray-600"><ChevronLeft /></button>
          <div className="text-center">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Paso {paso + 1} de 14</span>
            <h2 className="font-black text-gray-900 text-lg">
              {paso < 12 ? `Grupo ${letraActual}` : paso === 12 ? "Eliminatorias" : "Resumen Final"}
            </h2>
          </div>
          <button onClick={() => setPaso(p => Math.min(13, p + 1))} className="p-2 text-gray-600"><ChevronRight /></button>
        </div>
        {/* Barra de progreso visual */}
        <div className="w-full bg-gray-200 h-1.5 mt-3 rounded-full overflow-hidden">
          <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${((paso + 1) / 14) * 100}%` }}></div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {esGrupo ? (
          <div className="space-y-6">
            {/* Tabla en tiempo real */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 text-white text-[10px] uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Pos</th>
                    <th className="px-1 py-2 text-center">PTS</th>
                    <th className="px-1 py-2 text-center">GD</th>
                  </tr>
                </thead>
                <tbody>
                  {calcularTabla(letraActual).map((eq: any, i) => (
                    <tr key={eq.id} className={`border-b ${i < 2 ? 'bg-green-50' : i === 2 ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 py-2 font-bold text-gray-900 flex items-center gap-2">
                        {i + 1}. {eq.bandera_url} {eq.nombre}
                      </td>
                      <td className="text-center font-black text-blue-700">{eq.pts}</td>
                      <td className="text-center font-bold text-gray-600">{eq.gd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Partidos del Grupo */}
            <div className="space-y-3">
              {partidosActuales.map(p => (
                <div key={p.id} className="bg-white p-4 rounded-xl border border-gray-300 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 text-right font-bold text-gray-900 text-sm">
                      {p.equipo_a.nombre} {p.equipo_a.bandera_url}
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        value={simulacion[p.id]?.a || ''} 
                        onChange={(e) => handleScore(p.id, 'a', e.target.value)}
                        className="w-12 h-12 text-center border-2 border-gray-300 rounded-lg font-bold text-xl focus:border-blue-600"
                      />
                      <input 
                        type="number" 
                        value={simulacion[p.id]?.b || ''} 
                        onChange={(e) => handleScore(p.id, 'b', e.target.value)}
                        className="w-12 h-12 text-center border-2 border-gray-300 rounded-lg font-bold text-xl focus:border-blue-600"
                      />
                    </div>
                    <div className="flex-1 text-left font-bold text-gray-900 text-sm">
                      {p.equipo_b.bandera_url} {p.equipo_b.nombre}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <button 
              onClick={() => setPaso(p => p + 1)}
              className="w-full bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition"
            >
              Confirmar Grupo {letraActual}
            </button>
          </div>
        ) : paso === 12 ? (
          <div className="text-center p-6">
            <Trophy size={64} className="mx-auto text-yellow-500 mb-4" />
            <h3 className="text-xl font-bold text-gray-900">¡Fase de Grupos Completa!</h3>
            <p className="text-gray-600 mb-6">El sistema calculó los 32 clasificados según tus resultados.</p>
            {/* Aquí iría la lógica visual de las llaves, por ahora mostramos el botón al resumen */}
            <button 
              onClick={() => setPaso(13)}
              className="w-full bg-green-600 text-white py-4 rounded-xl font-bold"
            >
              Ver Resumen y Guardar
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-green-600 text-white p-6 rounded-2xl text-center shadow-xl">
              <CheckCircle2 size={48} className="mx-auto mb-2" />
              <h2 className="text-2xl font-black">Simulación Lista</h2>
              <p className="text-green-100 text-sm">Ya podés aplicar estos resultados a tu Prode real.</p>
            </div>

            <button 
              onClick={guardarComoPronostico}
              disabled={guardando}
              className="w-full bg-blue-700 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2"
            >
              <Save /> {guardando ? "Guardando..." : "Guardar como mi Prode oficial"}
            </button>

            <button 
              onClick={() => setPaso(0)}
              className="w-full bg-white text-gray-700 py-4 rounded-xl font-bold border border-gray-300"
            >
              Reiniciar Simulación
            </button>
          </div>
        )}
      </div>
    </div>
  );
}