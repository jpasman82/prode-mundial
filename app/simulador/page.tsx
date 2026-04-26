"use client";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Trophy, Dices } from 'lucide-react';

type Equipo = { id: string; nombre: string; bandera_url: string; grupo: string };
type Partido = {
  id: string; fase: string; codigo_partido: string;
  equipo_a_id: string | null; equipo_b_id: string | null;
  equipo_a: Equipo | null; equipo_b: Equipo | null;
  placeholder_a: string | null; placeholder_b: string | null;
};
type Resultado = { a: string; b: string };

const LETRAS_GRUPOS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
const RONDAS = [
  { fase: '16vos de Final', label: '16vos' },
  { fase: 'Octavos de Final', label: 'Octavos' },
  { fase: 'Cuartos de Final', label: 'Cuartos' },
  { fase: 'Semifinal', label: 'Semifinal' },
];

export default function Simulador({ userId }: { userId: string | null }) {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [simulacion, setSimulacion] = useState<Record<string, Resultado>>({});
  const [cargando, setCargando] = useState(true);
  const [empezado, setEmpezado] = useState(false);
  const [vista, setVista] = useState<'grupos' | 'llave'>('grupos');
  const [grupoActivo, setGrupoActivo] = useState('A');
  const [sheetPartidoId, setSheetPartidoId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    '16vos de Final': true, 'Octavos de Final': true,
    'Cuartos de Final': true, 'Semifinal': true,
  });
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
    setSimulacion(prev => ({ ...prev, [id]: { ...(prev[id] || { a: '', b: '' }), [lado]: valor } }));
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
  const toggleRonda = (fase: string) => setExpanded(e => ({ ...e, [fase]: !e[fase] }));

  const calcularTabla = useCallback((grupo: string) => {
    const stats: Record<string, any> = {};
    equipos.filter(e => e.grupo === grupo).forEach(e => {
      stats[e.id] = { ...e, pts: 0, gd: 0, gf: 0 };
    });
    partidos.filter(p => p.fase === 'Fase de Grupos' && p.equipo_a?.grupo === grupo).forEach(p => {
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
          partido.equipo_a_simulado = partido.placeholder_a.includes('Mejor 3ro')
            ? mejoresTerceros[indexTercero++ % 8]
            : clasificados[partido.placeholder_a];
        }
        if (partido.placeholder_b) {
          partido.equipo_b_simulado = partido.placeholder_b.includes('Mejor 3ro')
            ? mejoresTerceros[indexTercero++ % 8]
            : clasificados[partido.placeholder_b];
        }
        const res = simulacion[partido.id];
        if (res && res.a !== '' && res.b !== '' && partido.equipo_a_simulado && partido.equipo_b_simulado) {
          const ga = parseInt(res.a), gb = parseInt(res.b);
          if (!isNaN(ga) && !isNaN(gb) && ga !== gb) {
            clasificados[`Ganador ${partido.codigo_partido}`] = ga > gb ? partido.equipo_a_simulado : partido.equipo_b_simulado;
            clasificados[`Perdedor ${partido.codigo_partido}`] = ga > gb ? partido.equipo_b_simulado : partido.equipo_a_simulado;
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
    const ganador = decidido ? (parseInt(res!.a) > parseInt(res!.b) ? eqA : eqB) : null;
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
    return final ? matchInfo(final).ganador : null;
  }, [datosSimulados.partidos, matchInfo]);

  const sheetPartido = sheetPartidoId
    ? datosSimulados.partidos.find((p: any) => p.id === sheetPartidoId)
    : null;

  const splitFase = (fase: string) => {
    const ps = datosSimulados.partidos.filter((p: any) => p.fase === fase);
    const mitad = Math.ceil(ps.length / 2);
    return { izq: ps.slice(0, mitad), der: ps.slice(mitad) };
  };

  const scrollToFinal = () => {
    document.getElementById('v2-final')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // ── Splash ───────────────────────────────────────────────────────────────────
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
    const todosCompletos = LETRAS_GRUPOS.every(g => {
      const ps = partidos.filter(p => p.fase === 'Fase de Grupos' && p.equipo_a?.grupo === g);
      return ps.every(p => { const r = simulacion[p.id]; return r && r.a !== '' && r.b !== ''; });
    });
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
              <div className="flex items-center gap-2">
                <button onClick={llenarAlAzar} className="h-8 px-2.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-bold flex items-center gap-1 active:scale-95">
                  <Dices size={14} /> Dados
                </button>
                <button onClick={() => setVista('llave')} className="h-8 px-3 rounded-lg bg-rose-900 text-white text-[11px] font-bold active:scale-95 shadow">
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

          {todosCompletos && (
            <button
              onClick={() => setVista('llave')}
              className="w-full bg-rose-900 text-white py-4 rounded-xl font-bold text-sm shadow-md active:scale-95 transition flex items-center justify-center gap-2"
            >
              <Trophy size={18} /> Ver camino al trofeo
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── VISTA: LLAVE ─────────────────────────────────────────────────────────────
  const finalPartidos = datosSimulados.partidos.filter((p: any) => p.fase === 'Final');
  const tercerPuestoPartidos = datosSimulados.partidos.filter((p: any) => p.fase === 'Tercer Puesto');

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
              <div className="h-full bg-gradient-to-r from-rose-700 to-amber-500 transition-all duration-500" style={{ width: `${progreso.pct}%` }}></div>
            </div>
            <div className="text-[10px] font-bold text-gray-500 tabular-nums">{progreso.completos}/{progreso.total}</div>
            <button onClick={scrollToFinal} className="h-6 px-2 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black active:scale-95">
              🏆 Final
            </button>
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
          <RondaFila
            key={`top-${fase}`}
            fase={fase} label={label}
            partidos={splitFase(fase).izq}
            matchInfo={matchInfo}
            expanded={expanded[fase]}
            onToggle={() => toggleRonda(fase)}
            onOpen={(id: string) => setSheetPartidoId(id)}
          />
        ))}

        <div className="flex justify-center py-1">
          <div className="w-0.5 h-6 bg-gradient-to-b from-gray-300 to-amber-400"></div>
        </div>

        <div id="v2-final">
          <div className={`relative overflow-hidden rounded-2xl border-2 ${
            finalPartidos[0] && matchInfo(finalPartidos[0]).decidido
              ? 'border-amber-300 bg-gradient-to-b from-amber-50 via-white to-amber-50'
              : 'border-amber-200 bg-white'
          } p-4 shadow-lg`}>
            <div className="text-center mb-3">
              <div className="text-[9px] font-black uppercase tracking-[0.28em] text-amber-700">✦ La gran final ✦</div>
            </div>
            {finalPartidos.map((p: any) => (
              <MatchCard key={p.id} p={p} info={matchInfo(p)} onClick={() => setSheetPartidoId(p.id)} />
            ))}
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
                Completá la final para ver al campeón
              </div>
            )}
          </div>

          {tercerPuestoPartidos.length > 0 && (
            <div className="mt-3">
              <div className="text-center text-[9px] font-black uppercase tracking-[0.22em] text-gray-500 mb-1.5">🥉 Tercer puesto</div>
              <div className="max-w-sm mx-auto">
                {tercerPuestoPartidos.map((p: any) => (
                  <MatchCard key={p.id} p={p} info={matchInfo(p)} onClick={() => setSheetPartidoId(p.id)} />
                ))}
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
          <RondaFila
            key={`bot-${fase}`}
            fase={fase} label={label}
            partidos={splitFase(fase).der}
            matchInfo={matchInfo}
            expanded={expanded[fase]}
            onToggle={() => toggleRonda(fase)}
            onOpen={(id: string) => setSheetPartidoId(id)}
          />
        ))}
      </div>

      {sheetPartido && (
        <MatchSheet
          partido={sheetPartido}
          info={matchInfo(sheetPartido)}
          onClose={() => setSheetPartidoId(null)}
          onSave={(a: string, b: string) => { setResultadoPar(sheetPartido.id, a, b); setSheetPartidoId(null); }}
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
          <input type="number" inputMode="numeric" value={sim?.a || ''}
            onChange={e => onScore(p.id, 'a', e.target.value)}
            className="w-12 h-12 text-center border-2 border-gray-300 rounded-lg font-black text-lg text-rose-900 bg-gray-50 focus:border-rose-700 focus:bg-white outline-none"
          />
          <input type="number" inputMode="numeric" value={sim?.b || ''}
            onChange={e => onScore(p.id, 'b', e.target.value)}
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
    <div className={`flex items-center gap-1.5 px-1.5 py-1.5 transition-all ${winner ? 'bg-rose-50' : loser ? 'opacity-40' : ''}`}>
      <span className="text-base leading-none flex-shrink-0 w-5 text-center">{eq ? eq.bandera_url : '·'}</span>
      <span className={`flex-1 min-w-0 truncate text-[11px] ${
        eq ? (winner ? 'font-black text-rose-900' : 'font-semibold text-gray-800') : 'text-gray-400 font-medium italic'
      }`}>{label}</span>
      <span className={`flex-shrink-0 w-5 text-center text-[12px] font-black tabular-nums ${
        cargado ? (winner ? 'text-rose-900' : 'text-gray-400') : 'text-gray-300'
      }`}>{cargado && score !== undefined ? score : '·'}</span>
    </div>
  );

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white border rounded-lg overflow-hidden shadow-sm hover:border-rose-400 active:scale-[0.99] transition-all ${
        decidido ? 'border-rose-200' : listo ? 'border-gray-300' : 'border-dashed border-gray-200'
      }`}
    >
      <Row eq={eqA} label={labelA} score={ga} winner={winA} loser={decidido && !winA} />
      <div className="h-px bg-gray-100"></div>
      <Row eq={eqB} label={labelB} score={gb} winner={winB} loser={decidido && !winB} />
    </button>
  );
}

function RondaFila({ fase, label, partidos, matchInfo, expanded, onToggle, onOpen }: any) {
  const total = partidos.length;
  const done = partidos.filter((p: any) => matchInfo(p).decidido).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={onToggle} className="w-full px-3 py-2 flex items-center justify-between gap-2 active:bg-gray-50">
        <div className="flex items-center gap-2">
          <div className={`w-1 h-4 rounded-full ${done === total && total > 0 ? 'bg-rose-800' : done > 0 ? 'bg-amber-400' : 'bg-gray-200'}`}></div>
          <span className="text-[11px] font-black text-gray-800 uppercase tracking-wider">{label}</span>
          <span className="text-[9px] font-bold text-gray-400 tabular-nums">{done}/{total}</span>
        </div>
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded ? (
        <div className="p-2 pt-0 grid grid-cols-2 gap-1.5">
          {partidos.map((p: any) => (
            <MatchCard key={p.id} p={p} info={matchInfo(p)} onClick={() => onOpen(p.id)} />
          ))}
        </div>
      ) : (
        <div className="px-3 pb-2 flex gap-1 overflow-x-auto no-scrollbar">
          {partidos.map((p: any) => {
            const m = matchInfo(p);
            return (
              <div key={p.id} onClick={() => onOpen(p.id)}
                className={`flex-shrink-0 h-7 px-1.5 rounded flex items-center gap-1 text-[10px] font-black cursor-pointer ${
                  m.decidido ? 'bg-rose-900 text-white' :
                  m.cargado ? 'bg-amber-200 text-amber-900' :
                  m.listo ? 'bg-gray-100 text-gray-600' :
                  'bg-gray-50 text-gray-400 border border-dashed border-gray-200'
                }`}
              >
                <span>{m.eqA?.bandera_url || '·'}</span>
                <span className="text-gray-400 text-[9px]">vs</span>
                <span>{m.eqB?.bandera_url || '·'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MatchSheet({ partido, info, onClose, onSave }: any) {
  const [a, setA] = useState(info.res?.a || '');
  const [b, setB] = useState(info.res?.b || '');

  useEffect(() => { setA(info.res?.a || ''); setB(info.res?.b || ''); }, [partido.id]);

  const { eqA, eqB, listo } = info;
  const labelA = eqA ? eqA.nombre : (partido.placeholder_a || '?');
  const labelB = eqB ? eqB.nombre : (partido.placeholder_b || '?');
  const empate = a !== '' && b !== '' && a === b;
  const esTercer = partido.fase === 'Tercer Puesto';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40"></div>
      <div className="relative bg-white w-full max-w-lg rounded-t-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
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
              <input type="number" inputMode="numeric" min="0" max="20" disabled={!listo} value={a}
                onChange={e => setA(e.target.value)}
                className="w-16 h-20 text-center border-2 border-gray-300 rounded-xl font-black text-3xl text-rose-900 bg-gray-50 focus:border-rose-700 focus:bg-white outline-none disabled:bg-gray-100 disabled:text-gray-300 disabled:border-gray-200"
              />
              <div className="text-xl text-gray-300 font-bold">-</div>
              <input type="number" inputMode="numeric" min="0" max="20" disabled={!listo} value={b}
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
