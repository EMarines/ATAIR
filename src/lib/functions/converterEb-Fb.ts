export function convertOperationEbFb(operationType: string) {
  if (!operationType) return '';
  const op = operationType.toLowerCase().trim();
  switch(op) {
    case 'sale':
    case 'venta':
      return 'Comprador';
    case 'rental':
    case 'renta':
      return 'Arrendatario';
    default:
      return '';
  }
}

export function convertOperation(operationType: string) {
  if (!operationType) return '';
  const op = operationType.toLowerCase().trim();
  switch(op) {
    case 'sale':
    case 'venta':
      return 'Venta';
    case 'rental':
    case 'renta':
      return 'Renta';
    default:
      return '';
  }
}

// export function convertOperationRng(operationType: string) {
//   switch(operationType) {
//     case 'price':
//       return 'Venta';

