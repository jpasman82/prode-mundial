"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { leerTemaSync, type Tema } from '@/lib/useTema';
import { Medal, Target, CheckCircle2, Plus, X, Users } from 'lucide-react';

const FASES_EVOLUCION = ['Fecha 1', 'Fecha 2', 'Fecha 3', '16vos de Final', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Finales'];
const FASES_FILTRO = ['General', 'Fecha 1', 'Fecha 2', 'Fecha 3', '16vos de Final', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Finales'];

type Ambito = 'Nacional' | 'Provincial' | 'Municipal';

interface GrupoItem { id: string; nombre: string; codigo_acceso: string; }
interface RankingUser {
  id: string; nombre: string; provincia: string | null; municipio: string | null;
  puntosTotales: number; plenosTotales: number; aciertosTotales: number;
  puntosPorFase: Record<string, { pts: number; plenos: number; aciertos: number }>;
  posicionAnterior: number | null;
}

function determinarFase(faseReal: string, fechaHoraUtc: string) {
  if (faseReal === 'Fase de Grupos') {
    const dia = new Date(fechaHoraUtc).getDate();
    if (dia <= 15) return 'Fecha 1';
    if (dia <= 21) return 'Fecha 2';
    return 'Fecha 3';
  }
  if (faseReal === 'Final' || faseReal === 'Tercer Puesto') return 'Finales';
  return faseReal;
}

function calcularPuntos(p: any, pr: any) {
  const ga = p.goles_a, gb = p.goles_b, pa = pr.prediccion_goles_a, pb = pr.prediccion_goles_b;
  if (ga === pa && gb === pb) return { pts: 3, plenos: 1, aciertos: 0 };
  if (Math.sign(ga - gb) === Math.sign(pa - pb)) return { pts: 1, plenos: 0, aciertos: 1 };
  return { pts: 0, plenos: 0, aciertos: 0 };
}

function ModalAyuda({ onClose, esFDC }: { onClose: () => void; esFDC: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-black text-xl text-gray-900 mb-5">¿Cómo se puntúa?</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
            <span className="text-3xl font-black text-amber-700 w-10 text-center">3</span>
            <div>
              <p className="font-bold text-gray-800">Resultado exacto</p>
              <p className="text-sm text-gray-500">Acertaste el marcador exacto</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-3 bg-green-50 rounded-xl border border-green-100">
            <span className="text-3xl font-black text-green-700 w-10 text-center">1</span>
            <div>
              <p className="font-bold text-gray-800">Tendencia correcta</p>
              <p className="text-sm text-gray-500">Acertaste quién ganó o que fue empate</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-3xl font-black text-gray-300 w-10 text-center">0</span>
            <div>
              <p className="font-bold text-gray-800">Sin puntos</p>
              <p className="text-sm text-gray-500">La tendencia fue incorrecta</p>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className={`mt-5 w-full text-white font-bold py-3 rounded-xl ${esFDC ? 'bg-rose-900' : ''}`}
          style={!esFDC ? { backgroundColor: '#74ACDF' } : undefined}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function Ranking({ tema: temaProp }: { tema?: Tema }) {
  const [tema] = useState<Tema>(() => temaProp ?? leerTemaSync());
  const esFDC = tema === 'fdc';

  // Datos comunes
  const [ranking, setRanking] = useState<RankingUser[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroFase, setFiltroFase] = useState('General');
  const [miUsuarioId, setMiUsuarioId] = useState<string | null>(null);
  const [miProvincia, setMiProvincia] = useState<string | null>(null);
  const [miMunicipio, setMiMunicipio] = useState<string | null>(null);
  const [faseEvolucion, setFaseEvolucion] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [mostrarInfo, setMostrarInfo] = useState(false);

  // Solo FDC
  const [ambito, setAmbito] = useState<Ambito>('Nacional');

  // Solo Familia
  const [misGrupos, setMisGrupos] = useState<GrupoItem[]>([]);
  const [grupoActivo, setGrupoActivo] = useState<GrupoItem | null>(null);
  const [miembrosGrupo, setMiembrosGrupo] = useState<Set<string>>(new Set());
  const [cargandoGrupo, setCargandoGrupo] = useState(false);
  const [modalGrupos, setModalGrupos] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [codigoUnirse, setCodigoUnirse] = useState('');
  const [errorGrupo, setErrorGrupo] = useState<string | null>(null);
  const [exitoGrupo, setExitoGrupo] = useState<string | null>(null);

  // ─── Fetch ranking ─────────────────────────────────────────────────────────
  useEffect(() => {
    const calcularRanking = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user.id ?? null;
      setMiUsuarioId(uid);

      const [{ data: usuarios }, { data: partidos }, { data: pronosticos }] = await Promise.all([
        supabase.from('usuarios').select('id, nombre_jugador, provincia, municipio'),
        supabase.from('partidos').select('*').eq('estado', 'Finalizado'),
        supabase.from('pronosticos').select('*'),
      ]);

      if (!usuarios || !partidos || !pronosticos) { setCargando(false); return; }

      const miPerfil = uid ? usuarios.find((u: any) => u.id === uid) : null;
      if (miPerfil) {
        setMiProvincia(miPerfil.provincia ?? null);
        setMiMunicipio(miPerfil.municipio ?? null);
      }

      const mapaRanking: Record<string, RankingUser> = {};
      usuarios.forEach((u: any) => {
        mapaRanking[u.id] = {
          id: u.id,
          nombre: u.nombre_jugador || 'Jugador',
          provincia: u.provincia ?? null,
          municipio: u.municipio ?? null,
          puntosTotales: 0,
          plenosTotales: 0,
          aciertosTotales: 0,
          puntosPorFase: Object.fromEntries(FASES_FILTRO.map(f => [f, { pts: 0, plenos: 0, aciertos: 0 }])),
          posicionAnterior: null,
        };
      });

      partidos.forEach((p: any) => {
        const fase = determinarFase(p.fase, p.fecha_hora);
        pronosticos.filter((pr: any) => pr.partido_id === p.id).forEach((pr: any) => {
          const u = mapaRanking[pr.usuario_id];
          if (!u) return;
          const { pts, plenos, aciertos } = calcularPuntos(p, pr);
          u.puntosTotales += pts;
          u.plenosTotales += plenos;
          u.aciertosTotales += aciertos;
          if (u.puntosPorFase[fase]) {
            u.puntosPorFase[fase].pts += pts;
            u.puntosPorFase[fase].plenos += plenos;
            u.puntosPorFase[fase].aciertos += aciertos;
          }
        });
      });

      const fasesPresentes = FASES_EVOLUCION.filter(f => partidos.some((p: any) => determinarFase(p.fase, p.fecha_hora) === f));
      if (fasesPresentes.length >= 2) {
        const faseMasReciente = fasesPresentes[fasesPresentes.length - 1];
        setFaseEvolucion(faseMasReciente);

        const ptsSin: Record<string, { pts: number; plenos: number; aciertos: number }> = {};
        usuarios.forEach((u: any) => { ptsSin[u.id] = { pts: 0, plenos: 0, aciertos: 0 }; });
        partidos.filter((p: any) => determinarFase(p.fase, p.fecha_hora) !== faseMasReciente).forEach((p: any) => {
          pronosticos.filter((pr: any) => pr.partido_id === p.id).forEach((pr: any) => {
            if (!ptsSin[pr.usuario_id]) return;
            const { pts, plenos, aciertos } = calcularPuntos(p, pr);
            ptsSin[pr.usuario_id].pts += pts;
            ptsSin[pr.usuario_id].plenos += plenos;
            ptsSin[pr.usuario_id].aciertos += aciertos;
          });
        });

        Object.entries(ptsSin)
          .sort(([, a], [, b]) => b.pts - a.pts || b.plenos - a.plenos || b.aciertos - a.aciertos)
          .forEach(([id], i) => { if (mapaRanking[id]) mapaRanking[id].posicionAnterior = i; });
      }

      setRanking(Object.values(mapaRanking));
      setCargando(false);
    };

    calcularRanking();
  }, []);

  // ─── Fetch grupos (solo Familia) ────────────────────────────────────────────
  const cargarMisGrupos = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('miembros_grupo')
      .select('grupos ( id, nombre, codigo_acceso )')
      .eq('usuario_id', uid);
    if (data) {
      const grupos = data.map((d: any) => d.grupos).filter(Boolean) as GrupoItem[];
      setMisGrupos(grupos);
      // Usa actualización funcional para no depender de grupoActivo en el closure
      setGrupoActivo(prev => prev ?? (grupos.length > 0 ? grupos[0] : null));
    }
  }, []);

  useEffect(() => {
    if (esFDC || !miUsuarioId) return;
    cargarMisGrupos(miUsuarioId);
  }, [esFDC, miUsuarioId, cargarMisGrupos]);

  // Cuando cambia el grupo activo, cargamos sus miembros
  useEffect(() => {
    if (!grupoActivo) { setMiembrosGrupo(new Set()); return; }
    setCargandoGrupo(true);
    supabase
      .from('miembros_grupo')
      .select('usuario_id')
      .eq('grupo_id', grupoActivo.id)
      .then(({ data }) => {
        setMiembrosGrupo(new Set(data?.map((d: any) => d.usuario_id) ?? []));
        setCargandoGrupo(false);
      });
  }, [grupoActivo]);

  // ─── Acciones grupos ────────────────────────────────────────────────────────
  const crearGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorGrupo(null);
    setExitoGrupo(null);
    if (!miUsuarioId || !nuevoNombre.trim()) return;

    const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: nuevo, error: err1 } = await supabase
      .from('grupos')
      .insert([{ nombre: nuevoNombre.trim(), codigo_acceso: codigo }])
      .select()
      .single();
    if (err1 || !nuevo) { setErrorGrupo('No se pudo crear el grupo.'); return; }

    const { error: err2 } = await supabase
      .from('miembros_grupo')
      .insert([{ grupo_id: nuevo.id, usuario_id: miUsuarioId }]);
    if (err2) { setErrorGrupo('Grupo creado pero no se pudo unir.'); return; }

    setNuevoNombre('');
    setExitoGrupo(`Grupo "${nuevo.nombre}" creado. Código: ${codigo}`);
    await cargarMisGrupos(miUsuarioId);
    setGrupoActivo(nuevo as GrupoItem);
  };

  const unirseGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorGrupo(null);
    setExitoGrupo(null);
    if (!miUsuarioId || !codigoUnirse.trim()) return;

    const codigo = codigoUnirse.trim().toUpperCase();
    const { data: encontrado, error: err1 } = await supabase
      .from('grupos')
      .select('*')
      .eq('codigo_acceso', codigo)
      .single();
    if (err1 || !encontrado) { setErrorGrupo('Código no encontrado. Verificá que esté bien escrito.'); return; }

    const { error: err2 } = await supabase
      .from('miembros_grupo')
      .insert([{ grupo_id: encontrado.id, usuario_id: miUsuarioId }]);
    if (err2) {
      setErrorGrupo(err2.code === '23505' ? 'Ya estás en este grupo.' : 'Error al unirte al grupo.');
      return;
    }

    setCodigoUnirse('');
    setExitoGrupo(`Te uniste a "${encontrado.nombre}".`);
    await cargarMisGrupos(miUsuarioId);
    setGrupoActivo(encontrado as GrupoItem);
  };

  // ─── Ordenamiento ──────────────────────────────────────────────────────────
  const rankingOrdenado = [...ranking].sort((a, b) => {
    const pa = filtroFase === 'General' ? a.puntosTotales : a.puntosPorFase[filtroFase]?.pts ?? 0;
    const pb2 = filtroFase === 'General' ? b.puntosTotales : b.puntosPorFase[filtroFase]?.pts ?? 0;
    if (pb2 !== pa) return pb2 - pa;
    const plenosA = filtroFase === 'General' ? a.plenosTotales : a.puntosPorFase[filtroFase]?.plenos ?? 0;
    const plenosB = filtroFase === 'General' ? b.plenosTotales : b.puntosPorFase[filtroFase]?.plenos ?? 0;
    if (plenosB !== plenosA) return plenosB - plenosA;
    const aciertosA = filtroFase === 'General' ? a.aciertosTotales : a.puntosPorFase[filtroFase]?.aciertos ?? 0;
    const aciertosB2 = filtroFase === 'General' ? b.aciertosTotales : b.puntosPorFase[filtroFase]?.aciertos ?? 0;
    return aciertosB2 - aciertosA;
  });

  const rankingFiltrado = rankingOrdenado.filter(user => {
    if (esFDC) {
      if (ambito === 'Nacional') return true;
      if (!miProvincia) return true;
      if (ambito === 'Provincial') return user.provincia === miProvincia;
      return user.provincia === miProvincia &&
        user.municipio?.toLowerCase().trim() === miMunicipio?.toLowerCase().trim();
    }
    // Familia: filtrar por grupo
    if (!grupoActivo || miembrosGrupo.size === 0) return false;
    return miembrosGrupo.has(user.id);
  });

  const obtenerMedalla = (index: number) => {
    if (index === 0) return <Medal className="text-amber-500" size={24} />;
    if (index === 1) return <Medal className="text-gray-400" size={24} />;
    if (index === 2) return <Medal className="text-amber-700" size={24} />;
    return <span className="text-gray-500 font-bold w-6 text-center">{index + 1}°</span>;
  };

  const ambitoLabel = esFDC
    ? (ambito === 'Provincial' && miProvincia ? miProvincia : ambito === 'Municipal' && miMunicipio ? miMunicipio : ambito)
    : (grupoActivo?.nombre ?? 'Sin grupo');

  // ─── Colores del header según tema ─────────────────────────────────────────
  const headerGradient = esFDC
    ? 'from-rose-950 to-rose-800'
    : '';
  const headerStyle = !esFDC
    ? { background: 'linear-gradient(to right, #0e2a47, #1a3a5c)' }
    : undefined;

  const filtroBtnActivo = esFDC
    ? 'bg-rose-900 text-white border-rose-900 shadow-md'
    : '';
  const filtroBtnActivoStyle = !esFDC
    ? { backgroundColor: '#74ACDF', color: '#fff', borderColor: '#74ACDF' }
    : undefined;

  const accentColor = esFDC ? 'text-amber-400' : '';
  const accentStyle = !esFDC ? { color: '#F6B40E' } : undefined;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 pb-20">

      {mostrarInfo && <ModalAyuda onClose={() => setMostrarInfo(false)} esFDC={esFDC} />}

      {/* Modal gestión de grupos (Familia) */}
      {!esFDC && modalGrupos && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setModalGrupos(false); setErrorGrupo(null); setExitoGrupo(null); }}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-xl text-gray-900">Mis Grupos</h3>
              <button onClick={() => { setModalGrupos(false); setErrorGrupo(null); setExitoGrupo(null); }}>
                <X size={22} className="text-gray-400 hover:text-gray-700" />
              </button>
            </div>

            {exitoGrupo && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-green-800 text-sm font-bold">
                {exitoGrupo}
              </div>
            )}
            {errorGrupo && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-700 text-sm font-bold">
                {errorGrupo}
              </div>
            )}

            {/* Crear grupo */}
            <div className="mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Crear grupo nuevo</p>
              <form onSubmit={crearGrupo} className="flex gap-2">
                <input
                  value={nuevoNombre}
                  onChange={e => setNuevoNombre(e.target.value)}
                  placeholder="Nombre del grupo"
                  className="flex-1 border border-gray-300 rounded-lg p-2 text-sm outline-none"
                  required
                />
                <button
                  type="submit"
                  className="px-3 py-2 text-white rounded-lg text-sm font-bold"
                  style={{ backgroundColor: '#0e2a47' }}
                >
                  Crear
                </button>
              </form>
            </div>

            {/* Unirse */}
            <div className="mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Unirse con código</p>
              <form onSubmit={unirseGrupo} className="flex gap-2">
                <input
                  value={codigoUnirse}
                  onChange={e => setCodigoUnirse(e.target.value)}
                  placeholder="Ej: X9P2M4"
                  className="flex-1 border border-gray-300 rounded-lg p-2 text-sm uppercase outline-none"
                  required
                />
                <button
                  type="submit"
                  className="px-3 py-2 text-white rounded-lg text-sm font-bold"
                  style={{ backgroundColor: '#74ACDF' }}
                >
                  Unirme
                </button>
              </form>
            </div>

            {/* Lista de grupos */}
            {misGrupos.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Tus grupos</p>
                <ul className="space-y-2 max-h-40 overflow-y-auto">
                  {misGrupos.map(g => (
                    <li key={g.id} className="border border-gray-200 rounded-lg p-3 flex justify-between items-center">
                      <span className="font-bold text-gray-800 text-sm">{g.nombre}</span>
                      <span className="font-mono text-xs font-bold" style={{ color: '#F6B40E' }}>{g.codigo_acceso}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filtro de fase */}
      <div className="bg-white shadow-sm p-3 sticky top-0 z-10 border-b border-gray-200">
        <div className="flex overflow-x-auto gap-2 pb-1" style={{ scrollbarWidth: 'none' }}>
          {FASES_FILTRO.map(fase => (
            <button
              key={fase}
              onClick={() => setFiltroFase(fase)}
              className={`whitespace-nowrap px-4 py-2 font-bold rounded-lg border-2 transition-all ${filtroFase === fase ? (esFDC ? filtroBtnActivo : '') : 'bg-gray-50 text-gray-700 border-gray-300 hover:border-gray-400'}`}
              style={filtroFase === fase && !esFDC ? filtroBtnActivoStyle : undefined}
            >
              {fase}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">

        {/* Header */}
        <div
          className={`bg-gradient-to-r ${headerGradient} rounded-2xl p-5 text-white shadow-lg mb-4`}
          style={headerStyle}
        >
          <div className="flex items-center gap-4 mb-4">
            {esFDC ? (
              <img src="/logo-fdc.png" alt="FDC" className="h-12 w-auto object-contain flex-shrink-0" />
            ) : (
              <div className="h-12 w-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0" style={{ backgroundColor: '#74ACDF' }}>
                🇦🇷
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black uppercase tracking-wider">Tabla de Posiciones</h2>
              <p className="text-white/70 text-sm font-medium">
                {filtroFase}{' · '}
                <span className="text-white font-bold" style={accentStyle}>{ambitoLabel}</span>
              </p>
              {filtroFase === 'General' && esFDC && ambito === 'Nacional' && faseEvolucion && (
                <p className="text-white/50 text-xs font-medium mt-0.5">↑↓ movimiento vs {faseEvolucion}</p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Botón gestión de grupos (Familia) */}
              {!esFDC && (
                <button
                  onClick={() => { setModalGrupos(true); setErrorGrupo(null); setExitoGrupo(null); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm transition-colors"
                  style={{ backgroundColor: 'rgba(116,172,223,0.3)' }}
                  title="Gestionar grupos"
                >
                  <Users size={16} />
                </button>
              )}
              <button
                onClick={() => setMostrarInfo(true)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white font-black text-sm flex items-center justify-center transition-colors"
              >
                ?
              </button>
            </div>
          </div>

          {/* Selector de ámbito: FDC = Nacional/Provincial/Municipal; Familia = grupos */}
          {esFDC ? (
            <div className="flex gap-2">
              {(['Nacional', 'Provincial', 'Municipal'] as Ambito[]).map(a => (
                <button
                  key={a}
                  onClick={() => setAmbito(a)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${ambito === a ? 'bg-amber-400 text-rose-950' : 'bg-rose-900/60 text-rose-200 hover:bg-rose-800/60'}`}
                >
                  {a}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex-1 overflow-x-auto flex gap-2 pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {misGrupos.length === 0 ? (
                  <p className="text-white/60 text-xs font-medium">Sin grupos — usá el botón para crear o unirte</p>
                ) : (
                  misGrupos.map(g => (
                    <button
                      key={g.id}
                      onClick={() => setGrupoActivo(g)}
                      className="whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-lg transition-all border-2"
                      style={grupoActivo?.id === g.id
                        ? { backgroundColor: '#F6B40E', color: '#0e2a47', borderColor: '#F6B40E' }
                        : { backgroundColor: 'rgba(116,172,223,0.2)', color: '#fff', borderColor: 'transparent' }}
                    >
                      {g.nombre}
                    </button>
                  ))
                )}
              </div>
              <button
                onClick={() => { setModalGrupos(true); setErrorGrupo(null); setExitoGrupo(null); }}
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-black"
                style={{ backgroundColor: '#74ACDF', color: '#0e2a47' }}
                title="Crear o unirse a un grupo"
              >
                <Plus size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Aviso sin ubicación (solo FDC) */}
        {esFDC && !miProvincia && ambito !== 'Nacional' && !cargando && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-center">
            <p className="text-amber-900 font-bold text-sm">Tu cuenta no tiene provincia asignada.</p>
            <p className="text-amber-700 text-xs mt-1">Los rankings provinciales y municipales están disponibles para jugadores con ubicación.</p>
          </div>
        )}

        {/* Aviso sin grupo (solo Familia) */}
        {!esFDC && misGrupos.length === 0 && !cargando && (
          <div className="rounded-xl p-5 mb-4 text-center border-2 border-dashed" style={{ borderColor: '#74ACDF', backgroundColor: '#f0f7ff' }}>
            <p className="font-bold text-sm" style={{ color: '#0e2a47' }}>Todavía no estás en ningún grupo.</p>
            <p className="text-xs mt-1 text-gray-500">Creá uno o pedile un código a tus amigos.</p>
            <button
              onClick={() => { setModalGrupos(true); setErrorGrupo(null); setExitoGrupo(null); }}
              className="mt-3 px-5 py-2 text-white text-sm font-bold rounded-xl"
              style={{ backgroundColor: '#74ACDF' }}
            >
              + Crear o unirse a un grupo
            </button>
          </div>
        )}

        {/* Lista de ranking */}
        {cargando || cargandoGrupo ? (
          <p className="text-center font-bold text-gray-500 py-10">Calculando puntos...</p>
        ) : rankingFiltrado.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center">
            <p className="font-bold text-gray-400">
              {esFDC
                ? `No hay jugadores en tu ${ambito === 'Provincial' ? 'provincia' : 'municipio'} todavía.`
                : 'Seleccioná un grupo para ver el ranking.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {rankingFiltrado.map((user, index) => {
              const esYo = user.id === miUsuarioId;
              const expandido = expandidoId === user.id;
              const puntosMostrar = filtroFase === 'General' ? user.puntosTotales : user.puntosPorFase[filtroFase]?.pts ?? 0;
              const plenosMostrar = filtroFase === 'General' ? user.plenosTotales : user.puntosPorFase[filtroFase]?.plenos ?? 0;
              const aciertosMostrar = filtroFase === 'General' ? user.aciertosTotales : user.puntosPorFase[filtroFase]?.aciertos ?? 0;
              const delta = esFDC && filtroFase === 'General' && ambito === 'Nacional' && user.posicionAnterior !== null
                ? user.posicionAnterior - index : null;

              const rowBg = esYo
                ? (esFDC ? 'bg-rose-50' : '')
                : 'hover:bg-gray-50';
              const rowStyle = esYo && !esFDC ? { backgroundColor: '#f0f7ff' } : undefined;

              const nameColor = esYo
                ? (esFDC ? 'text-rose-900' : '')
                : 'text-gray-800';
              const nameStyle = esYo && !esFDC ? { color: '#0e2a47' } : undefined;

              const badgeStyle = !esFDC ? { backgroundColor: '#74ACDF', color: '#fff' } : undefined;

              return (
                <div
                  key={user.id}
                  className={`cursor-pointer transition-colors ${rowBg}`}
                  style={rowStyle}
                  onClick={() => setExpandidoId(expandido ? null : user.id)}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 flex flex-col items-center flex-shrink-0">
                      {obtenerMedalla(index)}
                      {delta !== null && (
                        delta > 0
                          ? <span className="text-[10px] font-black text-green-600 leading-none">↑{delta}</span>
                          : delta < 0
                            ? <span className="text-[10px] font-black text-red-500 leading-none">↓{Math.abs(delta)}</span>
                            : <span className="text-[10px] font-bold text-gray-300 leading-none">—</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className={`font-bold text-base leading-tight ${nameColor}`} style={nameStyle}>
                        {user.nombre}
                      </span>
                      {esYo && (
                        <span
                          className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase align-middle"
                          style={badgeStyle ?? { backgroundColor: '#7f1d1d', color: '#fff' }}
                        >
                          Vos
                        </span>
                      )}
                      {esFDC && ambito === 'Nacional' && user.provincia && (
                        <p className="text-[10px] text-gray-400 font-medium truncate">
                          {user.municipio ? `${user.municipio}, ` : ''}{user.provincia}
                        </p>
                      )}
                      {esFDC && ambito === 'Provincial' && user.municipio && (
                        <p className="text-[10px] text-gray-400 font-medium truncate">{user.municipio}</p>
                      )}
                    </div>

                    <span className="font-black text-2xl flex-shrink-0" style={{ color: '#d97706' }}>
                      {puntosMostrar}
                    </span>
                  </div>

                  {expandido && (
                    <div className="px-4 pb-3 flex gap-6 border-t border-gray-100 pt-2">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-green-600" />
                        <span className="text-sm font-bold text-green-700">{aciertosMostrar} aciertos</span>
                        <span className="text-xs text-gray-400">(1 pt c/u)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Target size={14} className="text-amber-600" />
                        <span className="text-sm font-bold text-amber-700">{plenosMostrar} exactos</span>
                        <span className="text-xs text-gray-400">(3 pts c/u)</span>
                      </div>
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
