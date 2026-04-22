"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Fixture from '../fixture/page'; // Reutilizamos el componente que ya armamos
import { Menu, X, Trophy, Table, Calculator, LogOut } from 'lucide-react'; 
import Simulador from '../simulador/page';

export default function Dashboard() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState<'fixture' | 'prode' | 'simulador'>('fixture');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase.from('usuarios').select('nombre_jugador').eq('id', session.user.id).single();
        setUserName(data?.nombre_jugador || 'Jugador');
      }
    };
    getUser();
  }, []);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar (La barra escondida) */}
      <div className={`fixed inset-y-0 left-0 transform ${menuAbierto ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition duration-200 ease-in-out z-30 w-64 bg-blue-900 text-white p-6 shadow-xl`}>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold italic">PRODE 2026</h2>
          <button onClick={() => setMenuAbierto(false)} className="md:hidden">
            <X size={24} />
          </button>
        </div>

        <nav className="space-y-4">
          <button 
            onClick={() => { setPestanaActiva('fixture'); setMenuAbierto(false); }}
            className={`flex items-center gap-3 w-full p-3 rounded-lg transition ${pestanaActiva === 'fixture' ? 'bg-blue-700' : 'hover:bg-blue-800'}`}
          >
            <Table size={20} /> Fixture
          </button>
          <button 
            onClick={() => { setPestanaActiva('prode'); setMenuAbierto(false); }}
            className={`flex items-center gap-3 w-full p-3 rounded-lg transition ${pestanaActiva === 'prode' ? 'bg-blue-700' : 'hover:bg-blue-800'}`}
          >
            <Trophy size={20} /> Mi Prode / Ranking
          </button>
          <button 
            onClick={() => { setPestanaActiva('simulador'); setMenuAbierto(false); }}
            className={`flex items-center gap-3 w-full p-3 rounded-lg transition ${pestanaActiva === 'simulador' ? 'bg-blue-700' : 'hover:bg-blue-800'}`}
          >
            <Calculator size={20} /> Simulador
          </button>
        </nav>

        <div className="absolute bottom-8 left-6 right-6">
          <button onClick={cerrarSesion} className="flex items-center gap-3 text-red-300 hover:text-red-100 transition">
            <LogOut size={20} /> Salir
          </button>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm p-4 flex items-center gap-4">
          <button onClick={() => setMenuAbierto(true)} className="md:hidden text-gray-600">
            <Menu size={28} />
          </button>
          <h1 className="text-xl font-bold text-gray-800 uppercase tracking-tight">
            {pestanaActiva}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">¡Hola, {userName}!</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {pestanaActiva === 'fixture' && <Fixture />}
          {pestanaActiva === 'prode' && (
            <div className="bg-white p-8 rounded-2xl shadow-sm text-center">
              <Trophy size={48} className="mx-auto text-yellow-500 mb-4" />
              <h2 className="text-2xl font-bold">Ranking del Grupo</h2>
              <p className="text-gray-500">Próximamente verás aquí los puntos de todos tus amigos.</p>
            </div>
          )}
          {pestanaActiva === 'simulador' && (
            <div className="bg-white p-8 rounded-2xl shadow-sm text-center border-2 border-dashed border-gray-200">
              <Calculator size={48} className="mx-auto text-blue-500 mb-4" />
              <h2 className="text-2xl font-bold">Simulador de Llaves</h2>
              <p className="text-gray-500">Jugá con los resultados para ver cómo quedan los cruces.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}