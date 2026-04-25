"use client";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { MapPin } from 'lucide-react';

const LETRAS_GRUPOS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
const FASES_TABS = [
  { fase: '16vos de Final', label: '16vos' },
  { fase: 'Octavos de Final', label: '8vos' },
  { fase: 'Cuartos de Final', label: '4tos' },
  { fase: 'Semifinal', label: 'Semi' },
  { fase: 'Tercer Puesto', label: '3er P.' },
  { fase: 'Final', label: 'Final' },
];
const FASES_LLAVE = FASES_TABS.map(f => f.fase);

export default function Fixture() {
  const [partidos, setPartidos] = useState<any[]>([]);
  const [equipos, setEquipos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<'grupos' | 'llave'>('grupos');
  const [grupoActivo, setGrupoActivo] = useState('A');
  const [faseActiva, setFaseActiva] = useState('16vos de Final');
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    const cargar = async () => {
      const { data: eq } = await supabase.from('equipos').select('*').order('nombre');
      const { data: par } = await supabase
        .from('partidos')
        .select(`
          id, fecha_hora, fase, estado, goles_a, goles_b, estadio, ciudad,
          placeholder_a, placeholder_b, equipo_a_id, equipo_b_id,
          equipo_a:equipos!equipo_a_id(id, nombre, bandera_url, grupo),
          equipo_b:equipos!equipo_b_id(id, nombre, bandera_url, grupo)
        `)
        .order('fecha_hora', { ascending: true });
      if (eq) setEquipos(eq);
      if (par) setPartidos(par);
      setCargando(false);
    };
    cargar();
  }, []);

  const tabla = useMemo(() => {
    const stats: Record<string, any> = {};
    equipos.filter(e => e.grupo === grupoActivo).forEach(e => {
      stats[e.id] = { ...e, pj: 0, pts: 0, gd: 0, gf: 0 };
    });
    partidos.forEach(p => {
      if (p.estado === 'Finalizado' && stats[p.equipo_a_id] && stats[p.equipo_b_id]) {
        const a = p.equipo_a_id, b = p.equipo_b_id;
        stats[a].pj++; stats[b].pj++;
        stats[a].gf += p.goles_a; stats[a].gd += (p.goles_a - p.goles_b);
        stats[b].gf += p.goles_b; stats[b].gd += (p.goles_b - p.goles_a);
        if (p.goles_a > p.goles_b) stats[a].pts += 3;
        else if (p.goles_b > p.goles_a) stats[b].pts += 3;
        else { stats[a].pts += 1; stats[b].pts += 1; }
      }
    });
    return Object.values(stats).sort((a: any, b: any) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  }, [equipos, partidos, grupoActivo]);

  const onTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) < 50) { setTouchStartX(null); return; }
    if (vista === 'grupos') {
      const idx = LETRAS_GRUPOS.indexOf(grupoActivo);
      if (diff > 0 && idx < LETRAS_GRUPOS.length - 1) setGrupoActivo(LETRAS_GRUPOS[idx + 1]);
      else if (diff < 0 && idx > 0) setGrupoActivo(LETRAS_GRUPOS[idx - 1]);
    } else {
      const idx = FASES_LLAVE.indexOf(faseActiva);
      if (diff > 0 && idx < FASES_LLAVE.length - 1) setFaseActiva(FASES_LLAVE[idx + 1]);
      else if (diff < 0 && idx > 0) setFaseActiva(FASES_LLAVE[idx - 1]);
    }
    setTouchStartX(null);
  };

  if (cargando) {
    return <div className="p-10 text-center font-bold text-gray-700">Cargando fixture oficial...</div>;
  }

  const partidosGrupo = partidos.filter(p => p.fase === 'Fase de Grupos' && p.equipo_a?.grupo === grupoActivo);
  const partidosFase = partidos.filter(p => p.fase === faseActiva);

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="px-4 pt-3 pb-2 max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-black text-rose-800 uppercase tracking-[0.22em]">Prode 2026</div>
              <h1 className="text-[15px] font-black text-gray-900 leading-tight">
                {vista === 'grupos' ? 'Fase de grupos' : 'Llave eliminatoria'}
              </h1>
            </div>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setVista('grupos')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${vista === 'grupos' ? 'bg-white text-rose-900 shadow' : 'text-gray-500'}`}
              >
                Grupos
              </button>
              <button
                onClick={() => setVista('llave')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${vista === 'llave' ? 'bg-white text-rose-900 shadow' : 'text-gray-500'}`}
              >
                Llave
              </button>
            </div>
          </div>
        </div>

        {vista === 'grupos' ? (
          <div className="px-2 pb-2 flex gap-1 overflow-x-auto no-scrollbar max-w-2xl mx-auto">
            {LETRAS_GRUPOS.map(g => {
              const ps = partidos.filter(p => p.fase === 'Fase de Grupos' && p.equipo_a?.grupo === g);
              const done = ps.filter(p => p.estado === 'Finalizado').length;
              const active = grupoActivo === g;
              return (
                <button key={g} onClick={() => setGrupoActivo(g)}
                  className={`flex-shrink-0 h-9 w-14 rounded-lg text-[11px] font-bold flex flex-col items-center justify-center ${
                    active ? 'bg-rose-900 text-white shadow' : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                >
                  <span>Grupo {g}</span>
                  <span className={`text-[8px] ${active ? 'text-rose-200' : 'text-gray-400'}`}>{done}/{ps.length}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="px-2 pb-2 flex gap-1 overflow-x-auto no-scrollbar max-w-2xl mx-auto">
            {FASES_TABS.map(t => {
              const ps = partidos.filter(p => p.fase === t.fase);
              const done = ps.filter(p => p.estado === 'Finalizado').length;
              const active = faseActiva === t.fase;
              return (
                <button key={t.fase} onClick={() => setFaseActiva(t.fase)}
                  className={`flex-shrink-0 h-9 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1.5 ${
                    active ? 'bg-rose-900 text-white shadow' : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                >
                  <span>{t.label}</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full tabular-nums ${
                    active ? 'bg-rose-700 text-rose-100' : 'bg-gray-100 text-gray-500'
                  }`}>{done}/{ps.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div
        className="p-4 max-w-2xl mx-auto space-y-4"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {vista === 'grupos' ? (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 text-white text-[10px] uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">Grupo {grupoActivo}</th>
                    <th className="px-1 py-2 text-center">PTS</th>
                    <th className="px-1 py-2 text-center">PJ</th>
                    <th className="px-1 py-2 text-center">DIF</th>
                  </tr>
                </thead>
                <tbody>
                  {tabla.map((eq: any, i) => (
                    <tr key={eq.id} className={`border-b border-gray-100 ${i < 2 ? 'bg-green-50' : i === 2 ? 'bg-rose-50' : ''}`}>
                      <td className="px-3 py-2 font-bold text-gray-900">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 w-4 text-right">{i + 1}.</span>
                          <span className="text-xl">{eq.bandera_url}</span>
                          <span>{eq.nombre}</span>
                        </div>
                      </td>
                      <td className="text-center font-black text-amber-600">{eq.pts}</td>
                      <td className="text-center font-bold text-gray-500">{eq.pj}</td>
                      <td className="text-center font-bold text-gray-600">{eq.gd >= 0 ? '+' : ''}{eq.gd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-gray-50 p-2 text-[10px] text-gray-500 text-center font-medium border-t">
                Los 2 primeros y los 8 mejores terceros avanzan.
              </div>
            </div>

            <div className="space-y-2">
              {partidosGrupo.map(p => <FixtureMatchCard key={p.id} partido={p} />)}
            </div>

            <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 pt-1">
              <span>{LETRAS_GRUPOS.indexOf(grupoActivo) > 0 ? `← Grupo ${LETRAS_GRUPOS[LETRAS_GRUPOS.indexOf(grupoActivo) - 1]}` : ''}</span>
              <span>{LETRAS_GRUPOS.indexOf(grupoActivo) < LETRAS_GRUPOS.length - 1 ? `Grupo ${LETRAS_GRUPOS[LETRAS_GRUPOS.indexOf(grupoActivo) + 1]} →` : ''}</span>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              {partidosFase.length > 0 ? (
                partidosFase.map(p => <FixtureMatchCard key={p.id} partido={p} />)
              ) : (
                <p className="text-center text-gray-400 font-bold py-10">Sin partidos en esta ronda aún.</p>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 pt-1">
              <span>{FASES_LLAVE.indexOf(faseActiva) > 0 ? `← ${FASES_TABS[FASES_LLAVE.indexOf(faseActiva) - 1]?.label}` : ''}</span>
              <span>{FASES_LLAVE.indexOf(faseActiva) < FASES_LLAVE.length - 1 ? `${FASES_TABS[FASES_LLAVE.indexOf(faseActiva) + 1]?.label} →` : ''}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FixtureMatchCard({ partido }: { partido: any }) {
  const finalizado = partido.estado === 'Finalizado';
  const eqA = partido.equipo_a;
  const eqB = partido.equipo_b;
  const labelA = eqA?.nombre || partido.placeholder_a || '?';
  const labelB = eqB?.nombre || partido.placeholder_b || '?';
  const draw = finalizado && partido.goles_a === partido.goles_b;
  const winA = finalizado && partido.goles_a > partido.goles_b;
  const winB = finalizado && partido.goles_b > partido.goles_a;

  const fechaObj = new Date(partido.fecha_hora);
  const hora = fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const fechaStr = fechaObj.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className={`bg-white border rounded-xl shadow-sm overflow-hidden ${finalizado ? 'border-gray-200' : 'border-dashed border-gray-200'}`}>
      <div className="px-3 py-1.5 flex items-center justify-between border-b border-gray-100">
        <span className="text-[10px] font-bold text-gray-400 capitalize">{fechaStr.replace(/\./g, '')} · {hora}</span>
        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
          finalizado ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>{finalizado ? 'Final' : 'Pendiente'}</span>
      </div>
      <div className="flex items-center px-3 py-2.5 gap-2">
        <div className={`flex-1 flex items-center justify-end gap-2 min-w-0 transition-opacity ${finalizado && !draw && !winA ? 'opacity-40' : ''}`}>
          <span className="text-sm font-bold truncate text-right text-gray-900">{labelA}</span>
          <span className="text-xl flex-shrink-0">{eqA?.bandera_url || '·'}</span>
        </div>
        <div className="flex-shrink-0 w-16 text-center">
          {finalizado ? (
            <span className="text-base font-black text-rose-900 tabular-nums">{partido.goles_a} - {partido.goles_b}</span>
          ) : (
            <span className="text-xs font-bold text-gray-300">vs</span>
          )}
        </div>
        <div className={`flex-1 flex items-center gap-2 min-w-0 transition-opacity ${finalizado && !draw && !winB ? 'opacity-40' : ''}`}>
          <span className="text-xl flex-shrink-0">{eqB?.bandera_url || '·'}</span>
          <span className="text-sm font-bold truncate text-gray-900">{labelB}</span>
        </div>
      </div>
      {partido.estadio && (
        <div className="px-3 pb-2 text-[9px] text-gray-400 flex items-center gap-1 font-medium">
          <MapPin size={9} /> {partido.estadio}, {partido.ciudad}
        </div>
      )}
    </div>
  );
}
