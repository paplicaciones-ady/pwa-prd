import { useEffect, useState } from 'react';
import { httpClient } from '../../shared/api/httpClient';
import { useAuth } from '../auth/AuthContext';
import { useBackTarget } from '../../shared/layout/TopBarContext';

interface CatalogItem {
  sku: string;
  nombre: string;
  precio: number;
}

export function CatalogPage() {
  useBackTarget('/home');
  const { moduleContexts, loadModuleContext } = useAuth();
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canVer = moduleContexts['catalog']?.permissions.includes('catalog.ver') ?? false;
  const canCargar = moduleContexts['catalog']?.permissions.includes('catalog.cargar') ?? false;

  useEffect(() => {
    loadModuleContext('catalog').catch(() => undefined);
  }, []);

  const handleListar = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await httpClient.get('/catalog/items');
      setItems(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo consultar el catálogo');
    } finally {
      setBusy(false);
    }
  };

  const handleCargar = async () => {
    setError('');
    setBusy(true);
    try {
      await httpClient.post('/catalog/items', { sku: 'CAT-999', nombre: 'Producto de prueba', precio: 999 });
      await handleListar();
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo cargar el producto');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="s2">
      <div className="s2-head">
        <h1 className="page-title">Catálogo de productos</h1>
        <p className="lead below">Listado de prueba con permisos <code>catalog.ver</code> / <code>catalog.cargar</code>.</p>
      </div>
      <div className="s2-body">
        <div className="info-card" style={{ padding: 20 }}>
          {error && <p style={{ color: '#b00020', fontSize: 12, marginTop: 8 }}>{error}</p>}
          {canVer ? (
            <button type="button" onClick={handleListar} className="btn btn-primary" disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
              Consultar catálogo
            </button>
          ) : (
            <p className="empty-state" style={{ textAlign: 'left', margin: 0 }}>
              No tenés permiso <code>catalog.ver</code> para consultar el catálogo.
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {canCargar && (
              <button type="button" onClick={handleCargar} className="btn btn-ghost" disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
                Cargar producto de prueba
              </button>
            )}
          </div>

          {items && (
            <div style={{ marginTop: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--line)' }}>SKU</th>
                    <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--line)' }}>Nombre</th>
                    <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--line)' }}>Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.sku}>
                      <td style={{ padding: 8, borderBottom: '1px solid var(--line)' }}>{it.sku}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid var(--line)' }}>{it.nombre}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid var(--line)', textAlign: 'right' }}>${it.precio.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}