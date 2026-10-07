import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { httpClient } from '../../shared/api/httpClient';
import { AddressBuilderModal } from '../../shared/components/AddressBuilderModal';
import { useBackTarget } from '../../shared/layout/TopBarContext';
import { calcNitDv, isValidFullNit, sanitizeDocumentNumber } from '../../shared/utils/validators';

const ACTIVIDADES: Array<[string, string]> = [
  ['0111', 'Cultivo de cereales'], ['0113', 'Cultivo de hortalizas'], ['0121', 'Cultivo de frutas tropicales'],
  ['0122', 'Cultivo de café'], ['0123', 'Cultivo de flores'], ['0150', 'Explotación mixta agrícola'],
  ['0161', 'Actividades de apoyo a la agricultura'], ['0171', 'Caza ordinaria'], ['1011', 'Procesamiento de carne y pescado'],
  ['1040', 'Elaboración de aceites y grasas'], ['1051', 'Elaboración de productos lácteos'], ['1071', 'Elaboración de productos de panadería'],
  ['1101', 'Elaboración de bebidas alcohólicas'], ['1104', 'Elaboración de bebidas no alcohólicas'], ['2011', 'Fabricación de sustancias químicas básicas'],
  ['2022', 'Fabricación de pesticidas y agroquímicos'], ['4690', 'Comercio al por mayor no especializado'], ['4711', 'Comercio al por menor en establecimientos no especializados'],
  ['4752', 'Comercio al por menor de artículos de ferretería'], ['4755', 'Comercio al por menor de artículos de uso doméstico'], ['4773', 'Comercio al por menor de productos agrícolas'],
  ['5210', 'Almacenamiento y depósito'], ['5221', 'Actividades de estaciones de transporte'], ['7730', 'Alquiler de maquinaria y equipo agropecuario'],
];

const DEPARTAMENTOS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare',
  'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira',
  'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda',
  'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada',
];

const CIUDADES = [
  'Bogotá D.C.', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Cúcuta', 'Bucaramanga', 'Ibagué',
  'Pereira', 'Santa Marta', 'Manizales', 'Pasto', 'Neiva', 'Villavicencio', 'Montería', 'Armenia',
  'Popayán', 'Sincelejo', 'Valledupar', 'Riohacha', 'Tunja', 'Florencia', 'Quibdó', 'Mocoa',
  'San José del Guaviare', 'Leticia', 'Yopal', 'Inírida', 'Mitú', 'Puerto Carreño', 'Arauca', 'San Andrés',
];

const INDICATIVOS = ['601', '602', '604', '605', '606', '607', '608', '609'];

interface Address {
  built: string;
  department: string;
  city: string;
  postalCode: string;
  phone: string;
  phonePrefix: string;
  contactFirstName: string;
  contactSecondName: string;
  contactFirstLastName: string;
  contactSecondLastName: string;
  description: string;
}

const EMPTY_ADDRESS: Address = {
  built: '', department: '', city: '', postalCode: '', phone: '',
  phonePrefix: '', contactFirstName: '', contactSecondName: '',
  contactFirstLastName: '', contactSecondLastName: '', description: '',
};

export function CreateClientPage() {
  const navigate = useNavigate();
  useBackTarget('/clients');
  const [searchParams] = useSearchParams();
  const nitParam = searchParams.get('nit');
  const [personType, setPersonType] = useState('');
  const [form, setForm] = useState<Record<string, any>>({ fullName: '', documentNumber: nitParam || '' });
  const [addrModal, setAddrModal] = useState<'principal' | 'despacho' | null>(null);
  const [principal, setPrincipal] = useState<Address>({ ...EMPTY_ADDRESS });
  const [despacho, setDespacho] = useState<Address>({ ...EMPTY_ADDRESS });
  const [references, setReferences] = useState([
    { entity: '', built: '', department: '', city: '', phone: '', phonePrefix: '', creditLimit: '' },
    { entity: '', built: '', department: '', city: '', phone: '', phonePrefix: '', creditLimit: '' },
    { entity: '', built: '', department: '', city: '', phone: '', phonePrefix: '', creditLimit: '' },
  ]);
  const [cancelRef, setCancelRef] = useState<string | null>(null);
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState('');

  const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));
  // Un NIT se digita completo (con DV, sin '-'): su DV es el último dígito. Para
  // otros documentos el número va sin DV y el DV se calcula (módulo 11).
  const isNit = form.documentType === 'nit';
  const doc: string = form.documentNumber || '';
  const nitInvalid = isNit && doc.length > 0 && !isValidFullNit(doc);
  // Solo el NIT lleva DV (su último dígito); la cédula y otros documentos no tienen.
  const dv = isNit && isValidFullNit(doc) ? doc.slice(-1) : '';
  const bool = (key: string) => (v: string) => set(key, v === 'si');

  async function handleSubmit() {
    setError('');
    if (!accept) { setError('Debe aceptar el tratamiento de datos'); return; }
    const fullName =
      form.fullName ||
      (personType === 'juridica'
        ? form.legalName || [form.repFirstName, form.repFirstLastName].filter(Boolean).join(' ')
        : [form.firstName, form.firstLastName].filter(Boolean).join(' ')) ||
      form.commercialName;
    if (!fullName) { setError('El nombre completo es obligatorio'); return; }
    if (!form.documentNumber) { setError('El número de documento es obligatorio'); return; }
    if (nitInvalid) { setError("El NIT va completo, con su DV al final y sin '-'"); return; }
    const payload = {
      ...form,
      phone: form.phone || '',
      fullName,
      documentNumber: form.documentNumber,
      dv: dv || undefined,
      personType: personType || undefined,
      directions: [
        principal.built || principal.department || principal.city ? { kind: 'principal', ...principal, address: principal.built } : null,
        despacho.built || despacho.department || despacho.city ? { kind: 'despacho', ...despacho, address: despacho.built } : null,
      ].filter(Boolean),
      references: references
        .filter((r) => r.entity || r.built)
        .map((r) => ({ ...r, address: r.built })),
    };
    try {
      await httpClient.post('/clients', payload);
      navigate('/clients');
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo crear el cliente');
    }
  }

  return (
    <div className="s2">
      <div className="s2-head">
        <h1 className="page-title">Crear cliente</h1>
      </div>

      <div className="s2-body">
        <div className="note">
          <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M12 8v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="16.5" r="1" fill="currentColor" /></svg>
          <p>La información debe coincidir con el documento de registro y diligenciarse en MAYÚSCULA, excepto los correos.</p>
        </div>

        <button className="btn btn-primary" style={{ marginBottom: 16 }} type="button">Vinculación de cliente</button>

        <div className="field">
          <label>Tipo de persona</label>
          <div className="sel">
            <select value={personType} onChange={(e) => setPersonType(e.target.value)}>
              <option value="">* Seleccione el tipo de persona</option>
              <option value="natural">Natural</option>
              <option value="juridica">Jurídica</option>
            </select>
            <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>

        {personType && (
          <>
            <div className="sec">Datos del documento</div>

            <div className="field">
              <label>Tipo de documento</label>
              <div className="sel">
                <select value={form.documentType || ''} onChange={(e) => set('documentType', e.target.value)}>
                  <option value="">* Seleccione el tipo de documento</option>
                  <option value="nit">NIT</option>
                  <option value="cc">Cédula de Ciudadanía</option>
                  <option value="ce">Cédula de Extranjería</option>
                  <option value="pp">Permiso de Protección</option>
                </select>
                <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>

            <div className="row2">
              <div className="field" style={{ flex: 2 }}>
                <label>{isNit ? "NIT completo, con DV y sin '-'" : "Número de documento (sin '-')"}</label>
                <input
                  className="inp"
                  placeholder={isNit ? '* Ej. 9014902765' : "* Número de documento, sin '-'"}
                  value={form.documentNumber || ''}
                  onChange={(e) => set('documentNumber', sanitizeDocumentNumber(e.target.value))}
                  maxLength={20}
                  style={nitInvalid ? { borderColor: '#e11225' } : undefined}
                />
                {nitInvalid && (
                  <div className="help" style={{ color: '#c62828', fontWeight: 600 }}>
                    {/^\d{9,16}$/.test(doc)
                      ? `El DV no coincide: con ese número debería terminar en ${calcNitDv(doc.slice(0, -1))}.`
                      : 'Escribe el NIT completo: número más DV.'}
                  </div>
                )}
              </div>
              {isNit && (
                <div className="field" style={{ flex: 1 }}>
                  <label>DV</label>
                  {/* El último dígito del NIT digitado. */}
                  <input className="inp" placeholder="DV" value={dv || '—'} readOnly />
                </div>
              )}
            </div>

            {personType === 'natural' && (
              <>
                <div className="sec">Datos personales</div>
                <div className="field">
                  <label>Razón comercial</label>
                  <input className="inp" placeholder="* Razón comercial" value={form.commercialName || ''} onChange={(e) => set('commercialName', e.target.value)} />
                </div>
                <div className="row2">
                  <div className="field"><input className="inp" placeholder="* Primer nombre" value={form.firstName || ''} onChange={(e) => set('firstName', e.target.value)} /></div>
                  <div className="field"><input className="inp" placeholder="Segundo nombre" value={form.secondName || ''} onChange={(e) => set('secondName', e.target.value)} /></div>
                </div>
                <div className="row2">
                  <div className="field"><input className="inp" placeholder="* Primer apellido" value={form.firstLastName || ''} onChange={(e) => set('firstLastName', e.target.value)} /></div>
                  <div className="field"><input className="inp" placeholder="Segundo apellido" value={form.secondLastName || ''} onChange={(e) => set('secondLastName', e.target.value)} /></div>
                </div>
              </>
            )}

            {personType === 'juridica' && (
              <>
                <div className="sec">Datos de la empresa</div>
                <div className="field"><input className="inp" placeholder="* Razón social" value={form.legalName || ''} onChange={(e) => set('legalName', e.target.value)} /></div>
                <div className="sec">Representación legal</div>
                <div className="row2">
                  <div className="field"><input className="inp" placeholder="* Primer nombre" value={form.repFirstName || ''} onChange={(e) => set('repFirstName', e.target.value)} /></div>
                  <div className="field"><input className="inp" placeholder="Segundo nombre" value={form.repSecondName || ''} onChange={(e) => set('repSecondName', e.target.value)} /></div>
                </div>
                <div className="row2">
                  <div className="field"><input className="inp" placeholder="* Primer apellido" value={form.repFirstLastName || ''} onChange={(e) => set('repFirstLastName', e.target.value)} /></div>
                  <div className="field"><input className="inp" placeholder="Segundo apellido" value={form.repSecondLastName || ''} onChange={(e) => set('repSecondLastName', e.target.value)} /></div>
                </div>
              </>
            )}

            <div className="sec">Contacto</div>
            <div className="row2">
              <div className="field"><input className="inp" type="email" placeholder="Email general" value={form.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
              <div className="field"><input className="inp" placeholder="Celular" value={form.cellphone || ''} onChange={(e) => set('cellphone', e.target.value)} /></div>
            </div>
            <div className="row2">
              <div className="field" style={{ flex: '0 0 110px' }}>
                <div className="sel">
                  <select value={form.phonePrefix || ''} onChange={(e) => set('phonePrefix', e.target.value)}>
                    <option value="">Ind.</option>
                    {INDICATIVOS.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <input className="inp" placeholder="Teléfono fijo" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
              </div>
            </div>

            <div className="sec">Actividad económica</div>
            <div className="field">
              <label>Código CIIU</label>
              <div className="sel">
                <select value={form.economicActivityCode || ''} onChange={(e) => {
                  const code = e.target.value;
                  const found = ACTIVIDADES.find(([c]) => c === code);
                  set('economicActivityCode', code);
                  set('economicActivityDescription', found ? found[1] : '');
                }}>
                  <option value="">* Seleccione código de actividad económica</option>
                  {ACTIVIDADES.map(([code, desc]) => <option key={code} value={code}>{code} - {desc}</option>)}
                </select>
                <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>

            <div className="sec">Dirección principal (RUT)</div>
            <AddressField
              address={principal.built}
              onOpen={() => setAddrModal('principal')}
              onApply={(a) => setPrincipal((p) => ({ ...p, built: a }))}
            />
            <div className="row2">
              <div className="field">
                <label>Departamento</label>
                <div className="sel">
                  <select value={principal.department} onChange={(e) => setPrincipal((p) => ({ ...p, department: e.target.value }))}>
                    <option value="">* Departamento</option>
                    {DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </div>
              <div className="field">
                <label>Ciudad</label>
                <div className="sel">
                  <select value={principal.city} onChange={(e) => setPrincipal((p) => ({ ...p, city: e.target.value }))}>
                    <option value="">* Ciudad</option>
                    {CIUDADES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </div>
            </div>
            <div className="field">
              <label>Código postal</label>
              <div className="sel">
                <select value={principal.postalCode} onChange={(e) => setPrincipal((p) => ({ ...p, postalCode: e.target.value }))}>
                  <option value="">* Código postal</option>
                  {ciudadesPostal().map(([c, cp]) => <option key={c} value={cp}>{cp} - {c}</option>)}
                </select>
                <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>

            <div className="sec">Dirección de despacho</div>
            <div className="sec-sub">Nombre del contacto</div>
            <div className="row2">
              <div className="field"><input className="inp" placeholder="* Primer nombre" value={despacho.contactFirstName || ''} onChange={(e) => setDespacho((d) => ({ ...d, contactFirstName: e.target.value }))} /></div>
              <div className="field"><input className="inp" placeholder="Segundo nombre" value={despacho.contactSecondName || ''} onChange={(e) => setDespacho((d) => ({ ...d, contactSecondName: e.target.value }))} /></div>
            </div>
            <div className="row2">
              <div className="field"><input className="inp" placeholder="* Primer apellido" value={despacho.contactFirstLastName || ''} onChange={(e) => setDespacho((d) => ({ ...d, contactFirstLastName: e.target.value }))} /></div>
              <div className="field"><input className="inp" placeholder="Segundo apellido" value={despacho.contactSecondLastName || ''} onChange={(e) => setDespacho((d) => ({ ...d, contactSecondLastName: e.target.value }))} /></div>
            </div>
            <div className="sec-sub">Ubicación</div>
            <AddressField
              address={despacho.built}
              onOpen={() => setAddrModal('despacho')}
              onApply={(a) => setDespacho((d) => ({ ...d, built: a }))}
            />
            <div className="field">
              <textarea className="inp ta" placeholder="Descripción de la dirección (ej: Casa de dos pisos, portón rojo)" value={despacho.description || ''} onChange={(e) => setDespacho((d) => ({ ...d, description: e.target.value }))} />
            </div>
            <div className="row2">
              <div className="field">
                <label>Departamento</label>
                <div className="sel">
                  <select value={despacho.department} onChange={(e) => setDespacho((d) => ({ ...d, department: e.target.value }))}>
                    <option value="">* Departamento</option>
                    {DEPARTAMENTOS.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                  <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </div>
              <div className="field">
                <label>Ciudad</label>
                <div className="sel">
                  <select value={despacho.city} onChange={(e) => setDespacho((d) => ({ ...d, city: e.target.value }))}>
                    <option value="">* Ciudad</option>
                    {CIUDADES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </div>
            </div>
            <div className="row2">
              <div className="field" style={{ flex: '0 0 110px' }}>
                <div className="sel">
                  <select value={despacho.phonePrefix || ''} onChange={(e) => setDespacho((d) => ({ ...d, phonePrefix: e.target.value }))}>
                    <option value="">Ind.</option>
                    {INDICATIVOS.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <input className="inp" placeholder="Teléfono" value={despacho.phone || ''} onChange={(e) => setDespacho((d) => ({ ...d, phone: e.target.value }))} />
              </div>
            </div>

            <div className="sec">Información comercial</div>
            <div className="field">
              <label>Vocación del establecimiento</label>
              <div className="sel">
                <select value={form.establishmentVocation || ''} onChange={(e) => set('establishmentVocation', e.target.value)}>
                  <option value="">* Vocación del establecimiento</option>
                  <option value="almacen-agricola">Almacén agrícola</option>
                  <option value="almacen-agricola-ferreteria">Almacén agrícola / Ferretería</option>
                  <option value="ferroelectrico">Ferroeléctrico</option>
                  <option value="ferreteria">Ferretería</option>
                  <option value="miscelanea">Miscelánea</option>
                  <option value="viveros">Viveros</option>
                  <option value="distribucion-pdv">Distribución punto de venta</option>
                </select>
                <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
            <div className="field">
              <label>Tamaño del establecimiento</label>
              <div className="sel">
                <select value={form.establishmentSize || ''} onChange={(e) => set('establishmentSize', e.target.value)}>
                  <option value="">* Tamaño del establecimiento</option>
                  <option value="hasta-50">Hasta 50 m²</option>
                  <option value="50-100">50 – 100 m²</option>
                  <option value="100-200">100 – 200 m²</option>
                  <option value="mas-200">Más de 200 m²</option>
                </select>
                <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
            <div className="field">
              <label>Tipo de atención</label>
              <div className="sel">
                <select value={form.serviceType || ''} onChange={(e) => set('serviceType', e.target.value)}>
                  <option value="">* Tipo de atención</option>
                  <option value="mostrador">Mostrador</option>
                  <option value="autoservicio">Autoservicio</option>
                  <option value="mixto">Mixto</option>
                  <option value="bodega">Bodega</option>
                </select>
                <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <input className="inp" type="email" placeholder="* Email facturación electrónica" value={form.billingEmail || ''} onChange={(e) => set('billingEmail', e.target.value)} />
              </div>
              <div className="field">
                <input className="inp" type="email" placeholder="Email tesorería y contabilidad" value={form.treasuryEmail || ''} onChange={(e) => set('treasuryEmail', e.target.value)} />
              </div>
            </div>

            {personType === 'natural' && (
              <>
                <div className="sec">Declaración de origen de fondos</div>
                <div className="sec-sub">¿Desempeña o ha desempeñado cargo público?</div>
                <RadioGroup name="publicOffice" value={form.publicOffice} onChange={(v) => bool('publicOffice')(v)} />
                {form.publicOffice && (
                  <>
                    <div className="sec-sub">Adjuntar declaración de renta</div>
                    <div className="field">
                      <div className="file-wrap">
                        <input type="file" id="file-renta" accept=".pdf,.jpg,.png" />
                        <label htmlFor="file-renta" className="file-label">
                          <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
                          Seleccionar archivo
                        </label>
                      </div>
                    </div>
                    <div className="field"><input className="inp" placeholder="* Cargo o desempeño" value={form.publicOfficeCargo || ''} onChange={(e) => set('publicOfficeCargo', e.target.value)} /></div>
                    <div className="row2">
                      <div className="field"><label>Fecha inicio</label><input className="inp" type="date" value={form.publicOfficeStart || ''} onChange={(e) => set('publicOfficeStart', e.target.value)} /></div>
                      <div className="field"><label>Fecha fin</label><input className="inp" type="date" value={form.publicOfficeEnd || ''} onChange={(e) => set('publicOfficeEnd', e.target.value)} /></div>
                    </div>
                  </>
                )}
                <div className="sec-sub">¿Relacione si tiene cuentas en el extranjero?</div>
                <RadioGroup name="foreignAccounts" value={form.foreignAccounts} onChange={(v) => bool('foreignAccounts')(v)} />
                <div className="sec-sub">Su cargo implica el manejo de recursos, bienes o valores públicos <span className="opcional">(no obligatorio)</span></div>
                <RadioGroup name="publicResourceManagement" value={form.publicResourceManagement} onChange={(v) => bool('publicResourceManagement')(v)} />

                <div className="sec">Comercio exterior</div>
                <div className="sec-sub">¿Tramita operaciones de comercio exterior (importa y exporta)?</div>
                <RadioGroup name="foreignTrade" value={form.foreignTrade} onChange={(v) => bool('foreignTrade')(v)} />
                {form.foreignTrade && (
                  <>
                    <div className="field"><input className="inp" type="number" placeholder="* Número de operaciones al año" value={form.foreignTradeOpsPerYear || ''} onChange={(e) => set('foreignTradeOpsPerYear', e.target.value)} /></div>
                    <div className="sec-sub">Forma de pago</div>
                    <div className="field">
                      <div className="sel">
                        <select value={form.paymentMethod || ''} onChange={(e) => set('paymentMethod', e.target.value)}>
                          <option value="">* Seleccione forma de pago</option>
                          <option value="transferencias">Transferencias</option>
                          <option value="tc">Tarjeta de crédito</option>
                          <option value="td">Tarjeta débito</option>
                          <option value="otro">Otro</option>
                        </select>
                        <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </div>
                    </div>
                    {form.paymentMethod === 'otro' && (
                      <div className="field"><input className="inp" placeholder="Especifique la forma de pago" value={form.paymentMethodOther || ''} onChange={(e) => set('paymentMethodOther', e.target.value)} /></div>
                    )}
                    <div className="field"><textarea className="inp ta" placeholder="* Descripción de la mercancía objeto de trámite" value={form.merchandiseDescription || ''} onChange={(e) => set('merchandiseDescription', e.target.value)} /></div>
                  </>
                )}

                <div className="sec">Capital y fondos</div>
                <div className="field"><input className="inp" placeholder="Capital socio registrado" value={form.capitalRegistered || ''} onChange={(e) => set('capitalRegistered', e.target.value)} /></div>
                <div className="field"><input className="inp" placeholder="Orígenes de fondos" value={form.fundsOrigin || ''} onChange={(e) => set('fundsOrigin', e.target.value)} /></div>
              </>
            )}

            {personType === 'juridica' && (
              <>
                <div className="sec">Declaraciones</div>
                <div className="sec-sub">¿Desempeña o ha desempeñado cargo público?</div>
                <RadioGroup name="jurPublicOffice" value={form.jurPublicOffice} onChange={(v) => bool('jurPublicOffice')(v)} />
                <div className="sec-sub">Su cargo implica el manejo de recursos, bienes o valores públicos <span className="opcional">(no obligatorio)</span></div>
                <RadioGroup name="jurPublicResourceManagement" value={form.jurPublicResourceManagement} onChange={(v) => bool('jurPublicResourceManagement')(v)} />
                <div className="sec-sub">¿Tramita operaciones de comercio exterior (importa y exporta)?</div>
                <RadioGroup name="jurForeignTrade" value={form.jurForeignTrade} onChange={(v) => bool('jurForeignTrade')(v)} />
              </>
            )}

            <div className="sec">Referencias comerciales</div>
            {references.map((ref, idx) => (
              <div key={idx} className="info-card" style={{ padding: 16, marginBottom: 12 }}>
                <div className="sec-sub">Referencia {idx + 1}</div>
                <div className="field"><input className="inp" placeholder="* Entidad" value={ref.entity} onChange={(e) => updateRef(idx, 'entity', e.target.value)} /></div>
                <div className="field">
                  <div className="inp-row">
                    <input className="inp" placeholder="* Dirección" value={ref.built} readOnly />
                    <button className="addr-btn" type="button" onClick={() => setCancelRef(String(idx))}>
                      <svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="2" /></svg>
                    </button>
                  </div>
                </div>
                <div className="row2">
                  <div className="field">
                    <div className="sel">
                      <select value={ref.department} onChange={(e) => updateRef(idx, 'department', e.target.value)}>
                        <option value="">* Departamento</option>
                        {DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  </div>
                  <div className="field">
                    <div className="sel">
                      <select value={ref.city} onChange={(e) => updateRef(idx, 'city', e.target.value)}>
                        <option value="">* Ciudad</option>
                        {CIUDADES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  </div>
                </div>
                <div className="row2">
                  <div className="field" style={{ flex: '0 0 110px' }}>
                    <div className="sel">
                      <select value={ref.phonePrefix || ''} onChange={(e) => updateRef(idx, 'phonePrefix', e.target.value)}>
                        <option value="">Ind.</option>
                        {INDICATIVOS.map((i) => <option key={i} value={i}>{i}</option>)}
                      </select>
                      <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  </div>
                  <div className="field" style={{ flex: 1 }}><input className="inp" placeholder="Teléfono" value={ref.phone} onChange={(e) => updateRef(idx, 'phone', e.target.value)} /></div>
                </div>
                <div className="field"><input className="inp" placeholder="Cupo crédito" value={ref.creditLimit} onChange={(e) => updateRef(idx, 'creditLimit', e.target.value)} /></div>
              </div>
            ))}

            <div className="sec">Aceptación</div>
            <label className="check-row">
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
              <span>Acepta el tratamiento de datos personales de acuerdo con la política de protección de datos de S.A.S.</span>
            </label>

            {error && <p className="error-msg">{error}</p>}

            <div className="rowbtn">
              <button className="btn btn-ghost" onClick={() => navigate('/clients')}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSubmit}>Aceptar</button>
            </div>
          </>
        )}
      </div>

      {addrModal && (
        <AddressBuilderModal
          onClose={() => setAddrModal(null)}
          onApply={(a) => {
            if (addrModal === 'principal') setPrincipal((p) => ({ ...p, built: a }));
            else setDespacho((d) => ({ ...d, built: a }));
            setAddrModal(null);
          }}
        />
      )}

      {cancelRef !== null && (
        <AddressBuilderModal
          onClose={() => setCancelRef(null)}
          onApply={(a) => {
            updateRef(Number(cancelRef), 'built', a);
            setCancelRef(null);
          }}
        />
      )}
    </div>
  );

  function updateRef(idx: number, key: string, value: string) {
    setReferences((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }

  function ciudadesPostal(): Array<[string, string]> {
    const s = (c: string, cp: string): [string, string] => [c, cp];
    return [
      s('Bogotá D.C.', '110001'), s('Medellín', '050001'), s('Cali', '760001'), s('Barranquilla', '080001'),
      s('Cartagena', '130001'), s('Cúcuta', '540001'), s('Bucaramanga', '680001'), s('Ibagué', '730001'),
      s('Pereira', '660001'), s('Santa Marta', '470001'), s('Manizales', '170001'), s('Pasto', '520001'),
      s('Neiva', '410001'), s('Villavicencio', '500001'), s('Montería', '230001'), s('Armenia', '630001'),
      s('Popayán', '190001'), s('Sincelejo', '700001'), s('Valledupar', '200001'), s('Riohacha', '440001'),
      s('Tunja', '150001'), s('Florencia', '180001'), s('Quibdó', '270001'), s('Mocoa', '860001'),
      s('San José del Guaviare', '950001'), s('Leticia', '910001'), s('Yopal', '850001'), s('Inírida', '940001'),
      s('Mitú', '970001'), s('Puerto Carreño', '990001'), s('Arauca', '810001'), s('San Andrés', '880001'),
    ];
  }
}

function RadioGroup({ name, value, onChange }: { name: string; value?: boolean | string; onChange: (v: string) => void }) {
  return (
    <div className="radio-group">
      <label className="radio">
        <input type="radio" name={name} checked={value === true} onChange={() => onChange('si')} />
        <span>Sí</span>
      </label>
      <label className="radio">
        <input type="radio" name={name} checked={value === false} onChange={() => onChange('no')} />
        <span>No</span>
      </label>
    </div>
  );
}

function AddressField({ address, onOpen, onApply }: { address: string; onOpen: () => void; onApply: (a: string) => void }) {
  return (
    <div className="field">
      <div className="inp-row">
        <input className="inp" placeholder="* Escriba la dirección manualmente" value={address} onChange={(e) => onApply(e.target.value)} />
        <button className="addr-btn" type="button" onClick={onOpen}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="2" /></svg>
        </button>
      </div>
      {address && (
        <div className="addr-result">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="2" /></svg>
          {address}
        </div>
      )}
    </div>
  );
}