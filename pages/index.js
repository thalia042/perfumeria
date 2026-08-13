import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const CATEGORIAS = [
  { value: 'todas', label: 'Todas' },
  { value: 'mujer', label: 'Mujer' },
  { value: 'hombre', label: 'Hombre' },
  { value: 'nina', label: 'Niña' },
  { value: 'nino', label: 'Niño' },
];

function Bottle() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
      <rect x="12" y="3" width="6" height="4" rx="1" fill="#C9A24B" />
      <rect x="10.5" y="7" width="9" height="3" rx="1" fill="#6B1E3C" />
      <path
        d="M9 12c0-1 .8-2 2-2h8c1.2 0 2 1 2 2v12c0 1.7-1.3 3-3 3h-6c-1.7 0-3-1.3-3-3V12z"
        fill="#6B1E3C"
        opacity="0.9"
      />
      <rect x="10.5" y="16" width="9" height="6" fill="#F7EFE7" opacity="0.55" />
    </svg>
  );
}

export default function Home({ initialPerfumes }) {
  const [perfumes] = useState(initialPerfumes || []);
  const [categoria, setCategoria] = useState('todas');
  const [tamano, setTamano] = useState('todos');

  const tamanos = useMemo(() => {
    const s = new Set(perfumes.map((p) => p.tamano).filter(Boolean));
    return ['todos', ...Array.from(s)];
  }, [perfumes]);

  const filtrados = useMemo(() => {
    return perfumes.filter((p) => {
      const okCat = categoria === 'todas' || p.categoria === categoria;
      const okTam = tamano === 'todos' || p.tamano === tamano;
      return okCat && okTam;
    });
  }, [perfumes, categoria, tamano]);

  return (
    <div className="page">
      <Head>
        <title>Catálogo de Perfumes</title>
        <meta
          name="description"
          content="Perfumes disponibles para retirar en el local."
        />
      </Head>

      <header className="header">
        <div className="container">
          <div className="header-mark">
            <Bottle />
            <span className="header-eyebrow">Disponible para retirar</span>
          </div>
          <h1 className="header-title serif">Catálogo de Perfumes</h1>
          <p className="header-sub">
            Elegí por categoría y tamaño. Cada frasco que ves acá está
            disponible ahora mismo en el local — vení a retirarlo.
          </p>
        </div>
      </header>

      <div className="container">
        <div className="filters">
          <div className="filter-group">
            <span className="filter-label">Categoría</span>
            {CATEGORIAS.map((c) => (
              <button
                key={c.value}
                className={`pill ${categoria === c.value ? 'active' : ''}`}
                onClick={() => setCategoria(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="filter-group">
            <span className="filter-label">Tamaño</span>
            {tamanos.map((t) => (
              <button
                key={t}
                className={`pill ${tamano === t ? 'active' : ''}`}
                onClick={() => setTamano(t)}
              >
                {t === 'todos' ? 'Todos' : t}
              </button>
            ))}
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="empty">
            <div className="empty-title serif">No hay perfumes con este filtro</div>
            <p>Probá con otra categoría o tamaño.</p>
          </div>
        ) : (
          <div className="grid">
            {filtrados.map((p) => (
              <div className="card" key={p.id}>
                <div className="card-photo">
                  {p.foto_url ? (
                    <img src={p.foto_url} alt={p.nombre} />
                  ) : null}
                  <span className="card-badge">
                    {CATEGORIAS.find((c) => c.value === p.categoria)?.label ||
                      p.categoria}
                  </span>
                </div>
                <div className="card-body">
                  <div className="card-name serif">{p.nombre}</div>
                  <div className="card-meta">
                    <span>{p.tamano}</span>
                    <span className="card-dot" />
                    <span>{p.marca || 'Sin marca'}</span>
                  </div>
                  <div className="card-footer">
                    <span className="card-price">
                      ${Number(p.precio).toLocaleString('es-AR')}
                    </span>
                    <span
                      className={`card-stock ${!p.en_stock ? 'out' : ''}`}
                    >
                      {p.en_stock ? '● Disponible' : '● Sin stock'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="footer">
        <div className="container footer">
          <span>Catálogo actualizado en tiempo real.</span>
          <a href="/admin/login">Panel de administración</a>
        </div>
      </footer>
    </div>
  );
}

export async function getServerSideProps() {
  const { data, error } = await supabase
    .from('perfumes')
    .select('*')
    .order('created_at', { ascending: false });

  return {
    props: {
      initialPerfumes: error ? [] : data,
    },
  };
}
