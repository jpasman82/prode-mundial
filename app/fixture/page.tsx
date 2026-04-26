"use client";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { MapPin, Trophy } from 'lucide-react';

const LETRAS_GRUPOS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
const RONDAS = [
  { fase: '16vos de Final', label: '16vos' },
  { fase: 'Octavos de Final', label: 'Octavos' },
  { fase: 'Cuartos de Final', label: 'Cuartos' },
  { fase: 'Semifinal', label: 'Semifinal' },
];

export default function Fixture() {
  const [partidos, setPartidos] = useState<any[]>([]);
  const [equipos, setEquipos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<'grupos' | 'llave'>('grupos');
  const [grupoActivo, setGrupoActivo] = useState('A');
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    const cargar = async () => {
      const { data: eq } = await supabase.from('equipos').select('*').order('nombre');
      const { data: par } = await supabase
        .from('partidos')
        .select(`
          id, fecha_hora, fase, estado, goles_a, goles_b, estadio, ciudad,
          codigo_partido, placeholder_a, placeholder_b, equipo_a_id, equipo_b_id,
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

  const calcularTabla = (grupo: string) => {
    const stats: Record<string, any> = {};
    equipos.filter(e => e.grupo === grupo).forEach(e => {
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
  };

  const campeon = useMemo(() => {
    const final = partidos.find(p => p.fase === 'Final' && p.estado === 'Finalizado');
    if (!final) return null;
    return final.goles_a > final.goles_b ? final.equipo_a : final.equipo_b;
  }, [partidos]);

  const progreso = useMemo(() => {
    const elim = partidos.filter(p => p.fase !== 'Fase de Grupos');
    const total = elim.length;
    const completos = elim.filter(p => p.estado === 'Finalizado').length;
    return { total, completos, pct: total === 0 ? 0 : Math.round((completos / total) * 100) };
  }, [partidos]);

  const splitFase = (fase: string) => {
    const ps = partidos.filter(p => p.fase === fase);
    const mitad = Math.ceil(ps.length / 2);
    return { izq: ps.slice(0, mitad), der: ps.slice(mitad) };
  };

  const scrollToFinal = () => {
    document.getElementById('fixture-final')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (cargando) {
    return <div className="p-10 text-center font-bold text-gray-700">Cargando fixture oficial...</div>;
  }

  // ── VISTA: GRUPOS ────────────────────────────────────────────────────────────
  if (vista === 'grupos') {
    const tabla = calcularTabla(grupoActivo);
    const partidosGrupo = partidos.filter(p => p.fase === 'Fase de Grupos' && p.equipo_a?.grupo === grupoActivo);
    const cambiarGrupo = (delta: number) => {
      const idx = LETRAS_GRUPOS.indexOf(grupoActivo);
      const nuevo = idx + delta;
      if (nuevo >= 0 && nuevo < LETRAS_GRUPOS.length) setGrupoActivo(LETRAS_GRUPOS[nuevo]);
    };

    return (
      <div className="min-h-screen bg-[#faf7f5] pb-24">
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
          <div className="px-4 pt-3 pb-2 max-w-2xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[9px] font-black text-rose-800 uppercase tracking-[0.22em]">Prode 2026</div>
                <h1 className="text-[15px] font-black text-gray-900 leading-tight">Fase de grupos</h1>
              </div>
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setVista('grupos')}
                  className="px-3 py-1.5 rounded-md text-[11px] font-bold bg-white text-rose-900 shadow"
                >Grupos</button>
                <button
                  onClick={() => setVista('llave')}
                  className="px-3 py-1.5 rounded-md text-[11px] font-bold text-gray-500"
                >Llave</button>
              </div>
            </div>
          </div>
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
        </div>

        <div
          className="p-4 max-w-2xl mx-auto space-y-4"
          onTouchStart={e => setTouchStartX(e.touches[0].clientX)}
          onTouchEnd={e => {
            if (touchStartX === null) return;
            const diff = touchStartX - e.changedTouches[0].clientX;
            if (Math.abs(diff) >= 50) cambiarGrupo(diff > 0 ? 1 : -1);
            setTouchStartX(null);
          }}
        >
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
        </div>
      </div>
    );
  }

  // ── VISTA: LLAVE ─────────────────────────────────────────────────────────────
  const finalPartidos = partidos.filter(p => p.fase === 'Final');
  const tercerPuestoPartidos = partidos.filter(p => p.fase === 'Tercer Puesto');

  return (
    <div className="min-h-screen bg-[#faf7f5] pb-24">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="px-4 pt-3 pb-2.5 max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-black text-rose-800 uppercase tracking-[0.22em]">Prode 2026</div>
              <h1 className="text-[15px] font-black text-gray-900 leading-tight">Camino al trofeo</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setVista('grupos')}
                  className="px-3 py-1.5 rounded-md text-[11px] font-bold text-gray-500"
                >Grupos</button>
                <button
                  onClick={() => setVista('llave')}
                  className="px-3 py-1.5 rounded-md text-[11px] font-bold bg-white text-rose-900 shadow"
                >Llave</button>
              </div>
              <button onClick={scrollToFinal} className="h-8 px-2 rounded-lg bg-amber-100 text-amber-800 text-[10px] font-black active:scale-95">
                🏆 Final
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-500 to-amber-500 transition-all duration-500" style={{ width: `${progreso.pct}%` }}></div>
            </div>
            <div className="text-[10px] font-bold text-gray-500 tabular-nums">{progreso.completos}/{progreso.total} jugados</div>
          </div>
        </div>
      </div>

      <div className="px-3 py-4 max-w-2xl mx-auto space-y-2">
        <div className="flex items-center gap-2 px-1">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-300"></div>
          <div className="text-[9px] font-black uppercase tracking-[0.22em] text-gray-400">Llave superior</div>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-300"></div>
        </div>

        {RONDAS.map(({ fase, label }) => (
          <FixtureRondaFila key={`top-${fase}`} label={label} partidos={splitFase(fase).izq} />
        ))}

        <div className="flex justify-center py-1">
          <div className="w-0.5 h-6 bg-gradient-to-b from-gray-300 to-amber-400"></div>
        </div>

        <div id="fixture-final">
          <div className={`relative overflow-hidden rounded-2xl border-2 ${
            finalPartidos[0]?.estado === 'Finalizado'
              ? 'border-amber-300 bg-gradient-to-b from-amber-50 via-white to-amber-50'
              : 'border-amber-200 bg-white'
          } p-4 shadow-lg`}>
            <div className="text-center mb-3">
              <div className="text-[9px] font-black uppercase tracking-[0.28em] text-amber-700">✦ La gran final ✦</div>
            </div>
            {finalPartidos.map(p => <FixtureMatchCard key={p.id} partido={p} />)}
            {campeon ? (
              <div className="mt-4 text-center">
                <Trophy size={48} className="mx-auto text-amber-500 mb-1" />
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-700">Campeón del mundo</div>
                <div className="mt-1 inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-100 to-amber-50 border border-amber-300 rounded-full">
                  <span className="text-2xl">{campeon.bandera_url}</span>
                  <span className="text-base font-black text-gray-900">{campeon.nombre}</span>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-center text-[10px] text-gray-400 font-medium">
                El campeón se conocerá en la final
              </div>
            )}
          </div>

          {tercerPuestoPartidos.length > 0 && (
            <div className="mt-3">
              <div className="text-center text-[9px] font-black uppercase tracking-[0.22em] text-gray-500 mb-1.5">🥉 Tercer puesto</div>
              <div className="max-w-sm mx-auto">
                {tercerPuestoPartidos.map(p => <FixtureMatchCard key={p.id} partido={p} />)}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center py-1">
          <div className="w-0.5 h-6 bg-gradient-to-t from-gray-300 to-amber-400"></div>
        </div>

        <div className="flex items-center gap-2 px-1 pt-2">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-300"></div>
          <div className="text-[9px] font-black uppercase tracking-[0.22em] text-gray-400">Llave inferior</div>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-300"></div>
        </div>

        {[...RONDAS].reverse().map(({ fase, label }) => (
          <FixtureRondaFila key={`bot-${fase}`} label={label} partidos={splitFase(fase).der} />
        ))}
      </div>
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function FixtureRondaFila({ label, partidos }: { label: string; partidos: any[] }) {
  const [expandido, setExpandido] = useState(true);
  const total = partidos.length;
  const done = partidos.filter(p => p.estado === 'Finalizado').length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={() => setExpandido(e => !e)} className="w-full px-3 py-2 flex items-center justify-between gap-2 active:bg-gray-50">
        <div className="flex items-center gap-2">
          <div className={`w-1 h-4 rounded-full ${done === total && total > 0 ? 'bg-green-600' : done > 0 ? 'bg-amber-400' : 'bg-gray-200'}`}></div>
          <span className="text-[11px] font-black text-gray-800 uppercase tracking-wider">{label}</span>
          <span className="text-[9px] font-bold text-gray-400 tabular-nums">{done}/{total}</span>
        </div>
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${expandido ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expandido ? (
        <div className="p-2 pt-0 space-y-2">
          {partidos.map(p => <FixtureMatchCard key={p.id} partido={p} />)}
        </div>
      ) : (
        <div className="px-3 pb-2 flex gap-1 overflow-x-auto no-scrollbar">
          {partidos.map(p => {
            const fin = p.estado === 'Finalizado';
            return (
              <div key={p.id} className={`flex-shrink-0 h-7 px-1.5 rounded flex items-center gap-1 text-[10px] font-black ${
                fin ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500 border border-dashed border-gray-200'
              }`}>
                <span>{p.equipo_a?.bandera_url || '·'}</span>
                <span className="text-gray-400 text-[9px]">vs</span>
                <span>{p.equipo_b?.bandera_url || '·'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FixtureMatchCard({ partido }: { partido: any }) {
  const fin = partido.estado === 'Finalizado';
  const eqA = partido.equipo_a;
  const eqB = partido.equipo_b;
  const labelA = eqA?.nombre || partido.placeholder_a || '?';
  const labelB = eqB?.nombre || partido.placeholder_b || '?';
  const draw = fin && partido.goles_a === partido.goles_b;
  const winA = fin && partido.goles_a > partido.goles_b;
  const winB = fin && partido.goles_b > partido.goles_a;

  const fechaObj = new Date(partido.fecha_hora);
  const hora = fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const fechaStr = fechaObj.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className={`bg-white border rounded-xl shadow-sm overflow-hidden ${fin ? 'border-gray-200' : 'border-dashed border-gray-200'}`}>
      <div className="px-3 py-1.5 flex items-center justify-between border-b border-gray-100">
        <span className="text-[10px] font-bold text-gray-400 capitalize">{fechaStr.replace(/\./g, '')} · {hora}</span>
        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
          fin ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>{fin ? 'Final' : 'Pendiente'}</span>
      </div>
      <div className="flex items-center px-3 py-2.5 gap-2">
        <div className={`flex-1 flex items-center justify-end gap-2 min-w-0 transition-opacity ${fin && !draw && !winA ? 'opacity-40' : ''}`}>
          <span className="text-sm font-bold truncate text-right text-gray-900">{labelA}</span>
          <span className="text-xl flex-shrink-0">{eqA?.bandera_url || '·'}</span>
        </div>
        <div className="flex-shrink-0 w-16 text-center">
          {fin ? (
            <span className="text-base font-black text-rose-900 tabular-nums">{partido.goles_a} - {partido.goles_b}</span>
          ) : (
            <span className="text-xs font-bold text-gray-300">vs</span>
          )}
        </div>
        <div className={`flex-1 flex items-center gap-2 min-w-0 transition-opacity ${fin && !draw && !winB ? 'opacity-40' : ''}`}>
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
