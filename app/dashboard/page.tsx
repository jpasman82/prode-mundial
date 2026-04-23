"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Fixture from '../fixture/page'; 
import MiProde from '../prode/page';
import Simulador from '../simulador/page';
import Ranking from '../ranking/page'; // <--- Importamos el ranking nuevo
import { Menu, X, Trophy, Table, Calculator, LogOut, Medal } from 'lucide-react'; 

export default function Dashboard() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  // Agregamos 'ranking' a las pestañas
  const [pestanaActiva, setPestanaActiva] = useState<'fixture' | 'prode' | 'ranking' | 'simulador'>('fixture');
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
      <div className={`fixed inset-y-0 left-0 transform ${menuAbierto ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition duration-200 ease-in-out z-30 w-64 bg-blue-900 text-white p-6 shadow-xl`}>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold italic tracking-wider">PRODE 2026</h2>
          <button onClick={() => setMenuAbierto(false)} className="md:hidden text-white/70 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="space-y-3">
          <button onClick={() => { setPestanaActiva('fixture'); setMenuAbierto(false); }} className={`flex items-center gap-3 w-full p-3 rounded-lg transition font-medium ${pestanaActiva === 'fixture' ? 'bg-blue-700 shadow' : 'hover:bg-blue-800 text-blue-100'}`}>
            <Table size={20} /> Fixture Oficial
          </button>
          
          <button onClick={() => { setPestanaActiva('simulador'); setMenuAbierto(false); }} className={`flex items-center gap-3 w-full p-3 rounded-lg transition font-medium ${pestanaActiva === 'simulador' ? 'bg-blue-700 shadow' : 'hover:bg-blue-800 text-blue-100'}`}>
            <Calculator size={20} /> Simulador Mágico
          </button>

          <button onClick={() => { setPestanaActiva('prode'); setMenuAbierto(false); }} className={`flex items-center gap-3 w-full p-3 rounded-lg transition font-medium ${pestanaActiva === 'prode' ? 'bg-blue-700 shadow' : 'hover:bg-blue-800 text-blue-100'}`}>
            <Trophy size={20} /> Mi Prode
          </button>
          
          {/* EL NUEVO BOTÓN DEL RANKING */}
          <button onClick={() => { setPestanaActiva('ranking'); setMenuAbierto(false); }} className={`flex items-center gap-3 w-full p-3 rounded-lg transition font-medium ${pestanaActiva === 'ranking' ? 'bg-blue-700 shadow' : 'hover:bg-blue-800 text-blue-100'}`}>
            <Medal size={20} /> Ranking del Grupo
          </button>
        </nav>

        <div className="absolute bottom-8 left-6 right-6">
          <button onClick={cerrarSesion} className="flex items-center gap-3 text-red-300 hover:text-red-100 transition font-bold">
            <LogOut size={20} /> Cerrar Sesión
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm p-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setMenuAbierto(true)} className="md:hidden text-gray-700 hover:text-blue-900 transition">
              <Menu size={28} />
            </button>
            <h1 className="text-xl font-black text-gray-800 uppercase tracking-tight">
              {pestanaActiva.replace('prode', 'Mi Prode')}
            </h1>
          </div>
          <span className="text-sm font-bold text-blue-900 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            {userName}
          </span>
        </header>

        <main className="flex-1 overflow-y-auto relative bg-gray-100">
          {pestanaActiva === 'fixture' && <Fixture />}
          {pestanaActiva === 'prode' && <MiProde />}
          {pestanaActiva === 'simulador' && <Simulador />}
          {/* EL COMPONENTE RANKING SE MUESTRA ACÁ */}
          {pestanaActiva === 'ranking' && <Ranking />} 
        </main>
      </div>
    </div>
  );
}