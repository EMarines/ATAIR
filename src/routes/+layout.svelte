<script lang="ts">
  import "../styles/main.css";
  import { db } from '$lib/firebase';
  import { collection, onSnapshot } from 'firebase/firestore';
  import type { QuerySnapshot, DocumentData } from 'firebase/firestore';
  import { contactsStore, binnaclesStore, propertiesStore } from '$lib/stores/dataStore';
  import type { Contact, Binnacle, Property } from '$lib/types';
  import {Navbar, Footer} from '$components';
  import NotificationContainer from '$lib/components/NotificationContainer.svelte';

  const unsubscribes: (() => void)[] = [];

  // Función para obtener la instancia de Firestore
  const getDb = () => db;


    // Configurar nuevos listeners
    unsubscribes.push(
      onSnapshot(
        collection(getDb(), 'contacts'),
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
                
                // Asegurar que el ID del documento sea válido
                const docId = doc.id && doc.id.trim() !== '' ? doc.id : null;
                if (!docId) {
                  console.error('Error: Documento con ID inválido', doc.id);
                  return null;
                }
                
                // Crear el objeto de contacto con el ID del documento
                const contactData = {
                  // Asignar explícitamente el ID del documento y asegurarse de que sea una cadena
                  id: docId,
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
                  modePay: data.modePay || '', // Ensure modePay is included
                  // Incluir el resto de los datos
                  ...data
                };
                
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
        collection(getDb(), 'binnacles'),
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
        collection(getDb(), 'properties'),
        (snapshot: QuerySnapshot<DocumentData>) => {
          const datos = snapshot.docs.map(doc => ({
            public_id: doc.id,
            ...doc.data()
          })) as Property[];
          propertiesStore.set(datos);
        }
      )
    );
  // }

  // onDestroy(() => {
  //   unsubscribes.forEach(unsubscribe => unsubscribe());
  // });
</script>

<div class="app-container">
  <NotificationContainer />
  
  <header>
    <Navbar />
  </header>
  
  <main>
      <slot />
  </main>

  <Footer />
</div>

<style>
  .app-container {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    overflow-x: hidden; /* Prevenir scroll horizontal */
  }

  main {
    flex: 1;
    position: relative;
    z-index: 2;
    width: 100%; /* Asegurar que main ocupe exactamente el ancho disponible */
  }
  
  /* Removed the footer-container div as it's not needed */
</style>