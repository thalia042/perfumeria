import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { supabase } from "../../lib/supabaseClient";

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
  { value: "unisex", label: "Unisex" },
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
// Compresión segura que no rompe la subida si falla el canvas
async function comprimirImagen(archivo, maxWidth = 1000, calidad = 0.75) {
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
              if (!blob) return resolve(archivo); // Fallback al original
              const archivoComprimido = new File([blob], `${Date.now()}.jpg`, {
                type: "image/jpeg",
              });
              resolve(archivoComprimido);
            },
            "image/jpeg",
            calidad,
          );
        } catch (err) {
          resolve(archivo); // Fallback al original ante cualquier fallo de memoria
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

  // Vuelve a 6 cada vez que filtrás por sección, buscás o cambiás el orden
  useEffect(() => {
    setLimiteListaAdmin(ITEMS_POR_PAGINA_ADMIN);
  }, [filtroSeccionLista, ordenLista, busqueda]);

  const [form, setForm] = useState(FORM_VACIO);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const siguienteCodigo = useMemo(
    () => calcularSiguienteCodigo(perfumes),
    [perfumes],
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/admin/login");
      } else {
        setChecking(false);
        cargarPerfumes();
        cargarConfiguracion();
      }
    });
  }, [router]);

  const cargarPerfumes = useCallback(async () => {
    const { data } = await supabase
      .from("perfumes")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setPerfumes(data);
  }, []);

  const cargarConfiguracion = useCallback(async () => {
    const { data } = await supabase
      .from("configuracion")
      .select("valor")
      .eq("clave", "precios_ocultos")
      .maybeSingle();
    if (data?.valor) setPreciosOcultos(data.valor);
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
          // Comprime la imagen de forma segura
          const fotoAEnviar = await comprimirImagen(f, 800, 0.65);

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
            gridTemplateColumns: "1fr 1fr 1fr",
            padding: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setTabActiva("nuevo")}
            style={{
              padding: "14px 8px",
              border: "none",
              background: "none",
              fontSize: 14,
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
              padding: "14px 8px",
              border: "none",
              background: "none",
              fontSize: 14,
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
              padding: "14px 8px",
              border: "none",
              background: "none",
              fontSize: 14,
              fontWeight: 600,
              color: tabActiva === "precios" ? "#6B1E3C" : "#777",
              borderBottom:
                tabActiva === "precios" ? "3px solid #6B1E3C" : "none",
              cursor: "pointer",
            }}
          >
            Precios
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
                gap: 6,
                marginBottom: 10,
                overflowX: "auto",
                paddingBottom: 4,
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
                  whiteSpace: "nowrap",
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
                    whiteSpace: "nowrap",
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

              {/* BOTÓN CARGAR MÁS PRODUCTOS (ADMIN) */}
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
      </div>
    </div>
  );
}
