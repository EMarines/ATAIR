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
