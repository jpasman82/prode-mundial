"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import { Trophy, ShieldCheck, Zap } from 'lucide-react';

export default function Home() {
  const [nombre, setNombre] = useState('');
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
        // Verificamos si este usuario de Google ya eligió un nombre en nuestra base
        const { data: perfil } = await supabase
          .from('usuarios')
          .select('nombre_jugador')
          .eq('id', session.user.id)
          .maybeSingle();

        if (perfil) {
          // Ya tiene nombre, lo mandamos directo a jugar
          router.push('/dashboard');
        } else {
          // Entró con Google pero es su primera vez, le pedimos el apodo
          setNecesitaUsername(true);
          setCargando(false);
        }
      } else {
        // No hay sesión de Google iniciada
        setCargando(false);
      }
    };
    
    chequearUsuario();

    // Escuchamos cambios en la autenticación (por si vuelve de la pantalla de Google)
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

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  const loginConGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
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

    setCargando(true);
    
    // 1. Verificamos si el nombre ya está siendo usado por otro jugador
    const { data: existe } = await supabase
      .from('usuarios')
      .select('nombre_jugador')
      .ilike('nombre_jugador', usernameLimpio) // ilike ignora mayúsculas/minúsculas
      .maybeSingle();

    if (existe) {
      setError('Ese nombre ya está en uso. Por favor elegí otro distinto.');
      setCargando(false);
      return;
    }

    // 2. Si el nombre está libre, lo guardamos asociado a su ID de Google
    const { error: dbError } = await supabase.from('usuarios').insert([
      { id: userId, nombre_jugador: usernameLimpio }
    ]);

    if (dbError) {
      setError('Hubo un error al guardar tu nombre.');
      setCargando(false);
    } else {
      router.push('/dashboard');
    }
  };

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-900 text-white font-black uppercase tracking-tighter">
        Cargando la Cancha...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="text-blue-700" size={40} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 italic tracking-tighter">PRODE 2026</h1>
          <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">
            {necesitaUsername ? 'Último paso' : 'Viví el mundial con tus amigos'}
          </p>
        </div>

        {/* PANTALLA 1: Botón de Google */}
        {!necesitaUsername ? (
          <div className="space-y-4">
            <button
              onClick={loginConGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 font-bold py-4 rounded-2xl shadow-sm active:scale-95 transition-all hover:bg-gray-50"
            >
              {/* Ícono simple de G usando SVG nativo */}
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
          
        /* PANTALLA 2: Elegir Nombre de Usuario */
          <form onSubmit={guardarUsername} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Elegí tu nombre de jugador</label>
              <input
                type="text"
                required
                className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-600 outline-none transition text-gray-900 font-black text-lg text-center"
                placeholder="Ej: Fran10"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
              <p className="text-[10px] text-gray-400 text-center mt-2 font-bold uppercase">
                Este nombre será único y visible en el ranking
              </p>
            </div>

            {error && (
              <p className="text-red-600 text-xs font-bold text-center bg-red-50 p-3 rounded-lg border border-red-100">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all text-lg uppercase tracking-wide"
            >
              Comenzar a Jugar
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center text-center">
            <ShieldCheck size={20} className="text-green-600 mb-1" />
            <span className="text-[9px] font-black text-gray-400 uppercase">Google Auth</span>
          </div>
          <div className="flex flex-col items-center text-center border-x border-gray-100">
            <Trophy size={20} className="text-yellow-500 mb-1" />
            <span className="text-[9px] font-black text-gray-400 uppercase">Ranking</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <Zap size={20} className="text-blue-600 mb-1" />
            <span className="text-[9px] font-black text-gray-400 uppercase">En Vivo</span>
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-blue-200 text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
        USA • MÉXICO • CANADÁ 2026
      </p>
    </div>
  );
}