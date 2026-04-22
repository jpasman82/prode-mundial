"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';

export default function Fixture() {
  const [partidos, setPartidos] = useState<any[]>([]);
  const [equipos, setEquipos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [predicciones, setPredicciones] = useState<Record<string, { a: string, b: string }>>({});
  const [guardandoPartido, setGuardandoPartido] = useState<string | null>(null);
  
  // Estado para controlar qué partido está abierto (acordeón)
  const [partidoExpandido, setPartidoExpandido] = useState<string | null>(null);

  const [vistaActiva, setVistaActiva] = useState<'grupos' | 'eliminatorias'>('grupos');
  const [grupoSeleccionado, setGrupoSeleccionado] = useState('A');

  const letrasGrupos = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  useEffect(() => {
    const inicializar = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);

      const { data: equiposData } = await supabase.from('equipos').select('*').order('nombre');
      if (equiposData) setEquipos(equiposData);

      const { data: partidosData } = await supabase
        .from('partidos')
        .select(`
          id, fecha_hora, fase, estado, goles_a, goles_b, estadio, ciudad, placeholder_a, placeholder_b,
          equipo_a_id, equipo_b_id,
          equipo_a:equipos!equipo_a_id(id, nombre, bandera_url, grupo),
          equipo_b:equipos!equipo_b_id(id, nombre, bandera_url, grupo)
        `)
        .order('fecha_hora', { ascending: true });

      if (partidosData) setPartidos(partidosData);

      const { data: misPronosticos } = await supabase
        .from('pronosticos')
        .select('*')
        .eq('usuario_id', session.user.id);

      if (misPronosticos) {
        const preds: Record<string, { a: string, b: string }> = {};
        misPronosticos.forEach((p) => {
          preds[p.partido_id] = { a: p.prediccion_goles_a.toString(), b: p.prediccion_goles_b.toString() };
        });
        setPredicciones(preds);
      }
      setCargando(false);
    };
    inicializar();
  }, []);

  const toggleExpandir = (id: string) => {
    // Si toco el que ya está abierto, lo cierro. Si toco otro, lo abro.
    setPartidoExpandido(partidoExpandido === id ? null : id);
  };

  const handleCambio = (partidoId: string, equipo: 'a' | 'b', valor: string) => {
    setPredicciones((prev) => ({
      ...prev,
      [partidoId]: { ...prev[partidoId], [equipo]: valor }
    }));
  };

  const guardarPronostico = async (partidoId: string) => {
    if (!userId) return;
    const pred = predicciones[partidoId];
    if (!pred || pred.a === '' || pred.b === '') return alert('¡Completá ambos resultados!');

    setGuardandoPartido(partidoId);
    try {
      const { data: existe } = await supabase.from('pronosticos').select('id').eq('usuario_id', userId).eq('partido_id', partidoId).maybeSingle();
      if (existe) {
        await supabase.from('pronosticos').update({ prediccion_goles_a: parseInt(pred.a), prediccion_goles_b: parseInt(pred.b) }).eq('id', existe.id);
      } else {
        await supabase.from('pronosticos').insert([{ usuario_id: userId, partido_id: partidoId, prediccion_goles_a: parseInt(pred.a), prediccion_goles_b: parseInt(pred.b) }]);
      }
      alert('¡Pronóstico guardado! ✅');
      setPartidoExpandido(null); // Cierra el acordeón al guardar
    } catch (e) {
      alert('Error al guardar');
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
          stats[a].pj += 1; stats[b].pj += 1;
          stats[a].gf += p.goles_a; stats[a].gc += p.goles_b;
          stats[b].gf += p.goles_b; stats[b].gc += p.goles_a;
          if (p.goles_a > p.goles_b) { stats[a].pg += 1; stats[a].pts += 3; stats[b].pp += 1; } 
          else if (p.goles_b > p.goles_a) { stats[b].pg += 1; stats[b].pts += 3; stats[a].pp += 1; } 
          else { stats[a].pe += 1; stats[b].pe += 1; stats[a].pts += 1; stats[b].pts += 1; }
        }
      }
    });

    return Object.values(stats).sort((a: any, b: any) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const difB = b.gf - b.gc; const difA = a.gf - a.gc;
      if (difB !== difA) return difB - difA;
      return b.gf - a.gf;
    });
  };

  // VERSIÓN COMPACTA DE LA FILA DEL PARTIDO
  const renderizarFilaPartido = (partido: any) => {
    const esExpandido = partidoExpandido === partido.id;
    const pred = predicciones[partido.id] || { a: '', b: '' };
    const equiposOk = partido.equipo_a && partido.equipo_b;
    
    // Formato de fecha corto (ej: "11 jun") y hora (ej: "16:00")
    const fechaObj = new Date(partido.fecha_hora);
    const hora = fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const fecha = fechaObj.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

    return (
      <div key={partido.id} className="mb-2 overflow-hidden bg-white border border-gray-300 rounded-lg shadow-sm">
        {/* Cabecera de la fila (Siempre visible) */}
        <div 
          onClick={() => toggleExpandir(partido.id)}
          className="flex items-center justify-between p-3 cursor-pointer active:bg-gray-100"
        >
          {/* Fecha y Hora a la izquierda */}
          <div className="flex flex-col items-start w-14 border-r border-gray-200 pr-2">
            <span className="text-[10px] font-bold text-gray-600 uppercase">{fecha}</span>
            <span className="text-xs font-bold text-blue-800">{hora}</span>
          </div>

          {/* Equipos en el centro */}
          <div className="flex items-center flex-1 gap-2 px-2">
            <div className="flex items-center justify-end flex-1 gap-2">
              <span className="text-sm font-bold text-gray-900 truncate">
                {partido.equipo_a?.nombre || partido.placeholder_a}
              </span>
              <span className="text-2xl">{partido.equipo_a?.bandera_url || '🛡️'}</span>
            </div>
            
            <span className="text-xs font-bold text-gray-400">vs</span>
            
            <div className="flex items-center flex-1 gap-2">
              <span className="text-2xl">{partido.equipo_b?.bandera_url || '🛡️'}</span>
              <span className="text-sm font-bold text-gray-900 truncate">
                {partido.equipo_b?.nombre || partido.placeholder_b}
              </span>
            </div>
          </div>
          
          {/* Flechita a la derecha */}
          <div className="ml-1 text-gray-500">
            {esExpandido ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>

        {/* Panel Expandible (Carga de pronóstico y estadio) */}
        {esExpandido && (
          <div className="p-4 border-t bg-gray-50 border-gray-200">
            {partido.estadio && (
              <div className="flex justify-center items-center gap-1 mb-4 text-xs font-bold text-gray-600">
                <MapPin size={14} /> {partido.estadio}, {partido.ciudad}
              </div>
            )}
            
            <div className="flex items-center justify-center gap-4 mb-4">
              <input 
                type="number" value={pred.a} onChange={(e) => handleCambio(partido.id, 'a', e.target.value)}
                disabled={!equiposOk}
                className="w-16 h-14 text-2xl font-bold text-center bg-white border-2 border-gray-400 rounded-lg outline-none focus:border-blue-600 text-gray-900 disabled:bg-gray-200"
              />
              <span className="text-xl font-bold text-gray-500">-</span>
              <input 
                type="number" value={pred.b} onChange={(e) => handleCambio(partido.id, 'b', e.target.value)}
                disabled={!equiposOk}
                className="w-16 h-14 text-2xl font-bold text-center bg-white border-2 border-gray-400 rounded-lg outline-none focus:border-blue-600 text-gray-900 disabled:bg-gray-200"
              />
            </div>

            <button 
              onClick={() => guardarPronostico(partido.id)}
              disabled={!equiposOk || guardandoPartido === partido.id}
              className="w-full py-3 font-bold text-white transition bg-green-600 rounded-lg active:scale-95 disabled:bg-gray-400"
            >
              {guardandoPartido === partido.id ? 'Guardando...' : equiposOk ? 'Guardar Pronóstico' : 'Esperando rivales'}
            </button>
          </div>
        )}
      </div>
    );
  };

  const partidosFiltrados = vistaActiva === 'grupos' 
    ? partidos.filter(p => p.fase === 'Fase de Grupos' && (p.equipo_a?.grupo === grupoSeleccionado || p.equipo_b?.grupo === grupoSeleccionado))
    : partidos.filter(p => p.fase !== 'Fase de Grupos');

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <div className="sticky top-0 z-20 bg-white shadow-sm">
        {/* Selector Grupos / Llaves */}
        <div className="p-3 bg-white">
          <div className="flex gap-1 p-1 bg-gray-200 rounded-lg">
            <button onClick={() => setVistaActiva('grupos')} className={`flex-1 py-2 font-bold rounded-md ${vistaActiva === 'grupos' ? 'bg-white text-blue-800 shadow' : 'text-gray-700'}`}>Fase de Grupos</button>
            <button onClick={() => setVistaActiva('eliminatorias')} className={`flex-1 py-2 font-bold rounded-md ${vistaActiva === 'eliminatorias' ? 'bg-white text-blue-800 shadow' : 'text-gray-700'}`}>Eliminatorias</button>
          </div>
        </div>

        {/* Cuadrícula de Botones de Grupo (Solo visible en Fase de Grupos) */}
        {vistaActiva === 'grupos' && (
          <div className="px-3 pb-3 bg-white border-b border-gray-200">
            <div className="grid grid-cols-6 gap-2">
              {letrasGrupos.map(l => (
                <button 
                  key={l} onClick={() => setGrupoSeleccionado(l)}
                  className={`py-2 font-bold rounded-lg border-2 transition-all ${grupoSeleccionado === l ? 'bg-blue-700 text-white border-blue-700 shadow-md' : 'bg-gray-50 text-gray-700 border-gray-300 hover:border-blue-400'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {cargando ? (
          <p className="mt-10 font-bold text-center text-gray-700">Cargando partidos...</p>
        ) : (
          <>
            {/* Tabla de posiciones si estamos en grupos */}
            {vistaActiva === 'grupos' && (
               <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-300 mb-6">
                 <div className="bg-blue-800 text-white p-2 text-center">
                   <h2 className="font-bold">Grupo {grupoSeleccionado}</h2>
                 </div>
                 <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-gray-100 text-gray-800 border-b-2 border-gray-300">
                       <tr>
                         <th className="px-3 py-2">País</th>
                         <th className="px-1 py-2 text-center">PTS</th>
                         <th className="px-1 py-2 text-center text-gray-600">PJ</th>
                         <th className="px-1 py-2 text-center text-gray-600">GF</th>
                         <th className="px-1 py-2 text-center text-gray-600">GC</th>
                       </tr>
                     </thead>
                     <tbody>
                       {calcularTablaPosiciones(grupoSeleccionado).map((eq: any, index: number) => (
                         <tr key={eq.id} className="border-b border-gray-200 last:border-0">
                           <td className="px-3 py-2 flex items-center gap-2 font-bold text-gray-900">
                             <span className="text-gray-500">{index + 1}.</span>
                             <span className="text-lg">{eq.bandera_url}</span>
                             {eq.nombre}
                           </td>
                           <td className="px-1 py-2 text-center font-bold text-blue-800">{eq.pts}</td>
                           <td className="px-1 py-2 text-center text-gray-700">{eq.pj}</td>
                           <td className="px-1 py-2 text-center text-gray-700">{eq.gf}</td>
                           <td className="px-1 py-2 text-center text-gray-700">{eq.gc}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
            )}

            {/* Lista de Partidos */}
            {vistaActiva === 'grupos' ? (
              <div className="flex flex-col">
                {partidosFiltrados.length > 0 ? partidosFiltrados.map(renderizarFilaPartido) : <p className="text-center text-gray-500">No hay partidos.</p>}
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {['16vos de Final', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Tercer Puesto', 'Final'].map(fase => {
                  const partidosFase = partidosFiltrados.filter(p => p.fase === fase);
                  if (partidosFase.length === 0) return null;
                  return (
                    <div key={fase}>
                      <h3 className="font-bold text-lg text-gray-800 mb-3 border-b-2 border-gray-300 pb-1">{fase}</h3>
                      {partidosFase.map(renderizarFilaPartido)}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}