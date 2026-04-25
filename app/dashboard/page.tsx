"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { leerTemaSync, type Tema } from '../../lib/useTema';
import Fixture from '../fixture/page';
import MiProde from '../prode/page';
import Simulador from '../simulador/page';
import Ranking from '../ranking/page';
import { Menu, X, Trophy, Table, Calculator, LogOut, Medal } from 'lucide-react';

// Paletas por tema
const ESTILOS = {
  fdc: {
    sidebar: 'bg-rose-950',
    sidebarActivo: 'bg-rose-800',
    sidebarHover: 'hover:bg-rose-900',
    sidebarTexto: 'text-rose-100',
    badgeTexto: 'text-rose-900',
    badgeBg: 'bg-rose-50',
    badgeBorde: 'border-rose-200',
    botonLogout: 'text-red-300 hover:text-red-100',
    logo: <img src="/logo-fdc.png" alt="FDC" className="h-10 w-auto object-contain flex-shrink-0" />,
    titulo: 'PRODE FDC',
  },
  familia: {
    sidebar: '',
    sidebarActivo: '',
    sidebarHover: '',
    sidebarTexto: 'text-white/80',
    badgeTexto: '',
    badgeBg: '',
    badgeBorde: '',
    botonLogout: 'text-white/50 hover:text-white/80',
    logo: (
      <div className="h-10 w-10 rounded-full flex items-center justify-center text-2xl flex-shrink-0" style={{ backgroundColor: '#74ACDF' }}>
        🇦🇷
      </div>
    ),
    titulo: 'PRODE FAMILIA',
  },
} as const;

export default function Dashboard() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState<'fixture' | 'prode' | 'ranking' | 'simulador'>('fixture');
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  // Lectura síncrona para evitar flash de tema incorrecto
  const [tema] = useState<Tema>(() => leerTemaSync());

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
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

  const esFDC = tema === 'fdc';
  const e = ESTILOS[tema];

  const sidebarBg = esFDC
    ? 'bg-rose-950'
    : undefined;
  const sidebarStyle = !esFDC ? { backgroundColor: '#0e2a47' } : undefined;

  const activoClass = esFDC
    ? 'bg-rose-800 shadow'
    : '';
  const activoStyle = !esFDC ? { backgroundColor: '#74ACDF', color: '#0e2a47', fontWeight: 900 } : undefined;

  const hoverClass = esFDC ? 'hover:bg-rose-900' : '';
  const hoverStyle = !esFDC ? {} : undefined;

  const headerBadgeClass = esFDC
    ? 'text-rose-900 bg-rose-50 border border-rose-200'
    : '';
  const headerBadgeStyle = !esFDC
    ? { color: '#0e2a47', backgroundColor: '#74ACDF', fontWeight: 700 }
    : undefined;

  const TABS = [
    { id: 'fixture' as const, label: 'Fixture Oficial', icon: <Table size={20} /> },
    { id: 'simulador' as const, label: 'Simulador', icon: <Calculator size={20} /> },
    { id: 'prode' as const, label: 'Mi Prode', icon: <Trophy size={20} /> },
    { id: 'ranking' as const, label: 'Ranking', icon: <Medal size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 transform ${menuAbierto ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition duration-200 ease-in-out z-30 w-64 text-white p-6 shadow-xl ${sidebarBg ?? ''}`}
        style={sidebarStyle}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 min-w-0">
            {e.logo}
            <h2 className="text-lg font-black italic tracking-wider truncate">{e.titulo}</h2>
          </div>
          <button onClick={() => setMenuAbierto(false)} className="md:hidden text-white/70 hover:text-white flex-shrink-0">
            <X size={24} />
          </button>
        </div>

        <nav className="space-y-2">
          {TABS.map(tab => {
            const activo = pestanaActiva === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setPestanaActiva(tab.id); setMenuAbierto(false); }}
                className={`flex items-center gap-3 w-full p-3 rounded-lg transition font-medium ${activo ? activoClass : `${hoverClass} ${e.sidebarTexto}`}`}
                style={activo ? activoStyle : hoverStyle}
              >
                {tab.icon} {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-8 left-6 right-6">
          <button onClick={cerrarSesion} className={`flex items-center gap-3 transition font-bold ${e.botonLogout}`}>
            <LogOut size={20} /> Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm p-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMenuAbierto(true)}
              className={`md:hidden transition ${esFDC ? 'text-gray-700 hover:text-rose-900' : 'text-gray-700'}`}
              style={!esFDC ? { color: '#0e2a47' } : {}}
            >
              <Menu size={28} />
            </button>
            <h1 className="text-xl font-black text-gray-800 uppercase tracking-tight">
              {TABS.find(t => t.id === pestanaActiva)?.label ?? pestanaActiva}
            </h1>
          </div>
          <span
            className={`text-sm font-bold px-3 py-1 rounded-full ${headerBadgeClass}`}
            style={headerBadgeStyle}
          >
            {userName}
          </span>
        </header>

        <main className="flex-1 overflow-y-auto relative bg-gray-100">
          {pestanaActiva === 'fixture' && <Fixture />}
          {pestanaActiva === 'prode' && <MiProde userId={userId} />}
          {pestanaActiva === 'simulador' && <Simulador userId={userId} />}
          {pestanaActiva === 'ranking' && <Ranking tema={tema} />}
        </main>
      </div>
    </div>
  );
}
