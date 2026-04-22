"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [nombre, setNombre] = useState('');
  const [cargando, setCargando] = useState(false);
  const [usuarioListo, setUsuarioListo] = useState(false);
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
    if (!nombre.trim()) return;

    setCargando(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

      if (authError) throw authError;

      if (!authData.user) throw new Error("No se pudo crear el usuario");

      const { error: dbError } = await supabase
        .from('usuarios')
        .insert([
          {
            id: authData.user.id,
            nombre_jugador: nombre
          }
        ]);

      if (dbError) throw dbError;

      setUsuarioListo(true);
    } catch (error) {
      if (error instanceof Error) {
        alert('Hubo un error: ' + error.message);
      } else {
        alert('Ocurrió un error inesperado');
      }
    } finally {
      setCargando(false);
    }
  };

  if (usuarioListo) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">Prode Mundial 🏆</h1>
        <form onSubmit={ingresar} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Elegí tu nombre de jugador
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Fran10"
              className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
          >
            {cargando ? 'Entrando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}