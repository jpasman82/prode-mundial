"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Lock, Save, CheckCircle, Clock } from 'lucide-react';

type Pred = { a: string; b: string };

const FASES_ORDEN = ['Fecha 1', 'Fecha 2', 'Fecha 3', '16vos de Final', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Finales'];

function determinarFaseDisplay(partido: any): string {
  if (partido.fase === 'Fase de Grupos') {
    const dia = new Date(partido.fecha_hora).getDate();
    if (dia <= 15) return 'Fecha 1';
    if (dia <= 21) return 'Fecha 2';
    return 'Fecha 3';
  }
  if (partido.fase === 'Final' || partido.fase === 'Tercer Puesto') return 'Finales';
  return partido.fase;
}

export default function MiProde({ userId }: { userId: string | null }) {
  const [partidos, setPartidos] = useState<any[]>([]);
  const [inputs, setInputs] = useState<Record<string, Pred>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [cargando, setCargando] = useState(true);
  const [faseActiva, setFaseActiva] = useState('Fecha 1');
  const [miUserId, setMiUserId] = useState<string | null>(userId);

  useEffect(() => {
    const cargar = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;
      setMiUserId(uid);

      const [{ data: partidos }, { data: pronosticos }] = await Promise.all([
        supabase.from('partidos').select(`
          id, fase, fecha_hora, placeholder_a, placeholder_b, estado,
          equipo_a:equipos!equipo_a_id(id, nombre, bandera_url, grupo),
          equipo_b:equipos!equipo_b_id(id, nombre, bandera_url, grupo)
        `).order('fecha_hora'),
        supabase.from('pronosticos')
          .select('partido_id, prediccion_goles_a, prediccion_goles_b')
          .eq('usuario_id', uid)
      ]);

      if (partidos) setPartidos(partidos);

      const initialInputs: Record<string, Pred> = {};
      (pronosticos || []).forEach((p: any) => {
        initialInputs[p.partido_id] = {
          a: p.prediccion_goles_a?.toString() ?? '',
          b: p.prediccion_goles_b?.toString() ?? '',
        };
      });
      setInputs(initialInputs);
      setCargando(false);
    };
    cargar();
  }, []);

  const handleInput = (partidoId: string, equipo: 'a' | 'b', valor: string) => {
    setInputs(prev => ({ ...prev, [partidoId]: { ...prev[partidoId], [equipo]: valor } }));
  };

  const guardar = async (partido: any) => {
    const pred = inputs[partido.id];
    if (!pred || pred.a === '' || pred.b === '' || !miUserId) return;

    setSaving(prev => ({ ...prev, [partido.id]: true }));
    const { error } = await supabase.from('pronosticos').upsert({
      usuario_id: miUserId,
      partido_id: partido.id,
      prediccion_goles_a: parseInt(pred.a),
      prediccion_goles_b: parseInt(pred.b),
      equipo_a_id: partido.equipo_a?.id ?? null,
      equipo_b_id: partido.equipo_b?.id ?? null,
    }, { onConflict: 'usuario_id,partido_id' });
    setSaving(prev => ({ ...prev, [partido.id]: false }));

    if (!error) {
      setSaved(prev => ({ ...prev, [partido.id]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [partido.id]: false })), 2000);
    }
  };

  const renderPartido = (partido: any) => {
    const bloqueado = new Date() >= new Date(partido.fecha_hora);
    const equiposConocidos = partido.equipo_a !== null && partido.equipo_b !== null;
    const pendiente = !equiposConocidos && !bloqueado;
    const pred = inputs[partido.id];
    const eqA = partido.equipo_a;
    const eqB = partido.equipo_b;

    const fecha = new Date(partido.fecha_hora).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
    const hora = new Date(partido.fecha_hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

    return (
      <div key={partido.id} className="bg-white rounded-xl border border-gray-200 shadow-sm mb-3 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <span className="text-xs font-bold text-gray-400 uppercase capitalize">
            {fecha.replace('.', '')} • {hora}
          </span>
          {bloqueado ? (
            <span className="flex items-center gap-1 text-xs font-bold text-red-500"><Lock size={12} /> Cerrado</span>
          ) : pendiente ? (
            <span className="flex items-center gap-1 text-xs font-bold text-gray-400"><Clock size={12} /> Por definirse</span>
          ) : (
            <span className="text-xs font-bold text-green-600">Abierto</span>
          )}
        </div>

        <div className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
              <span className="font-bold text-sm leading-tight text-gray-900 text-right">{eqA?.nombre ?? partido.placeholder_a ?? '?'}</span>
              <span className="text-2xl flex-shrink-0">{eqA?.bandera_url ?? '🛡️'}</span>
            </div>

            <div className="flex gap-1.5 flex-shrink-0">
              {bloqueado ? (
                <div className={`px-3 py-1.5 rounded-lg font-black text-lg border ${pred ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                  {pred ? `${pred.a} - ${pred.b}` : '? - ?'}
                </div>
              ) : (
                <>
                  <input
                    type="number" min="0" max="99"
                    disabled={pendiente}
                    value={pred?.a ?? ''}
                    onChange={e => handleInput(partido.id, 'a', e.target.value)}
                    className="w-11 h-12 text-center border-2 border-gray-300 rounded-lg font-black text-lg text-blue-900 bg-gray-50 focus:border-blue-500 focus:bg-white disabled:bg-gray-100 disabled:text-gray-300 disabled:border-gray-200 outline-none"
                  />
                  <input
                    type="number" min="0" max="99"
                    disabled={pendiente}
                    value={pred?.b ?? ''}
                    onChange={e => handleInput(partido.id, 'b', e.target.value)}
                    className="w-11 h-12 text-center border-2 border-gray-300 rounded-lg font-black text-lg text-blue-900 bg-gray-50 focus:border-blue-500 focus:bg-white disabled:bg-gray-100 disabled:text-gray-300 disabled:border-gray-200 outline-none"
                  />
                </>
              )}
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className="text-2xl flex-shrink-0">{eqB?.bandera_url ?? '🛡️'}</span>
              <span className="font-bold text-sm leading-tight text-gray-900">{eqB?.nombre ?? partido.placeholder_b ?? '?'}</span>
            </div>
          </div>

          {!bloqueado && !pendiente && (
            <div className="mt-2.5 flex justify-center">
              <button
                onClick={() => guardar(partido)}
                disabled={saving[partido.id] || !pred?.a || !pred?.b}
                className={`flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  saved[partido.id]
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40'
                }`}
              >
                {saved[partido.id]
                  ? <><CheckCircle size={14} /> Guardado</>
                  : <><Save size={14} /> {saving[partido.id] ? 'Guardando...' : 'Guardar'}</>
                }
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (cargando) return <p className="text-center font-bold text-gray-500 mt-10">Cargando tu Prode...</p>;

  const fasesConPartidos = FASES_ORDEN.filter(f => partidos.some(p => determinarFaseDisplay(p) === f));
  const partidosFase = partidos.filter(p => determinarFaseDisplay(p) === faseActiva);

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <div className="bg-white shadow-sm sticky top-0 z-10 border-b border-gray-200">
        <div className="overflow-x-auto">
          <div className="flex min-w-max">
            {FASES_ORDEN.map(fase => {
              const tiene = fasesConPartidos.includes(fase);
              return (
                <button
                  key={fase}
                  onClick={() => tiene && setFaseActiva(fase)}
                  className={`px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                    faseActiva === fase
                      ? 'border-blue-600 text-blue-700 bg-blue-50'
                      : tiene
                        ? 'border-transparent text-gray-500 hover:text-gray-700'
                        : 'border-transparent text-gray-300 cursor-default'
                  }`}
                >
                  {fase}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {partidosFase.length > 0
          ? partidosFase.map(renderPartido)
          : <p className="text-center text-gray-500 mt-10">No hay partidos para esta fase.</p>
        }
      </div>
    </div>
  );
}
