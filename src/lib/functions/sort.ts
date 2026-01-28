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

export function sortBinnacle(toRender: Binnacle[]): Binnacle[] {
  return toRender.sort((a: Binnacle, b: Binnacle) => {
      if(new Date(a.date) < new Date(b.date)){
         return 1;
      } else if (new Date(a.date) > new Date(b.date)){
         return -1;
      } else {
         return 0;
      }
   })
}