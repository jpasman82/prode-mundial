"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Trophy } from 'lucide-react';

export default function MiProde() {
  const [pronosticos, setPronosticos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [campeon, setCampeon] = useState<any>(null);
  
  const [vistaActiva, setVistaActiva] = useState<'grupos' | 'eliminatorias'>('grupos');
  const [grupoSeleccionado, setGrupoSeleccionado] = useState('A');
  const [faseEliminatoria, setFaseEliminatoria] = useState('16vos de Final');

  const letrasGrupos = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const fasesEliminatorias = ['16vos de Final', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Tercer Puesto', 'Final'];

  useEffect(() => {
    const cargarMiProde = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from('pronosticos')
        .select(`
          *,
          partido:partidos(id, fase, fecha_hora, codigo_partido),
          equipo_a:equipos!equipo_a_id(id, nombre, bandera_url, grupo),
          equipo_b:equipos!equipo_b_id(id, nombre, bandera_url, grupo)
        `)
        .eq('usuario_id', session.user.id);

      if (data) {
        setPronosticos(data);

        // Buscar al Campeón
        const final = data.find(p => p.partido.fase === 'Final');
        if (final && final.equipo_a && final.equipo_b) {
           if (final.prediccion_goles_a > final.prediccion_goles_b) setCampeon(final.equipo_a);
           else if (final.prediccion_goles_b > final.prediccion_goles_a) setCampeon(final.equipo_b);
        }
      }
      setCargando(false);
    };
    cargarMiProde();
  }, []);

  if (cargando) return <p className="text-center font-bold text-gray-500 mt-10">Cargando tu Prode...</p>;

  if (pronosticos.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center mt-10 bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Aún no hay pronósticos</h2>
        <p className="text-gray-500">Andá a la pestaña "Simulador" para completar tu Prode y ver tus resultados acá.</p>
      </div>
    );
  }

  // Filtrado de pronósticos según la vista actual
  const pronosticosGrupo = pronosticos.filter(p => 
    p.partido.fase === 'Fase de Grupos' && 
    (p.equipo_a?.grupo === grupoSeleccionado || p.equipo_b?.grupo === grupoSeleccionado)
  );

  const pronosticosFase = pronosticos.filter(p => p.partido.fase === faseEliminatoria);

  const renderFilaProde = (p: any) => (
    <div key={p.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col mb-3">
       <span className="text-[10px] font-bold text-gray-400 uppercase text-center mb-2">
         {p.partido.fase === 'Fase de Grupos' ? `Grupo ${p.equipo_a?.grupo}` : p.partido.fase}
       </span>
       <div className="flex items-center justify-between">
         <div className="flex-1 text-right font-bold text-sm text-gray-900 flex items-center justify-end gap-2 min-w-0">
           <span className="truncate">{p.equipo_a?.nombre || 'Por definir'}</span>
           <span className="text-xl flex-shrink-0">{p.equipo_a?.bandera_url || '🛡️'}</span>
         </div>
         
         <div className="px-3 py-1 font-black text-lg text-blue-900 bg-blue-50 rounded-lg mx-2 border border-blue-200">
           {p.prediccion_goles_a} - {p.prediccion_goles_b}
         </div>
         
         <div className="flex-1 text-left font-bold text-sm text-gray-900 flex items-center justify-start gap-2 min-w-0">
           <span className="text-xl flex-shrink-0">{p.equipo_b?.bandera_url || '🛡️'}</span>
           <span className="truncate">{p.equipo_b?.nombre || 'Por definir'}</span>
         </div>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Corona del Campeón */}
      {campeon && (
        <div className="max-w-2xl mx-auto p-4 mb-2">
          <div className="bg-gradient-to-b from-yellow-50 to-white p-6 rounded-2xl border border-yellow-300 text-center shadow-md">
            <Trophy size={48} className="mx-auto text-yellow-500 mb-2 drop-shadow-sm" />
            <h2 className="text-[10px] font-bold text-yellow-700 uppercase tracking-widest mb-1">Tu Campeón</h2>
            <div className="text-5xl mb-1">{campeon.bandera_url}</div>
            <h1 className="text-2xl font-black text-gray-900">{campeon.nombre}</h1>
          </div>
        </div>
      )}

      {/* Navegación del Historial */}
      <div className="bg-white shadow-sm mb-4 sticky top-0 z-10">
        <div className="p-3">
          <div className="flex gap-1 p-1 bg-gray-200 rounded-lg">
            <button onClick={() => setVistaActiva('grupos')} className={`flex-1 py-2 font-bold rounded-md transition-colors ${vistaActiva === 'grupos' ? 'bg-white text-blue-800 shadow' : 'text-gray-700'}`}>Grupos</button>
            <button onClick={() => setVistaActiva('eliminatorias')} className={`flex-1 py-2 font-bold rounded-md transition-colors ${vistaActiva === 'eliminatorias' ? 'bg-white text-blue-800 shadow' : 'text-gray-700'}`}>Llaves</button>
          </div>
        </div>

        {vistaActiva === 'grupos' && (
          <div className="px-3 pb-3">
            <div className="flex overflow-x-auto gap-2 scrollbar-hide">
              {letrasGrupos.map(l => (
                <button 
                  key={l} onClick={() => setGrupoSeleccionado(l)}
                  className={`min-w-[40px] py-1 font-bold rounded-lg border-2 transition-all ${grupoSeleccionado === l ? 'bg-blue-700 text-white border-blue-700' : 'bg-gray-50 text-gray-700 border-gray-300'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}

        {vistaActiva === 'eliminatorias' && (
          <div className="px-3 pb-3">
            <div className="flex overflow-x-auto gap-2 scrollbar-hide">
              {fasesEliminatorias.map(fase => (
                <button 
                  key={fase} onClick={() => setFaseEliminatoria(fase)}
                  className={`whitespace-nowrap px-3 py-1 font-bold rounded-lg border-2 transition-all ${faseEliminatoria === fase ? 'bg-blue-700 text-white border-blue-700' : 'bg-gray-50 text-gray-700 border-gray-300'}`}
                >
                  {fase.replace('de Final', '').trim()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Resultados */}
      <div className="max-w-2xl mx-auto p-4">
        <h3 className="font-bold text-gray-800 mb-4 px-1">
          {vistaActiva === 'grupos' ? `Tus predicciones: Grupo ${grupoSeleccionado}` : `Tu llave: ${faseEliminatoria}`}
        </h3>
        
        <div className="space-y-1">
          {vistaActiva === 'grupos' 
            ? pronosticosGrupo.length > 0 ? pronosticosGrupo.map(renderFilaProde) : <p className="text-gray-500">No hay resultados guardados para este grupo.</p>
            : pronosticosFase.length > 0 ? pronosticosFase.map(renderFilaProde) : <p className="text-gray-500">No hay resultados guardados para esta fase.</p>
          }
        </div>
      </div>
    </div>
  );
}