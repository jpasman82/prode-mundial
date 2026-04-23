"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import { Trophy, ShieldCheck, Zap } from 'lucide-react';

export default function Home() {
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [cargando, setCargando] = useState(false);
  const [usuarioListo, setUsuarioListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const chequearSesion = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUsuarioListo(true);
      }
    };
    chequearSesion();
  }, []);

  useEffect(() => {
    if (usuarioListo) {
      router.push('/dashboard');
    }
  }, [usuarioListo, router]);

  const ingresar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    
    if (!nombre.trim()) {
      setError('Por favor, ingresá tu nombre.');
      return;
    }

    // Validación estricta: Solo 4 números
    if (!/^\d{4}$/.test(pin)) {
      setError('La clave debe ser de exactamente 4 números.');
      return;
    }

    setCargando(true);

    try {
      const nombreLimpio = nombre.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const fakeEmail = `${nombreLimpio}@prode2026.com`;
      
      // TRUCO MÁGICO: Le sumamos un texto fijo para engañar la regla de 6 caracteres de Supabase
      const supabasePassword = `${pin}-PR0D3-SECRETO`;

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password: supabasePassword
      });

      if (signInError) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: fakeEmail,
          password: supabasePassword
        });

        if (signUpError) {
          if (signUpError.message.includes('already registered') || signUpError.message.includes('User already exists')) {
            throw new Error('Ese nombre ya está en uso. Si es tuyo, el PIN es incorrecto. 🔒');
          }
          throw signUpError; 
        }

        if (signUpData.user) {
          const { error: dbError } = await supabase.from('usuarios').insert([
            { id: signUpData.user.id, nombre_jugador: nombre.trim() }
          ]);
          if (dbError) throw dbError;
        }
      }

      setUsuarioListo(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  if (usuarioListo) return null;

  return (
    <div className="min-h-screen bg-blue-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="text-blue-700" size={40} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 italic tracking-tighter">PRODE 2026</h1>
          <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Viví el mundial con tus amigos</p>
        </div>

        <form onSubmit={ingresar} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tu Nombre / Apodo</label>
            <input
              type="text"
              required
              className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-600 outline-none transition text-gray-900 font-black text-lg text-center"
              placeholder="Ej: Fran10"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Clave de Acceso (PIN)</label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              required
              className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-600 outline-none transition text-blue-900 font-black text-3xl text-center tracking-[0.5em]"
              placeholder="••••"
              value={pin}
              onChange={(e) => {
                // Solo permitimos ingresar números
                const valor = e.target.value.replace(/[^0-9]/g, '');
                setPin(valor);
              }}
            />
            <p className="text-[10px] text-gray-400 text-center mt-2 font-bold uppercase">Ingresá 4 números</p>
          </div>

          {error && (
            <p className="text-red-600 text-xs font-bold text-center bg-red-50 p-3 rounded-lg border border-red-100">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all text-lg uppercase tracking-wide disabled:bg-blue-300 mt-2"
          >
            {cargando ? 'Cargando...' : 'Entrar a la Cancha'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center text-center">
            <ShieldCheck size={20} className="text-green-600 mb-1" />
            <span className="text-[9px] font-black text-gray-400 uppercase">Seguro</span>
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