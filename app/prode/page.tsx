"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Trophy } from 'lucide-react';

export default function MiProde() {
  const [pronosticos, setPronosticos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [campeon, setCampeon] = useState<any>(null);

  useEffect(() => {
    const cargarMiProde = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from('pronosticos')
        .select(`
          *,
          partido:partidos(fase, fecha_hora),
          equipo_a:equipos!equipo_a_id(nombre, bandera_url),
          equipo_b:equipos!equipo_b_id(nombre, bandera_url)
        `)
        .eq('usuario_id', session.user.id);

      if (data) {
        // Ordenamos los partidos por fecha
        const ordenados = data.sort((a, b) => new Date(a.partido.fecha_hora).getTime() - new Date(b.partido.fecha_hora).getTime());
        setPronosticos(ordenados);

        // Buscamos quién ganó la Final en tu simulación
        const final = ordenados.find(p => p.partido.fase === 'Final');
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

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-10">
      {campeon ? (
        <div className="bg-gradient-to-b from-yellow-50 to-white p-6 rounded-2xl border border-yellow-300 text-center shadow-md">
          <Trophy size={56} className="mx-auto text-yellow-500 mb-2 drop-shadow-sm" />
          <h2 className="text-xs font-bold text-yellow-700 uppercase tracking-widest mb-2">Tu Campeón Pronosticado</h2>
          <div className="text-6xl mb-2">{campeon.bandera_url}</div>
          <h1 className="text-3xl font-black text-gray-900">{campeon.nombre}</h1>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-2xl shadow-sm text-center border-2 border-dashed border-gray-300">
          <p className="text-gray-500 font-medium">Aún no simulaste hasta la final. ¡Completá el simulador para ver a tu campeón acá!</p>
        </div>
      )}

      <div>
        <h3 className="font-bold text-lg text-gray-800 border-b-2 border-gray-300 pb-2 mb-4">
          Tus Resultados Guardados ({pronosticos.length}/104)
        </h3>
        
        <div className="space-y-3">
          {pronosticos.map(p => (
            <div key={p.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col">
               <span className="text-[10px] font-bold text-gray-400 uppercase text-center mb-2">{p.partido.fase}</span>
               <div className="flex items-center justify-between">
                 <div className="flex-1 text-right font-bold text-sm text-gray-900 flex items-center justify-end gap-2">
                   <span className="truncate">{p.equipo_a?.nombre || 'Por definir'}</span>
                   <span className="text-xl">{p.equipo_a?.bandera_url || '🛡️'}</span>
                 </div>
                 
                 <div className="px-3 py-1 font-black text-lg text-blue-900 bg-gray-100 rounded-lg mx-2 border border-gray-200">
                   {p.prediccion_goles_a} - {p.prediccion_goles_b}
                 </div>
                 
                 <div className="flex-1 text-left font-bold text-sm text-gray-900 flex items-center justify-start gap-2">
                   <span className="text-xl">{p.equipo_b?.bandera_url || '🛡️'}</span>
                   <span className="truncate">{p.equipo_b?.nombre || 'Por definir'}</span>
                 </div>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}