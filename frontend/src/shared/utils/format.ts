const COP_CURRENCY = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCOP(value: number): string {
  return COP_CURRENCY.format(value);
}

export function productImage(code: string): string {
  return `/products/${code}.png`;
}