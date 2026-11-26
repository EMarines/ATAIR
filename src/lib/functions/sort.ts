import type { Property, Binnacle, Todo } from '$lib/types';

export function sortList(PropList: Property[]): Property[] {
    PropList.sort((a: Property, b: Property) => {
        if(new Date(a.created_at) < new Date(b.created_at)){
            return 1;
        } else if (new Date(a.created_at) > new Date(b.created_at)){
            return -1;
        }
        return 0;
    });
    
    return PropList;
}

export function sortTodos(toRender: Todo[]): Todo[] {
    return toRender.sort((a: Todo, b: Todo) => {
        if(new Date(a.endTask) < new Date(b.endTask)){
            return 1;
        } else if (new Date(a.endTask) > new Date(b.endTask)){
            return -1;
        } else {
            return 0;
        }
    });
}

function parseBinnacleDateMs(raw: any): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (raw && typeof raw === 'object') {
    if (typeof raw.toMillis === 'function') return raw.toMillis();
    if (typeof raw.seconds === 'number') return raw.seconds * 1000;
  }
  return 0;
}

export function sortBinnacle(toRender: Binnacle[]): Binnacle[] {
  return [...toRender].sort((a: Binnacle, b: Binnacle) => {
      const dateA = parseBinnacleDateMs(a?.date ?? a?.createdAt);
      const dateB = parseBinnacleDateMs(b?.date ?? b?.createdAt);
      return dateB - dateA;
   });
}