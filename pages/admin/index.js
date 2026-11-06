import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { supabase } from "../../lib/supabaseClient";
import html2canvas from "html2canvas";

const SECCIONES_DISPONIBLES = [
  { id: "perfumeria", label: "Perfumería" },
  { id: "natura", label: "Natura" },
  { id: "avon", label: "Avon" },
  { id: "joyeria", label: "Perla Negra" },
];

const CATEGORIAS = [
  { value: "", label: "Sin género" },
  { value: "mujer", label: "Mujer" },
  { value: "hombre", label: "Hombre" },
  { value: "infantil", label: "Infantil" },
];

const TIPOS_POR_SECCION = {
  perfumeria: [
    { value: "perfume", label: "Perfume" },
    { value: "body_splash", label: "Body Splash" },
  ],
  natura: [
    { value: "crema", label: "Crema" },
    { value: "jabon", label: "Jabón" },
    { value: "desodorante", label: "Desodorante" },
    { value: "perfume", label: "Perfume" },
    { value: "body_splash", label: "Body Splash" },
    { value: "maquillaje", label: "Maquillaje" },
  ],
  avon: [
    { value: "crema", label: "Crema" },
    { value: "maquillaje", label: "Maquillaje" },
    { value: "perfume", label: "Perfume" },
    { value: "desodorante", label: "Desodorante" },
    { value: "jabon", label: "Jabón" },
  ],
  joyeria: [
    { value: "aros", label: "Aros" },
    { value: "collar", label: "Collar" },
    { value: "pulsera", label: "Pulsera" },
    { value: "anillo", label: "Anillo" },
    { value: "dije", label: "Dije" },
    { value: "conjunto", label: "Conjunto" },
  ],
};

const TODOS_LOS_TIPOS = [
  { value: "perfume", label: "Perfume" },
  { value: "body_splash", label: "Body Splash" },
  { value: "crema", label: "Crema" },
  { value: "jabon", label: "Jabón" },
  { value: "desodorante", label: "Desodorante" },
  { value: "maquillaje", label: "Maquillaje" },
  { value: "aros", label: "Aros" },
  { value: "collar", label: "Collar" },
  { value: "pulsera", label: "Pulsera" },
  { value: "anillo", label: "Anillo" },
  { value: "dije", label: "Dije" },
  { value: "conjunto", label: "Conjunto" },
];

const FORM_VACIO = {
  id: null,
  nombre: "A",
  marca: "",
  precio: 0,
  precio_anterior: "",
  categoria: "",
  tamano: "",
  tipo: "crema",
  secciones: ["natura"],
  disponibilidad: "inmediata",
  en_promo: false,
  fotos: [],
  vencimiento: "",
  codigo: "",
  cantidad_stock: "",
};

function normalizarTexto(str) {
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function calcularSiguienteCodigo(perfumes) {
  const regex = /^([A-Za-z]*)(\d+)$/;
  let mejor = null;

  perfumes.forEach((p) => {
    const m = (p.codigo || "").trim().match(regex);
    if (!m) return;
    const numero = parseInt(m[2], 10);
    if (!mejor || numero > mejor.numero) {
      mejor = { prefijo: m[1], numero, digitos: m[2].length, texto: p.codigo };
    }
  });

  if (!mejor) return null;

  const siguienteNum = String(mejor.numero + 1).padStart(mejor.digitos, "0");
  return {
    ultimo: mejor.texto,
    sugerido: `${mejor.prefijo}${siguienteNum}`,
  };
}

async function comprimirImagen(archivo, maxWidth = 900, calidad = 0.7) {
  if (!archivo || !archivo.type.startsWith("image/")) {
    return archivo;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(archivo);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) return resolve(archivo);
              const archivoComprimido = new File([blob], `${Date.now()}.jpg`, {
                type: "image/jpeg",
              });
              resolve(archivoComprimido);
            },
            "image/jpeg",
            calidad,
          );
        } catch (err) {
          resolve(archivo);
        }
      };

      img.onerror = () => resolve(archivo);
    };

    reader.onerror = () => resolve(archivo);
  });
}

export default function Admin() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [perfumes, setPerfumes] = useState([]);
  const [preciosOcultos, setPreciosOcultos] = useState([]);
  const [imagenesSecciones, setImagenesSecciones] = useState({});
  const [subiendoPortada, setSubiendoPortada] = useState(null);

  // 'nuevo' | 'lista' | 'precios' | 'portadas'
  const [tabActiva, setTabActiva] = useState("nuevo");
  const [mostrarAvanzados, setMostrarAvanzados] = useState(false);
  const [seccionConfigOcultar, setSeccionConfigOcultar] =
    useState("perfumeria");

  const [filtroSeccionLista, setFiltroSeccionLista] = useState("todas");
  const [ordenLista, setOrdenLista] = useState("nuevos");
  const [busqueda, setBusqueda] = useState("");

  const ITEMS_POR_PAGINA_ADMIN = 6;
  const [limiteListaAdmin, setLimiteListaAdmin] = useState(
    ITEMS_POR_PAGINA_ADMIN,
  );

  const [form, setForm] = useState(FORM_VACIO);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ==========================================
  // 1. ESTADOS PARA LAS CAPTURAS
  // ==========================================
  const [productoCaptura, setProductoCaptura] = useState(null);
  const [listaCaptura, setListaCaptura] = useState(null);
  // ESTADOS PARA EL GENERADOR DE FLYERS CUSTOM
  const [tituloFlyerCustom, setTituloFlyerCustom] = useState("PRODUCTOS");
  const [idsSeleccionados, setIdsSeleccionados] = useState([]);
  const [mostrarEtiquetaNuevo, setMostrarEtiquetaNuevo] = useState(false);

  // 👇 NUEVOS ESTADOS CON FILTRO DE TIPO AGREGADO
  const [busquedaFlyer, setBusquedaFlyer] = useState("");
  const [filtroSeccionFlyer, setFiltroSeccionFlyer] = useState("todas");
  const [filtroTipoFlyer, setFiltroTipoFlyer] = useState("todos"); // <-- NUEVO
  const [limiteFlyer, setLimiteFlyer] = useState(12);

  // Reiniciar el límite a 12 al buscar o cambiar filtros
  useEffect(() => {
    setLimiteFlyer(12);
  }, [busquedaFlyer, filtroSeccionFlyer, filtroTipoFlyer]);

  // Productos filtrados para el buscador (súper rápido)
  const productosFlyerFiltrados = useMemo(() => {
    return perfumes.filter((p) => {
      // Filtro 1: Sección
      const secs =
        p.secciones && p.secciones.length > 0 ? p.secciones : ["perfumeria"];
      if (filtroSeccionFlyer !== "todas" && !secs.includes(filtroSeccionFlyer))
        return false;

      // Filtro 2: Tipo (Cremas, Jabones, etc)
      if (
        filtroTipoFlyer !== "todos" &&
        (p.tipo || "perfume") !== filtroTipoFlyer
      )
        return false;

      // Filtro 3: Búsqueda escrita
      if (!busquedaFlyer.trim()) return true;
      const q = normalizarTexto(busquedaFlyer);
      return (
        normalizarTexto(p.nombre).includes(q) ||
        normalizarTexto(p.marca).includes(q) ||
        normalizarTexto(p.codigo).includes(q)
      );
    });
  }, [perfumes, filtroSeccionFlyer, filtroTipoFlyer, busquedaFlyer]);

  // Solo renderizamos los primeros 12 (o el límite activo)
  const productosFlyerVisibles = useMemo(() => {
    return productosFlyerFiltrados.slice(0, limiteFlyer);
  }, [productosFlyerFiltrados, limiteFlyer]);

  const siguienteCodigo = useMemo(
    () => calcularSiguienteCodigo(perfumes),
    [perfumes],
  );

  useEffect(() => {
    setLimiteListaAdmin(ITEMS_POR_PAGINA_ADMIN);
  }, [filtroSeccionLista, ordenLista, busqueda]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/admin/login");
      } else {
        setChecking(false);
        cargarPerfumes();
        cargarConfiguraciones();
      }
    });
  }, [router]);

  // ==========================================
  // EFECTOS PARA DESCARGAR LAS IMÁGENES (FALTANTES)
  // ==========================================

  // 1. Descargar Flyer Individual
  useEffect(() => {
    if (productoCaptura) {
      setTimeout(async () => {
        try {
          const el = document.getElementById("flyer-export");
          if (!el) return;
          const canvas = await html2canvas(el, { scale: 2, useCORS: true });
          const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
          const link = document.createElement("a");
          link.download = `flyer-${productoCaptura.nombre.replace(/\s+/g, "_")}.jpg`;
          link.href = dataUrl;
          link.click();
        } catch (err) {
          console.error("Error al generar flyer individual:", err);
          alert("Hubo un error al crear la imagen.");
        } finally {
          setProductoCaptura(null);
        }
      }, 500); // Damos 500ms para que el DOM y las imágenes se rendericen
    }
  }, [productoCaptura]);

  // 2. Descargar Flyer Grupal (El de la nueva pestaña y botones)
  useEffect(() => {
    if (listaCaptura) {
      setTimeout(async () => {
        try {
          const el = document.getElementById("flyer-lista-export");
          if (!el) return;
          const canvas = await html2canvas(el, { scale: 2, useCORS: true });
          const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
          const link = document.createElement("a");
          link.download = `flyer-${listaCaptura.titulo.replace(/\s+/g, "_")}.jpg`;
          link.href = dataUrl;
          link.click();
        } catch (err) {
          console.error("Error al generar flyer grupal:", err);
          alert("Hubo un error al crear el flyer grupal.");
        } finally {
          setListaCaptura(null);
        }
      }, 500); // Damos 500ms para que la grilla y las fotos carguen
    }
  }, [listaCaptura]);

  const cargarPerfumes = useCallback(async () => {
    const { data } = await supabase
      .from("perfumes")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setPerfumes(data);
  }, []);

  const cargarConfiguraciones = useCallback(async () => {
    // 1. Precios ocultos
    const { data: confPrecios } = await supabase
      .from("configuracion")
      .select("valor")
      .eq("clave", "precios_ocultos")
      .maybeSingle();
    if (confPrecios?.valor) setPreciosOcultos(confPrecios.valor);

    // 2. Imágenes de secciones
    const { data: confImg } = await supabase
      .from("configuracion")
      .select("valor")
      .eq("clave", "imagenes_secciones")
      .maybeSingle();
    if (confImg?.valor) setImagenesSecciones(confImg.valor);
  }, []);

  async function toggleOcultarPrecio(secId, tipo) {
    const clave = `${secId}:${tipo}`;
    const nuevo = preciosOcultos.includes(clave)
      ? preciosOcultos.filter((k) => k !== clave)
      : [...preciosOcultos, clave];

    setPreciosOcultos(nuevo);
    await supabase.from("configuracion").upsert({
      clave: "precios_ocultos",
      valor: nuevo,
    });
  }

  async function subirPortadaSeccion(secId, archivo) {
    if (!archivo) return;
    setSubiendoPortada(secId);
    try {
      const fotoOptimizada = await comprimirImagen(archivo, 1000, 0.75);
      const ext = "jpg";
      // Nombre único con timestamp y random
      const path = `portadas/portada-${secId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("perfumes-fotos")
        .upload(path, fotoOptimizada, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage
        .from("perfumes-fotos")
        .getPublicUrl(path);

      if (pub?.publicUrl) {
        const nuevasImg = {
          ...imagenesSecciones,
          [secId]: pub.publicUrl,
        };
        setImagenesSecciones(nuevasImg);

        const { error: dbError } = await supabase.from("configuracion").upsert({
          clave: "imagenes_secciones",
          valor: nuevasImg,
        });

        if (dbError) throw dbError;

        alert(`¡Portada de ${secId} actualizada con éxito!`);
      }
    } catch (err) {
      alert("Error al subir portada: " + (err.message || err));
    } finally {
      setSubiendoPortada(null);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  const tiposDisponiblesForm = useMemo(() => {
    const secs = form.secciones || [];
    if (secs.length === 1 && secs[0] in TIPOS_POR_SECCION) {
      return TIPOS_POR_SECCION[secs[0]];
    }
    return TODOS_LOS_TIPOS;
  }, [form.secciones]);

  function toggleSeccion(secId) {
    const actuales = form.secciones || [];
    let nuevas = actuales.includes(secId)
      ? actuales.filter((s) => s !== secId)
      : [...actuales, secId];

    if (nuevas.length === 0) nuevas = [secId];

    let nuevoTipo = form.tipo;
    if (nuevas.length === 1 && TIPOS_POR_SECCION[nuevas[0]]) {
      const validos = TIPOS_POR_SECCION[nuevas[0]].map((t) => t.value);
      if (!validos.includes(nuevoTipo)) {
        nuevoTipo = validos[0];
      }
    }

    setForm({ ...form, secciones: nuevas, tipo: nuevoTipo });
  }

  function editar(p) {
    setForm({
      ...p,
      cantidad_stock: p.cantidad_stock ?? "",
      precio_anterior: p.precio_anterior ?? "",
      tipo: p.tipo || "perfume",
      categoria: p.categoria || "",
      disponibilidad:
        p.disponibilidad || (p.en_stock ? "inmediata" : "encargo"),
      secciones:
        p.secciones && p.secciones.length > 0 ? p.secciones : ["perfumeria"],
    });
    setFiles([]);
    setTabActiva("nuevo");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function nuevo() {
    setForm(FORM_VACIO);
    setFiles([]);
    setMostrarAvanzados(false);
  }

  async function eliminar(id) {
    if (!confirm("¿Borrar este producto?")) return;
    await supabase.from("perfumes").delete().eq("id", id);
    cargarPerfumes();
  }

  function quitarFotoExistente(url) {
    setForm({
      ...form,
      fotos: (form.fotos || []).filter((f) => f !== url),
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      let fotos = form.fotos || [];

      if (files.length > 0) {
        const urlsNuevas = [];
        for (const f of files) {
          const fotoAEnviar = await comprimirImagen(f, 900, 0.7);
          const ext = fotoAEnviar.name.split(".").pop() || "jpg";
          const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("perfumes-fotos")
            .upload(path, fotoAEnviar, {
              contentType: fotoAEnviar.type || "image/jpeg",
              upsert: true,
            });

          if (uploadError) throw uploadError;

          const { data: pub } = supabase.storage
            .from("perfumes-fotos")
            .getPublicUrl(path);

          if (pub?.publicUrl) {
            urlsNuevas.push(pub.publicUrl);
          }
        }
        fotos = [...fotos, ...urlsNuevas];
      }

      const esFragancia =
        form.tipo === "perfume" || form.tipo === "body_splash";

      const payload = {
        nombre: form.nombre || "A",
        marca: form.marca,
        precio: Number(form.precio) || 0,
        precio_anterior:
          form.en_promo && form.precio_anterior
            ? Number(form.precio_anterior)
            : null,
        categoria: form.categoria || null,
        tamano: form.tamano || null,
        tipo: form.tipo,
        secciones:
          form.secciones && form.secciones.length > 0
            ? form.secciones
            : ["perfumeria"],
        disponibilidad: form.disponibilidad,
        en_stock: form.disponibilidad === "inmediata",
        en_promo: form.en_promo,
        fotos,
        foto_url: fotos[0] || null,
        vencimiento: form.vencimiento || null,
        codigo: esFragancia ? form.codigo || null : null,
        cantidad_stock:
          form.cantidad_stock === "" ? null : Number(form.cantidad_stock),
      };

      if (form.id) {
        const { error: updateError } = await supabase
          .from("perfumes")
          .update(payload)
          .eq("id", form.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("perfumes")
          .insert(payload);
        if (insertError) throw insertError;
      }

      nuevo();
      cargarPerfumes();
      alert("¡Producto guardado!");
    } catch (err) {
      setError(err.message || "Algo salió mal, probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  if (checking) return null;

  const esFragancia = form.tipo === "perfume" || form.tipo === "body_splash";

  const perfumesVisibles = perfumes
    .filter((p) => {
      const secs =
        p.secciones && p.secciones.length > 0 ? p.secciones : ["perfumeria"];
      if (
        filtroSeccionLista !== "todas" &&
        !secs.includes(filtroSeccionLista)
      ) {
        return false;
      }

      if (!busqueda.trim()) return true;
      const q = normalizarTexto(busqueda);
      return (
        normalizarTexto(p.nombre).includes(q) ||
        normalizarTexto(p.marca).includes(q) ||
        normalizarTexto(p.codigo).includes(q)
      );
    })
    .sort((a, b) => {
      if (ordenLista === "precio_asc")
        return Number(a.precio) - Number(b.precio);
      if (ordenLista === "precio_desc")
        return Number(b.precio) - Number(a.precio);
      if (ordenLista === "nombre")
        return a.nombre.localeCompare(b.nombre, "es");
      if (ordenLista === "codigo") {
        if (!a.codigo) return 1;
        if (!b.codigo) return -1;
        return a.codigo.localeCompare(b.codigo, "es", { numeric: true });
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

  const perfumesRenderizadosAdmin = perfumesVisibles.slice(0, limiteListaAdmin);

  return (
    <div
      className="admin-shell"
      style={{ paddingBottom: tabActiva === "nuevo" ? 90 : 30 }}
    >
      <Head>
        <title>Admin Móvil — Blanquita</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
      </Head>

      <div className="admin-header" style={{ padding: "12px 0" }}>
        <div
          className="container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span className="admin-title serif" style={{ fontSize: 18 }}>
            Admin Blanquita
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <a
              className="btn btn-ghost btn-sm"
              href="/"
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12 }}
            >
              Ver web
            </a>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleLogout}
              style={{ fontSize: 12 }}
            >
              Salir
            </button>
          </div>
        </div>
      </div>

      {/* 4 PESTAÑAS: CARGAR / LISTA / PRECIOS / PORTADAS */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #ebd9c8",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          className="container"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            padding: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setTabActiva("nuevo")}
            style={{
              padding: "14px 4px",
              border: "none",
              background: "none",
              fontSize: 13,
              fontWeight: 600,
              color: tabActiva === "nuevo" ? "#6B1E3C" : "#777",
              borderBottom:
                tabActiva === "nuevo" ? "3px solid #6B1E3C" : "none",
              cursor: "pointer",
            }}
          >
            {form.id ? "Editar" : "Cargar"}
          </button>
          <button
            type="button"
            onClick={() => setTabActiva("lista")}
            style={{
              padding: "14px 4px",
              border: "none",
              background: "none",
              fontSize: 13,
              fontWeight: 600,
              color: tabActiva === "lista" ? "#6B1E3C" : "#777",
              borderBottom:
                tabActiva === "lista" ? "3px solid #6B1E3C" : "none",
              cursor: "pointer",
            }}
          >
            Lista ({perfumes.length})
          </button>
          <button
            type="button"
            onClick={() => setTabActiva("precios")}
            style={{
              padding: "14px 4px",
              border: "none",
              background: "none",
              fontSize: 13,
              fontWeight: 600,
              color: tabActiva === "precios" ? "#6B1E3C" : "#777",
              borderBottom:
                tabActiva === "precios" ? "3px solid #6B1E3C" : "none",
              cursor: "pointer",
            }}
          >
            Precios
          </button>
          <button
            type="button"
            onClick={() => setTabActiva("portadas")}
            style={{
              padding: "14px 4px",
              border: "none",
              background: "none",
              fontSize: 13,
              fontWeight: 600,
              color: tabActiva === "portadas" ? "#6B1E3C" : "#777",
              borderBottom:
                tabActiva === "portadas" ? "3px solid #6B1E3C" : "none",
              cursor: "pointer",
            }}
          >
            Portadas
          </button>
          {/* 👇 NUEVA PESTAÑA */}
          <button
            type="button"
            onClick={() => setTabActiva("flyers")}
            style={{
              padding: "14px 4px",
              border: "none",
              background: "none",
              fontSize: 13,
              fontWeight: 600,
              color: tabActiva === "flyers" ? "#6B1E3C" : "#777",
              borderBottom:
                tabActiva === "flyers" ? "3px solid #6B1E3C" : "none",
              cursor: "pointer",
            }}
          >
            Flyer
          </button>
        </div>
      </div>

      <div className="container" style={{ marginTop: 16 }}>
        {tabActiva === "nuevo" && (
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="error" style={{ marginBottom: 14 }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                1. ¿A qué sección va?
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {SECCIONES_DISPONIBLES.map((sec) => {
                  const sel = (form.secciones || []).includes(sec.id);
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => toggleSeccion(sec.id)}
                      style={{
                        padding: "12px 10px",
                        borderRadius: 8,
                        border: `1.5px solid ${sel ? "#6B1E3C" : "#ddd"}`,
                        background: sel ? "#6B1E3C" : "#fff",
                        color: sel ? "#fff" : "#2b2320",
                        fontWeight: sel ? "700" : "500",
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                    >
                      {sec.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                marginBottom: 16,
                background: "#fff",
                padding: 14,
                borderRadius: 10,
                border: "1px solid #ebd9c8",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                2. Foto(s) del producto
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files))}
                style={{ width: "100%", fontSize: 14 }}
              />
              {form.fotos && form.fotos.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {form.fotos.map((url) => (
                    <div key={url} style={{ position: "relative" }}>
                      <img
                        src={url}
                        alt=""
                        style={{
                          width: 60,
                          height: 60,
                          objectFit: "cover",
                          borderRadius: 6,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => quitarFotoExistente(url)}
                        style={{
                          position: "absolute",
                          top: -6,
                          right: -6,
                          background: "#d9534f",
                          color: "#fff",
                          borderRadius: "50%",
                          width: 22,
                          height: 22,
                          border: "none",
                          fontSize: 12,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                3. Disponibilidad
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, disponibilidad: "inmediata" })
                  }
                  style={{
                    padding: "10px",
                    borderRadius: 8,
                    border: `1.5px solid ${
                      form.disponibilidad === "inmediata" ? "#2e7d32" : "#ddd"
                    }`,
                    background:
                      form.disponibilidad === "inmediata" ? "#2e7d32" : "#fff",
                    color:
                      form.disponibilidad === "inmediata" ? "#fff" : "#2b2320",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Inmediata (en mano)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, disponibilidad: "encargo" })
                  }
                  style={{
                    padding: "10px",
                    borderRadius: 8,
                    border: `1.5px solid ${
                      form.disponibilidad === "encargo" ? "#6B1E3C" : "#ddd"
                    }`,
                    background:
                      form.disponibilidad === "encargo" ? "#6B1E3C" : "#fff",
                    color:
                      form.disponibilidad === "encargo" ? "#fff" : "#2b2320",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Por encargo
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                4. Tipo
              </label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {tiposDisponiblesForm.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm({ ...form, tipo: t.value })}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 20,
                      border: `1px solid ${
                        form.tipo === t.value ? "#6B1E3C" : "#ccc"
                      }`,
                      background: form.tipo === t.value ? "#6B1E3C" : "#fff",
                      color: form.tipo === t.value ? "#fff" : "#2b2320",
                      fontSize: 13,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  Nombre
                </label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px",
                    fontSize: 15,
                    borderRadius: 6,
                    border: "1px solid #ccc",
                  }}
                  required
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  Precio ($)
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.precio}
                  onChange={(e) => setForm({ ...form, precio: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px",
                    fontSize: 15,
                    borderRadius: 6,
                    border: "1px solid #ccc",
                  }}
                  required
                />
              </div>
            </div>

            {esFragancia && (
              <div
                style={{
                  marginBottom: 16,
                  background: "#fdf8f4",
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #ebd9c8",
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  Código de muestra
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={form.codigo || ""}
                    onChange={(e) =>
                      setForm({ ...form, codigo: e.target.value })
                    }
                    placeholder="ej. C001"
                    style={{
                      flex: 1,
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid #ccc",
                    }}
                  />
                  {siguienteCodigo && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm({ ...form, codigo: siguienteCodigo.sugerido })
                      }
                      style={{
                        padding: "0 10px",
                        background: "#6B1E3C",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    >
                      Usar {siguienteCodigo.sugerido}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => setMostrarAvanzados((v) => !v)}
                style={{
                  width: "100%",
                  padding: 10,
                  background: "#f4ede6",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "#6B1E3C",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {mostrarAvanzados
                  ? "▲ Ocultar opciones opcionales"
                  : "▼ Completar marca, medida, vencimiento o promo"}
              </button>
            </div>

            {mostrarAvanzados && (
              <div
                style={{
                  background: "#fff",
                  padding: 14,
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  marginBottom: 20,
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{ fontSize: 12, fontWeight: 600, display: "block" }}
                  >
                    Marca / Línea / Detalle
                  </label>
                  <input
                    value={form.marca}
                    onChange={(e) =>
                      setForm({ ...form, marca: e.target.value })
                    }
                    placeholder="ej. Ekos, Acero quirúrgico"
                    style={{
                      width: "100%",
                      padding: 8,
                      marginTop: 4,
                      borderRadius: 6,
                      border: "1px solid #ccc",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        display: "block",
                      }}
                    >
                      Tamaño / Medida
                    </label>
                    <input
                      value={form.tamano || ""}
                      onChange={(e) =>
                        setForm({ ...form, tamano: e.target.value })
                      }
                      placeholder="ej. 75g, 50cm"
                      style={{
                        width: "100%",
                        padding: 8,
                        marginTop: 4,
                        borderRadius: 6,
                        border: "1px solid #ccc",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        display: "block",
                      }}
                    >
                      Público
                    </label>
                    <select
                      value={form.categoria || ""}
                      onChange={(e) =>
                        setForm({ ...form, categoria: e.target.value })
                      }
                      style={{
                        width: "100%",
                        padding: 8,
                        marginTop: 4,
                        borderRadius: 6,
                        border: "1px solid #ccc",
                      }}
                    >
                      {CATEGORIAS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{ fontSize: 12, fontWeight: 600, display: "block" }}
                  >
                    Vencimiento
                  </label>
                  <input
                    type="date"
                    value={form.vencimiento || ""}
                    onChange={(e) =>
                      setForm({ ...form, vencimiento: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: 8,
                      marginTop: 4,
                      borderRadius: 6,
                      border: "1px solid #ccc",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 8 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.en_promo}
                      onChange={(e) =>
                        setForm({ ...form, en_promo: e.target.checked })
                      }
                    />
                    Está en promoción 🏷️
                  </label>
                  {form.en_promo && (
                    <input
                      type="number"
                      placeholder="Precio anterior tachado"
                      value={form.precio_anterior}
                      onChange={(e) =>
                        setForm({ ...form, precio_anterior: e.target.value })
                      }
                      style={{
                        width: "100%",
                        padding: 8,
                        marginTop: 8,
                        borderRadius: 6,
                        border: "1px solid #ccc",
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            <div
              style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                background: "#fff",
                padding: "12px 16px",
                boxShadow: "0 -2px 10px rgba(0,0,0,0.1)",
                display: "flex",
                gap: 10,
                zIndex: 20,
              }}
            >
              {form.id && (
                <button
                  type="button"
                  onClick={nuevo}
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    background: "#f8f8f8",
                    fontWeight: 600,
                  }}
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                style={{
                  flex: 2,
                  padding: "14px",
                  borderRadius: 8,
                  border: "none",
                  background: "#6B1E3C",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {saving
                  ? "Guardando…"
                  : form.id
                    ? "Guardar cambios"
                    : "✓ Guardar producto"}
              </button>
            </div>
          </form>
        )}

        {tabActiva === "lista" && (
          <div>
            <input
              type="text"
              placeholder="Buscar por nombre, código o marca…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 8,
                border: "1px solid #ccc",
                marginBottom: 10,
                fontSize: 15,
              }}
            />

            <div
              style={{
                display: "flex",
                flexWrap: "wrap" /* 👇 Esto hace que los botones bajen 👇 */,
                gap: 6,
                marginBottom: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setFiltroSeccionLista("todas")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: `1px solid ${
                    filtroSeccionLista === "todas" ? "#6B1E3C" : "#ddd"
                  }`,
                  background:
                    filtroSeccionLista === "todas" ? "#6B1E3C" : "#fff",
                  color: filtroSeccionLista === "todas" ? "#fff" : "#2b2320",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Todas las secciones
              </button>
              {SECCIONES_DISPONIBLES.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setFiltroSeccionLista(sec.id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    border: `1px solid ${
                      filtroSeccionLista === sec.id ? "#6B1E3C" : "#ddd"
                    }`,
                    background:
                      filtroSeccionLista === sec.id ? "#6B1E3C" : "#fff",
                    color: filtroSeccionLista === sec.id ? "#fff" : "#2b2320",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {sec.label}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <select
                value={ordenLista}
                onChange={(e) => setOrdenLista(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  fontSize: 13,
                  background: "#fff",
                }}
              >
                <option value="nuevos">Más nuevos primero</option>
                <option value="precio_asc">Precio: menor a mayor</option>
                <option value="precio_desc">Precio: mayor a menor</option>
                <option value="codigo">Ordenar por Código</option>
                <option value="nombre">Ordenar alfabéticamente (A-Z)</option>
              </select>
            </div>

            {/* 👇 CHECKBOX PARA FLYER INDIVIDUAL (Ubicado justo antes de la lista) 👇 */}
            <div
              style={{
                marginBottom: 14,
                background: "#fdf8f4",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #d4af37",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#9a7b1e",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={mostrarEtiquetaNuevo}
                  onChange={(e) => setMostrarEtiquetaNuevo(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#d4af37" }}
                />
                ✨ Agregar etiqueta "Nuevo Ingreso" al descargar flyer
              </label>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {perfumesRenderizadosAdmin.map((p) => {
                const disp =
                  p.disponibilidad || (p.en_stock ? "inmediata" : "encargo");
                return (
                  <div
                    key={p.id}
                    style={{
                      background: "#fff",
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid #ebd9c8",
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    {p.fotos && p.fotos[0] ? (
                      <img
                        src={p.fotos[0]}
                        alt=""
                        loading="lazy"
                        style={{
                          width: 65,
                          height: 65,
                          objectFit: "cover",
                          borderRadius: 8,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 65,
                          height: 65,
                          background: "#eee",
                          borderRadius: 8,
                        }}
                      />
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                          marginBottom: 2,
                        }}
                      >
                        {p.codigo && (
                          <span
                            style={{
                              background: "#2B2320",
                              color: "#fff",
                              padding: "1px 5px",
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            {p.codigo}
                          </span>
                        )}
                        <strong
                          style={{
                            fontSize: 15,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {p.nombre}
                        </strong>
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        {p.marca || "Sin marca"}{" "}
                        {p.tamano ? `· ${p.tamano}` : ""}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            color: "#6B1E3C",
                            fontSize: 14,
                          }}
                        >
                          ${Number(p.precio).toLocaleString("es-AR")}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: disp === "inmediata" ? "#2e7d32" : "#6B1E3C",
                          }}
                        >
                          ● {disp === "inmediata" ? "Inmediato" : "Encargo"}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {/* 👇 3. AGREGA ESTE BOTÓN NUEVO */}
                      <button
                        type="button"
                        onClick={() => setProductoCaptura(p)}
                        style={{
                          padding: "6px 10px",
                          background: "#fdf8f4",
                          border: "1px solid #d4af37",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#9a7b1e",
                          cursor: "pointer",
                        }}
                      >
                        Flyer
                      </button>

                      <button
                        type="button"
                        onClick={() => editar(p)}
                        style={{
                          padding: "6px 10px",
                          background: "#f4ede6",
                          border: "none",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#6B1E3C",
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminar(p.id)}
                        style={{
                          padding: "6px 10px",
                          background: "#fdf0f0",
                          border: "none",
                          borderRadius: 6,
                          fontSize: 12,
                          color: "#d9534f",
                        }}
                      >
                        Borrar
                      </button>
                    </div>
                  </div>
                );
              })}

              {perfumesVisibles.length === 0 && (
                <div
                  style={{ textAlign: "center", padding: 30, color: "#888" }}
                >
                  No se encontraron productos con ese filtro o búsqueda.
                </div>
              )}

              {limiteListaAdmin < perfumesVisibles.length && (
                <div style={{ textAlign: "center", margin: "16px 0 24px" }}>
                  <p style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                    Mostrando {limiteListaAdmin} de {perfumesVisibles.length}{" "}
                    productos
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setLimiteListaAdmin(
                        (prev) => prev + ITEMS_POR_PAGINA_ADMIN,
                      )
                    }
                    style={{
                      padding: "10px 20px",
                      background: "#f4ede6",
                      color: "#6B1E3C",
                      border: "1px solid #ebd9c8",
                      borderRadius: 20,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Ver más productos
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {tabActiva === "precios" && (
          <div
            style={{
              background: "#fff",
              padding: 16,
              borderRadius: 10,
              border: "1px solid #ebd9c8",
            }}
          >
            <h3 style={{ margin: "0 0 10px 0", fontSize: 16 }}>
              Esconder precios al actualizar
            </h3>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>
              Elegí la sección y tocá el producto para esconder su precio (el
              cliente verá &quot;Consultar precio&quot;).
            </p>

            <div
              style={{
                display: "flex",
                gap: 6,
                marginBottom: 14,
                flexWrap: "wrap",
              }}
            >
              {SECCIONES_DISPONIBLES.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setSeccionConfigOcultar(sec.id)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "none",
                    background:
                      seccionConfigOcultar === sec.id ? "#6B1E3C" : "#f0f0f0",
                    color: seccionConfigOcultar === sec.id ? "#fff" : "#2b2320",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {sec.label}
                </button>
              ))}
            </div>

            <div
              style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}
            >
              {(TIPOS_POR_SECCION[seccionConfigOcultar] || []).map((t) => {
                const clave = `${seccionConfigOcultar}:${t.value}`;
                const oculto = preciosOcultos.includes(clave);
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() =>
                      toggleOcultarPrecio(seccionConfigOcultar, t.value)
                    }
                    style={{
                      padding: "12px 14px",
                      borderRadius: 8,
                      border: `1.5px solid ${oculto ? "#6B1E3C" : "#ddd"}`,
                      background: oculto ? "#6B1E3C" : "#fff",
                      color: oculto ? "#fff" : "#2b2320",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    <span>{t.label}</span>
                    <span style={{ fontSize: 12 }}>
                      {oculto ? "Oculto" : "Visible"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* PESTAÑA 4: CAMBIAR FOTOS DE LAS PORTADAS */}
        {tabActiva === "portadas" && (
          <div
            style={{
              background: "#fff",
              padding: 16,
              borderRadius: 10,
              border: "1px solid #ebd9c8",
            }}
          >
            <h3 style={{ margin: "0 0 10px 0", fontSize: 16 }}>
              Fotos de portada de las secciones
            </h3>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 18 }}>
              Subí fotos representativas para los 4 bloques principales. Se
              comprimen solas antes de guardarse.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {SECCIONES_DISPONIBLES.map((sec) => {
                const imgActual = imagenesSecciones[sec.id];
                const estaSubiendo = subiendoPortada === sec.id;

                return (
                  <div
                    key={sec.id}
                    style={{
                      border: "1px solid #ebd9c8",
                      borderRadius: 8,
                      padding: 12,
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    {imgActual ? (
                      <img
                        src={imgActual}
                        alt={sec.label}
                        style={{
                          width: 75,
                          height: 75,
                          borderRadius: 8,
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 75,
                          height: 75,
                          borderRadius: 8,
                          background: "#f0ece7",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          color: "#999",
                        }}
                      >
                        Sin foto
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong
                        style={{
                          fontSize: 15,
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        {sec.label}
                      </strong>
                      <label
                        style={{
                          display: "inline-block",
                          padding: "6px 12px",
                          background: estaSubiendo ? "#eee" : "#f4ede6",
                          color: "#6B1E3C",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: estaSubiendo ? "not-allowed" : "pointer",
                        }}
                      >
                        {estaSubiendo ? "Subiendo…" : "Cambiar foto"}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={estaSubiendo}
                          style={{ display: "none" }}
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              subirPortadaSeccion(sec.id, e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PESTAÑA 5: ARMAR FLYER PERSONALIZADO (OPTIMIZADO CON FILTRO DOBLE) */}
        {tabActiva === "flyers" && (
          <div
            style={{
              background: "#fff",
              padding: 16,
              borderRadius: 10,
              border: "1px solid #ebd9c8",
            }}
          >
            <h3 style={{ margin: "0 0 6px 0", fontSize: 16 }}>
              Armar Flyer Personalizado
            </h3>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>
              Buscá y seleccioná hasta 9 productos. El diseño se adaptará solo.
            </p>

            {/* 1. TÍTULO DEL FLYER Y BOTÓN DESCARGAR */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  Título en la foto
                </label>
                <input
                  type="text"
                  value={tituloFlyerCustom}
                  onChange={(e) =>
                    setTituloFlyerCustom(e.target.value.toUpperCase())
                  }
                  placeholder="Ej: CREMAS, JABONES..."
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid #ccc",
                    fontSize: 13,
                  }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  type="button"
                  disabled={idsSeleccionados.length === 0}
                  onClick={() => {
                    const seleccionados = perfumes.filter((p) =>
                      idsSeleccionados.includes(p.id),
                    );
                    setListaCaptura({
                      titulo: tituloFlyerCustom || "PRODUCTOS",
                      productos: seleccionados,
                    });
                  }}
                  style={{
                    width: "100%",
                    padding: "10px",
                    background:
                      idsSeleccionados.length > 0 ? "#6B1E3C" : "#ccc",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor:
                      idsSeleccionados.length > 0 ? "pointer" : "not-allowed",
                  }}
                >
                  📸 Bajar ({idsSeleccionados.length}/9)
                </button>
              </div>
            </div>

            {/* 👇 CHECKBOX PARA FLYER GRUPAL 👇 */}
            <div
              style={{
                marginBottom: 14,
                background: "#fdf8f4",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #d4af37",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#9a7b1e",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={mostrarEtiquetaNuevo}
                  onChange={(e) => setMostrarEtiquetaNuevo(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#d4af37" }}
                />
                ✨ Agregar etiqueta "Nuevos Ingresos" en la foto
              </label>
            </div>

            {/* 2. RESUMEN FLOTANTE DE PRODUCTOS SELECCIONADOS */}
            {idsSeleccionados.length > 0 && (
              <div
                style={{
                  background: "#fdf8f4",
                  border: "1px solid #d4af37",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{ fontSize: 12, fontWeight: 700, color: "#9a7b1e" }}
                  >
                    Seleccionados ({idsSeleccionados.length} de 9):
                  </span>
                  <button
                    type="button"
                    onClick={() => setIdsSeleccionados([])}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#d9534f",
                      fontSize: 11,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Vaciar lista
                  </button>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    overflowX: "auto",
                    paddingBottom: 4,
                  }}
                >
                  {idsSeleccionados.map((id) => {
                    const prod = perfumes.find((p) => p.id === id);
                    if (!prod) return null;
                    return (
                      <div
                        key={id}
                        style={{ position: "relative", flexShrink: 0 }}
                      >
                        {prod.fotos && prod.fotos[0] ? (
                          <img
                            src={prod.fotos[0]}
                            style={{
                              width: 45,
                              height: 45,
                              objectFit: "cover",
                              borderRadius: 6,
                            }}
                            alt=""
                          />
                        ) : (
                          <div
                            style={{
                              width: 45,
                              height: 45,
                              background: "#ccc",
                              borderRadius: 6,
                            }}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setIdsSeleccionados(
                              idsSeleccionados.filter((i) => i !== id),
                            )
                          }
                          style={{
                            position: "absolute",
                            top: -4,
                            right: -4,
                            background: "#d9534f",
                            color: "#fff",
                            border: "none",
                            borderRadius: "50%",
                            width: 18,
                            height: 18,
                            fontSize: 10,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. FILTROS Y BUSCADOR RÁPIDO */}
            <div
              style={{
                background: "#f8f8f8",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #eee",
                marginBottom: 12,
              }}
            >
              <input
                type="text"
                placeholder="Buscar por nombre, marca o código…"
                value={busquedaFlyer}
                onChange={(e) => setBusquedaFlyer(e.target.value)}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  marginBottom: 10,
                  fontSize: 14,
                }}
              />

              {/* Fila 1: Filtro por Sección */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap" /* 👇 Chau scroll, hola salto de línea 👇 */,
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: "bold",
                    color: "#888",
                    display: "flex",
                    alignItems: "center",
                    marginRight: 4,
                  }}
                >
                  Marca:
                </span>
                <button
                  type="button"
                  onClick={() => setFiltroSeccionFlyer("todas")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 14,
                    border: `1px solid ${filtroSeccionFlyer === "todas" ? "#6B1E3C" : "#ddd"}`,
                    background:
                      filtroSeccionFlyer === "todas" ? "#6B1E3C" : "#fff",
                    color: filtroSeccionFlyer === "todas" ? "#fff" : "#333",
                    fontSize: 12,
                  }}
                >
                  Todas
                </button>
                {SECCIONES_DISPONIBLES.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setFiltroSeccionFlyer(sec.id)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 14,
                      border: `1px solid ${filtroSeccionFlyer === sec.id ? "#6B1E3C" : "#ddd"}`,
                      background:
                        filtroSeccionFlyer === sec.id ? "#6B1E3C" : "#fff",
                      color: filtroSeccionFlyer === sec.id ? "#fff" : "#333",
                      fontSize: 12,
                    }}
                  >
                    {sec.label}
                  </button>
                ))}
              </div>

              {/* Fila 2: Filtro por Tipo */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap" /* 👇 Chau scroll, hola salto de línea 👇 */,
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: "bold",
                    color: "#888",
                    display: "flex",
                    alignItems: "center",
                    marginRight: 4,
                  }}
                >
                  Tipo:
                </span>
                <button
                  type="button"
                  onClick={() => setFiltroTipoFlyer("todos")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 14,
                    border: `1px solid ${filtroTipoFlyer === "todos" ? "#6B1E3C" : "#ddd"}`,
                    background:
                      filtroTipoFlyer === "todos" ? "#6B1E3C" : "#fff",
                    color: filtroTipoFlyer === "todos" ? "#fff" : "#333",
                    fontSize: 12,
                  }}
                >
                  Todos
                </button>
                {TODOS_LOS_TIPOS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setFiltroTipoFlyer(t.value)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 14,
                      border: `1px solid ${filtroTipoFlyer === t.value ? "#6B1E3C" : "#ddd"}`,
                      background:
                        filtroTipoFlyer === t.value ? "#6B1E3C" : "#fff",
                      color: filtroTipoFlyer === t.value ? "#fff" : "#333",
                      fontSize: 12,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. LISTA PAGINADA (MAX 12 POR TANDA) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {productosFlyerVisibles.map((p) => {
                const checked = idsSeleccionados.includes(p.id);
                return (
                  <label
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: `1.5px solid ${checked ? "#6B1E3C" : "#ebd9c8"}`,
                      background: checked ? "#fdf8f4" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        if (checked) {
                          setIdsSeleccionados(
                            idsSeleccionados.filter((id) => id !== p.id),
                          );
                        } else {
                          if (idsSeleccionados.length >= 9)
                            return alert("Máximo 9 productos por flyer.");
                          setIdsSeleccionados([...idsSeleccionados, p.id]);
                        }
                      }}
                      style={{ width: 18, height: 18, accentColor: "#6B1E3C" }}
                    />
                    {p.fotos && p.fotos[0] ? (
                      <img
                        src={p.fotos[0]}
                        style={{
                          width: 38,
                          height: 38,
                          objectFit: "cover",
                          borderRadius: 6,
                        }}
                        alt=""
                      />
                    ) : (
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          background: "#eee",
                          borderRadius: 6,
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {p.nombre}
                      </div>
                      <div style={{ fontSize: 11, color: "#666" }}>
                        {p.codigo ? `[${p.codigo}] ` : ""}
                        {p.marca || "Sin marca"} ·{" "}
                        {Number(p.precio) === 0 ? "Consultar" : `$${p.precio}`}
                      </div>
                    </div>
                  </label>
                );
              })}

              {productosFlyerFiltrados.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: 20,
                    color: "#888",
                    fontSize: 13,
                  }}
                >
                  No se encontraron productos con ese filtro.
                </div>
              )}

              {/* BOTÓN VER MÁS PRODUCTOS */}
              {limiteFlyer < productosFlyerFiltrados.length && (
                <button
                  type="button"
                  onClick={() => setLimiteFlyer((prev) => prev + 12)}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    background: "#f4ede6",
                    color: "#6B1E3C",
                    border: "1px solid #ebd9c8",
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Ver más productos ({productosFlyerVisibles.length} de{" "}
                  {productosFlyerFiltrados.length})
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {/* ==================================================== */}
      {/* PLANTILLA OCULTA PARA DESCARGAR REDES SOCIALES       */}
      {/* ==================================================== */}
      {productoCaptura && (
        <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
          <div
            id="flyer-export"
            style={{
              width: "540px", // Mitad exacta de 1080px (se duplica con scale: 2)
              height: "960px", // Mitad exacta de 1920px (se duplica con scale: 2)
              backgroundColor: "#000000", // El borde exterior totalmente negro
              padding: "28px", // Grosor del borde negro
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Tarjeta interior con bordes redondeados */}
            <div
              style={{
                backgroundColor: "#151515", // Un gris casi negro para resaltar sobre el borde puro
                borderRadius: "24px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "100%",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              {/* Imagen y Etiqueta Nuevo Ingreso */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                }}
              >
                {productoCaptura.fotos && productoCaptura.fotos[0] ? (
                  <img
                    src={productoCaptura.fotos[0]}
                    crossOrigin="anonymous"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    alt="producto"
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: "#333",
                    }}
                  />
                )}

                {/* 🌟 ETIQUETA ATRACTIVA "NUEVO INGRESO" 🌟 */}
                {mostrarEtiquetaNuevo && (
                  <div
                    style={{
                      position: "absolute",
                      top: "32px",
                      left: "0",
                      background:
                        "linear-gradient(90deg, #d4af37 0%, #f3e5ab 100%)",
                      color: "#151515",
                      padding: "12px 28px",
                      fontWeight: "900",
                      fontSize: "24px",
                      fontFamily: "system-ui, sans-serif",
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      borderTopRightRadius: "30px",
                      borderBottomRightRadius: "30px",
                      boxShadow: "0 6px 15px rgba(0,0,0,0.6)",
                    }}
                  >
                    ✨ Nuevo Ingreso
                  </div>
                )}
              </div>

              {/* Textos del producto con tipografía un poco más grande para este tamaño */}
              <div style={{ padding: "36px 40px", backgroundColor: "#151515" }}>
                {productoCaptura.codigo && (
                  <p
                    style={{
                      color: "#d4af37",
                      fontSize: "18px",
                      fontWeight: "bold",
                      margin: "0 0 12px 0",
                      letterSpacing: "2px",
                    }}
                  >
                    {productoCaptura.codigo}
                  </p>
                )}

                <h2
                  style={{
                    color: "#ffffff",
                    fontSize: "40px",
                    margin: "0 0 12px 0",
                    fontFamily: "serif",
                    fontWeight: "600",
                    lineHeight: 1.1,
                  }}
                >
                  {productoCaptura.nombre}
                </h2>

                <p
                  style={{
                    color: "#cccccc",
                    fontSize: "20px",
                    margin: "0 0 28px 0",
                  }}
                >
                  {productoCaptura.marca || "Sin marca"}{" "}
                  {productoCaptura.tamano ? `• ${productoCaptura.tamano}` : ""}
                </p>

                <h3
                  style={{
                    color: "#ffffff",
                    fontSize: "32px",
                    margin: 0,
                    fontFamily: "serif",
                    fontWeight: "bold",
                  }}
                >
                  {preciosOcultos.includes(
                    `${productoCaptura.secciones?.[0] || "perfumeria"}:${productoCaptura.tipo || "perfume"}`,
                  )
                    ? "Consultar precio"
                    : `$${Number(productoCaptura.precio).toLocaleString("es-AR")}`}
                </h3>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ==================================================== */}
      {/* FIN DE PLANTILLA OCULTA                              */}
      {/* ==================================================== */}
      {/* ==================================================== */}
      {/* PLANTILLA OCULTA DINÁMICA (ADAPTABLE Y CORRIGE $0)   */}
      {/* ==================================================== */}
      {listaCaptura && (
        <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
          {(() => {
            const cant = listaCaptura.productos.length;

            // Columnas según cantidad
            let numCols = 3;
            if (cant === 1) numCols = 1;
            else if (cant <= 4) numCols = 2;

            return (
              <div
                id="flyer-lista-export"
                style={{
                  width: "540px",
                  height: "960px",
                  backgroundColor: "#000000",
                  padding: "28px",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#151515",
                    borderRadius: "24px",
                    padding: "30px 24px",
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    height: "100%",
                    boxSizing: "border-box",
                    justifyContent: "space-between", // Distribuye el espacio verticalmente
                  }}
                >
                  {/* Encabezado */}
                  <div style={{ textAlign: "center", marginBottom: "16px" }}>
                    {/* 🌟 ETIQUETA ATRACTIVA GRUPAL 🌟 */}
                    {mostrarEtiquetaNuevo && (
                      <div
                        style={{
                          display: "inline-block",
                          background:
                            "linear-gradient(90deg, #d4af37 0%, #f3e5ab 100%)",
                          color: "#151515",
                          padding: "6px 24px",
                          borderRadius: "30px",
                          fontSize: "15px",
                          fontWeight: "900",
                          letterSpacing: "2px",
                          textTransform: "uppercase",
                          marginBottom: "12px",
                          boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
                        }}
                      >
                        ✨ Nuevos Ingresos ✨
                      </div>
                    )}

                    <h2
                      style={{
                        color: "#ffffff",
                        fontSize: "36px",
                        margin: "0 0 4px 0",
                        fontFamily: "serif",
                        letterSpacing: "3px",
                        textTransform: "uppercase",
                      }}
                    >
                      {listaCaptura.titulo}
                    </h2>
                  </div>

                  {/* Grilla Dinámica */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${numCols}, 1fr)`,
                      gap: cant <= 4 ? "24px 20px" : "14px 10px",
                      alignContent: "center",
                      flex: 1,
                      margin: "auto 0",
                    }}
                  >
                    {listaCaptura.productos.map((p) => {
                      const clave = `${p.secciones?.[0] || "perfumeria"}:${p.tipo || "perfume"}`;

                      // 👇 CORRECCIÓN CLAVE: Si precio es 0 o está oculto en config
                      const esOculto =
                        Number(p.precio) === 0 ||
                        preciosOcultos.includes(clave);
                      const precioTxt = esOculto
                        ? "Consultar precio"
                        : `$${Number(p.precio).toLocaleString("es-AR")}`;

                      return (
                        <div
                          key={p.id}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          {p.fotos && p.fotos[0] ? (
                            <img
                              src={p.fotos[0]}
                              crossOrigin="anonymous"
                              style={{
                                width: "100%",
                                aspectRatio: "5/7",
                                objectFit: "cover",
                                borderRadius: "10px",
                                maxHeight:
                                  cant <= 2
                                    ? "380px"
                                    : cant <= 4
                                      ? "260px"
                                      : "160px",
                              }}
                              alt={p.nombre}
                            />
                          ) : (
                            <div
                              style={{
                                width: "100%",
                                aspectRatio: "5/7",
                                backgroundColor: "#333",
                                borderRadius: "10px",
                              }}
                            />
                          )}
                          <div>
                            <div
                              style={{
                                color: "#fff",
                                fontSize:
                                  cant <= 2
                                    ? "18px"
                                    : cant <= 4
                                      ? "15px"
                                      : "12px",
                                fontWeight: "600",
                                lineHeight: "1.2",
                                marginBottom: "2px",
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                              }}
                            >
                              {p.nombre}
                            </div>
                            <div
                              style={{
                                color: "#d4af37",
                                fontSize:
                                  cant <= 2
                                    ? "20px"
                                    : cant <= 4
                                      ? "16px"
                                      : "13px",
                                fontWeight: "bold",
                              }}
                            >
                              {precioTxt}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pie de página */}
                  <div
                    style={{
                      textAlign: "center",
                      borderTop: "1px solid #333",
                      paddingTop: "16px",
                      marginTop: "16px",
                    }}
                  >
                    <p
                      style={{
                        color: "#fff",
                        margin: 0,
                        fontSize: "16px",
                        fontWeight: "500",
                        letterSpacing: "1px",
                      }}
                    >
                      Consultanos por WhatsApp 💬
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
