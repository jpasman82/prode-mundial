"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

export default function AdminPanel() {
  const [partidos, setPartidos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  
  // Guardamos temporalmente los goles oficiales que estás tipeando
  const [golesOficiales, setGolesOficiales] = useState<Record<string, { a: string, b: string }>>({});

  const cargarPartidos = async () => {
    setCargando(true);
    const { data } = await supabase
      .from('partidos')
      .select(`
        id, fecha_hora, fase, estado, goles_a, goles_b, placeholder_a, placeholder_b,
        equipo_a:equipos!equipo_a_id(id, nombre, bandera_url),
        equipo_b:equipos!equipo_b_id(id, nombre, bandera_url)
      `)
      .order('fecha_hora', { ascending: true });

    if (data) {
      setPartidos(data);
    }
    setCargando(false);
  };

  useEffect(() => {
    cargarPartidos();
  }, []);

  const handleCambio = (partidoId: string, equipo: 'a' | 'b', valor: string) => {
    setGolesOficiales((prev) => ({
      ...prev,
      [partidoId]: {
        a: prev[partidoId]?.a ?? '',
        b: prev[partidoId]?.b ?? '',
        [equipo]: valor,
      },
    }));
  };

  const finalizarPartido = async (partidoId: string) => {
    const res = golesOficiales[partidoId];
    
    if (!res || res.a === '' || res.b === '') {
      alert('⚠️ Tenés que poner los goles de los dos equipos antes de finalizar.');
      return;
    }

    const confirmar = confirm('¿Estás seguro? Esto va a repartir los puntos a todos los jugadores y no se puede deshacer fácilmente.');
    if (!confirmar) return;

    // Actualizamos la base de datos oficial
    const { error } = await supabase
      .from('partidos')
      .update({
        goles_a: parseInt(res.a),
        goles_b: parseInt(res.b),
        estado: 'Finalizado' // ¡Esta palabra es la que dispara el cálculo de puntos!
      })
      .eq('id', partidoId);

    if (error) {
      alert('Hubo un error: ' + error.message);
    } else {
      alert('¡Partido finalizado y puntos repartidos! 🏆');
      cargarPartidos(); // Recargamos para que desaparezca el botón
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 font-sans">
      <header className="flex items-center mb-6 gap-4 border-b border-gray-700 pb-4">
        <Link href="/dashboard" className="text-blue-400 font-bold text-xl hover:text-blue-300">
          ← Volver
        </Link>
        <h1 className="text-xl font-bold text-white flex-1">Panel de Control Admin ⚙️</h1>
      </header>

      <div className="max-w-2xl mx-auto bg-gray-800 rounded-xl p-6 shadow-2xl border border-gray-700">
        <p className="text-gray-400 mb-6 text-sm">
          Atención: Los resultados que cargues acá son los oficiales. Al tocar "Finalizar", el sistema calculará automáticamente los puntos de todos los usuarios.
        </p>

        {cargando ? (
          <p className="text-center text-gray-500 py-10">Cargando base de datos...</p>
        ) : partidos.length === 0 ? (
          <p className="text-center text-gray-500 py-10">No hay partidos cargados.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {partidos.map((partido) => {
              const estaFinalizado = partido.estado === 'Finalizado';
              const goles = golesOficiales[partido.id] || { a: '', b: '' };

              return (
                <div key={partido.id} className={`p-4 rounded-lg flex items-center justify-between gap-4 ${estaFinalizado ? 'bg-gray-700 opacity-75' : 'bg-gray-700 border-l-4 border-red-500'}`}>
                  
                  {/* Info del Partido */}
                  <div className="flex-1">
                    <span className="text-xs font-bold text-gray-400 uppercase">{partido.fase}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xl">{partido.equipo_a ? partido.equipo_a.bandera_url : '🛡️'}</span>
<span className="text-white font-bold">{partido.equipo_a ? partido.equipo_a.nombre : partido.placeholder_a}</span>
<span className="text-gray-500 text-sm">vs</span>
<span className="text-white font-bold">{partido.equipo_b ? partido.equipo_b.nombre : partido.placeholder_b}</span>
<span className="text-xl">{partido.equipo_b ? partido.equipo_b.bandera_url : '🛡️'}</span>
                    </div>
                  </div>

                  {/* Controles de Carga */}
                  {estaFinalizado ? (
                    <div className="bg-gray-900 px-4 py-2 rounded-lg border border-green-900">
                      <span className="text-green-500 font-bold text-lg">
                        {partido.goles_a} - {partido.goles_b}
                      </span>
                      <span className="block text-[10px] text-green-700 uppercase text-center mt-1">Finalizado</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" min="0" value={goles.a ?? ''}
                          onChange={(e) => handleCambio(partido.id, 'a', e.target.value)}
                          className="w-12 h-10 text-center font-bold bg-gray-900 text-white border border-gray-600 rounded"
                        />
                        <span className="text-gray-500">-</span>
                        <input 
                          type="number" min="0" value={goles.b ?? ''}
                          onChange={(e) => handleCambio(partido.id, 'b', e.target.value)}
                          className="w-12 h-10 text-center font-bold bg-gray-900 text-white border border-gray-600 rounded"
                        />
                      </div>
                      <button 
                        onClick={() => finalizarPartido(partido.id)}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition text-sm"
                      >
                        Finalizar
                      </button>
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