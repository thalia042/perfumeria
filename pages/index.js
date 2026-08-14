import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// 👇 CAMBIAR ACÁ: tu número de WhatsApp con código de país, sin espacios ni "+"
// Ejemplo Argentina: "5492970123456"
const WHATSAPP_NUMERO = "5490000000000";

const FAVORITOS_KEY = "perfumeria-favoritos";

const CATEGORIAS = [
  { value: "todas", label: "Todas" },
  { value: "mujer", label: "Mujer" },
  { value: "hombre", label: "Hombre" },
  { value: "nina", label: "Niña" },
  { value: "nino", label: "Niño" },
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
      <rect
        x="10.5"
        y="16"
        width="9"
        height="6"
        fill="#F7EFE7"
        opacity="0.55"
      />
    </svg>
  );
}

function Heart({ filled }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "#6B1E3C" : "none"}
      stroke={filled ? "#6B1E3C" : "#2B2320"}
      strokeWidth="2"
    >
      <path d="M12 21s-7.5-4.6-10-9.2C.4 8.1 2 4.5 5.6 4c2-.3 3.8.7 4.9 2.3.4.6.9 1.4 1.5 2.3.6-.9 1.1-1.7 1.5-2.3C14.6 4.7 16.4 3.7 18.4 4c3.6.5 5.2 4.1 3.6 7.8C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

function FotosCarrusel({ fotos, nombre }) {
  const [idx, setIdx] = useState(0);
  const lista = fotos && fotos.length > 0 ? fotos : [];

  function anterior(e) {
    e.stopPropagation();
    setIdx((i) => (i === 0 ? lista.length - 1 : i - 1));
  }

  function siguiente(e) {
    e.stopPropagation();
    setIdx((i) => (i === lista.length - 1 ? 0 : i + 1));
  }

  if (lista.length === 0) return null;

  return (
    <>
      <img src={lista[idx]} alt={nombre} />
      {lista.length > 1 && (
        <>
          <button
            className="carrusel-arrow left"
            onClick={anterior}
            aria-label="Foto anterior"
          >
            ‹
          </button>
          <button
            className="carrusel-arrow right"
            onClick={siguiente}
            aria-label="Foto siguiente"
          >
            ›
          </button>
          <div className="carrusel-dots">
            {lista.map((_, i) => (
              <span key={i} className={`dot ${i === idx ? "active" : ""}`} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function Home({ initialPerfumes }) {
  const [perfumes] = useState(initialPerfumes || []);
  const [categoria, setCategoria] = useState("todas");
  const [tamano, setTamano] = useState("todos");
  const [soloPromos, setSoloPromos] = useState(false);
  const [favoritos, setFavoritos] = useState([]);

  // Carga los favoritos guardados en este navegador (si volvió otro día)
  useEffect(() => {
    try {
      const guardados = JSON.parse(
        window.localStorage.getItem(FAVORITOS_KEY) || "[]",
      );
      setFavoritos(guardados);
    } catch {
      setFavoritos([]);
    }
  }, []);

  function toggleFavorito(id) {
    setFavoritos((prev) => {
      const next = prev.includes(id)
        ? prev.filter((f) => f !== id)
        : [...prev, id];
      window.localStorage.setItem(FAVORITOS_KEY, JSON.stringify(next));
      return next;
    });
  }

  const perfumesFavoritos = useMemo(
    () => perfumes.filter((p) => favoritos.includes(p.id)),
    [perfumes, favoritos],
  );

  function enviarPorWhatsapp() {
    const lineas = perfumesFavoritos.map(
      (p) =>
        `• ${p.nombre} (${p.tamano}) - $${Number(p.precio).toLocaleString("es-AR")}`,
    );
    const mensaje = `¡Hola! Vi el catálogo y me interesan estos perfumes:\n\n${lineas.join(
      "\n",
    )}\n\n¿Me los pueden guardar para pasar a retirar?`;
    const url = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
      mensaje,
    )}`;
    window.open(url, "_blank");
  }

  const tamanos = useMemo(() => {
    const s = new Set(perfumes.map((p) => p.tamano).filter(Boolean));
    return ["todos", ...Array.from(s)];
  }, [perfumes]);

  const filtrados = useMemo(() => {
    return perfumes.filter((p) => {
      const okCat = categoria === "todas" || p.categoria === categoria;
      const okTam = tamano === "todos" || p.tamano === tamano;
      const okPromo = !soloPromos || p.en_promo;
      return okCat && okTam && okPromo;
    });
  }, [perfumes, categoria, tamano, soloPromos]);

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
            <span className="header-eyebrow">
              Disponible para retirar al momento
            </span>
          </div>
          <h1 className="header-title serif">Catálogo de Perfumes</h1>
          <p className="header-sub">
            Elegí por categoría y tamaño. Cada perfume se encuentra disponible
            en el local BlanquitaIndumentaria.
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
                className={`pill ${categoria === c.value ? "active" : ""}`}
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
                className={`pill ${tamano === t ? "active" : ""}`}
                onClick={() => setTamano(t)}
              >
                {t === "todos" ? "Todos" : t}
              </button>
            ))}
          </div>
          <div className="filter-group">
            <button
              className={`pill pill-promo ${soloPromos ? "active" : ""}`}
              onClick={() => setSoloPromos((v) => !v)}
            >
              🏷️ Solo promociones
            </button>
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="empty">
            <div className="empty-title serif">
              No hay perfumes con este filtro
            </div>
            <p>Probá con otra categoría o tamaño.</p>
          </div>
        ) : (
          <div className="grid">
            {filtrados.map((p) => (
              <div className="card" key={p.id}>
                <div className="card-photo">
                  <FotosCarrusel fotos={p.fotos} nombre={p.nombre} />
                  <span className="card-badge">
                    {CATEGORIAS.find((c) => c.value === p.categoria)?.label ||
                      p.categoria}
                  </span>
                  {p.en_promo && (
                    <span className="card-badge-promo">🏷️ Promo</span>
                  )}
                  <button
                    className="fav-btn"
                    onClick={() => toggleFavorito(p.id)}
                    aria-label={
                      favoritos.includes(p.id)
                        ? "Quitar de favoritos"
                        : "Agregar a favoritos"
                    }
                  >
                    <Heart filled={favoritos.includes(p.id)} />
                  </button>
                </div>
                <div className="card-body">
                  <div className="card-name serif">{p.nombre}</div>
                  <div className="card-meta">
                    <span>{p.tamano}</span>
                    <span className="card-dot" />
                    <span>{p.marca || "Sin marca"}</span>
                  </div>
                  <div className="card-footer">
                    <span className="card-price">
                      ${Number(p.precio).toLocaleString("es-AR")}
                    </span>
                    <span className={`card-stock ${!p.en_stock ? "out" : ""}`}>
                      {p.en_stock ? "● Disponible" : "● Sin stock"}
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
          <p>Comodoro Rivadavia</p>
          <a href="/admin/login">Panel de administración</a>
        </div>
      </footer>

      {perfumesFavoritos.length > 0 && (
        <div className="fav-bar">
          <div className="container fav-bar-inner">
            <span className="fav-count">
              <Heart filled /> {perfumesFavoritos.length}{" "}
              {perfumesFavoritos.length === 1 ? "favorito" : "favoritos"}
            </span>
            <button className="btn btn-primary" onClick={enviarPorWhatsapp}>
              Enviar mi lista por WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export async function getServerSideProps() {
  const { data, error } = await supabase
    .from("perfumes")
    .select("*")
    .order("created_at", { ascending: false });

  return {
    props: {
      initialPerfumes: error ? [] : data,
    },
  };
}
