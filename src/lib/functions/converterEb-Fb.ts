export function convertOperationEbFb(operationType: string) {
  switch(operationType) {
    case 'sale':
      return 'Comprador';
    case 'rental':
      return 'Arrendador';
    default:
      return '';
  }
}

export function convertOperation(operationType: string) {
  switch(operationType) {
    case 'sale':
      return 'Venta';
    case 'rental':
      return 'Arrendador';
    default:
      return '';
  }
}

// export function convertOperationRng(operationType: string) {
//   switch(operationType) {
//     case 'price':
//       return 'Venta';

