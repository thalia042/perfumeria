import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const WHATSAPP_NUMERO = "5492974437221";
const FAVORITOS_KEY = "catalogo-favoritos";

const SECCIONES = [
  {
    id: "perfumeria",
    nombre: "Perfumería",
    descripcion: "Fragancias para mujer, hombre e infantil",
  },
  {
    id: "natura",
    nombre: "Natura",
    descripcion: "Líneas de cuidado diario, repuestos y perfumería",
  },
  {
    id: "avon",
    nombre: "Avon",
    descripcion: "Cosmética, fragancias y cuidado de la piel",
  },
  {
    id: "joyeria",
    nombre: "Joyería",
    descripcion: "Aros, collares y accesorios de acero",
  },
];

const LABELS_TIPO = {
  perfume: "Perfume",
  body_splash: "Body Splash",
  crema: "Crema",
  jabon: "Jabón",
  maquillaje: "Maquillaje",
  desodorante: "Desodorante",
  aros: "Aros",
  collar: "Collar",
  pulsera: "Pulsera",
  anillo: "Anillo",
  dije: "Dije",
};

const CATEGORIAS = [
  { value: "todas", label: "Todas" },
  { value: "mujer", label: "Mujer" },
  { value: "hombre", label: "Hombre" },
  { value: "infantil", label: "Infantil" },
  { value: "unisex", label: "Unisex" },
];

function normalizarTexto(str) {
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

export default function Home({ initialPerfumes, initialPreciosOcultos }) {
  const [perfumes, setPerfumes] = useState(initialPerfumes || []);
  const [preciosOcultos, setPreciosOcultos] = useState(
    initialPreciosOcultos || [],
  );
  const [seccionActual, setSeccionActual] = useState(null);
  const [categoria, setCategoria] = useState("todas");
  const [tamano, setTamano] = useState("todos");
  const [soloPromos, setSoloPromos] = useState(false);
  const [filtroDisponibilidad, setFiltroDisponibilidad] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("nuevos");
  const [tipo, setTipo] = useState("todos");
  const [favoritos, setFavoritos] = useState([]);

  useEffect(() => {
    const intervalo = setInterval(async () => {
      const { data } = await supabase
        .from("perfumes")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setPerfumes(data);

      const { data: conf } = await supabase
        .from("configuracion")
        .select("valor")
        .eq("clave", "precios_ocultos")
        .maybeSingle();
      if (conf?.valor) setPreciosOcultos(conf.valor);
    }, 30000);
    return () => clearInterval(intervalo);
  }, []);

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

  const productosFavoritos = useMemo(
    () => perfumes.filter((p) => favoritos.includes(p.id)),
    [perfumes, favoritos],
  );

  function enviarPorWhatsapp() {
    const inmediatos = productosFavoritos.filter(
      (p) =>
        (p.disponibilidad || (p.en_stock ? "inmediata" : "encargo")) ===
        "inmediata",
    );
    const encargo = productosFavoritos.filter(
      (p) =>
        (p.disponibilidad || (p.en_stock ? "inmediata" : "encargo")) ===
        "encargo",
    );

    let mensaje =
      "Hola, vi el catálogo y me interesan los siguientes artículos:\n\n";

    if (inmediatos.length > 0) {
      mensaje += "DISPONIBLES PARA RETIRAR HOY:\n";
      inmediatos.forEach((p) => {
        const ocultarPrecio = preciosOcultos.includes(p.tipo || "perfume");
        const precioTxt =
          ocultarPrecio || Number(p.precio) === 0
            ? "Consultar precio"
            : `$${Number(p.precio).toLocaleString("es-AR")}`;
        mensaje += `• ${p.codigo ? `[${p.codigo}] ` : ""}${p.nombre} ${p.tamano ? `(${p.tamano})` : ""} - ${precioTxt}\n`;
      });
      mensaje += "\n";
    }

    if (encargo.length > 0) {
      mensaje += "PARA ENCARGAR (ABONO PREVIO COMPLETO):\n";
      encargo.forEach((p) => {
        const ocultarPrecio = preciosOcultos.includes(p.tipo || "perfume");
        const precioTxt =
          ocultarPrecio || Number(p.precio) === 0
            ? "Consultar precio"
            : `$${Number(p.precio).toLocaleString("es-AR")}`;
        mensaje += `• ${p.codigo ? `[${p.codigo}] ` : ""}${p.nombre} ${p.tamano ? `(${p.tamano})` : ""} - ${precioTxt}\n`;
      });
      mensaje += "\n¿Me confirmás para coordinar?\n";
    }

    const url = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");
  }

  const esBusquedaActiva = busqueda.trim().length > 0;

  // Productos base según la sección activa
  const productosBaseSeccion = useMemo(() => {
    if (!seccionActual) return perfumes;
    return perfumes.filter((p) => {
      const secs =
        p.secciones && p.secciones.length > 0 ? p.secciones : ["perfumeria"];
      return secs.includes(seccionActual);
    });
  }, [perfumes, seccionActual]);

  // Solo mostrar tipos que realmente tienen productos cargados en esta sección
  const tiposDisponibles = useMemo(() => {
    const tiposEncontrados = new Set(
      productosBaseSeccion
        .filter(
          (p) =>
            (p.disponibilidad || (p.en_stock ? "inmediata" : "encargo")) !==
            "agotado",
        )
        .map((p) => p.tipo || "perfume"),
    );

    const lista = [{ value: "todos", label: "Todos los tipos" }];
    tiposEncontrados.forEach((t) => {
      lista.push({ value: t, label: LABELS_TIPO[t] || t });
    });
    return lista;
  }, [productosBaseSeccion]);

  // Solo mostrar categorías que tengan productos en esta sección
  const categoriasDisponibles = useMemo(() => {
    const catsEncontradas = new Set(
      productosBaseSeccion
        .filter(
          (p) =>
            (p.disponibilidad || (p.en_stock ? "inmediata" : "encargo")) !==
            "agotado",
        )
        .map((p) => p.categoria)
        .filter(Boolean),
    );

    const lista = [{ value: "todas", label: "Todas" }];
    CATEGORIAS.filter((c) => c.value !== "todas").forEach((c) => {
      if (catsEncontradas.has(c.value)) {
        lista.push(c);
      }
    });
    return lista;
  }, [productosBaseSeccion]);

  const tamanos = useMemo(() => {
    const s = new Set(
      productosBaseSeccion.map((p) => p.tamano).filter(Boolean),
    );
    return ["todos", ...Array.from(s)];
  }, [productosBaseSeccion]);

  const filtrados = useMemo(() => {
    const lista = perfumes.filter((p) => {
      const secs =
        p.secciones && p.secciones.length > 0 ? p.secciones : ["perfumeria"];
      const disp = p.disponibilidad || (p.en_stock ? "inmediata" : "encargo");

      if (disp === "agotado") return false;

      if (!esBusquedaActiva && seccionActual) {
        if (!secs.includes(seccionActual)) return false;
      }

      // Filtro de categoría activo tanto en Perfumería como en Joyería
      if (
        (seccionActual === "perfumeria" || seccionActual === "joyeria") &&
        categoria !== "todas"
      ) {
        if (p.categoria !== categoria) return false;
      }

      if (tipo !== "todos" && (p.tipo || "perfume") !== tipo) return false;
      if (tamano !== "todos" && p.tamano !== tamano) return false;
      if (soloPromos && !p.en_promo) return false;
      if (filtroDisponibilidad !== "todos" && disp !== filtroDisponibilidad)
        return false;

      if (esBusquedaActiva) {
        const q = normalizarTexto(busqueda);
        const match =
          normalizarTexto(p.nombre).includes(q) ||
          normalizarTexto(p.marca).includes(q) ||
          normalizarTexto(p.codigo).includes(q);
        if (!match) return false;
      }

      return true;
    });

    return [...lista].sort((a, b) => {
      const dispA = a.disponibilidad || (a.en_stock ? "inmediata" : "encargo");
      const dispB = b.disponibilidad || (b.en_stock ? "inmediata" : "encargo");

      if (dispA !== dispB) {
        return dispA === "inmediata" ? -1 : 1;
      }
      if (orden === "precio_asc") {
        return Number(a.precio) - Number(b.precio);
      }
      if (orden === "precio_desc") {
        return Number(b.precio) - Number(a.precio);
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [
    perfumes,
    seccionActual,
    categoria,
    tamano,
    soloPromos,
    filtroDisponibilidad,
    busqueda,
    orden,
    tipo,
    esBusquedaActiva,
  ]);

  function cambiarSeccion(secId) {
    setSeccionActual(secId);
    setTipo("todos");
    setCategoria("todas");
    setTamano("todos");
    setFiltroDisponibilidad("todos");
  }

  return (
    <div className="page">
      <Head>
        <title>Catálogo | Blanquita Indumentaria</title>
        <meta
          name="description"
          content="Productos disponibles para retirar en el local o encargar."
        />
      </Head>

      <header className="header">
        <div className="container">
          <div className="header-mark">
            <span className="header-eyebrow">
              Stock inmediato y pedidos por catálogo
            </span>
          </div>
          <h1 className="header-title serif">Catálogo Blanquita</h1>
          <p className="header-sub">
            Productos para retiro inmediato o por encargo con abono previo
            completo.
          </p>

          {seccionActual && (
            <div className="secciones-nav" style={{ marginTop: 16 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setSeccionActual(null)}
              >
                Ver todas las secciones
              </button>
              <div
                className="secciones-tabs"
                style={{
                  display: "inline-flex",
                  gap: 8,
                  marginLeft: 10,
                  flexWrap: "wrap",
                }}
              >
                {SECCIONES.map((sec) => (
                  <button
                    key={sec.id}
                    className={`pill ${seccionActual === sec.id ? "active" : ""}`}
                    onClick={() => cambiarSeccion(sec.id)}
                  >
                    {sec.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="container">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Buscar por nombre, código o marca en todo el catálogo…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="search-input-public"
          />
          {(seccionActual || esBusquedaActiva) && (
            <select
              className="orden-select"
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
            >
              <option value="nuevos">Más nuevos primero</option>
              <option value="precio_asc">Precio: menor a mayor</option>
              <option value="precio_desc">Precio: mayor a menor</option>
            </select>
          )}
        </div>

        {esBusquedaActiva && (
          <div
            className="busqueda-aviso"
            style={{
              marginBottom: 20,
              padding: "10px 14px",
              background: "#fdf8f4",
              border: "1px solid #ebd9c8",
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            <strong>Búsqueda global:</strong> buscando &quot;{busqueda}&quot; en
            todas las secciones.
            <button
              style={{
                marginLeft: 10,
                textDecoration: "underline",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#6B1E3C",
              }}
              onClick={() => setBusqueda("")}
            >
              Limpiar búsqueda
            </button>
          </div>
        )}

        {!seccionActual && !esBusquedaActiva ? (
          <div
            className="secciones-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 20,
              margin: "30px 0",
            }}
          >
            {SECCIONES.map((sec) => {
              const cant = perfumes.filter((p) => {
                const s =
                  p.secciones && p.secciones.length > 0
                    ? p.secciones
                    : ["perfumeria"];
                const disp =
                  p.disponibilidad || (p.en_stock ? "inmediata" : "encargo");
                return s.includes(sec.id) && disp !== "agotado";
              }).length;

              return (
                <div
                  key={sec.id}
                  className="seccion-card card"
                  onClick={() => cambiarSeccion(sec.id)}
                  style={{
                    cursor: "pointer",
                    padding: 28,
                    textAlign: "center",
                  }}
                >
                  <h2
                    className="serif"
                    style={{ margin: "0 0 10px 0", fontSize: 24 }}
                  >
                    {sec.nombre}
                  </h2>
                  <p
                    style={{
                      fontSize: 14,
                      color: "#6b5f57",
                      margin: "0 0 16px 0",
                    }}
                  >
                    {sec.descripcion}
                  </p>
                  <span className="pill" style={{ pointerEvents: "none" }}>
                    {cant} {cant === 1 ? "artículo" : "artículos"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="filters">
              <div className="filter-group">
                <span className="filter-label">Disponibilidad</span>
                <button
                  className={`pill ${filtroDisponibilidad === "todos" ? "active" : ""}`}
                  onClick={() => setFiltroDisponibilidad("todos")}
                >
                  Todos
                </button>
                <button
                  className={`pill ${filtroDisponibilidad === "inmediata" ? "active" : ""}`}
                  onClick={() => setFiltroDisponibilidad("inmediata")}
                >
                  Entrega inmediata
                </button>
                <button
                  className={`pill ${filtroDisponibilidad === "encargo" ? "active" : ""}`}
                  onClick={() => setFiltroDisponibilidad("encargo")}
                >
                  Por encargo
                </button>
              </div>

              {tiposDisponibles.length > 2 && (
                <div className="filter-group">
                  <span className="filter-label">Tipo</span>
                  {tiposDisponibles.map((t) => (
                    <button
                      key={t.value}
                      className={`pill ${tipo === t.value ? "active" : ""}`}
                      onClick={() => setTipo(t.value)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Filtro de público para Perfumería y Joyería */}
              {(seccionActual === "perfumeria" ||
                seccionActual === "joyeria") &&
                !esBusquedaActiva &&
                categoriasDisponibles.length > 2 && (
                  <div className="filter-group">
                    <span className="filter-label">Categoría</span>
                    {categoriasDisponibles.map((c) => (
                      <button
                        key={c.value}
                        className={`pill ${categoria === c.value ? "active" : ""}`}
                        onClick={() => setCategoria(c.value)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}

              {tamanos.length > 2 && (
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
              )}

              <div className="filter-group">
                <button
                  className={`pill pill-promo ${soloPromos ? "active" : ""}`}
                  onClick={() => setSoloPromos((v) => !v)}
                >
                  🏷️ Promociones
                </button>
              </div>
            </div>

            {filtrados.length === 0 ? (
              <div className="empty">
                <div className="empty-title serif">
                  No se encontraron productos
                </div>
                <p>Probá cambiando los filtros o el término de búsqueda.</p>
              </div>
            ) : (
              <div className="grid">
                {filtrados.map((p) => {
                  const secs =
                    p.secciones && p.secciones.length > 0
                      ? p.secciones
                      : ["perfumeria"];
                  const disp =
                    p.disponibilidad || (p.en_stock ? "inmediata" : "encargo");
                  const tipoActual = p.tipo || "perfume";
                  const esPerfumeriaOBs =
                    tipoActual === "perfume" || tipoActual === "body_splash";
                  const precioOculto =
                    preciosOcultos.includes(tipoActual) ||
                    Number(p.precio) === 0;

                  return (
                    <div className="card" key={p.id}>
                      <div className="card-photo">
                        <FotosCarrusel fotos={p.fotos} nombre={p.nombre} />
                        <div className="card-badges-left">
                          {secs.map((sId) => {
                            const matchSec = SECCIONES.find(
                              (s) => s.id === sId,
                            );
                            if (!matchSec) return null;
                            return (
                              <span
                                key={sId}
                                className="card-badge"
                                style={{ marginRight: 4 }}
                              >
                                {matchSec.nombre}
                              </span>
                            );
                          })}

                          {/* Etiqueta con Mayúscula inicial */}
                          {p.tipo && (
                            <span className="card-badge-tipo">
                              {LABELS_TIPO[p.tipo] ||
                                p.tipo.charAt(0).toUpperCase() +
                                  p.tipo.slice(1)}
                            </span>
                          )}
                          {p.en_promo && (
                            <span className="card-badge-promo">🏷️ Promo</span>
                          )}
                        </div>

                        {/* Código solo visible si es perfume o body splash */}
                        {esPerfumeriaOBs && p.codigo && (
                          <span className="card-codigo-bubble">{p.codigo}</span>
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
                          {p.tamano && <span>{p.tamano}</span>}
                          {p.tamano && p.marca && <span className="card-dot" />}
                          <span>{p.marca || "Sin marca"}</span>
                        </div>

                        {!precioOculto &&
                          p.en_promo &&
                          p.precio_anterior > p.precio && (
                            <div className="card-descuento-row">
                              <span className="card-price-old">
                                $
                                {Number(p.precio_anterior).toLocaleString(
                                  "es-AR",
                                )}
                              </span>
                              <span className="card-discount-badge">
                                -
                                {Math.round(
                                  100 -
                                    (Number(p.precio) /
                                      Number(p.precio_anterior)) *
                                      100,
                                )}
                                %
                              </span>
                            </div>
                          )}

                        <div
                          className="card-footer"
                          style={{
                            flexDirection: "column",
                            alignItems: "flex-start",
                            gap: 6,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              width: "100%",
                              alignItems: "center",
                            }}
                          >
                            <span className="card-price">
                              {precioOculto
                                ? "Consultar precio"
                                : `$${Number(p.precio).toLocaleString("es-AR")}`}
                            </span>
                            <span
                              className={`card-stock ${disp === "encargo" ? "out" : ""}`}
                            >
                              {disp === "inmediata"
                                ? "Entrega inmediata"
                                : "Por encargo"}
                            </span>
                          </div>
                          {disp === "encargo" && (
                            <span
                              style={{
                                fontSize: 11,
                                color: "#6B1E3C",
                                fontWeight: 500,
                              }}
                            >
                              Abono previo completo
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <footer className="footer">
        <div className="container footer">
          <p>Comodoro Rivadavia</p>
          <a href="/admin/login">Panel de administración</a>
        </div>
      </footer>

      {productosFavoritos.length > 0 && (
        <div className="fav-bar">
          <div className="container fav-bar-inner">
            <span className="fav-count">
              <Heart filled /> {productosFavoritos.length}{" "}
              {productosFavoritos.length === 1 ? "artículo" : "artículos"}
            </span>
            <button className="btn btn-primary" onClick={enviarPorWhatsapp}>
              Consultar por WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export async function getServerSideProps() {
  const { data: perfumes } = await supabase
    .from("perfumes")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: conf } = await supabase
    .from("configuracion")
    .select("valor")
    .eq("clave", "precios_ocultos")
    .maybeSingle();

  return {
    props: {
      initialPerfumes: perfumes || [],
      initialPreciosOcultos: conf?.valor || [],
    },
  };
}
