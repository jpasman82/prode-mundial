"use client";
import { useState, useEffect } from 'react';

export type Tema = 'fdc' | 'familia';

export function useTema() {
  const [tema, setTemaState] = useState<Tema | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const guardado = localStorage.getItem('prode_tema') as Tema | null;
    setTemaState(guardado);
    setListo(true);
  }, []);

  const setTema = (t: Tema) => {
    localStorage.setItem('prode_tema', t);
    setTemaState(t);
  };

  return { tema, setTema, listo };
}

export function leerTemaSync(): Tema {
  if (typeof window === 'undefined') return 'fdc';
  return (localStorage.getItem('prode_tema') as Tema) || 'fdc';
}
