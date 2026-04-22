"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';

export default function Fixture() {
  const [partidos, setPartidos] = useState<any[]>([]);
  const [equipos, setEquipos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [partidoExpandido, setPartidoExpandido] = useState<string | null>(null);

  const [vistaActiva, setVistaActiva] = useState<'grupos' | 'eliminatorias'>('grupos');
  const [grupoSeleccionado, setGrupoSeleccionado] = useState('A');
  const [faseEliminatoria, setFaseEliminatoria] = useState('16vos de Final');

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const letrasGrupos = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const fasesEliminatorias = ['16vos de Final', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Tercer Puesto', 'Final'];
  const nombresFases: Record<string, string> = {
    '16vos de Final': '16vos',
    'Octavos de Final': 'Octavos',
    'Cuartos de Final': 'Cuartos',
    'Semifinal': 'Semis',
    'Tercer Puesto': '3er Puesto',
    'Final': 'Final'
  };

  useEffect(() => {
    const inicializar = async () => {
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
      setCargando(false);
    };
    inicializar();
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;

    if (vistaActiva === 'grupos') {
      const currentIndex = letrasGrupos.indexOf(grupoSeleccionado);
      if (distance > minSwipeDistance && currentIndex < letrasGrupos.length - 1) {
        setGrupoSeleccionado(letrasGrupos[currentIndex + 1]);
      } else if (distance < -minSwipeDistance && currentIndex > 0) {
        setGrupoSeleccionado(letrasGrupos[currentIndex - 1]);
      }
    } else if (vistaActiva === 'eliminatorias') {
      const currentIndex = fasesEliminatorias.indexOf(faseEliminatoria);
      if (distance > minSwipeDistance && currentIndex < fasesEliminatorias.length - 1) {
        setFaseEliminatoria(fasesEliminatorias[currentIndex + 1]);
      } else if (distance < -minSwipeDistance && currentIndex > 0) {
        setFaseEliminatoria(fasesEliminatorias[currentIndex - 1]);
      }
    }
  };

  const toggleExpandir = (id: string) => {
    setPartidoExpandido(partidoExpandido === id ? null : id);
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

  const renderizarFilaPartido = (partido: any) => {
    const esExpandido = partidoExpandido === partido.id;
    const equiposOk = partido.equipo_a && partido.equipo_b;
    
    const fechaObj = new Date(partido.fecha_hora);
    const hora = fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const fecha = fechaObj.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });

    // Mostramos goles oficiales (si el partido está finalizado) o un guión si está pendiente
    const mostrarGolesA = partido.estado === 'Finalizado' && partido.goles_a !== null ? partido.goles_a : '-';
    const mostrarGolesB = partido.estado === 'Finalizado' && partido.goles_b !== null ? partido.goles_b : '-';

    return (
      <div key={partido.id} className="mb-3 overflow-hidden bg-white border border-gray-300 rounded-xl shadow-sm">
        <div 
          onClick={() => toggleExpandir(partido.id)}
          className="flex flex-col p-3 cursor-pointer active:bg-gray-100"
        >
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide capitalize">
              🗓️ {fecha.replace('.', '')} • {hora}
            </span>
            <div className="text-gray-400">
              {esExpandido ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>

          <div className="flex items-center justify-between w-full">
            <div className="flex items-center justify-end flex-1 gap-2 min-w-0">
              <span className="text-sm font-bold text-gray-900 truncate leading-tight text-right">
                {partido.equipo_a?.nombre || partido.placeholder_a}
              </span>
              <span className="text-2xl flex-shrink-0">{partido.equipo_a?.bandera_url || '🛡️'}</span>
            </div>
            
            {/* VISTA DE SOLO LECTURA: Goles Reales */}
            <div className="px-3">
              <span className={`text-lg font-black bg-gray-100 px-3 py-1 rounded-lg border border-gray-200 ${partido.estado === 'Finalizado' ? 'text-blue-900' : 'text-gray-400'}`}>
                {mostrarGolesA} - {mostrarGolesB}
              </span>
            </div>
            
            <div className="flex items-center justify-start flex-1 gap-2 min-w-0">
              <span className="text-2xl flex-shrink-0">{partido.equipo_b?.bandera_url || '🛡️'}</span>
              <span className="text-sm font-bold text-gray-900 truncate leading-tight text-left">
                {partido.equipo_b?.nombre || partido.placeholder_b}
              </span>
            </div>
          </div>
        </div>

        {esExpandido && (
          <div className="p-4 border-t bg-gray-50 border-gray-200 text-center">
            <div className="flex items-start justify-between w-full mb-4 px-2">
              <div className="flex-1 text-center pr-2">
                <span className="text-sm font-bold text-blue-900 leading-snug break-words">
                  {partido.equipo_a?.nombre || partido.placeholder_a}
                </span>
              </div>
              <div className="flex-1 text-center pl-2">
                <span className="text-sm font-bold text-blue-900 leading-snug break-words">
                  {partido.equipo_b?.nombre || partido.placeholder_b}
                </span>
              </div>
            </div>

            {partido.estadio && (
              <div className="flex justify-center items-center gap-1 text-xs font-bold text-gray-600 mb-2">
                <MapPin size={14} /> {partido.estadio}, {partido.ciudad}
              </div>
            )}
            
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mt-2">
              Estado: <span className={partido.estado === 'Finalizado' ? 'text-green-600' : 'text-orange-500'}>{partido.estado}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const partidosFiltrados = vistaActiva === 'grupos' 
    ? partidos.filter(p => p.fase === 'Fase de Grupos' && (p.equipo_a?.grupo === grupoSeleccionado || p.equipo_b?.grupo === grupoSeleccionado))
    : partidos.filter(p => p.fase === faseEliminatoria);

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <div className="bg-white shadow-sm mb-4">
        <div className="p-3">
          <div className="flex gap-1 p-1 bg-gray-200 rounded-lg">
            <button onClick={() => setVistaActiva('grupos')} className={`flex-1 py-2 font-bold rounded-md transition-colors ${vistaActiva === 'grupos' ? 'bg-white text-blue-800 shadow' : 'text-gray-700'}`}>Fase de Grupos</button>
            <button onClick={() => setVistaActiva('eliminatorias')} className={`flex-1 py-2 font-bold rounded-md transition-colors ${vistaActiva === 'eliminatorias' ? 'bg-white text-blue-800 shadow' : 'text-gray-700'}`}>Eliminatorias</button>
          </div>
        </div>

        {vistaActiva === 'grupos' && (
          <div className="px-3 pb-4">
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

        {vistaActiva === 'eliminatorias' && (
          <div className="px-3 pb-4">
            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
              {fasesEliminatorias.map(fase => (
                <button 
                  key={fase} onClick={() => setFaseEliminatoria(fase)}
                  className={`whitespace-nowrap px-4 py-2 font-bold rounded-lg border-2 transition-all ${faseEliminatoria === fase ? 'bg-blue-700 text-white border-blue-700 shadow-md' : 'bg-gray-50 text-gray-700 border-gray-300 hover:border-blue-400'}`}
                >
                  {nombresFases[fase]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div 
        className="p-4 max-w-2xl mx-auto"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {cargando ? (
          <p className="mt-10 font-bold text-center text-gray-700">Cargando datos oficiales...</p>
        ) : (
          <>
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

            <div className="flex flex-col">
              {partidosFiltrados.length > 0 ? (
                partidosFiltrados.map(renderizarFilaPartido)
              ) : (
                <p className="text-center text-gray-500">No hay partidos.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}