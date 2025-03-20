// import { binnacle } from '$lib/stores/store';
import { db } from '$lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import type { Binnacle } from '$lib/types'

export async function infoToBinnacle (binn: Binnacle) {  
   try {
      const validatedBinn = {
         date: binn.date || '',
         comment: binn.comment || '',
         action: binn.action || '',
         to: binn.to || ''
      };

      const binnacleToAdd = collection(db, "binnacles")
      await addDoc(binnacleToAdd, validatedBinn);
   } catch (error) {
      console.log("error", error)
   }  
         
};



 