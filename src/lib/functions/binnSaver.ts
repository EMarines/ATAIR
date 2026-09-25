import { db } from '$lib/firebase_toggle';
import { collection, addDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import type { Binnacle } from '$lib/types';

export async function infoToBinnacle(binn: Binnacle) {  
   try {
      const validatedBinn = {
         date: binn.date || '',
         comment: binn.comment || '',
         action: binn.action || '',
         to: binn.to || ''
      };

      const binnacleToAdd = collection(db, "binnacles");
      await addDoc(binnacleToAdd, validatedBinn);

      // Si es envío de propiedad a un contacto, registrar automáticamente en sendedProperties del contacto
      const contactId = String(binn.to || '').trim();
      const propId = String(binn.comment || '').trim();
      const action = String(binn.action || '');
      if (contactId && propId && propId !== 'Sin ID público' && action.includes('Propiedad enviada')) {
         try {
            await updateDoc(doc(db, 'contacts', contactId), {
               sendedProperties: arrayUnion(propId),
               lastProposalPropertyId: propId,
               lastProposalSentAt: Date.now()
            });
            console.log(`✅ [Liberamiento] Propiedad ${propId} agregada a sendedProperties del contacto ${contactId}`);
         } catch (contactErr) {
            console.warn('⚠️ No se pudo actualizar sendedProperties en el contacto:', contactErr);
         }
      }
   } catch (error) {
      console.log("error", error);
   }  
}




 