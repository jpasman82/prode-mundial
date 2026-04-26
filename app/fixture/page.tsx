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
const FASES_BRACKET = [
  { fase: '16vos de Final', label: '16vos' },
  { fase: 'Octavos de Final', label: '8vos' },
  { fase: 'Cuartos de Final', label: '4tos' },
  { fase: 'Semifinal', label: 'Semi' },
];

export default function Fixture() {
  const [partidos, setPartidos] = useState<any[]>([]);
  const [equipos, setEquipos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<'grupos' | 'llave'>('grupos');
  const [grupoActivo, setGrupoActivo] = useState('A');
  const [faseActiva, setFaseActiva] = useState('16vos de Final');
  const [ladoSeleccionado, setLadoSeleccionado] = useState<'izq' | 'der' | null>(null);
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
                {vista === 'grupos' ? 'Fase de grupos' : ladoSeleccionado ? (ladoSeleccionado === 'izq' ? 'Lado A' : 'Lado B') : 'Llave eliminatoria'}
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
        ) : null}
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
        ) : ladoSeleccionado ? (
          // ── Zoomed: un lado ───────────────────────────────────────────────
          <div className="space-y-4">
            <button onClick={() => setLadoSeleccionado(null)} className="text-[11px] font-bold text-gray-500 hover:text-rose-800 transition">
              ← Bracket completo
            </button>
            {FASES_BRACKET.map(f => {
              const ps = partidos.filter(p => p.fase === f.fase);
              const mid = Math.ceil(ps.length / 2);
              const side = ladoSeleccionado === 'izq' ? ps.slice(0, mid) : ps.slice(mid);
              if (side.length === 0) return null;
              return (
                <div key={f.fase}>
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">{f.label}</div>
                  <div className="space-y-2">
                    {side.map(p => <FixtureMatchCard key={p.id} partido={p} />)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // ── Overview: bracket completo ────────────────────────────────────
          <div className="space-y-3">
            <div className="flex gap-2">
              {(['izq', 'der'] as const).map(lado => (
                <button
                  key={lado}
                  onClick={() => setLadoSeleccionado(lado)}
                  className="flex-1 bg-white rounded-2xl border-2 border-gray-200 p-3 active:scale-[0.98] hover:border-rose-300 transition-all text-left"
                >
                  <div className="text-[9px] font-black uppercase tracking-wide text-center mb-2.5 text-gray-500">
                    {lado === 'izq' ? 'Lado A' : 'Lado B'}
                  </div>
                  {FASES_BRACKET.map(f => {
                    const ps = partidos.filter(p => p.fase === f.fase);
                    const mid = Math.ceil(ps.length / 2);
                    const side = lado === 'izq' ? ps.slice(0, mid) : ps.slice(mid);
                    if (side.length === 0) return null;
                    return (
                      <div key={f.fase} className="mb-2">
                        <div className="text-[7px] font-black uppercase text-gray-300 mb-0.5 tracking-wide">{f.label}</div>
                        <div className="space-y-0.5">
                          {side.map(p => {
                            const fin = p.estado === 'Finalizado';
                            const eqA = p.equipo_a;
                            const eqB = p.equipo_b;
                            return (
                              <FixtureMiniTile
                                key={p.id}
                                eqA={eqA}
                                eqB={eqB}
                                scoreA={fin ? p.goles_a : undefined}
                                scoreB={fin ? p.goles_b : undefined}
                                finalizado={fin}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <div className="text-center mt-2 text-[8px] font-black text-rose-800 uppercase tracking-wide">
                    Ver detalle →
                  </div>
                </button>
              ))}
            </div>

            {(() => {
              const finalPs = partidos.filter(p => p.fase === 'Final');
              const tercerPs = partidos.filter(p => p.fase === 'Tercer Puesto');
              if (finalPs.length === 0) return null;
              return (
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-center mb-2">🏆 Final</div>
                  <div className="max-w-sm mx-auto space-y-2">
                    {finalPs.map(p => <FixtureMatchCard key={p.id} partido={p} />)}
                    {tercerPs.length > 0 && (
                      <>
                        <div className="text-center text-[8px] font-black text-gray-400 uppercase tracking-wide pt-1">🥉 Tercer puesto</div>
                        {tercerPs.map(p => <FixtureMatchCard key={p.id} partido={p} />)}
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function FixtureMiniTile({ eqA, eqB, scoreA, scoreB, finalizado }: any) {
  const hasScore = finalizado && scoreA !== undefined && scoreB !== undefined;
  return (
    <div className={`flex items-center gap-1 px-1 py-0.5 rounded leading-none ${finalizado ? 'bg-green-50' : ''}`}>
      <span className="w-5 text-center text-sm">{eqA?.bandera_url || '·'}</span>
      <span className={`text-[8px] font-black tabular-nums flex-1 text-center ${hasScore ? 'text-rose-900' : 'text-gray-200'}`}>
        {hasScore ? `${scoreA}-${scoreB}` : '-'}
      </span>
      <span className="w-5 text-center text-sm">{eqB?.bandera_url || '·'}</span>
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
