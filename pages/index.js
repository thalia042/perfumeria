import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const WHATSAPP_NUMERO = "5492974437221";
const PRODUCTOS_POR_PAGINA = 12; // Carga de a 12 para máxima velocidad y ahorro de datos

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
    nombre: "Perla Negra",
    descripcion: "Aros, collares, anillos, dijes y conjuntos de acero",
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
  conjunto: "Conjunto",
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

function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.63C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2Z"
        fill="#25D366"
      />
      <path
        d="M17.52 14.33C17.22 14.18 15.75 13.45 15.48 13.35C15.2 13.25 15 13.2 14.8 13.5C14.6 13.8 14.03 14.48 13.85 14.68C13.68 14.88 13.5 14.9 13.2 14.75C12.9 14.6 11.95 14.29 10.82 13.28C9.94 12.49 9.35 11.52 9.17 11.22C9 10.92 9.15 10.76 9.3 10.61C9.43 10.48 9.6 10.26 9.75 10.08C9.9 9.9 9.95 9.78 10.05 9.58C10.15 9.38 10.1 9.2 10.02 9.05C9.95 8.9 9.37 7.48 9.13 6.9C8.9 6.34 8.66 6.42 8.48 6.41C8.31 6.4 8.11 6.4 7.91 6.4C7.71 6.4 7.39 6.48 7.11 6.78C6.84 7.08 6.06 7.81 6.06 9.28C6.06 10.75 7.13 12.18 7.28 12.38C7.43 12.58 9.39 15.6 12.4 16.9C13.12 17.21 13.68 17.4 14.12 17.54C14.84 17.77 15.5 17.74 16.02 17.66C16.6 17.57 17.81 16.92 18.06 16.22C18.31 15.52 18.31 14.92 18.23 14.8C18.16 14.68 17.82 14.48 17.52 14.33Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}
function optimizarUrl(url) {
  if (!url || !url.startsWith("http")) return url;
  // Redimensiona a un ancho máximo de 600px, comprime al 75% y convierte a formato liviano
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=600&q=75&output=webp`;
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
      <img
        src={optimizarUrl(lista[idx])}
        alt={nombre}
        loading="lazy"
        decoding="async"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
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

  // Cantidad visible actual para paginación
  const [limiteVisible, setLimiteVisible] = useState(PRODUCTOS_POR_PAGINA);

  // Cada vez que se cambia de filtro o búsqueda, vuelve a los primeros 12
  useEffect(() => {
    setLimiteVisible(PRODUCTOS_POR_PAGINA);
  }, [
    seccionActual,
    categoria,
    tamano,
    soloPromos,
    filtroDisponibilidad,
    busqueda,
    orden,
    tipo,
  ]);

  useEffect(() => {
    async function cargarConf() {
      const { data } = await supabase
        .from("configuracion")
        .select("valor")
        .eq("clave", "precios_ocultos")
        .maybeSingle();
      if (data?.valor && Array.isArray(data.valor)) {
        setPreciosOcultos(data.valor);
      }
    }
    cargarConf();

    const intervalo = setInterval(async () => {
      const { data: pData } = await supabase
        .from("perfumes")
        .select("*")
        .order("created_at", { ascending: false });
      if (pData) setPerfumes(pData);
      cargarConf();
    }, 20000);

    return () => clearInterval(intervalo);
  }, []);

  function tienePrecioOculto(p) {
    if (Number(p.precio) === 0) return true;
    const secs =
      p.secciones && p.secciones.length > 0 ? p.secciones : ["perfumeria"];
    const t = p.tipo || "perfume";

    if (seccionActual) {
      return (
        preciosOcultos.includes(`${seccionActual}:${t}`) ||
        preciosOcultos.includes(t)
      );
    }

    return secs.some(
      (sec) =>
        preciosOcultos.includes(`${sec}:${t}`) || preciosOcultos.includes(t),
    );
  }

  function consultarProductoDirecto(p, e) {
    e.stopPropagation();
    const oculto = tienePrecioOculto(p);
    const precioTxt = oculto
      ? "consultar el precio"
      : `precio $${Number(p.precio).toLocaleString("es-AR")}`;
    const dispTxt =
      (p.disponibilidad || (p.en_stock ? "inmediata" : "encargo")) ===
      "inmediata"
        ? "para retiro inmediato"
        : "para encargar";

    const mensaje = `¡Hola! Me interesa este producto del catálogo:\n\n• ${
      p.codigo ? `[${p.codigo}] ` : ""
    }${p.nombre} (${p.tamano || "Estándar"}) - ${dispTxt}\n\n¿Me podrías confirmar disponibilidad y precio?`;

    window.open(
      `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`,
      "_blank",
    );
  }

  const esBusquedaActiva = busqueda.trim().length > 0;

  const productosBaseSeccion = useMemo(() => {
    if (!seccionActual) return perfumes;
    return perfumes.filter((p) => {
      const secs =
        p.secciones && p.secciones.length > 0 ? p.secciones : ["perfumeria"];
      return secs.includes(seccionActual);
    });
  }, [perfumes, seccionActual]);

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

  const tamanos = useMemo(() => {
    const s = Array.from(
      new Set(productosBaseSeccion.map((p) => p.tamano).filter(Boolean)),
    );

    s.sort((a, b) => {
      const numA = parseFloat(a.replace(/[^\d.]/g, "")) || 0;
      const numB = parseFloat(b.replace(/[^\d.]/g, "")) || 0;
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b, "es", { numeric: true });
    });

    return ["todos", ...s];
  }, [productosBaseSeccion]);

  // Lista total que coincide con los filtros
  const filtrados = useMemo(() => {
    const lista = perfumes.filter((p) => {
      const secs =
        p.secciones && p.secciones.length > 0 ? p.secciones : ["perfumeria"];
      const disp = p.disponibilidad || (p.en_stock ? "inmediata" : "encargo");

      if (disp === "agotado") return false;

      if (!esBusquedaActiva && seccionActual) {
        if (!secs.includes(seccionActual)) return false;
      }

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

  // Solo renderiza la porción actual
  const productosRenderizados = useMemo(() => {
    return filtrados.slice(0, limiteVisible);
  }, [filtrados, limiteVisible]);

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
                    className={`pill ${
                      seccionActual === sec.id ? "active" : ""
                    }`}
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
                  className={`pill ${
                    filtroDisponibilidad === "todos" ? "active" : ""
                  }`}
                  onClick={() => setFiltroDisponibilidad("todos")}
                >
                  Todos
                </button>
                <button
                  className={`pill ${
                    filtroDisponibilidad === "inmediata" ? "active" : ""
                  }`}
                  onClick={() => setFiltroDisponibilidad("inmediata")}
                >
                  Entrega inmediata
                </button>
                <button
                  className={`pill ${
                    filtroDisponibilidad === "encargo" ? "active" : ""
                  }`}
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

              {(seccionActual === "perfumeria" ||
                seccionActual === "joyeria") &&
                !esBusquedaActiva && (
                  <div className="filter-group">
                    <span className="filter-label">Público</span>
                    {CATEGORIAS.map((c) => (
                      <button
                        key={c.value}
                        className={`pill ${
                          categoria === c.value ? "active" : ""
                        }`}
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
              <>
                <div className="grid">
                  {productosRenderizados.map((p) => {
                    const secs =
                      p.secciones && p.secciones.length > 0
                        ? p.secciones
                        : ["perfumeria"];
                    const disp =
                      p.disponibilidad ||
                      (p.en_stock ? "inmediata" : "encargo");
                    const tipoActual = p.tipo || "perfume";
                    const esPerfumeriaOBs =
                      tipoActual === "perfume" || tipoActual === "body_splash";
                    const precioOculto = tienePrecioOculto(p);

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

                          {esPerfumeriaOBs && p.codigo && (
                            <span className="card-codigo-bubble">
                              {p.codigo}
                            </span>
                          )}

                          <button
                            className="fav-btn"
                            onClick={(e) => consultarProductoDirecto(p, e)}
                            title="Consultar por WhatsApp"
                            style={{
                              background: "#25D366",
                              boxShadow: "0 2px 8px rgba(37, 211, 102, 0.4)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <WhatsAppIcon />
                          </button>
                        </div>
                        <div className="card-body">
                          <div className="card-name serif">{p.nombre}</div>
                          <div className="card-meta">
                            {p.tamano && <span>{p.tamano}</span>}
                            {p.tamano && p.marca && (
                              <span className="card-dot" />
                            )}
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
                                className={`card-stock ${
                                  disp === "encargo" ? "out" : ""
                                }`}
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

                {/* BOTÓN CARGAR MÁS PRODUCTOS */}
                {limiteVisible < filtrados.length && (
                  <div style={{ textAlign: "center", margin: "20px 0 60px" }}>
                    <p
                      style={{
                        fontSize: 13,
                        color: "#6b5f57",
                        marginBottom: 12,
                      }}
                    >
                      Mostrando {limiteVisible} de {filtrados.length} productos
                    </p>
                    <button
                      onClick={() =>
                        setLimiteVisible((prev) => prev + PRODUCTOS_POR_PAGINA)
                      }
                      className="btn btn-primary"
                      style={{
                        padding: "14px 28px",
                        fontSize: 15,
                        borderRadius: 30,
                        cursor: "pointer",
                      }}
                    >
                      Cargar más productos
                    </button>
                  </div>
                )}
              </>
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
