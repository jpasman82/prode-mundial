"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Grupos() {
  const [grupos, setGrupos] = useState<any[]>([]);
  const [nombreNuevoGrupo, setNombreNuevoGrupo] = useState('');
  const [codigoUnirse, setCodigoUnirse] = useState('');
  const [cargando, setCargando] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  const cargarMisGrupos = useCallback(async (id: string) => {
    setCargando(true);
    // Buscamos a qué grupos pertenece el usuario y traemos los datos de esos grupos
    const { data, error } = await supabase
      .from('miembros_grupo')
      .select(`
        grupo_id,
        grupos ( id, nombre, codigo_acceso )
      `)
      .eq('usuario_id', id);

    if (data) {
      // Extraemos solo la info del grupo para limpiar el array
      const gruposFormateados = data.map((item: any) => item.grupos);
      setGrupos(gruposFormateados);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
      setUserId(session.user.id);
      cargarMisGrupos(session.user.id);
    };
    init();
  }, [router, cargarMisGrupos]);

  const crearGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreNuevoGrupo.trim() || !userId) return;

    // Generamos un código aleatorio
    const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();

    // 1. Creamos el grupo
    const { data: nuevoGrupoData, error: errorGrupo } = await supabase
      .from('grupos')
      .insert([{ nombre: nombreNuevoGrupo, codigo_acceso: codigo }])
      .select();

    if (errorGrupo) {
      console.log("Error al crear grupo:", errorGrupo);
      alert("No se pudo crear: " + errorGrupo.message);
      return;
    }

    // 2. Nos unimos al grupo
    if (nuevoGrupoData && nuevoGrupoData.length > 0) {
      const nuevoGrupo = nuevoGrupoData[0]; // ACÁ está la variable que no encontraba
      
      const { error: errorUnion } = await supabase
        .from('miembros_grupo')
        .insert([{ grupo_id: nuevoGrupo.id, usuario_id: userId }]);
        
      if (errorUnion) {
         console.log("Error detallado de base de datos:", errorUnion);
         alert(`Error de base de datos (${errorUnion.code}): ${errorUnion.message}`);
         return;
      }
      
      // Si todo sale bien, limpiamos el input y recargamos
      setNombreNuevoGrupo('');
      cargarMisGrupos(userId);
    }
  };

  const unirseGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoUnirse.trim() || !userId) return;

    const codigoLimpio = codigoUnirse.trim().toUpperCase();

    // 1. Buscamos si existe un grupo con ese código
    const { data: grupoEncontrado, error: errorBusqueda } = await supabase
      .from('grupos')
      .select('*')
      .eq('codigo_acceso', codigoLimpio)
      .single();

    if (errorBusqueda || !grupoEncontrado) {
      alert('Código no encontrado. Verificá que esté bien escrito.');
      return;
    }

    // 2. Si existe, nos unimos
    const { error: errorUnion } = await supabase
      .from('miembros_grupo')
      .insert([{ grupo_id: grupoEncontrado.id, usuario_id: userId }]);

    if (errorUnion) {
      if (errorUnion.code === '23505') { // Error de Postgres: Ya existe ese registro
        alert('Ya estás participando en este grupo.');
      } else {
        alert('Error al intentar unirte.');
      }
    } else {
      setCodigoUnirse('');
      cargarMisGrupos(userId); // Recargamos la lista
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Cabecera con botón de volver */}
      <header className="flex items-center mb-6 gap-4">
        <Link href="/dashboard" className="text-rose-800 font-bold text-xl">
          ← Volver
        </Link>
        <h1 className="text-xl font-bold text-gray-800">Mis Grupos</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Columna 1: Acciones (Crear / Unirse) */}
        <div className="flex flex-col gap-6">
          {/* Crear Grupo */}
          <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-rose-800">
            <h2 className="text-lg font-bold mb-4">Crear un Nuevo Grupo</h2>
            <form onSubmit={crearGrupo} className="flex flex-col gap-3">
              <input
                type="text"
                value={nombreNuevoGrupo}
                onChange={(e) => setNombreNuevoGrupo(e.target.value)}
                placeholder="Ej: Los pibes del cole"
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-rose-800"
                required
              />
              <button type="submit" className="bg-rose-900 text-white font-bold py-3 rounded-lg hover:bg-rose-800 transition">
                Crear Grupo
              </button>
            </form>
          </div>

          {/* Unirse a Grupo */}
          <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-green-500">
            <h2 className="text-lg font-bold mb-4">Unirse con un Código</h2>
            <form onSubmit={unirseGrupo} className="flex flex-col gap-3">
              <input
                type="text"
                value={codigoUnirse}
                onChange={(e) => setCodigoUnirse(e.target.value)}
                placeholder="Ej: X9P2M4"
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-green-500 uppercase"
                required
              />
              <button type="submit" className="bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition">
                Unirme al Grupo
              </button>
            </form>
          </div>
        </div>

        {/* Columna 2: Lista de mis grupos */}
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h2 className="text-lg font-bold mb-4">Grupos a los que pertenezco</h2>
          
          {cargando ? (
            <p className="text-gray-500 text-center py-4">Cargando grupos...</p>
          ) : grupos.length === 0 ? (
            <div className="bg-gray-50 text-center py-8 rounded-lg border border-dashed border-gray-300">
              <p className="text-gray-500">Todavía no estás en ningún grupo.</p>
              <p className="text-sm text-gray-400 mt-1">Creá uno o pedile un código a tus amigos.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {grupos.map((grupo) => (
                <li key={grupo.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-gray-800">{grupo.nombre}</h3>
                    <p className="text-sm text-gray-500">
                      Código para invitar: <span className="font-mono font-bold text-amber-600">{grupo.codigo_acceso}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}