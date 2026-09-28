import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { httpClient } from '../../shared/api/httpClient';
import { useBackTarget } from '../../shared/layout/TopBarContext';

interface Profile {
  id: string;
  name: string;
  isSystemRole: boolean;
}

interface Permission {
  id: string;
  code: string;
  resource: string;
  action: string;
}

export function ProfilesPage() {
  const { moduleContexts, loadModuleContext } = useAuth();
  useBackTarget('/profiles');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [profilePerms, setProfilePerms] = useState<string[]>([]);
  const [error, setError] = useState('');

  const ctx = moduleContexts['profiles'];
  const canUpdate = ctx?.permissions.includes('profiles.update');
  const canCreate = ctx?.permissions.includes('profiles.create');
  const canDelete = ctx?.permissions.includes('profiles.delete');

  useEffect(() => {
    loadModuleContext('profiles').catch(() => undefined);
    loadProfiles();
    loadPermissions();
  }, []);

  const loadProfiles = () => {
    httpClient.get('/profiles').then((res) => setProfiles(res.data || [])).catch(() => setProfiles([]));
  };

  const loadPermissions = () => {
    httpClient.get('/profiles/permissions').then((res) => setPermissions(res.data || [])).catch(() => setPermissions([]));
  };

  const createProfile = async () => {
    if (!newName.trim()) return;
    setError('');
    try {
      await httpClient.post('/profiles', { name: newName.trim() });
      setNewName('');
      loadProfiles();
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo crear');
    }
  };

  const updateProfile = async (id: string) => {
    if (!editName.trim()) return;
    setError('');
    try {
      await httpClient.patch(`/profiles/${id}`, { name: editName.trim() });
      setEditing(null);
      loadProfiles();
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo actualizar');
    }
  };

  const deleteProfile = async (id: string) => {
    if (!window.confirm('¿Eliminar este perfil?')) return;
    setError('');
    try {
      await httpClient.delete(`/profiles/${id}`);
      loadProfiles();
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo eliminar');
    }
  };

  const openPermissions = async (p: Profile) => {
    setSelectedProfile(p);
    const res = await httpClient.get(`/profiles/${p.id}/permissions`);
    setProfilePerms((res.data || []).map((perm: Permission) => perm.id));
  };

  const togglePerm = async (permId: string) => {
    if (!selectedProfile) return;
    const has = profilePerms.includes(permId);
    try {
      if (has) {
        await httpClient.delete(`/profiles/${selectedProfile.id}/permissions/${permId}`);
        setProfilePerms((prev) => prev.filter((id) => id !== permId));
      } else {
        await httpClient.post(`/profiles/${selectedProfile.id}/permissions`, { permissionId: permId });
        setProfilePerms((prev) => [...prev, permId]);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'Error al cambiar permiso');
    }
  };

  if (!ctx) return <p style={{ padding: 40 }}>Cargando...</p>;

  return (
    <div className="s2">
      <div className="s2-head">
        <h1 className="page-title">Perfiles y permisos</h1>
      </div>

      <div className="s2-body">
        {canCreate && (
          <div className="info-card" style={{ padding: 20, marginBottom: 16 }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>Nuevo perfil</h3>
            <div className="row2">
              <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                <input className="inp" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre del perfil" />
              </div>
              <button className="btn btn-primary" onClick={createProfile} style={{ width: 'auto', padding: '0 20px' }}>
                Crear
              </button>
            </div>
            {error && <p style={{ color: 'red', fontSize: 12, marginTop: 8 }}>{error}</p>}
          </div>
        )}

        {profiles.length === 0 && <p className="empty-state">No hay perfiles</p>}
        {profiles.map((p) => (
          <div key={p.id} className="info-card" style={{ padding: 16, marginBottom: 12 }}>
            <div className="info-row" style={{ borderBottom: 0, padding: '8px 0' }}>
              <div style={{ flex: 1 }}>
                {editing === p.id ? (
                  <div className="row2">
                    <input className="inp" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ flex: 1 }} />
                    <button className="btn btn-primary" onClick={() => updateProfile(p.id)} style={{ width: 'auto', padding: '0 14px' }}>Guardar</button>
                    <button className="btn btn-ghost" onClick={() => setEditing(null)} style={{ width: 'auto', padding: '0 14px' }}>Cancelar</button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                    {p.isSystemRole && <span style={{ fontSize: 10, background: 'var(--accent-soft)', color: 'var(--accent-deep)', padding: '2px 8px', borderRadius: 99 }}>Sistema</span>}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {canUpdate && !p.isSystemRole && (
                  <button
                    onClick={() => { setEditing(p.id); setEditName(p.name); }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Editar
                  </button>
                )}
                {canUpdate && (
                  <button
                    onClick={() => openPermissions(p)}
                    style={{ background: 'none', border: 'none', color: 'var(--green-deep)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Permisos
                  </button>
                )}
                {canDelete && !p.isSystemRole && (
                  <button
                    onClick={() => deleteProfile(p.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedProfile && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => setSelectedProfile(null)}>
          <div style={{
            background: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto',
          }} onClick={(e) => e.stopPropagation()}>
            <h3 className="section-title" style={{ marginTop: 0 }}>Permisos: {selectedProfile.name}</h3>
            {permissions.length === 0 && <p className="empty-state">No hay permisos</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {permissions.map((perm) => {
                const active = profilePerms.includes(perm.id);
                return (
                  <button
                    key={perm.id}
                    onClick={() => togglePerm(perm.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 12, border: '1.6px solid var(--line)',
                      background: active ? 'var(--green-soft)' : '#fff',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--green-deep)' : 'var(--ink)' }}>
                      {perm.code}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                      background: active ? 'var(--green)' : 'var(--line)', color: active ? '#fff' : 'var(--faint)',
                    }}>
                      {active ? 'On' : 'Off'}
                    </span>
                  </button>
                );
              })}
            </div>
            <button className="btn btn-primary" onClick={() => setSelectedProfile(null)} style={{ marginTop: 16 }}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}