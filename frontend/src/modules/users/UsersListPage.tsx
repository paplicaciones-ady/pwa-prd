import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Can } from '../../shared/components/Can';
import { httpClient } from '../../shared/api/httpClient';

interface User {
  id: string;
  fullName: string;
  email: string;
  status: string;
  profileId?: string;
}

interface Profile {
  id: string;
  name: string;
}

const SUPER_ADMIN_PROFILE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

export function UsersListPage() {
  const { moduleContexts, loadModuleContext, isSuperAccount } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [ctx, setCtx] = useState(moduleContexts['users']);
  const [showForm, setShowForm] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', fullName: '', password: '', profileId: '', companyId: '' });
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ fullName: '', email: '', profileId: '' });
  const [error, setError] = useState('');

  const loadUsers = () => httpClient.get('/users').then((res) => setUsers(res.data));
  const loadProfiles = () =>
    httpClient
      .get('/users/profiles')
      .then((res) => setProfiles((res.data || []).map((p: any) => ({ id: p.id, name: p.name }))))
      .catch(() => setProfiles([]));
  const loadCompanies = () =>
    httpClient
      .get('/config/companies')
      .then((res) => setCompanies((res.data || []).map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => setCompanies([]));

  useEffect(() => {
    loadModuleContext('users')
      .catch(() => undefined)
      .then(() => {
        setCtx(moduleContexts['users']);
        loadUsers();
        loadProfiles();
      });
  }, []);

  useEffect(() => {
    if (isSuperAccount) loadCompanies();
  }, [isSuperAccount]);

  const toggleStatus = (u: User) =>
    httpClient.patch(`/users/${u.id}/status`).then(loadUsers);

  const removeUser = (u: User) => {
    if (window.confirm(`¿Eliminar a ${u.fullName}?`)) {
      httpClient.delete(`/users/${u.id}`).then(loadUsers);
    }
  };

  const createUser = async () => {
    setError('');
    try {
      // El perfil super_admin es de sistema: no se le asigna ninguna empresa.
      const isSystemProfile = newUser.profileId === SUPER_ADMIN_PROFILE_ID;
      if (isSuperAccount && !isSystemProfile && !newUser.companyId) {
        setError('Debés indicar la empresa principal del usuario.');
        return;
      }
      const payload = isSuperAccount
        ? { ...newUser, companyId: isSystemProfile ? undefined : newUser.companyId }
        : newUser;
      await httpClient.post('/users', payload);
      setNewUser({ email: '', fullName: '', password: '', profileId: '', companyId: '' });
      setShowForm(false);
      loadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo crear');
    }
  };

  const startEdit = (u: User) => {
    setEditUserId(u.id);
    setEditData({ fullName: u.fullName, email: u.email, profileId: u.profileId || '' });
  };

  const saveEdit = async () => {
    if (!editUserId) return;
    setError('');
    try {
      await httpClient.patch(`/users/${editUserId}`, editData);
      setEditUserId(null);
      loadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo actualizar');
    }
  };

  const profileOptions = (currentProfileId?: string) => {
    const opts = profiles.filter((p) => isSuperAccount || p.id !== SUPER_ADMIN_PROFILE_ID);
    if (currentProfileId && !opts.find((p) => p.id === currentProfileId)) {
      opts.unshift({ id: currentProfileId, name: 'Perfil actual' });
    }
    return opts;
  };

  const visibleProfiles = () => profiles.filter((p) => isSuperAccount || p.id !== SUPER_ADMIN_PROFILE_ID);

  const selectedIsSystemProfile = newUser.profileId === SUPER_ADMIN_PROFILE_ID;

  if (!ctx) return <p style={{ padding: 40 }}>Cargando...</p>;

  return (
    <div className="s2">
      <div className="s2-head">
        <h1 className="page-title">Gestión de usuarios</h1>
      </div>

      <div className="s2-body">
        <Can permission="users.create" permissions={ctx.permissions}>
          <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ marginBottom: 16 }}>
            Crear usuario
          </button>
        </Can>

        {showForm && (
          <div className="info-card" style={{ padding: 20, marginBottom: 16 }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>Nuevo usuario</h3>
            <div className="field">
              <label>Nombre completo</label>
              <input className="inp" value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} placeholder="Juan Pérez" />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="inp" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="juan@empresa.com" />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input className="inp" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Mínimo 8 caracteres" />
            </div>
            <div className="field">
              <label>Perfil</label>
              <div className="sel">
                <select value={newUser.profileId} onChange={(e) => setNewUser({ ...newUser, profileId: e.target.value })}>
                  <option value="">Seleccionar perfil</option>
                  {visibleProfiles().map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
            {isSuperAccount && selectedIsSystemProfile && (
              <p style={{ fontSize: 11, background: 'var(--accent-soft)', padding: '6px 10px', borderRadius: 8, marginBottom: 4 }}>
                El perfil super_admin es un rol de sistema: no se le asigna ninguna empresa.
              </p>
            )}
            {isSuperAccount && !selectedIsSystemProfile && (
              <div className="field">
                <label>Empresa principal</label>
                <div className="sel">
                  <select value={newUser.companyId} onChange={(e) => setNewUser({ ...newUser, companyId: e.target.value })}>
                    <option value="">Seleccionar empresa</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </div>
            )}
            {error && <p style={{ color: 'red', fontSize: 12 }}>{error}</p>}
            <div className="row2">
              <button className="btn btn-primary" onClick={createUser}>Crear</button>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {users.length === 0 && <p className="empty-state">No hay usuarios</p>}
        {users.map((u) => (
          <div key={u.id} className="info-card" style={{ padding: '6px 0' }}>
            <div className="info-row" style={{ padding: '10px 16px' }}>
              {editUserId === u.id ? (
                <div style={{ flex: 1 }}>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <input className="inp" value={editData.fullName} onChange={(e) => setEditData({ ...editData, fullName: e.target.value })} placeholder="Nombre" />
                  </div>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <input className="inp" type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} placeholder="Email" />
                  </div>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label>Perfil</label>
                    <div className="sel">
                      <select value={editData.profileId} onChange={(e) => setEditData({ ...editData, profileId: e.target.value })}>
                        <option value="">Seleccionar perfil</option>
                        {profileOptions(editData.profileId).map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  </div>
                  {error && <p style={{ color: 'red', fontSize: 12, marginBottom: 8 }}>{error}</p>}
                  <div className="row2">
                    <button className="btn btn-primary" onClick={saveEdit} style={{ width: 'auto', padding: '0 16px' }}>Guardar</button>
                    <button className="btn btn-ghost" onClick={() => setEditUserId(null)} style={{ width: 'auto', padding: '0 16px' }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{u.fullName}</div>
                    <div style={{ fontSize: 11, color: 'var(--faint)' }}>{u.email} · {profiles.find((p) => p.id === u.profileId)?.name || u.profileId || 'Sin perfil'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, background: u.status === 'active' ? 'var(--green-soft)' : '#fdecea', color: u.status === 'active' ? 'var(--green-deep)' : '#b00020', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
                      {u.status}
                    </span>
                    <Can permission="users.update" permissions={ctx.permissions}>
                      <button onClick={() => startEdit(u)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Editar</button>
                      <button onClick={() => toggleStatus(u)} style={{ background: 'none', border: 'none', color: 'var(--ink)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        {u.status === 'active' ? 'Desactivar' : 'Activar'}
                      </button>
                    </Can>
                    <Can permission="users.delete" permissions={ctx.permissions}>
                      <button onClick={() => removeUser(u)} style={{ background: 'none', border: 'none', color: '#b00020', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Eliminar</button>
                    </Can>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}