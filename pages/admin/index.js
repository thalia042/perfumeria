import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { supabase } from "../../lib/supabaseClient";

const CATEGORIAS = [
  { value: "mujer", label: "Mujer" },
  { value: "hombre", label: "Hombre" },
  { value: "nina", label: "Niña" },
  { value: "nino", label: "Niño" },
];

const TAMANOS = ["15ml", "30ml", "50ml", "75ml", "100ml", "150ml"];

const FORM_VACIO = {
  id: null,
  nombre: "",
  marca: "",
  precio: "",
  categoria: "mujer",
  tamano: "30ml",
  en_stock: true,
  en_promo: false,
  fotos: [],
};

export default function Admin() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [perfumes, setPerfumes] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/admin/login");
      } else {
        setChecking(false);
        cargarPerfumes();
      }
    });
  }, [router]);

  const cargarPerfumes = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("perfumes")
      .select("*")
      .order("created_at", { ascending: false });
    if (!fetchError) setPerfumes(data);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  function editar(p) {
    setForm(p);
    setFiles([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function nuevo() {
    setForm(FORM_VACIO);
    setFiles([]);
  }

  async function eliminar(id) {
    if (!confirm("¿Borrar este perfume del catálogo?")) return;
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
          const path = `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("perfumes-fotos")
            .upload(path, f);
          if (uploadError) throw uploadError;
          const { data: pub } = supabase.storage
            .from("perfumes-fotos")
            .getPublicUrl(path);
          urlsNuevas.push(pub.publicUrl);
        }
        // Las fotos nuevas se agregan a las que ya tenía (si era edición)
        fotos = [...fotos, ...urlsNuevas];
      }

      const payload = {
        nombre: form.nombre,
        marca: form.marca,
        precio: Number(form.precio),
        categoria: form.categoria,
        tamano: form.tamano,
        en_stock: form.en_stock,
        en_promo: form.en_promo,
        fotos,
        foto_url: fotos[0] || null,
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

  return (
    <div className="admin-shell">
      <Head>
        <title>Admin — Catálogo de Perfumes</title>
      </Head>

      <div className="admin-header">
        <div className="container">
          <span className="admin-title serif">Panel de Perfumería</span>
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
        <div className="container admin-grid">
          <div className="panel">
            <div className="panel-title">
              {form.id ? "Editar perfume" : "Agregar perfume"}
            </div>
            {error && <div className="error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Nombre</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Marca</label>
                <input
                  value={form.marca}
                  onChange={(e) => setForm({ ...form, marca: e.target.value })}
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Precio</label>
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
                  <label>Tamaño (ml)</label>
                  <input
                    type="text"
                    list="tamanos-sugeridos"
                    placeholder="ej. 30ml, 45ml, 80ml"
                    value={form.tamano}
                    onChange={(e) =>
                      setForm({ ...form, tamano: e.target.value })
                    }
                    required
                  />
                  <datalist id="tamanos-sugeridos">
                    {TAMANOS.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="field">
                <label>Categoría</label>
                <select
                  value={form.categoria}
                  onChange={(e) =>
                    setForm({ ...form, categoria: e.target.value })
                  }
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Fotos (podés elegir 2 o más juntas)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files))}
                />
                <div className="hint">
                  {form.id
                    ? "Las fotos nuevas se agregan a las que ya tenía."
                    : "Seleccioná varias fotos con Ctrl (o Cmd en Mac) para subir más de una."}
                </div>
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
              </div>
              <div className="field">
                <label className="stock-toggle">
                  <input
                    type="checkbox"
                    checked={form.en_stock}
                    onChange={(e) =>
                      setForm({ ...form, en_stock: e.target.checked })
                    }
                  />
                  Disponible para retirar
                </label>
              </div>

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
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Tamaño</th>
                  <th>Precio</th>
                  <th>Promo</th>
                  <th>Stock</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {perfumes.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.fotos && p.fotos[0] && (
                        <img src={p.fotos[0]} className="thumb" alt="" />
                      )}
                    </td>
                    <td>
                      <strong>{p.nombre}</strong>
                      <div style={{ fontSize: 11, color: "#6b5f57" }}>
                        {p.marca}
                      </div>
                    </td>
                    <td>
                      {CATEGORIAS.find((c) => c.value === p.categoria)?.label ||
                        p.categoria}
                    </td>
                    <td>{p.tamano}</td>
                    <td>${Number(p.precio).toLocaleString("es-AR")}</td>
                    <td>{p.en_promo ? "🏷️" : "—"}</td>
                    <td>{p.en_stock ? "✅" : "—"}</td>
                    <td>
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
                ))}
                {perfumes.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      style={{ textAlign: "center", padding: 30 }}
                    >
                      Todavía no cargaste ningún perfume.
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
