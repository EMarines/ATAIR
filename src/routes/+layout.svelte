<script lang="ts">
	import '../styles/main.css';
	import { db } from '$lib/firebase_toggle';
	import { collection, onSnapshot } from 'firebase/firestore';
	import type { QuerySnapshot, DocumentData } from 'firebase/firestore';
	import { contactsStore, binnaclesStore, propertiesStore } from '$lib/stores/dataStore';
	import type { Contact, Binnacle, Property } from '$types';
	import { Navbar, Footer } from '$components';
	import NotificationContainer from '$lib/components/NotificationContainer.svelte';
	import {
		initializeAuthManager,
		authInitialized,
		userStore,
		authLoading
	} from '$lib/firebase/authManager';
	import { onMount } from 'svelte';

	const unsubscribes: (() => void)[] = [];

	// Función para obtener la instancia de Firestore
	const getDb = () => db;

	// Inicializar el gestor de autenticación al cargar la app
	// Firebase automáticamente restaura sesiones persistentes vía onAuthStateChanged
	onMount(async () => {
		console.log('🚀 Inicializando aplicación...');
		await initializeAuthManager();
		console.log(
			'✅ Gestor de autenticación inicializado - Firebase maneja la persistencia automáticamente'
		);
	});

	// Esperar a que la autenticación esté inicializada Y el usuario esté autenticado
	$: if ($authInitialized && $userStore) {
		setupFirestoreListeners();
	} else if ($authInitialized && !$userStore) {
		// Limpiar listeners si el usuario se desconecta
		cleanupListeners();
	}

	function cleanupListeners() {
		console.log('🧹 Limpiando listeners de Firestore...');
		unsubscribes.forEach((unsubscribe) => unsubscribe());
		unsubscribes.length = 0;
	}

	function setupFirestoreListeners() {
		console.log('🔗 Configurando listeners de Firestore para usuario autenticado...');

		// Limpiar listeners existentes
		cleanupListeners();

		// Configurar nuevos listeners - ahora sin executeWithValidToken ya que el usuario está autenticado
		unsubscribes.push(
			onSnapshot(
				collection(getDb(), 'contacts'),
				(snapshot: QuerySnapshot<DocumentData>) => {
					try {
						// Procesar todos los documentos, incluso aquellos que podrían estar en proceso de creación
						console.log(`Procesando ${snapshot.docs.length} documentos totales`);

						const datos = snapshot.docs
							.map((doc) => {
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
										console.log(
											'Encontrado contacto específico aabbcx zzzzz con ID:',
											contactData.id
										);
									}

									return contactData;
								} catch (docError) {
									console.error('Error al procesar documento:', docError);
									return null;
								}
							})
							.filter((contact) => contact !== null && contact.id && contact.id.trim() !== '');

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
			onSnapshot(collection(getDb(), 'binnacles'), (snapshot: QuerySnapshot<DocumentData>) => {
				const binnacles = snapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data()
				})) as Binnacle[];
				binnaclesStore.set(binnacles);
			})
		);

		unsubscribes.push(
			onSnapshot(collection(getDb(), 'properties'), (snapshot: QuerySnapshot<DocumentData>) => {
				const datos = snapshot.docs.map((doc) => ({
					public_id: doc.id,
					...doc.data()
				})) as Property[];
				propertiesStore.set(datos);
			})
		);
	}
</script>

<div class="app-container">
	<NotificationContainer />

	{#if $authLoading}
		<div class="loading-overlay">
			<div class="spinner"></div>
			<p>Cargando sesión...</p>
		</div>
	{:else}
		<header>
			<Navbar />
		</header>

		<main>
			<slot />
		</main>

		<Footer />
	{/if}
</div>

<style>
	.app-container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		overflow-x: hidden; /* Prevenir scroll horizontal */
	}

	.loading-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: #111;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		z-index: 1000;
		color: white;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid rgba(255, 255, 255, 0.1);
		border-left-color: #6b21a8;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	main {
		flex: 1;
		position: relative;
		z-index: 2;
		width: 100%; /* Asegurar que main ocupe exactamente el ancho disponible */
	}

	/* Removed the footer-container div as it's not needed */
</style>
