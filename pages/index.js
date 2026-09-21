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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.48 2 2 6.48 2 12C2 13.85 2.5 15.58 3.39 17.06L2.06 21.94L7.07 20.63C8.51 21.5 10.2 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM17.47 16.51C17.24 17.15 16.33 17.67 15.54 17.84C15 17.95 14.3 18.04 12.22 17.18C9.55 16.08 7.84 13.37 7.7 13.19C7.57 13.02 6.62 11.75 6.62 10.44C6.62 9.13 7.29 8.49 7.52 8.23C7.75 7.97 8.03 7.9 8.22 7.9C8.36 7.9 8.52 7.91 8.65 7.91C8.82 7.92 8.94 7.93 9.06 8.21C9.21 8.58 9.57 9.47 9.61 9.56C9.66 9.66 9.68 9.77 9.61 9.91C9.54 10.05 9.49 10.13 9.38 10.26C9.27 10.39 9.16 10.48 9.05 10.62C8.93 10.74 8.81 10.88 8.95 11.12C9.09 11.36 9.57 12.15 10.28 12.78C11.19 13.59 11.94 13.85 12.18 13.97C12.42 14.09 12.56 14.07 12.7 13.91C12.84 13.75 13.3 13.21 13.48 12.96C13.66 12.71 13.84 12.75 14.08 12.84C14.32 12.93 15.61 13.57 15.87 13.7C16.13 13.83 16.31 13.89 16.38 14C16.44 14.12 16.44 14.7 16.21 15.34L17.47 16.51Z"
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
    const disp = p.disponibilidad || (p.en_stock ? "inmediata" : "encargo");
    const dispTxt =
      disp === "inmediata"
        ? "Entrega inmediata"
        : "Por encargo (con seña/abono previo)";
    const medidaTxt = p.tamano ? ` (${p.tamano})` : "";
    const codigoTxt = p.codigo ? `[${p.codigo}] ` : "";

    let mensaje = "";

    if (oculto) {
      // Si el precio es 0 o está oculto por sección
      mensaje = `¡Hola! Me interesa este artículo del catálogo:\n\n• ${codigoTxt}${p.nombre}${medidaTxt}\n• Modalidad: ${dispTxt}\n\n¿Me podrías confirmar el precio y la disponibilidad para coordinar?`;
    } else {
      // Si ya tiene precio visible ($20.000, $34.500, etc.)
      const precioFormateado = `$${Number(p.precio).toLocaleString("es-AR")}`;
      mensaje = `¡Hola! Me interesa comprar este artículo del catálogo:\n\n• ${codigoTxt}${p.nombre}${medidaTxt}\n• Precio: ${precioFormateado}\n• Modalidad: ${dispTxt}\n\n¿Sigue disponible para coordinar la entrega?`;
    }

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
