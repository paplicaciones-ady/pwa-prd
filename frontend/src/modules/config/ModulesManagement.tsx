import { useEffect, useState } from 'react';
import { httpClient } from '../../shared/api/httpClient';
import { useAuth, ModuleView, ModuleVariant, CompanySummary } from '../auth/AuthContext';
import { ModuleForm } from './ModuleForm';
import { ModuleVariantForm } from './ModuleVariantForm';
import { isRegisteredPath } from '../registry';

interface Props {
  mode: 'company' | 'global';
}

export function ModulesManagement({ mode }: Props) {
  const { refreshBootstrap } = useAuth();
  const [modules, setModules] = useState<ModuleView[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [publishSelection, setPublishSelection] = useState<string[]>([]);
  const [variantsPanel, setVariantsPanel] = useState<string | null>(null);
  const [variantsByModule, setVariantsByModule] = useState<Record<string, ModuleVariant[]>>({});
  const [variantEdit, setVariantEdit] = useState<{ moduleId: string; companyId: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await httpClient.get('/config/modules');
      setModules(res.data || []);
    } catch {
      setModules([]);
    }
  };

  const loadCompanies = async () => {
    try {
      const res = await httpClient.get('/auth/companies');
      setCompanies(res.data || []);
    } catch {
      setCompanies([]);
    }
  };

  useEffect(() => {
    load();
    loadCompanies();
  }, []);

  const operaciones = (m: ModuleView) =>
    (m.operations || []).map((o) => (
      <span key={o.action} style={{ fontSize: 11, background: 'var(--accent-soft)', color: 'var(--accent-deep)', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
        {o.action}
      </span>
    ));

  const iconPreview = (m: ModuleView) => {
    if (!m.icon) return null;
    if (m.icon.startsWith('http')) return <img src={m.icon} alt="" height={28} width={28} style={{ objectFit: 'contain', borderRadius: 6 }} />;
    return <span style={{ fontSize: 20 }}>{m.label.charAt(0).toUpperCase()}</span>;
  };

  const toggleEnabled = async (m: ModuleView) => {
    try {
      await httpClient.patch(`/config/modules/${m.id}`, { enabled: !m.enabled });
      await load();
      await refreshBootstrap();
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo cambiar el estado');
    }
  };

  const remove = async (m: ModuleView) => {
    if (!window.confirm(`¿Eliminar el módulo "${m.label}"? Se quitará de todas las empresas donde esté publicado.`)) return;
    try {
      await httpClient.delete(`/config/modules/${m.id}`);
      await load();
      await refreshBootstrap();
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo eliminar');
    }
  };

  const openPublish = (m: ModuleView) => {
    const current = m.published.map((p) => p.companyId);
    setPublishId(publishId === m.id ? null : m.id);
    setPublishSelection(current);
  };

  const variantsOf = (m: ModuleView) => variantsByModule[m.id] || [];

  const openVariants = async (m: ModuleView) => {
    if (variantsPanel === m.id) {
      setVariantsPanel(null);
      setVariantEdit(null);
      return;
    }
    setVariantsPanel(m.id);
    setVariantEdit(null);
    try {
      const res = await httpClient.get(`/config/modules/${m.id}/variants`);
      setVariantsByModule((prev) => ({ ...prev, [m.id]: res.data || [] }));
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudieron cargar las variantes');
    }
  };

  const reloadVariants = async (m: ModuleView) => {
    try {
      const res = await httpClient.get(`/config/modules/${m.id}/variants`);
      setVariantsByModule((prev) => ({ ...prev, [m.id]: res.data || [] }));
    } catch {
      // se mantiene lo que había
    }
  };

  /** Empresas donde el módulo está disponible (dueña + publicaciones). */
  const candidateCompanies = (m: ModuleView) => {
    const list: { id: string; name: string }[] = [];
    if (m.ownerAssignment && m.companyId) {
      list.push({ id: m.companyId, name: m.companyName || 'Empresa dueña' });
    }
    for (const p of m.published) {
      list.push({ id: p.companyId, name: p.companyName || p.companyId });
    }
    return list;
  };

  const savePublish = async (m: ModuleView) => {
    setBusy(true);
    setError('');
    try {
      await httpClient.post(`/config/modules/${m.id}/publications`, { companyIds: publishSelection });
      setPublishId(null);
      await load();
      await refreshBootstrap();
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo publicar');
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async (m: ModuleView, companyId: string) => {
    try {
      await httpClient.delete(`/config/modules/${m.id}/publications/${companyId}`);
      await load();
      await refreshBootstrap();
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo quitar la publicación');
    }
  };

  const pending = (m: ModuleView) => {
    const current = new Set(m.published.map((p) => p.companyId));
    return companies.filter((c) => !current.has(c.id));
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 className="section-title" style={{ margin: 0 }}>
          {mode === 'global' ? 'Módulos de la plataforma' : 'Módulos de mi empresa'}
        </h3>
        <button style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, background: '#fff', color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cerrar' : '+ Nuevo módulo'}
        </button>
      </div>

      {error && <p style={{ color: 'red', fontSize: 12, marginBottom: 8 }}>{error}</p>}

      {showCreate && (
        <ModuleForm
          mode="create"
          superMode={mode === 'global'}
          companies={companies}
          onSaved={async () => {
            setShowCreate(false);
            await load();
            await refreshBootstrap();
          }}
        />
      )}

      {modules.length === 0 && <p className="empty-state">No hay módulos configurados</p>}

      {modules.map((m) => (
        <div key={m.id} className="info-card" style={{ padding: '10px 16px', marginBottom: 10 }}>
          {editingId === m.id ? (
            <ModuleForm
              mode="edit"
              editing={m}
              superMode={mode === 'global'}
              companies={companies}
              onSaved={async () => {
                setEditingId(null);
                await load();
                await refreshBootstrap();
              }}
            />
          ) : (
            <>
              <div className="info-row" style={{ borderBottom: 0, padding: '8px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {iconPreview(m)}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      {m.label}
                      {m.scope === 'global' && (
                        <span style={{ marginLeft: 8, fontSize: 10, background: 'var(--accent-soft)', color: 'var(--accent-deep)', borderRadius: 99, padding: '2px 8px' }}>global</span>
                      )}
                      {!isRegisteredPath(m.path) && (
                        <span title="El path no corresponde a ninguna pantalla de modules/registry" style={{ marginLeft: 8, fontSize: 10, background: '#fde8ea', color: '#b00020', borderRadius: 99, padding: '2px 8px' }}>ruta inexistente</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--faint)' }}>
                      {m.module} · {m.path}
                      {m.ownerAssignment && ` · ${m.ownerAssignment.placement === 'fab' ? 'FAB' : 'Home'} #${m.ownerAssignment.position}`}
                      {m.companyName && ` · ${m.companyName}`}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>{operaciones(m)}</div>
                    {m.published.length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>
                        Publicado en: {m.published.map((p) => p.companyName || p.companyId).join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {!m.isShared && (
                    <button onClick={() => toggleEnabled(m)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: m.enabled ? 'var(--green)' : 'var(--line)', color: m.enabled ? '#fff' : 'var(--ink)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {m.enabled ? 'On' : 'Off'}
                    </button>
                  )}
                  {!m.isShared && (
                    <button onClick={() => openPublish(m)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Publicar
                    </button>
                  )}
                  {!m.isShared && (
                    <button onClick={() => setEditingId(m.id)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Editar
                    </button>
                  )}
                  {!m.isShared && (
                    <button onClick={() => remove(m)} style={{ background: 'none', border: 'none', color: '#b00020', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Eliminar
                    </button>
                  )}
                  <button onClick={() => openVariants(m)} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 12px', color: variantsOf(m).length ? 'var(--accent-deep)' : 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    Variantes {variantsOf(m).length > 0 ? `(${variantsOf(m).length})` : ''}
                  </button>
                </div>
              </div>

              {publishId === m.id && (
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Publicar en otras empresas (se muestran en el FAB):</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pending(m).map((c) => (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={publishSelection.includes(c.id)}
                          onChange={(e) =>
                            setPublishSelection((prev) =>
                              e.target.checked
                                ? [...prev, c.id]
                                : prev.filter((x) => x !== c.id),
                            )
                          }
                        />
                        {c.name}
                      </label>
                    ))}
                    {pending(m).length === 0 && <p style={{ fontSize: 12, color: 'var(--faint)' }}>Ya está publicado en todas las empresas activas.</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button className="btn btn-primary" onClick={() => savePublish(m)} disabled={busy} style={{ width: 'auto', padding: '0 16px', opacity: busy ? 0.6 : 1 }}>
                      Guardar publicaciones
                    </button>
                    {m.published.map((p) => (
                      <button key={p.companyId} onClick={() => unpublish(m, p.companyId)} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: '#b00020', cursor: 'pointer' }}>
                        Quitar de {p.companyName || p.companyId}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            {variantsPanel === m.id && (
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Variantes por empresa (adaptan este módulo según la empresa):
                  </div>
                  {candidateCompanies(m).length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--faint)' }}>El módulo no está asignado a ninguna empresa todavía.</p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {candidateCompanies(m).map((c) => {
                      const v = variantsOf(m).find((x) => x.companyId === c.id);
                      const isEditing = variantEdit?.moduleId === m.id && variantEdit.companyId === c.id;
                      return (
                        <div key={c.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 12, flex: 1 }}>{c.name}</strong>
                            {v ? (
                              <span style={{ fontSize: 10, background: 'var(--green-soft)', color: 'var(--green-deep)', borderRadius: 99, padding: '2px 8px', fontWeight: 700 }}>
                                variante activa{`${v.label ? ` · ${v.label}` : ''}`}
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, background: 'var(--line)', color: 'var(--faint)', borderRadius: 99, padding: '2px 8px', fontWeight: 700 }}>
                                comportamiento por defecto
                              </span>
                            )}
                            <button onClick={() => setVariantEdit(isEditing ? null : { moduleId: m.id, companyId: c.id })} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}>
                              {isEditing ? 'Cerrar' : v ? 'Editar' : 'Configurar'}
                            </button>
                          </div>
                          {isEditing && (
                            <ModuleVariantForm
                              module={m}
                              company={c}
                              existing={v ?? null}
                              onSaved={async () => {
                                setVariantEdit(null);
                                await reloadVariants(m);
                                await refreshBootstrap();
                              }}
                              onCancel={() => setVariantEdit(null)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}