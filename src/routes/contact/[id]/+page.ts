import type { PageLoad } from './$types';
import { browser } from '$app/environment';
import { db } from '$lib/firebase_toggle';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    getDocsFromServer,
    limit,
    query,
    where
} from 'firebase/firestore';
import { redirect } from '@sveltejs/kit';
import { contactsStore } from '$lib/stores/dataStore';
import { get } from 'svelte/store';
import type { Binnacle } from '$types';

function normalizeBinnacleTimestamp(raw: any): number {
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

function normalizeBinnacleDoc(id: string, data: Record<string, any>): Binnacle {
    const comment = data.comment ?? data.commBinnacle ?? data.content ?? '';
    const date = normalizeBinnacleTimestamp(data.date ?? data.createdAt);
    return {
        ...data,
        id,
        comment: String(comment),
        date
    } as Binnacle;
}

async function fetchInitialBinnacles(contactId: string): Promise<Binnacle[]> {
    if (!db || !contactId) return [];
    const binnRef = collection(db, 'binnacles');
    const qTo = query(binnRef, where('to', '==', contactId), limit(300));
    const qContactId = query(binnRef, where('contactId', '==', contactId), limit(300));

    const runQuery = async (q: ReturnType<typeof query>) => {
        if (browser) {
            try {
                return await getDocsFromServer(q);
            } catch {
                return await getDocs(q);
            }
        }
        return await getDocs(q);
    };

    const fetchPromise = Promise.all([
        runQuery(qTo).catch((err) => {
            console.warn('[contact/+page.ts] Error leyendo binnacles por to:', err);
            return null;
        }),
        runQuery(qContactId).catch((err) => {
            console.warn('[contact/+page.ts] Error leyendo binnacles por contactId:', err);
            return null;
        })
    ]).then(([snapTo, snapContactId]) => {
        const merged = new Map<string, Binnacle>();
        for (const snap of [snapTo, snapContactId]) {
            if (!snap) continue;
            for (const docSnap of snap.docs) {
                merged.set(docSnap.id, normalizeBinnacleDoc(docSnap.id, docSnap.data() as Record<string, any>));
            }
        }
        return Array.from(merged.values());
    });

    // Timeout defensivo para no bloquear la navegación si la red está lenta; el cliente reintentará
    const timeoutPromise = new Promise<Binnacle[]>((resolve) => setTimeout(() => resolve([]), 3000));
    return Promise.race([fetchPromise, timeoutPromise]);
}

export const load: PageLoad = async ({ params }) => {
    try {
        // Validar que el ID del parámetro sea válido
        if (!params.id || params.id.trim() === '') {
            console.error('Error: ID de contacto no proporcionado o inválido');
            throw redirect(303, '/contacts');
        }

        const contactId = params.id.trim();

        // 1. Verificación instantánea en memoria (0ms latencia para contactos recién creados o en catálogo)
        const localContacts = get(contactsStore);
        const contactFromStore = Array.isArray(localContacts)
            ? localContacts.find((c) => c && c.id === contactId)
            : null;

        if (contactFromStore && contactFromStore.name) {
            console.log('⚡ Contacto cargado instantáneamente desde el store local:', contactFromStore.id);
            const initialBinnacles = await fetchInitialBinnacles(contactId);
            return {
                contact: contactFromStore,
                initialBinnacles
            };
        }

        const docRef = doc(db, 'contacts', contactId);
        const [docSnap, initialBinnacles] = await Promise.all([
            getDoc(docRef),
            fetchInitialBinnacles(contactId)
        ]);

        if (!docSnap.exists()) {
            console.error(`Error: Contacto con ID ${contactId} no encontrado`);
            throw redirect(303, '/contacts');
        }

        const data = docSnap.data();

        // Asegurarse de que el ID del contacto esté siempre presente y sea válido
        const contactData = {
            ...data,
            id: contactId // Usar el ID del parámetro de la URL
        };

        // Verificación exhaustiva del ID
        if (!contactData.id || contactData.id.trim() === '') {
            console.error('Error crítico: ID de contacto faltante después de cargar los datos', contactData);
            throw redirect(303, '/contacts');
        }

        console.log('Contacto cargado exitosamente con ID:', contactData.id);

        return {
            contact: contactData,
            initialBinnacles
        };
    } catch (e) {
        if (e instanceof Response) {
            // Si es una redirección, dejarla pasar
            throw e;
        }
        console.error('Error loading contact:', e);
        throw redirect(303, '/contacts');
    }
};