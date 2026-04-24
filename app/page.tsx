"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán',
];

export default function Home() {
  const [nombre, setNombre] = useState('');
  const [provincia, setProvincia] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [cargando, setCargando] = useState(true);
  const [necesitaUsername, setNecesitaUsername] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const chequearUsuario = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setUserId(session.user.id);
        const { data: perfil } = await supabase
          .from('usuarios')
          .select('nombre_jugador')
          .eq('id', session.user.id)
          .maybeSingle();

        if (perfil) {
          router.push('/dashboard');
        } else {
          setNecesitaUsername(true);
          setCargando(false);
        }
      } else {
        setCargando(false);
      }
    };

    chequearUsuario();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setCargando(true);
        setUserId(session.user.id);
        const { data: perfil } = await supabase
          .from('usuarios')
          .select('nombre_jugador')
          .eq('id', session.user.id)
          .maybeSingle();

        if (perfil) {
          router.push('/dashboard');
        } else {
          setNecesitaUsername(true);
          setCargando(false);
        }
      }
    });

    return () => { authListener.subscription.unsubscribe(); };
  }, [router]);

  const loginConGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) setError(error.message);
  };

  const guardarUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const usernameLimpio = nombre.trim();

    if (usernameLimpio.length < 3) {
      setError('El nombre debe tener al menos 3 letras o números.');
      return;
    }
    if (!provincia) {
      setError('Tenés que seleccionar tu provincia.');
      return;
    }
    if (municipio.trim().length < 2) {
      setError('Ingresá el nombre de tu municipio o localidad.');
      return;
    }

    setCargando(true);

    const { data: existe } = await supabase
      .from('usuarios')
      .select('nombre_jugador')
      .ilike('nombre_jugador', usernameLimpio)
      .maybeSingle();

    if (existe) {
      setError('Ese nombre ya está en uso. Por favor elegí otro distinto.');
      setCargando(false);
      return;
    }

    const { error: dbError } = await supabase.from('usuarios').insert([
      { id: userId, nombre_jugador: usernameLimpio, provincia, municipio: municipio.trim() }
    ]);

    if (dbError) {
      setError('Hubo un error al guardar tu perfil.');
      setCargando(false);
    } else {
      router.push('/dashboard');
    }
  };

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rose-950 text-white font-black uppercase tracking-tighter">
        Cargando la Cancha...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rose-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mx-auto mb-4">
            <img src="/logo-fdc.png" alt="Las Fuerzas del Cielo" className="h-24 w-auto object-contain" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 italic tracking-tighter">PRODE 2026</h1>
          <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">
            {necesitaUsername ? 'Último paso — completá tu perfil' : 'Las Fuerzas del Cielo · Mundial 2026'}
          </p>
        </div>

        {!necesitaUsername ? (
          <div className="space-y-4">
            <button
              onClick={loginConGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 font-bold py-4 rounded-2xl shadow-sm active:scale-95 transition-all hover:bg-gray-50"
            >
              <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                  <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                  <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                  <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                  <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                </g>
              </svg>
              Entrar con Google
            </button>
            {error && <p className="text-red-600 text-xs font-bold text-center mt-2">{error}</p>}
          </div>
        ) : (
          <form onSubmit={guardarUsername} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombre de jugador</label>
              <input
                type="text"
                required
                className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-rose-700 outline-none transition text-gray-900 font-black text-lg text-center"
                placeholder="Ej: Fran10"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Provincia</label>
              <select
                required
                className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-rose-700 outline-none transition text-gray-900 font-bold"
                value={provincia}
                onChange={(e) => setProvincia(e.target.value)}
              >
                <option value="">Seleccioná tu provincia...</option>
                {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Municipio / Localidad</label>
              <input
                type="text"
                required
                className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-rose-700 outline-none transition text-gray-900 font-bold"
                placeholder="Ej: La Plata"
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
              />
              <p className="text-[10px] text-gray-400 text-center mt-1 font-bold uppercase">
                Visible en los rankings provincial y municipal
              </p>
            </div>

            {error && (
              <p className="text-red-600 text-xs font-bold text-center bg-red-50 p-3 rounded-lg border border-red-100">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-rose-900 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all text-lg uppercase tracking-wide"
            >
              Comenzar a Jugar
            </button>
          </form>
        )}

        <div className="mt-6 pt-5 border-t border-gray-100 text-center">
          <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">
            Las Fuerzas del Cielo · 2026
          </p>
        </div>
      </div>

      <p className="mt-8 text-rose-200 text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
        USA · MÉXICO · CANADÁ 2026
      </p>
    </div>
  );
}
