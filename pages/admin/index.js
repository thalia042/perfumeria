import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { supabase } from "../../lib/supabaseClient";

const SECCIONES_DISPONIBLES = [
  { id: "perfumeria", label: "Perfumería" },
  { id: "natura", label: "Natura" },
  { id: "avon", label: "Avon" },
  { id: "joyeria", label: "Joyería" },
];

const CATEGORIAS = [
  { value: "mujer", label: "Mujer" },
  { value: "hombre", label: "Hombre" },
  { value: "infantil", label: "Infantil" },
  { value: "unisex", label: "Unisex / Sin género" },
];

const TODOS_LOS_TIPOS = [
  { value: "perfume", label: "Perfume" },
  { value: "body_splash", label: "Body Splash" },
  { value: "crema", label: "Crema" },
  { value: "jabon", label: "Jabón" },
  { value: "desodorante", label: "Desodorante / Antitranspirante" },
  { value: "maquillaje", label: "Maquillaje" },
  { value: "aros", label: "Aros" },
  { value: "collar", label: "Collar" },
  { value: "pulsera", label: "Pulsera" },
  { value: "anillo", label: "Anillo" },
  { value: "dije", label: "Dije" },
];

const TAMANOS = ["15ml", "30ml", "50ml", "75ml", "100ml", "150ml"];

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

function estadoVencimiento(fecha) {
  if (!fecha) return null;
  const hoy = new Date();
  const venc = new Date(fecha + "T00:00:00");
  const dias = Math.round((venc - hoy) / (1000 * 60 * 60 * 24));
  if (dias < 0) return { texto: "Vencido", clase: "venc-vencido" };
  if (dias <= 60) return { texto: `Vence en ${dias}d`, clase: "venc-pronto" };
  return { texto: venc.toLocaleDateString("es-AR"), clase: "venc-ok" };
}

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

export default function Admin() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [perfumes, setPerfumes] = useState([]);
  const [preciosOcultos, setPreciosOcultos] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [ordenarPorVencimiento, setOrdenarPorVencimiento] = useState(false);
  const [ordenarPorCodigo, setOrdenarPorCodigo] = useState(false);

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

  async function toggleOcultarPrecio(tipo) {
    const nuevo = preciosOcultos.includes(tipo)
      ? preciosOcultos.filter((t) => t !== tipo)
      : [...preciosOcultos, tipo];

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

  const tiposDisponibles = useMemo(() => {
    const secs = form.secciones || [];
    const esSoloJoyeria = secs.length === 1 && secs[0] === "joyeria";
    const esSoloPerfumeria = secs.length === 1 && secs[0] === "perfumeria";

    if (esSoloJoyeria) {
      return [
        { value: "aros", label: "Aros" },
        { value: "collar", label: "Collar" },
        { value: "pulsera", label: "Pulsera" },
        { value: "anillo", label: "Anillo" },
        { value: "dije", label: "Dije" },
      ];
    }

    if (esSoloPerfumeria) {
      return [
        { value: "perfume", label: "Perfume" },
        { value: "body_splash", label: "Body Splash" },
      ];
    }

    return TODOS_LOS_TIPOS;
  }, [form.secciones]);

  function toggleSeccion(secId) {
    const actuales = form.secciones || [];
    const existe = actuales.includes(secId);
    let nuevas = existe
      ? actuales.filter((s) => s !== secId)
      : [...actuales, secId];
    if (nuevas.length === 0) nuevas = ["perfumeria"];

    let nuevoTipo = form.tipo;
    if (nuevas.length === 1 && nuevas[0] === "perfumeria") {
      if (nuevoTipo !== "perfume" && nuevoTipo !== "body_splash") {
        nuevoTipo = "perfume";
      }
    } else if (nuevas.length === 1 && nuevas[0] === "joyeria") {
      if (
        !["aros", "collar", "pulsera", "anillo", "dije"].includes(nuevoTipo)
      ) {
        nuevoTipo = "aros";
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function nuevo() {
    setForm(FORM_VACIO);
    setFiles([]);
  }

  async function eliminar(id) {
    if (!confirm("¿Borrar este producto del catálogo?")) return;
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
          const ext = f.name.split(".").pop();
          const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("perfumes-fotos")
            .upload(path, f);
          if (uploadError) throw uploadError;
          const { data: pub } = supabase.storage
            .from("perfumes-fotos")
            .getPublicUrl(path);
          urlsNuevas.push(pub.publicUrl);
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
        codigo: esFragancia ? form.codigo || null : null, // Código solo para perfumes o body splash
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
      if (!busqueda.trim()) return true;
      const q = normalizarTexto(busqueda);
      return (
        normalizarTexto(p.nombre).includes(q) ||
        normalizarTexto(p.marca).includes(q) ||
        normalizarTexto(p.codigo).includes(q)
      );
    })
    .sort((a, b) => {
      const dispA = a.disponibilidad || (a.en_stock ? "inmediata" : "encargo");
      const dispB = b.disponibilidad || (b.en_stock ? "inmediata" : "encargo");

      if (dispA !== dispB) {
        return dispA === "inmediata" ? -1 : 1;
      }
      if (ordenarPorCodigo) {
        if (!a.codigo) return 1;
        if (!b.codigo) return -1;
        return a.codigo.localeCompare(b.codigo, "es", { numeric: true });
      }
      if (ordenarPorVencimiento) {
        if (!a.vencimiento) return 1;
        if (!b.vencimiento) return -1;
        return new Date(a.vencimiento) - new Date(b.vencimiento);
      }
      return 0;
    });

  return (
    <div className="admin-shell">
      <Head>
        <title>Admin — Catálogo General</title>
      </Head>

      <div className="admin-header">
        <div className="container">
          <span className="admin-title serif">Panel de Administración</span>
          <div style={{ display: "flex", gap: 10 }}>
            <a
              className="btn btn-ghost btn-sm"
              href="/"
              target="_blank"
              rel="noreferrer"
            >
              Ver catálogo público
            </a>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Salir
            </button>
          </div>
        </div>
      </div>

      <div className="admin-body">
        <div className="container" style={{ marginBottom: 20 }}>
          {/* MÓDULO PARA ESCONDER PRECIOS */}
          <div className="panel" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
              Esconder precios mientras actualizás (se mostrará &quot;Consultar
              precio&quot;):
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {TODOS_LOS_TIPOS.map((t) => {
                const oculto = preciosOcultos.includes(t.value);
                return (
                  <button
                    key={t.value}
                    type="button"
                    className={`pill ${oculto ? "active" : ""}`}
                    style={{
                      background: oculto ? "#6B1E3C" : "#fff",
                      color: oculto ? "#fff" : "#2b2320",
                    }}
                    onClick={() => toggleOcultarPrecio(t.value)}
                  >
                    {oculto ? `🙈 ${t.label} (Oculto)` : `👁️ ${t.label}`}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="container admin-grid">
          <div className="panel">
            <div className="panel-title">
              {form.id ? "Editar producto" : "Agregar producto"}
            </div>
            {error && <div className="error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>
                  <strong>Secciones donde aparece</strong>
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    marginTop: 6,
                  }}
                >
                  {SECCIONES_DISPONIBLES.map((sec) => (
                    <label
                      key={sec.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        background: (form.secciones || []).includes(sec.id)
                          ? "#f4e9df"
                          : "#fafafa",
                        border: `1px solid ${(form.secciones || []).includes(sec.id) ? "#6B1E3C" : "#ddd"}`,
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: (form.secciones || []).includes(sec.id)
                          ? "600"
                          : "normal",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={(form.secciones || []).includes(sec.id)}
                        onChange={() => toggleSeccion(sec.id)}
                      />
                      {sec.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* El código sólo se muestra si es Perfume o Body Splash */}
              {esFragancia && (
                <div className="field">
                  <label>Código del perfume / muestra</label>
                  <input
                    value={form.codigo || ""}
                    onChange={(e) =>
                      setForm({ ...form, codigo: e.target.value })
                    }
                    placeholder="ej. C001, P001"
                  />
                  {siguienteCodigo && (
                    <div className="codigo-hint">
                      Último usado: <strong>{siguienteCodigo.ultimo}</strong>
                      {" · "}
                      <button
                        type="button"
                        className="codigo-hint-btn"
                        onClick={() =>
                          setForm({ ...form, codigo: siguienteCodigo.sugerido })
                        }
                      >
                        Usar {siguienteCodigo.sugerido}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="field">
                <label>Nombre del producto</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>

              <div className="field">
                <label>Marca / Línea / Detalle</label>
                <input
                  value={form.marca}
                  onChange={(e) => setForm({ ...form, marca: e.target.value })}
                  placeholder="ej. Ekos, Kaiak, Acero quirúrgico"
                />
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Precio ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.precio}
                    onChange={(e) =>
                      setForm({ ...form, precio: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label>Tamaño / Medida (opcional)</label>
                  <input
                    type="text"
                    list="tamanos-sugeridos"
                    placeholder="ej. 100ml, 75g, 50cm"
                    value={form.tamano || ""}
                    onChange={(e) =>
                      setForm({ ...form, tamano: e.target.value })
                    }
                  />
                  <datalist id="tamanos-sugeridos">
                    {TAMANOS.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
                <div className="field">
                  <label>Vencimiento (opcional)</label>
                  <input
                    type="date"
                    value={form.vencimiento || ""}
                    onChange={(e) =>
                      setForm({ ...form, vencimiento: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Tipo</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  >
                    {tiposDisponibles.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Categoría / Público (opcional)</label>
                  <select
                    value={form.categoria || ""}
                    onChange={(e) =>
                      setForm({ ...form, categoria: e.target.value || null })
                    }
                  >
                    <option value="">Sin categoría específica</option>
                    {CATEGORIAS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Modalidad de disponibilidad</label>
                <select
                  value={form.disponibilidad}
                  onChange={(e) =>
                    setForm({ ...form, disponibilidad: e.target.value })
                  }
                >
                  <option value="inmediata">
                    Entrega inmediata (en stock físico)
                  </option>
                  <option value="encargo">
                    Por encargo (con abono previo completo)
                  </option>
                  <option value="agotado">
                    Agotado / Desactivado (no se muestra)
                  </option>
                </select>
              </div>

              <div className="field">
                <label>Fotos</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files))}
                />
                {form.fotos && form.fotos.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      marginTop: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {form.fotos.map((url) => (
                      <div key={url} style={{ position: "relative" }}>
                        <img src={url} alt="" className="thumb" />
                        <button
                          type="button"
                          onClick={() => quitarFotoExistente(url)}
                          className="thumb-remove"
                          aria-label="Quitar foto"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="field">
                <label className="stock-toggle">
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
                  <div style={{ marginTop: 10 }}>
                    <label>Precio anterior (tachado)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.precio_anterior}
                      onChange={(e) =>
                        setForm({ ...form, precio_anterior: e.target.value })
                      }
                      placeholder="ej. 39990"
                    />
                  </div>
                )}
              </div>

              {form.disponibilidad === "inmediata" && (
                <div className="field">
                  <label>
                    Cantidad en stock físico (opcional, uso interno)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.cantidad_stock}
                    onChange={(e) =>
                      setForm({ ...form, cantidad_stock: e.target.value })
                    }
                    placeholder="ej. 3"
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <button className="btn btn-primary" disabled={saving}>
                  {saving
                    ? "Guardando…"
                    : form.id
                      ? "Guardar cambios"
                      : "Agregar al catálogo"}
                </button>
                {form.id && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ borderColor: "#ddd", color: "#6b5f57" }}
                    onClick={nuevo}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="table-wrap">
            <div className="table-toolbar">
              <input
                type="text"
                placeholder="Buscar por nombre, código o marca…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="search-input"
              />
              <button
                className={`pill ${ordenarPorVencimiento ? "active" : ""}`}
                onClick={() => {
                  setOrdenarPorVencimiento((v) => !v);
                  setOrdenarPorCodigo(false);
                }}
              >
                Ordenar por vencimiento
              </button>
              <button
                className={`pill ${ordenarPorCodigo ? "active" : ""}`}
                onClick={() => {
                  setOrdenarPorCodigo((v) => !v);
                  setOrdenarPorVencimiento(false);
                }}
              >
                Ordenar por código
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Secciones</th>
                  <th>Tipo</th>
                  <th>Precio</th>
                  <th>Vencimiento</th>
                  <th>Promo</th>
                  <th>Disponibilidad</th>
                  <th className="col-actions-header">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {perfumesVisibles.map((p) => {
                  const venc = estadoVencimiento(p.vencimiento);
                  const secs =
                    p.secciones && p.secciones.length > 0
                      ? p.secciones
                      : ["perfumeria"];
                  const disp =
                    p.disponibilidad || (p.en_stock ? "inmediata" : "encargo");
                  const esFrag =
                    p.tipo === "perfume" || p.tipo === "body_splash";

                  return (
                    <tr key={p.id}>
                      <td>
                        {p.fotos && p.fotos[0] && (
                          <img src={p.fotos[0]} className="thumb" alt="" />
                        )}
                      </td>
                      <td>
                        {esFrag && p.codigo ? (
                          <span className="codigo-bubble">{p.codigo}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <strong>{p.nombre}</strong>
                        <div style={{ fontSize: 11, color: "#6b5f57" }}>
                          {p.marca}
                        </div>
                      </td>
                      <td>
                        <div
                          style={{ display: "flex", gap: 4, flexWrap: "wrap" }}
                        >
                          {secs.map((s) => (
                            <span
                              key={s}
                              style={{
                                fontSize: 11,
                                background: "#eee",
                                padding: "2px 5px",
                                borderRadius: 4,
                              }}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ textTransform: "capitalize" }}>
                        {p.tipo || "perfume"}
                      </td>
                      <td>
                        {Number(p.precio) === 0 ? (
                          <span style={{ color: "#888" }}>Sin precio ($0)</span>
                        ) : (
                          `$${Number(p.precio).toLocaleString("es-AR")}`
                        )}
                      </td>
                      <td>
                        {venc ? (
                          <span className={`venc-badge ${venc.clase}`}>
                            {venc.texto}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{p.en_promo ? "🏷️" : "—"}</td>
                      <td>
                        {disp === "inmediata" && (
                          <span style={{ color: "#2e7d32", fontWeight: 600 }}>
                            Inmediata{" "}
                            {p.cantidad_stock ? `(${p.cantidad_stock})` : ""}
                          </span>
                        )}
                        {disp === "encargo" && (
                          <span style={{ color: "#6B1E3C", fontWeight: 500 }}>
                            Por encargo
                          </span>
                        )}
                        {disp === "agotado" && (
                          <span style={{ color: "#888" }}>Agotado</span>
                        )}
                      </td>
                      <td className="col-actions">
                        <div className="row-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ borderColor: "#ddd", color: "#2b2320" }}
                            onClick={() => editar(p)}
                          >
                            Editar
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => eliminar(p.id)}
                          >
                            Borrar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {perfumesVisibles.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      style={{ textAlign: "center", padding: 30 }}
                    >
                      {busqueda
                        ? "Ningún producto coincide con la búsqueda."
                        : "Todavía no cargaste ningún producto."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
