/**
 * Estados del crédito (backend: CreditStatus, migración 1700000022000).
 *
 *   draft → pre_approved → pending_signatures → signed
 *     └→ rejected      (draft, pre_approved y pending_signatures → cancelled)
 */
export type CreditStatus = 'draft' | 'pre_approved' | 'rejected' | 'cancelled' | 'pending_signatures' | 'signed';

export const CREDIT_STATUS: Record<CreditStatus, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: '#8a6d00' },
  pre_approved: { label: 'Pre-aprobado', color: '#1f7a36' },
  rejected: { label: 'Rechazado', color: '#b00020' },
  cancelled: { label: 'Cancelado', color: '#6b7280' },
  pending_signatures: { label: 'Pendiente de firmas', color: '#1356a0' },
  signed: { label: 'Firmado/validado', color: '#2f7d4d' },
};

export function statusMeta(status: string) {
  return CREDIT_STATUS[status as CreditStatus] ?? { label: status, color: 'var(--muted)' };
}

/**
 * Pantalla en la que se retoma el estudio según su estado. null = no se puede
 * retomar (rechazado o cancelado): solo queda consultar el expediente.
 */
export function resumePath(id: string, status: string): string | null {
  switch (status) {
    case 'draft':
      return `/credits/result/${id}`;
    case 'pre_approved':
      return `/credits/sign/${id}`;
    case 'pending_signatures':
    case 'signed':
      return `/credits/success/${id}`;
    default:
      return null;
  }
}

/** Estados desde los que el asesor puede cancelar (backend: CANCELLABLE). */
export const canCancel = (status: string) => ['draft', 'pre_approved', 'pending_signatures'].includes(status);
