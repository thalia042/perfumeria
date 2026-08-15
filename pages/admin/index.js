import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../lib/supabaseClient';

const CATEGORIAS = [
  { value: 'mujer', label: 'Mujer' },
  { value: 'hombre', label: 'Hombre' },
  { value: 'infantil', label: 'Infantil' },
];

const TAMANOS = ['15ml', '30ml', '50ml', '75ml', '100ml', '150ml'];

const FORM_VACIO = {
  id: null,
  nombre: '',
  marca: '',
  precio: '',
  precio_anterior: '',
  categoria: 'mujer',
  tamano: '30ml',
  en_stock: true,
  en_promo: false,
  fotos: [],
  vencimiento: '',
  codigo: '',
  cantidad_stock: '',
};

function estadoVencimiento(fecha) {
  if (!fecha) return null;
  const hoy = new Date();
  const venc = new Date(fecha + 'T00:00:00');
  const dias = Math.round((venc - hoy) / (1000 * 60 * 60 * 24));
  if (dias < 0) return { texto: 'Vencido', clase: 'venc-vencido' };
  if (dias <= 60) return { texto: `Vence en ${dias}d`, clase: 'venc-pronto' };
  return { texto: venc.toLocaleDateString('es-AR'), clase: 'venc-ok' };
}

function normalizarTexto(str) {
  return (str || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Busca códigos con el patrón LETRAS+NÚMEROS (ej. C004) y calcula
// el último usado y el siguiente sugerido, respetando los ceros a la
// izquierda (C004 -> C005, no C5).
function calcularSiguienteCodigo(perfumes) {
  const regex = /^([A-Za-z]*)(\d+)$/;
  let mejor = null;

  perfumes.forEach((p) => {
    const m = (p.codigo || '').trim().match(regex);
    if (!m) return;
    const numero = parseInt(m[2], 10);
    if (!mejor || numero > mejor.numero) {
      mejor = { prefijo: m[1], numero, digitos: m[2].length, texto: p.codigo };
    }
  });

  if (!mejor) return null;

  const siguienteNum = String(mejor.numero + 1).padStart(mejor.digitos, '0');
  return {
    ultimo: mejor.texto,
    sugerido: `${mejor.prefijo}${siguienteNum}`,
  };
}

export default function Admin() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [perfumes, setPerfumes] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [ordenarPorVencimiento, setOrdenarPorVencimiento] = useState(false);
  const [ordenarPorCodigo, setOrdenarPorCodigo] = useState(false);

  const siguienteCodigo = useMemo(
    () => calcularSiguienteCodigo(perfumes),
    [perfumes]
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/admin/login');
      } else {
        setChecking(false);
        cargarPerfumes();
      }
    });
  }, [router]);

  const cargarPerfumes = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('perfumes')
      .select('*')
      .order('created_at', { ascending: false });
    if (!fetchError) setPerfumes(data);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/admin/login');
  }

  function editar(p) {
    setForm({
      ...p,
      cantidad_stock: p.cantidad_stock ?? '',
      precio_anterior: p.precio_anterior ?? '',
    });
    setFiles([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function nuevo() {
    setForm(FORM_VACIO);
    setFiles([]);
  }

  async function eliminar(id) {
    if (!confirm('¿Borrar este perfume del catálogo?')) return;
    await supabase.from('perfumes').delete().eq('id', id);
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
    setError('');

    try {
      let fotos = form.fotos || [];

      if (files.length > 0) {
        const urlsNuevas = [];
        for (const f of files) {
          const ext = f.name.split('.').pop();
          const path = `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('perfumes-fotos')
            .upload(path, f);
          if (uploadError) throw uploadError;
          const { data: pub } = supabase.storage
            .from('perfumes-fotos')
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
        precio_anterior:
          form.en_promo && form.precio_anterior
            ? Number(form.precio_anterior)
            : null,
        categoria: form.categoria,
        tamano: form.tamano,
        en_stock: form.en_stock,
        en_promo: form.en_promo,
        fotos,
        foto_url: fotos[0] || null,
        vencimiento: form.vencimiento || null,
        codigo: form.codigo || null,
        cantidad_stock:
          form.cantidad_stock === '' ? null : Number(form.cantidad_stock),
      };

      if (form.id) {
        const { error: updateError } = await supabase
          .from('perfumes')
          .update(payload)
          .eq('id', form.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('perfumes')
          .insert(payload);
        if (insertError) throw insertError;
      }

      nuevo();
      cargarPerfumes();
    } catch (err) {
      setError(err.message || 'Algo salió mal, probá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  if (checking) return null;

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
      if (ordenarPorCodigo) {
        if (!a.codigo) return 1;
        if (!b.codigo) return -1;
        return a.codigo.localeCompare(b.codigo, 'es', { numeric: true });
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
        <title>Admin — Catálogo de Perfumes</title>
      </Head>

      <div className="admin-header">
        <div className="container">
          <span className="admin-title serif">Panel de Perfumería</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <a className="btn btn-ghost btn-sm" href="/" target="_blank" rel="noreferrer">
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
              {form.id ? 'Editar perfume' : 'Agregar perfume'}
            </div>
            {error && <div className="error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Código (para el muestrario)</label>
                <input
                  value={form.codigo || ''}
                  onChange={(e) =>
                    setForm({ ...form, codigo: e.target.value })
                  }
                  placeholder="ej. P001"
                />
                {siguienteCodigo && (
                  <div className="codigo-hint">
                    Último usado: <strong>{siguienteCodigo.ultimo}</strong>
                    {' · '}
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
              <div className="field">
                <label>Nombre</label>
                <input
                  value={form.nombre}
                  onChange={(e) =>
                    setForm({ ...form, nombre: e.target.value })
                  }
                  required
                />
              </div>
              <div className="field">
                <label>Marca</label>
                <input
                  value={form.marca}
                  onChange={(e) =>
                    setForm({ ...form, marca: e.target.value })
                  }
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
                <div className="field">
                  <label>Vencimiento (opcional)</label>
                  <input
                    type="date"
                    value={form.vencimiento || ''}
                    onChange={(e) =>
                      setForm({ ...form, vencimiento: e.target.value })
                    }
                  />
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
                    ? 'Las fotos nuevas se agregan a las que ya tenía.'
                    : 'Seleccioná varias fotos con Ctrl (o Cmd en Mac) para subir más de una.'}
                </div>
                {form.fotos && form.fotos.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {form.fotos.map((url) => (
                      <div key={url} style={{ position: 'relative' }}>
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
                    <label>Precio anterior (se muestra tachado)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.precio_anterior}
                      onChange={(e) =>
                        setForm({ ...form, precio_anterior: e.target.value })
                      }
                      placeholder="ej. 39990"
                    />
                    {form.precio && form.precio_anterior > 0 && (
                      <div className="hint">
                        Descuento:{' '}
                        {Math.round(
                          100 -
                            (Number(form.precio) /
                              Number(form.precio_anterior)) *
                              100
                        )}
                        %
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="field">
                <label>Cantidad en stock (opcional, solo para vos)</label>
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

              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <button className="btn btn-primary" disabled={saving}>
                  {saving
                    ? 'Guardando…'
                    : form.id
                    ? 'Guardar cambios'
                    : 'Agregar al catálogo'}
                </button>
                {form.id && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ borderColor: '#ddd', color: '#6b5f57' }}
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
                placeholder="Buscar por nombre o marca…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="search-input"
              />
              <button
                className={`pill ${ordenarPorVencimiento ? 'active' : ''}`}
                onClick={() => {
                  setOrdenarPorVencimiento((v) => !v);
                  setOrdenarPorCodigo(false);
                }}
              >
                Ordenar por vencimiento
              </button>
              <button
                className={`pill ${ordenarPorCodigo ? 'active' : ''}`}
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
                  <th>Categoría</th>
                  <th>Tamaño</th>
                  <th>Precio</th>
                  <th>Vencimiento</th>
                  <th>Promo</th>
                  <th>Stock</th>
                  <th className="col-actions-header">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {perfumesVisibles.map((p) => {
                  const venc = estadoVencimiento(p.vencimiento);
                  return (
                    <tr key={p.id}>
                      <td>
                        {p.fotos && p.fotos[0] && (
                          <img src={p.fotos[0]} className="thumb" alt="" />
                        )}
                      </td>
                      <td>
                        {p.codigo ? (
                          <span className="codigo-bubble">{p.codigo}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <strong>{p.nombre}</strong>
                        <div style={{ fontSize: 11, color: '#6b5f57' }}>
                          {p.marca}
                        </div>
                      </td>
                      <td>
                        {CATEGORIAS.find((c) => c.value === p.categoria)
                          ?.label || p.categoria}
                      </td>
                      <td>{p.tamano}</td>
                      <td>${Number(p.precio).toLocaleString('es-AR')}</td>
                      <td>
                        {venc ? (
                          <span className={`venc-badge ${venc.clase}`}>
                            {venc.texto}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{p.en_promo ? '🏷️' : '—'}</td>
                      <td>
                        {p.en_stock ? '✅' : '—'}
                        {p.cantidad_stock != null && (
                          <span className="stock-qty">
                            {' '}
                            ({p.cantidad_stock})
                          </span>
                        )}
                      </td>
                      <td className="col-actions">
                        <div className="row-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ borderColor: '#ddd', color: '#2b2320' }}
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
                    <td colSpan={10} style={{ textAlign: 'center', padding: 30 }}>
                      {busqueda
                        ? 'Ningún perfume coincide con la búsqueda.'
                        : 'Todavía no cargaste ningún perfume.'}
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
