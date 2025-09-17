import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { firebase } from '$lib/stores/firebaseStores';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { contactId, googleContactId } = await request.json();
        
        console.log('📥 Recibiendo Google Contact ID:', { contactId, googleContactId });
        
        if (!contactId || !googleContactId) {
            return json(
                { success: false, error: 'Missing contactId or googleContactId' },
                { status: 400 }
            );
        }
        
        // Actualizar el contacto en Firebase con el googleContactId
        const updateData = {
            googleContactId: googleContactId,
            googleSyncedAt: Date.now(),
            googleSyncStatus: 'synced'
        };
        
        const result = await firebase.update('contacts', contactId, updateData);
        
        if (result.success) {
            console.log('✅ Google Contact ID guardado en Firebase:', contactId);
            return json({
                success: true,
                message: 'Google Contact ID saved successfully',
                contactId,
                googleContactId
            });
        } else {
            console.error('❌ Error actualizando contacto:', result.error);
            return json(
                { success: false, error: result.error },
                { status: 500 }
            );
        }
        
    } catch (error) {
        console.error('❌ Error en update-google-id:', error);
        return json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
};