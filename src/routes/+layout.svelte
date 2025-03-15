<script lang="ts">
  import '../styles/main.css'
  import { onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { db } from '$lib/firebase';
  import { collection, onSnapshot } from 'firebase/firestore';
  import type { QuerySnapshot, DocumentData } from 'firebase/firestore';
  import { contactsStore, binnaclesStore, propertiesStore } from '$lib/stores/dataStore';
  import { Navbar, Footer } from '$components';
  import type { Contact, Binnacle, Property } from '$lib/types';
  import { useAuth } from '$lib/hooks/useAuth';
  import { goto } from '$app/navigation';

  const { isAuthenticated, checkAuth } = useAuth();
  const unsubscribes: (() => void)[] = [];

  onMount(async () => {
    if (browser) {
      const isValid = await checkAuth();
      if (!isValid && window.location.pathname !== '/login') {
        goto('/login');
      }
    }
  });

  $: if (browser && $isAuthenticated) {
    // Limpiar subscripciones anteriores
    unsubscribes.forEach(unsubscribe => unsubscribe());
    unsubscribes.length = 0;

    // Configurar nuevos listeners
    unsubscribes.push(
      onSnapshot(
        collection(db, 'contacts'),
        (snapshot: QuerySnapshot<DocumentData>) => {
          try {
            // Procesar todos los documentos, incluso aquellos que podrían estar en proceso de creación
            console.log(`Procesando ${snapshot.docs.length} documentos totales`);
            
            const datos = snapshot.docs.map(doc => {
              try {
                const data = doc.data();
                
                // Verificar si el documento tiene los datos mínimos necesarios
                if (!data) {
                  console.error('Error: Documento sin datos', doc.id);
                  return null;
                }
                
                // Crear el objeto de contacto con el ID del documento
                const contactData = {
                  // Asignar explícitamente el ID del documento y asegurarse de que sea una cadena
                  id: doc.id,
                  createdAt: data.createdAt || Date.now(),
                  name: data.name || '',
                  lastname: data.lastname || '',
                  email: data.email || '',
                  telephon: data.telephon || '',
                  typeContact: data.typeContact || '',
                  selecMC: data.selecMC || '',
                  comContact: data.comContact || '',
                  contactStage: data.contactStage || 0,
                  isActive: data.isActive !== undefined ? data.isActive : true,
                  properties: Array.isArray(data.properties) ? data.properties : [],
                  budget: data.budget || 0,
                  selecTP: data.selecTP || '',
                  rangeProp: data.rangeProp || '',
                  numBaths: data.numBaths || 0,
                  numBeds: data.numBeds || 0,
                  numParks: data.numParks || 0,
                  halfBathroom: data.halfBathroom || '',
                  locaProperty: Array.isArray(data.locaProperty) ? data.locaProperty : [],
                  tagsProperty: Array.isArray(data.tagsProperty) ? data.tagsProperty : [],
                  // Incluir el resto de los datos
                  ...data
                };
                
                // Verificación adicional para asegurarse de que el ID esté presente
                if (!contactData.id || contactData.id.trim() === '') {
                  console.error('Error: Contacto sin ID válido después de procesamiento', contactData);
                  return null;
                }
                
                // Verificación específica para el contacto problemático
                if (contactData.name === 'aabbcx' && contactData.lastname === 'zzzzz') {
                  console.log('Encontrado contacto específico aabbcx zzzzz con ID:', contactData.id);
                }
                
                return contactData;
              } catch (docError) {
                console.error('Error al procesar documento:', docError);
                return null;
              }
            })
            .filter(contact => contact !== null && contact.id && contact.id.trim() !== '');
              
            console.log(`Cargados ${datos.length} contactos válidos desde Firebase`);
            
            // Actualizar el store solo si hay contactos válidos
            if (datos.length > 0) {
              contactsStore.set(datos);
            }
          } catch (error) {
            console.error('Error al procesar los contactos:', error);
          }
        },
        (error) => {
          console.error('Error en el listener de contactos:', error);
        }
      )
    );

    unsubscribes.push(
      onSnapshot(
        collection(db, 'binnacles'),
        (snapshot: QuerySnapshot<DocumentData>) => {
          const binnacles = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Binnacle[];
          binnaclesStore.set(binnacles);
        }
      )
    );

    unsubscribes.push(
      onSnapshot(
        collection(db, 'properties'),
        (snapshot: QuerySnapshot<DocumentData>) => {
          const datos = snapshot.docs.map(doc => ({
            public_id: doc.id,
            ...doc.data()
          })) as Property[];
          propertiesStore.set(datos);
        }
      )
    );
  }

  onDestroy(() => {
    unsubscribes.forEach(unsubscribe => unsubscribe());
  });
</script>

<div class="app">
    <header>
        <Navbar />
    </header>
    
    <main>
        <slot />
    </main>

    <footer>
        <Footer />
    </footer>
</div>

<style>
    .app {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
    }

    main {
        flex: 1;
    }

    footer {
        margin-top: auto;
        padding: 1rem;
        background: rgb(56, 56, 56);
        text-align: center;
    }
</style>