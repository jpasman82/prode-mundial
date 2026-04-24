"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

const LETRAS_GRUPOS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

function calcularTablaGrupo(grupo: string, todosPartidos: any[]) {
  const stats: Record<string, any> = {};

  todosPartidos
    .filter(p => p.fase === 'Fase de Grupos' && (p.equipo_a?.grupo === grupo || p.equipo_b?.grupo === grupo))
    .forEach(p => {
      if (p.equipo_a && !stats[p.equipo_a.id]) stats[p.equipo_a.id] = { ...p.equipo_a, pts: 0, gd: 0, gf: 0 };
      if (p.equipo_b && !stats[p.equipo_b.id]) stats[p.equipo_b.id] = { ...p.equipo_b, pts: 0, gd: 0, gf: 0 };
    });

  todosPartidos
    .filter(p => p.fase === 'Fase de Grupos' && p.estado === 'Finalizado' && p.equipo_a?.grupo === grupo)
    .forEach(p => {
      const a = p.equipo_a.id; const b = p.equipo_b.id;
      const ga = p.goles_a; const gb = p.goles_b;
      if (!stats[a] || !stats[b]) return;
      stats[a].gf += ga; stats[b].gf += gb;
      stats[a].gd += ga - gb; stats[b].gd += gb - ga;
      if (ga > gb) stats[a].pts += 3;
      else if (gb > ga) stats[b].pts += 3;
      else { stats[a].pts += 1; stats[b].pts += 1; }
    });

  return Object.values(stats).sort((a: any, b: any) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}

async function propagarBracket(partidoFinalizado: any, todosPartidos: any[]) {
  const updates: Array<{ id: string; equipo_a_id?: string; equipo_b_id?: string }> = [];

  if (partidoFinalizado.fase === 'Fase de Grupos') {
    const grupo = partidoFinalizado.equipo_a?.grupo ?? partidoFinalizado.equipo_b?.grupo;
    if (!grupo) return;

    const partidosGrupo = todosPartidos.filter(p =>
      p.fase === 'Fase de Grupos' && (p.equipo_a?.grupo === grupo || p.equipo_b?.grupo === grupo)
    );
    const finalizados = partidosGrupo.filter(p => p.estado === 'Finalizado');

    if (finalizados.length === 3) {
      const tabla = calcularTablaGrupo(grupo, todosPartidos);
      const primero = tabla[0];
      const segundo = tabla[1];

      if (primero && segundo) {
        todosPartidos.forEach(p => {
          const upd: any = { id: p.id };
          let changed = false;
          if (p.placeholder_a === `1ro ${grupo}`) { upd.equipo_a_id = primero.id; changed = true; }
          if (p.placeholder_a === `2do ${grupo}`) { upd.equipo_a_id = segundo.id; changed = true; }
          if (p.placeholder_b === `1ro ${grupo}`) { upd.equipo_b_id = primero.id; changed = true; }
          if (p.placeholder_b === `2do ${grupo}`) { upd.equipo_b_id = segundo.id; changed = true; }
          if (changed) updates.push(upd);
        });
      }
    }

    // Verificar si TODOS los grupos terminaron → asignar mejores terceros
    const gruposTerminados = LETRAS_GRUPOS.every(g => {
      const pGrupo = todosPartidos.filter(p =>
        p.fase === 'Fase de Grupos' && (p.equipo_a?.grupo === g || p.equipo_b?.grupo === g)
      );
      return pGrupo.length > 0 && pGrupo.every(p => p.estado === 'Finalizado');
    });

    if (gruposTerminados) {
      const terceros: any[] = [];
      LETRAS_GRUPOS.forEach(g => {
        const tabla = calcularTablaGrupo(g, todosPartidos);
        if (tabla[2]) terceros.push({ ...tabla[2] });
      });

      const mejoresTerceros = terceros
        .sort((a: any, b: any) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
        .slice(0, 8);

      const slotsMejorTercero = todosPartidos
        .filter(p => p.placeholder_a?.includes('Mejor 3ro') || p.placeholder_b?.includes('Mejor 3ro'))
        .sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime());

      let idx = 0;
      slotsMejorTercero.forEach(p => {
        const upd: any = { id: p.id };
        let changed = false;
        if (p.placeholder_a?.includes('Mejor 3ro') && mejoresTerceros[idx]) {
          upd.equipo_a_id = mejoresTerceros[idx++].id; changed = true;
        }
        if (p.placeholder_b?.includes('Mejor 3ro') && mejoresTerceros[idx]) {
          upd.equipo_b_id = mejoresTerceros[idx++].id; changed = true;
        }
        if (changed) updates.push(upd);
      });
    }

  } else {
    // Partido eliminatorio: propagar ganador y perdedor al siguiente partido
    const codigo = partidoFinalizado.codigo_partido;
    if (!codigo) return;

    const winner = partidoFinalizado.goles_a > partidoFinalizado.goles_b
      ? partidoFinalizado.equipo_a : partidoFinalizado.equipo_b;
    const loser = partidoFinalizado.goles_a > partidoFinalizado.goles_b
      ? partidoFinalizado.equipo_b : partidoFinalizado.equipo_a;

    todosPartidos.forEach(p => {
      const upd: any = { id: p.id };
      let changed = false;
      if (p.placeholder_a === `Ganador ${codigo}` && winner) { upd.equipo_a_id = winner.id; changed = true; }
      if (p.placeholder_b === `Ganador ${codigo}` && winner) { upd.equipo_b_id = winner.id; changed = true; }
      if (p.placeholder_a === `Perdedor ${codigo}` && loser) { upd.equipo_a_id = loser.id; changed = true; }
      if (p.placeholder_b === `Perdedor ${codigo}` && loser) { upd.equipo_b_id = loser.id; changed = true; }
      if (changed) updates.push(upd);
    });
  }

  await Promise.all(
    updates.map(({ id, ...fields }) => supabase.from('partidos').update(fields).eq('id', id))
  );
}

export default function AdminPanel() {
  const [partidos, setPartidos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [golesOficiales, setGolesOficiales] = useState<Record<string, { a: string, b: string }>>({});

  const cargarPartidos = async () => {
    setCargando(true);
    const { data } = await supabase
      .from('partidos')
      .select(`
        id, fecha_hora, fase, estado, goles_a, goles_b, codigo_partido, placeholder_a, placeholder_b,
        equipo_a:equipos!equipo_a_id(id, nombre, bandera_url, grupo),
        equipo_b:equipos!equipo_b_id(id, nombre, bandera_url, grupo)
      `)
      .order('fecha_hora', { ascending: true });

    if (data) setPartidos(data);
    setCargando(false);
  };

  useEffect(() => { cargarPartidos(); }, []);

  const handleCambio = (partidoId: string, equipo: 'a' | 'b', valor: string) => {
    setGolesOficiales(prev => ({
      ...prev,
      [partidoId]: { a: prev[partidoId]?.a ?? '', b: prev[partidoId]?.b ?? '', [equipo]: valor },
    }));
  };

  const finalizarPartido = async (partidoId: string) => {
    const res = golesOficiales[partidoId];
    if (!res || res.a === '' || res.b === '') {
      alert('⚠️ Tenés que poner los goles de los dos equipos antes de finalizar.');
      return;
    }

    const confirmar = confirm('¿Estás seguro? Esto va a repartir los puntos a todos los jugadores.');
    if (!confirmar) return;

    const { error } = await supabase
      .from('partidos')
      .update({ goles_a: parseInt(res.a), goles_b: parseInt(res.b), estado: 'Finalizado' })
      .eq('id', partidoId);

    if (error) {
      alert('Hubo un error: ' + error.message);
      return;
    }

    // Construir lista actualizada para la propagación (sin recargar de DB)
    const partidoOriginal = partidos.find(p => p.id === partidoId);
    const partidoFinalizado = {
      ...partidoOriginal,
      goles_a: parseInt(res.a),
      goles_b: parseInt(res.b),
      estado: 'Finalizado',
    };
    const todosActualizados = partidos.map(p => p.id === partidoId ? partidoFinalizado : p);

    await propagarBracket(partidoFinalizado, todosActualizados);

    alert('¡Partido finalizado! El bracket se actualizó automáticamente. 🏆');
    cargarPartidos();
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 font-sans">
      <header className="flex items-center mb-6 gap-4 border-b border-gray-700 pb-4">
        <Link href="/dashboard" className="text-amber-400 font-bold text-xl hover:text-amber-300">
          ← Volver
        </Link>
        <h1 className="text-xl font-bold text-white flex-1">Panel de Control Admin ⚙️</h1>
      </header>

      <div className="max-w-2xl mx-auto bg-gray-800 rounded-xl p-6 shadow-2xl border border-gray-700">
        <p className="text-gray-400 mb-6 text-sm">
          Al finalizar un partido, los puntos se calculan y el bracket se propaga automáticamente.
        </p>

        {cargando ? (
          <p className="text-center text-gray-500 py-10">Cargando base de datos...</p>
        ) : partidos.length === 0 ? (
          <p className="text-center text-gray-500 py-10">No hay partidos cargados.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {partidos.map(partido => {
              const estaFinalizado = partido.estado === 'Finalizado';
              const goles = golesOficiales[partido.id] || { a: '', b: '' };
              return (
                <div key={partido.id} className={`p-4 rounded-lg flex items-center justify-between gap-4 ${estaFinalizado ? 'bg-gray-700 opacity-75' : 'bg-gray-700 border-l-4 border-red-500'}`}>
                  <div className="flex-1">
                    <span className="text-xs font-bold text-gray-400 uppercase">{partido.fase}</span>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xl">{partido.equipo_a ? partido.equipo_a.bandera_url : '🛡️'}</span>
                      <span className="text-white font-bold">{partido.equipo_a ? partido.equipo_a.nombre : partido.placeholder_a}</span>
                      <span className="text-gray-500 text-sm">vs</span>
                      <span className="text-white font-bold">{partido.equipo_b ? partido.equipo_b.nombre : partido.placeholder_b}</span>
                      <span className="text-xl">{partido.equipo_b ? partido.equipo_b.bandera_url : '🛡️'}</span>
                    </div>
                  </div>

                  {estaFinalizado ? (
                    <div className="bg-gray-900 px-4 py-2 rounded-lg border border-green-900 text-center">
                      <span className="text-green-500 font-bold text-lg">{partido.goles_a} - {partido.goles_b}</span>
                      <span className="block text-[10px] text-green-700 uppercase mt-1">Finalizado</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" value={goles.a ?? ''}
                          onChange={e => handleCambio(partido.id, 'a', e.target.value)}
                          className="w-12 h-10 text-center font-bold bg-gray-900 text-white border border-gray-600 rounded"
                        />
                        <span className="text-gray-500">-</span>
                        <input type="number" min="0" value={goles.b ?? ''}
                          onChange={e => handleCambio(partido.id, 'b', e.target.value)}
                          className="w-12 h-10 text-center font-bold bg-gray-900 text-white border border-gray-600 rounded"
                        />
                      </div>
                      <button onClick={() => finalizarPartido(partido.id)}
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
