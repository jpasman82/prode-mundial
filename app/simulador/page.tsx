"use client";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Trophy, Dices } from 'lucide-react';

type Equipo = {
  id: string;
  nombre: string;
  bandera_url: string;
  grupo: string;
};

type Partido = {
  id: string;
  fase: string;
  codigo_partido: string;
  equipo_a_id: string | null;
  equipo_b_id: string | null;
  equipo_a: Equipo | null;
  equipo_b: Equipo | null;
  placeholder_a: string | null;
  placeholder_b: string | null;
};

type Resultado = { a: string; b: string };

const TABS = [
  { fase: '16vos de Final', label: '16vos' },
  { fase: 'Octavos de Final', label: '8vos' },
  { fase: 'Cuartos de Final', label: '4tos' },
  { fase: 'Semifinal', label: 'Semi' },
  { fase: 'Final', label: 'Final' },
];
const LETRAS_GRUPOS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
const FASES_LLAVE = TABS.map(t => t.fase);

export default function Simulador({ userId }: { userId: string | null }) {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [simulacion, setSimulacion] = useState<Record<string, Resultado>>({});
  const [cargando, setCargando] = useState(true);
  const [empezado, setEmpezado] = useState(false);
  const [vista, setVista] = useState<'grupos' | 'llave'>('grupos');
  const [grupoActivo, setGrupoActivo] = useState('A');
  const [faseActiva, setFaseActiva] = useState('16vos de Final');
  const [sheetPartidoId, setSheetPartidoId] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    const cargarDatos = async () => {
      const { data: eq } = await supabase.from('equipos').select('*').order('nombre');
      const { data: par } = await supabase
        .from('partidos')
        .select('*, equipo_a:equipos!equipo_a_id(*), equipo_b:equipos!equipo_b_id(*)')
        .order('fecha_hora');
      if (eq) setEquipos(eq);
      if (par) setPartidos(par as Partido[]);
      setCargando(false);
    };
    cargarDatos();
  }, []);

  const handleScore = useCallback((id: string, lado: 'a' | 'b', valor: string) => {
    setSimulacion(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { a: '', b: '' }), [lado]: valor }
    }));
  }, []);

  const setResultadoPar = useCallback((id: string, a: string, b: string) => {
    setSimulacion(prev => ({ ...prev, [id]: { a, b } }));
  }, []);

  const llenarAlAzar = useCallback(() => {
    const nueva: Record<string, Resultado> = { ...simulacion };
    partidos.forEach(p => {
      let ga = Math.floor(Math.random() * 4);
      let gb = Math.floor(Math.random() * 4);
      if (p.fase !== 'Fase de Grupos' && ga === gb) {
        if (Math.random() > 0.5) ga++; else gb++;
      }
      nueva[p.id] = { a: ga.toString(), b: gb.toString() };
    });
    setSimulacion(nueva);
  }, [partidos, simulacion]);

  const reset = useCallback(() => setSimulacion({}), []);

  const calcularTabla = useCallback((grupo: string) => {
    const stats: Record<string, any> = {};
    equipos.filter(e => e.grupo === grupo).forEach(e => {
      stats[e.id] = { ...e, pts: 0, gd: 0, gf: 0 };
    });
    partidos
      .filter(p => p.fase === 'Fase de Grupos' && p.equipo_a?.grupo === grupo)
      .forEach(p => {
        const res = simulacion[p.id];
        if (res && res.a !== '' && res.b !== '') {
          const ga = parseInt(res.a), gb = parseInt(res.b);
          if (stats[p.equipo_a_id!] && stats[p.equipo_b_id!]) {
            stats[p.equipo_a_id!].gf += ga; stats[p.equipo_b_id!].gf += gb;
            stats[p.equipo_a_id!].gd += (ga - gb); stats[p.equipo_b_id!].gd += (gb - ga);
            if (ga > gb) stats[p.equipo_a_id!].pts += 3;
            else if (gb > ga) stats[p.equipo_b_id!].pts += 3;
            else { stats[p.equipo_a_id!].pts += 1; stats[p.equipo_b_id!].pts += 1; }
          }
        }
      });
    return Object.values(stats).sort((a: any, b: any) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  }, [equipos, partidos, simulacion]);

  const datosSimulados = useMemo(() => {
    if (equipos.length === 0 || partidos.length === 0) return { partidos: [], clasificados: {} as Record<string, any> };

    const clasificados: Record<string, any> = {};
    const terceros: any[] = [];

    LETRAS_GRUPOS.forEach(grupo => {
      const tabla = calcularTabla(grupo);
      if (tabla.length >= 3) {
        clasificados[`1ro ${grupo}`] = tabla[0];
        clasificados[`2do ${grupo}`] = tabla[1];
        terceros.push(tabla[2]);
      }
    });

    terceros.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    const mejoresTerceros = terceros.slice(0, 8);
    let indexTercero = 0;

    const partidosProyectados = partidos.map(p => {
      const partido: any = { ...p };

      if (partido.fase !== 'Fase de Grupos') {
        if (partido.placeholder_a) {
          if (partido.placeholder_a.includes('Mejor 3ro')) {
            partido.equipo_a_simulado = mejoresTerceros[indexTercero % 8];
            indexTercero++;
          } else {
            partido.equipo_a_simulado = clasificados[partido.placeholder_a];
          }
        }
        if (partido.placeholder_b) {
          if (partido.placeholder_b.includes('Mejor 3ro')) {
            partido.equipo_b_simulado = mejoresTerceros[indexTercero % 8];
            indexTercero++;
          } else {
            partido.equipo_b_simulado = clasificados[partido.placeholder_b];
          }
        }

        const res = simulacion[partido.id];
        if (res && res.a !== '' && res.b !== '' && partido.equipo_a_simulado && partido.equipo_b_simulado) {
          const ga = parseInt(res.a), gb = parseInt(res.b);
          if (!isNaN(ga) && !isNaN(gb) && ga !== gb) {
            const ganador = ga > gb ? partido.equipo_a_simulado : partido.equipo_b_simulado;
            const perdedor = ga > gb ? partido.equipo_b_simulado : partido.equipo_a_simulado;
            clasificados[`Ganador ${partido.codigo_partido}`] = ganador;
            clasificados[`Perdedor ${partido.codigo_partido}`] = perdedor;
          }
        }
      } else {
        partido.equipo_a_simulado = partido.equipo_a;
        partido.equipo_b_simulado = partido.equipo_b;
      }
      return partido;
    });

    return { partidos: partidosProyectados, clasificados };
  }, [partidos, simulacion, equipos, calcularTabla]);

  const matchInfo = useCallback((p: any) => {
    const eqA = p.equipo_a_simulado;
    const eqB = p.equipo_b_simulado;
    const res = simulacion[p.id];
    const listo = !!(eqA && eqB);
    const cargado = !!(res && res.a !== '' && res.b !== '' && !isNaN(parseInt(res.a)) && !isNaN(parseInt(res.b)));
    const empate = cargado && parseInt(res!.a) === parseInt(res!.b);
    const decidido = listo && cargado && !empate;
    let ganador = null;
    if (decidido) ganador = parseInt(res!.a) > parseInt(res!.b) ? eqA : eqB;
    return { eqA, eqB, res, listo, cargado, empate, decidido, ganador };
  }, [simulacion]);

  const progreso = useMemo(() => {
    const elim = datosSimulados.partidos.filter((p: any) => p.fase !== 'Fase de Grupos');
    const total = elim.length;
    const completos = elim.filter((p: any) => matchInfo(p).decidido).length;
    return { total, completos, pct: total === 0 ? 0 : Math.round((completos / total) * 100) };
  }, [datosSimulados.partidos, matchInfo]);

  const campeon = useMemo(() => {
    const final = datosSimulados.partidos.find((p: any) => p.fase === 'Final');
    if (!final) return null;
    return matchInfo(final).ganador;
  }, [datosSimulados.partidos, matchInfo]);

  const sheetPartido = sheetPartidoId
    ? datosSimulados.partidos.find((p: any) => p.id === sheetPartidoId)
    : null;

  const onTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent, cambiador: (delta: number) => void) => {
    if (touchStartX === null) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) >= 50) cambiador(diff > 0 ? 1 : -1);
    setTouchStartX(null);
  };

  // ── Pantalla de inicio ───────────────────────────────────────────────────────
  if (!empezado) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-10 text-center">
          <div>
            <div className="text-[9px] font-black text-rose-800 uppercase tracking-[0.22em] mb-3">Prode 2026</div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Simulador</h1>
            <p className="text-gray-400 text-sm font-medium mt-3 leading-relaxed">
              Completá todos los resultados vos mismo y descubrí tu campeón del mundo. No se guardan en la DB.
            </p>
          </div>

          <button
            onClick={() => setEmpezado(true)}
            className="w-full bg-rose-900 text-white py-5 rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-all tracking-tight"
          >
            Empezar Simulación
          </button>

          <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">
            Los resultados no se guardan
          </p>
        </div>
      </div>
    );
  }

  if (cargando) {
    return <div className="p-10 text-center font-bold text-gray-700">Cargando Motor de Simulación...</div>;
  }

  // ── VISTA: GRUPOS ────────────────────────────────────────────────────────────
  if (vista === 'grupos') {
    const partidosGrupo = datosSimulados.partidos.filter(
      (p: any) => p.fase === 'Fase de Grupos' && p.equipo_a?.grupo === grupoActivo
    );
    const tabla = calcularTabla(grupoActivo);

    const cambiarGrupo = (delta: number) => {
      const idx = LETRAS_GRUPOS.indexOf(grupoActivo);
      const nuevo = idx + delta;
      if (nuevo >= 0 && nuevo < LETRAS_GRUPOS.length) setGrupoActivo(LETRAS_GRUPOS[nuevo]);
    };

    return (
      <div className="min-h-screen bg-gray-100 pb-24">
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
          <div className="px-4 pt-3 pb-2 max-w-2xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[9px] font-black text-rose-800 uppercase tracking-[0.22em]">Simulador 2026</div>
                <h1 className="text-[15px] font-black text-gray-900 leading-tight">Fase de grupos</h1>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={llenarAlAzar} className="h-8 px-2.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-bold flex items-center gap-1 active:scale-95">
                  <Dices size={14} /> Dados
                </button>
                <button
                  onClick={() => setVista('llave')}
                  className="h-8 px-3 rounded-lg bg-rose-900 text-white text-[11px] font-bold active:scale-95 shadow"
                >
                  Ir a llave →
                </button>
              </div>
            </div>
          </div>

          <div className="px-2 pb-2 flex gap-1 overflow-x-auto no-scrollbar max-w-2xl mx-auto">
            {LETRAS_GRUPOS.map(g => {
              const ps = partidos.filter(p => p.fase === 'Fase de Grupos' && p.equipo_a?.grupo === g);
              const done = ps.filter(p => { const r = simulacion[p.id]; return r && r.a !== '' && r.b !== ''; }).length;
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
          onTouchStart={onTouchStart}
          onTouchEnd={(e) => onTouchEnd(e, cambiarGrupo)}
        >
          <div className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-white text-[10px] uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">Grupo {grupoActivo}</th>
                  <th className="px-1 py-2 text-center">PTS</th>
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
                    <td className="text-center font-bold text-gray-600">{eq.gd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-gray-50 p-2 text-[10px] text-gray-500 text-center font-medium border-t">
              Los 2 primeros y los 8 mejores terceros avanzan.
            </div>
          </div>

          <div className="space-y-2">
            {partidosGrupo.map((p: any) => (
              <FilaPartidoGrupos key={p.id} p={p} sim={simulacion[p.id]} onScore={handleScore} />
            ))}
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
  const partidosFase = (fase: string) =>
    datosSimulados.partidos.filter((p: any) => p.fase === fase);

  const cambiarFase = (delta: number) => {
    const idx = FASES_LLAVE.indexOf(faseActiva);
    const nuevo = idx + delta;
    if (nuevo >= 0 && nuevo < FASES_LLAVE.length) setFaseActiva(FASES_LLAVE[nuevo]);
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="px-4 pt-3 pb-2 max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-black text-rose-800 uppercase tracking-[0.22em]">Simulador 2026</div>
              <h1 className="text-[15px] font-black text-gray-900 leading-tight">Llave eliminatoria</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setVista('grupos')} className="h-8 px-2.5 rounded-lg bg-white text-gray-600 border border-gray-200 text-[11px] font-bold active:scale-95">
                ← Grupos
              </button>
              <button onClick={llenarAlAzar} className="h-8 px-2.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-bold flex items-center gap-1 active:scale-95">
                <Dices size={14} /> Dados
              </button>
              <button onClick={reset} className="h-8 px-2.5 rounded-lg bg-gray-100 text-gray-600 border border-gray-200 text-[11px] font-bold active:scale-95">
                Reset
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-rose-700 to-rose-900 transition-all duration-500" style={{ width: `${progreso.pct}%` }}></div>
            </div>
            <div className="text-[10px] font-bold text-gray-500 tabular-nums">
              {progreso.completos}/{progreso.total}
            </div>
          </div>
        </div>

        <div className="px-2 pb-2 flex gap-1 overflow-x-auto no-scrollbar max-w-2xl mx-auto">
          {TABS.map(t => {
            const ps = partidosFase(t.fase);
            const done = ps.filter((p: any) => matchInfo(p).decidido).length;
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
      </div>

      <div
        className="p-3 max-w-2xl mx-auto space-y-3"
        onTouchStart={onTouchStart}
        onTouchEnd={(e) => onTouchEnd(e, cambiarFase)}
      >
        <MiniBracket
          datosSimulados={datosSimulados}
          matchInfo={matchInfo}
          faseActiva={faseActiva}
          onSelectFase={setFaseActiva}
        />

        {faseActiva === 'Final' ? (
          <div className="space-y-3 max-w-sm mx-auto">
            <div className="text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-rose-800">La gran final</div>
            </div>
            {partidosFase('Final').map((p: any) => (
              <MatchCard key={p.id} p={p} info={matchInfo(p)} onClick={() => setSheetPartidoId(p.id)} />
            ))}
            {partidosFase('Tercer Puesto').length > 0 && (
              <div className="pt-3">
                <div className="text-center text-[9px] font-black uppercase tracking-[0.22em] text-gray-500 mb-2">🥉 Tercer puesto</div>
                {partidosFase('Tercer Puesto').map((p: any) => (
                  <MatchCard key={p.id} p={p} info={matchInfo(p)} onClick={() => setSheetPartidoId(p.id)} />
                ))}
              </div>
            )}
            {campeon && (
              <div className="p-6 rounded-2xl bg-gradient-to-b from-amber-50 via-white to-white border-2 border-amber-200 text-center mt-4">
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-700 mb-1">Campeón del Mundo 2026</div>
                <Trophy size={48} className="mx-auto text-amber-500 mb-2" />
                <div className="text-5xl mb-1">{campeon.bandera_url}</div>
                <div className="text-2xl font-black text-gray-900">{campeon.nombre}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {partidosFase(faseActiva).map((p: any) => (
              <MatchCard key={p.id} p={p} info={matchInfo(p)} onClick={() => setSheetPartidoId(p.id)} />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 pt-1">
          <span>{FASES_LLAVE.indexOf(faseActiva) > 0 ? `← ${TABS[FASES_LLAVE.indexOf(faseActiva) - 1]?.label}` : ''}</span>
          <span>{FASES_LLAVE.indexOf(faseActiva) < FASES_LLAVE.length - 1 ? `${TABS[FASES_LLAVE.indexOf(faseActiva) + 1]?.label} →` : ''}</span>
        </div>
      </div>

      {sheetPartido && (
        <MatchSheet
          partido={sheetPartido}
          info={matchInfo(sheetPartido)}
          onClose={() => setSheetPartidoId(null)}
          onSave={(a: string, b: string) => {
            setResultadoPar(sheetPartido.id, a, b);
            setSheetPartidoId(null);
          }}
        />
      )}
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function FilaPartidoGrupos({ p, sim, onScore }: { p: any; sim?: Resultado; onScore: (id: string, lado: 'a'|'b', val: string) => void }) {
  return (
    <div className="bg-white p-3 rounded-xl border border-gray-300 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0 text-right font-bold text-sm flex items-center justify-end gap-2 text-gray-900">
          <span className="leading-tight truncate">{p.equipo_a?.nombre}</span>
          <span className="text-2xl flex-shrink-0">{p.equipo_a?.bandera_url}</span>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <input
            type="number" inputMode="numeric"
            value={sim?.a || ''}
            onChange={(e) => onScore(p.id, 'a', e.target.value)}
            className="w-12 h-12 text-center border-2 border-gray-300 rounded-lg font-black text-lg text-rose-900 bg-gray-50 focus:border-rose-700 focus:bg-white outline-none"
          />
          <input
            type="number" inputMode="numeric"
            value={sim?.b || ''}
            onChange={(e) => onScore(p.id, 'b', e.target.value)}
            className="w-12 h-12 text-center border-2 border-gray-300 rounded-lg font-black text-lg text-rose-900 bg-gray-50 focus:border-rose-700 focus:bg-white outline-none"
          />
        </div>
        <div className="flex-1 min-w-0 text-left font-bold text-sm flex items-center gap-2 text-gray-900">
          <span className="text-2xl flex-shrink-0">{p.equipo_b?.bandera_url}</span>
          <span className="leading-tight truncate">{p.equipo_b?.nombre}</span>
        </div>
      </div>
    </div>
  );
}

function MatchCard({ p, info, onClick }: { p: any; info: any; onClick: () => void }) {
  const { eqA, eqB, res, decidido, ganador, cargado, listo } = info;
  const labelA = eqA ? eqA.nombre : (p.placeholder_a || '?');
  const labelB = eqB ? eqB.nombre : (p.placeholder_b || '?');
  const ga = res?.a !== undefined && res.a !== '' ? parseInt(res.a) : undefined;
  const gb = res?.b !== undefined && res.b !== '' ? parseInt(res.b) : undefined;
  const winA = decidido && ganador?.id === eqA?.id;
  const winB = decidido && ganador?.id === eqB?.id;

  const Row = ({ eq, label, score, winner, loser }: any) => (
    <div className={`flex items-center gap-2 px-3 py-2 transition-all ${winner ? 'bg-rose-50' : loser ? 'opacity-40' : ''}`}>
      <span className="text-lg leading-none flex-shrink-0 w-6 text-center">{eq ? eq.bandera_url : '·'}</span>
      <span className={`flex-1 min-w-0 truncate text-sm ${
        eq ? (winner ? 'font-black text-rose-900' : 'font-semibold text-gray-800') : 'text-gray-400 font-medium italic'
      }`}>{label}</span>
      <span className={`flex-shrink-0 w-5 text-center text-sm font-black tabular-nums ${
        cargado ? (winner ? 'text-rose-900' : 'text-gray-400') : 'text-gray-300'
      }`}>{cargado && score !== undefined ? score : '·'}</span>
    </div>
  );

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white border rounded-xl overflow-hidden shadow-sm hover:border-rose-400 active:scale-[0.99] transition-all ${
        decidido ? 'border-rose-200' : listo ? 'border-gray-300' : 'border-dashed border-gray-200'
      }`}
    >
      <Row eq={eqA} label={labelA} score={ga} winner={winA} loser={decidido && !winA} />
      <div className="h-px bg-gray-100 mx-3"></div>
      <Row eq={eqB} label={labelB} score={gb} winner={winB} loser={decidido && !winB} />
    </button>
  );
}

function MiniBracket({ datosSimulados, matchInfo, faseActiva, onSelectFase }: any) {
  const FASES = [
    { fase: '16vos de Final', label: '16vos' },
    { fase: 'Octavos de Final', label: '8vos' },
    { fase: 'Cuartos de Final', label: '4tos' },
    { fase: 'Semifinal', label: 'SF' },
    { fase: 'Final', label: 'Final' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2">
      <div className="flex gap-1">
        {FASES.map(f => {
          const ps = datosSimulados.partidos.filter((p: any) => p.fase === f.fase);
          const done = ps.filter((p: any) => matchInfo(p).decidido).length;
          const isActive = faseActiva === f.fase;
          return (
            <button
              key={f.fase}
              onClick={() => onSelectFase(f.fase)}
              className={`flex-1 rounded-lg py-1.5 px-1 text-center transition-colors ${isActive ? 'bg-rose-50 ring-1 ring-rose-200' : ''}`}
            >
              <div className={`text-[8px] font-black uppercase tracking-wider mb-1.5 ${isActive ? 'text-rose-800' : 'text-gray-400'}`}>{f.label}</div>
              <div className="flex flex-col gap-0.5">
                {ps.map((p: any) => {
                  const m = matchInfo(p);
                  return (
                    <div key={p.id} className={`h-1.5 rounded-sm w-full ${
                      m.decidido ? 'bg-rose-900' :
                      m.cargado ? 'bg-amber-300' :
                      m.listo ? 'bg-gray-300' :
                      'bg-gray-100'
                    }`} />
                  );
                })}
              </div>
              <div className={`text-[8px] font-black mt-1.5 tabular-nums ${isActive ? 'text-rose-700' : 'text-gray-400'}`}>{done}/{ps.length}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MatchSheet({ partido, info, onClose, onSave }: any) {
  const [a, setA] = useState(info.res?.a || '');
  const [b, setB] = useState(info.res?.b || '');

  useEffect(() => {
    setA(info.res?.a || '');
    setB(info.res?.b || '');
  }, [partido.id]);

  const { eqA, eqB, listo } = info;
  const labelA = eqA ? eqA.nombre : (partido.placeholder_a || '?');
  const labelB = eqB ? eqB.nombre : (partido.placeholder_b || '?');
  const empate = a !== '' && b !== '' && a === b;
  const esTercer = partido.fase === 'Tercer Puesto';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40"></div>
      <div
        className="relative bg-white w-full max-w-lg rounded-t-3xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="pt-3 pb-2 flex justify-center">
          <div className="w-10 h-1.5 bg-gray-300 rounded-full"></div>
        </div>
        <div className="px-5 pb-2">
          <div className="text-center">
            <div className="text-[10px] font-bold text-rose-800 uppercase tracking-[0.18em]">{partido.fase}</div>
            <div className="text-[10px] text-gray-400 font-mono mt-0.5">Partido {partido.codigo_partido}</div>
          </div>

          {!listo && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
              <p className="text-xs text-amber-900 font-semibold">Este partido depende de resultados anteriores.</p>
              <p className="text-[11px] text-amber-700 mt-0.5">Completá las rondas previas para habilitar la carga.</p>
            </div>
          )}

          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex flex-col items-center gap-2">
              <div className="text-5xl">{eqA ? eqA.bandera_url : '🛡️'}</div>
              <div className={`text-center text-sm font-bold leading-tight ${eqA ? 'text-gray-900' : 'text-gray-400'}`}>{labelA}</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number" inputMode="numeric" min="0" max="20"
                disabled={!listo}
                value={a}
                onChange={e => setA(e.target.value)}
                className="w-16 h-20 text-center border-2 border-gray-300 rounded-xl font-black text-3xl text-rose-900 bg-gray-50 focus:border-rose-700 focus:bg-white outline-none disabled:bg-gray-100 disabled:text-gray-300 disabled:border-gray-200"
              />
              <div className="text-xl text-gray-300 font-bold">-</div>
              <input
                type="number" inputMode="numeric" min="0" max="20"
                disabled={!listo}
                value={b}
                onChange={e => setB(e.target.value)}
                className="w-16 h-20 text-center border-2 border-gray-300 rounded-xl font-black text-3xl text-rose-900 bg-gray-50 focus:border-rose-700 focus:bg-white outline-none disabled:bg-gray-100 disabled:text-gray-300 disabled:border-gray-200"
              />
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="text-5xl">{eqB ? eqB.bandera_url : '🛡️'}</div>
              <div className={`text-center text-sm font-bold leading-tight ${eqB ? 'text-gray-900' : 'text-gray-400'}`}>{labelB}</div>
            </div>
          </div>

          {empate && !esTercer && (
            <div className="mt-4 p-2 bg-orange-50 border border-orange-200 rounded-lg text-center">
              <p className="text-[11px] font-bold text-orange-700">⚠️ En eliminatorias no hay empate. Sumá los penales al marcador.</p>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2 pb-6">
            <button onClick={onClose} className="h-12 rounded-xl border-2 border-gray-200 bg-white text-gray-600 font-bold text-sm active:scale-[0.98] transition">
              Cancelar
            </button>
            <button
              onClick={() => onSave(a, b)}
              disabled={!listo || (empate && !esTercer) || a === '' || b === ''}
              className="h-12 rounded-xl bg-rose-900 text-white font-bold text-sm shadow-md active:scale-[0.98] transition disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
            >
              Guardar resultado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
