import { useState } from 'react';
import { Modal } from './Modal';

const TIPOS_VIA = ['Calle', 'Carrera', 'Diagonal', 'Transversal', 'Avenida', 'Vía', 'Autopista', 'Circunvalar', 'Pasaje'];
const COMPLEMENTOS = ['Casa', 'Apartamento', 'Oficina', 'Local', 'Lote', 'Manzana', 'Edificio', 'Torre', 'Interior', 'Etapa', 'Conjunto', 'Urbanización'];

interface AddressBuilderModalProps {
  onApply: (address: string) => void;
  onClose: () => void;
}

export function AddressBuilderModal({ onApply, onClose }: AddressBuilderModalProps) {
  const [tipoVia, setTipoVia] = useState('');
  const [numero, setNumero] = useState('');
  const [letra, setLetra] = useState('');
  const [bis, setBis] = useState('');
  const [numero2, setNumero2] = useState('');
  const [letra2, setLetra2] = useState('');
  const [complemento, setComplemento] = useState('');
  const [numComp, setNumComp] = useState('');
  const [desc, setDesc] = useState('');

  function buildPreview(): string {
    const parts: string[] = [];
    let main = '';
    if (tipoVia) main += tipoVia;
    if (numero) main += (main ? ' ' : '') + numero;
    if (letra) main += ' ' + letra;
    if (bis) main += ' ' + bis;
    if (numero2) {
      main += ' # ' + numero2;
      if (letra2) main += ' ' + letra2;
    } else if (letra2) {
      main += ' # ' + letra2;
    }
    if (main) parts.push(main);
    if (complemento) parts.push(complemento + (numComp ? ' ' + numComp : ''));
    else if (numComp) parts.push('Nro. ' + numComp);
    if (desc) parts.push(desc);
    return parts.join(', ');
  }

  const preview = buildPreview();

  return (
    <Modal open onClose={onClose}>
      <div className="sectitle">Construir dirección</div>
      <p className="modal-lead">Complete los campos de nomenclatura para construir la dirección.</p>

      <div className="field">
        <label>* Tipo de vía</label>
        <div className="sel">
          <select value={tipoVia} onChange={(e) => setTipoVia(e.target.value)}>
            <option value="">Seleccione</option>
            {TIPOS_VIA.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>

      <div className="row3">
        <div className="field">
          <label>N°</label>
          <input className="inp" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="45" />
        </div>
        <div className="field">
          <label>Letra</label>
          <input className="inp" value={letra} onChange={(e) => setLetra(e.target.value)} placeholder="A" />
        </div>
        <div className="field">
          <label>Bis</label>
          <div className="sel">
            <select value={bis} onChange={(e) => setBis(e.target.value)}>
              <option value="">—</option>
              <option value="Bis">Bis</option>
            </select>
            <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label># Secundario</label>
          <input className="inp" value={numero2} onChange={(e) => setNumero2(e.target.value)} placeholder="20" />
        </div>
        <div className="field">
          <label>Letra</label>
          <input className="inp" value={letra2} onChange={(e) => setLetra2(e.target.value)} placeholder="B" />
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label>Complemento</label>
          <div className="sel">
            <select value={complemento} onChange={(e) => setComplemento(e.target.value)}>
              <option value="">Ninguno</option>
              {COMPLEMENTOS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
        <div className="field">
          <label>N° complemento</label>
          <input className="inp" value={numComp} onChange={(e) => setNumComp(e.target.value)} placeholder="3" />
        </div>
      </div>

      <div className="field">
        <label>Descripción adicional <span className="opcional">(opcional)</span></label>
        <textarea className="inp ta" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej: Conjunto residencial, portón verde" />
      </div>

      <div className="addr-preview-box">
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="2" /></svg>
        <div>
          <div className="preview-label">Vista previa:</div>
          <strong>{preview || 'Complete los campos para ver la dirección'}</strong>
        </div>
      </div>

      <div className="rowbtn">
        <button className="btn btn-ghost" type="button" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" type="button" disabled={!preview} onClick={() => onApply(preview)}>Aplicar</button>
      </div>
    </Modal>
  );
}
