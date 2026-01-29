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
		userProfile,
		authLoading
	} from '$lib/firebase/authManager';
	import { isPublicRoute, isUserRoute, isAdminOnlyRoute } from '$lib/config/routes';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	const unsubscribes: (() => void)[] = [];

	// Función para obtener la instancia de Firestore
	const getDb = () => db;

	// Inicializar el gestor de autenticación al cargar la app
	// Firebase automáticamente restaura sesiones persistentes vía onAuthStateChanged
	onMount(async () => {
		if (typeof window !== 'undefined') {
			console.log('🚀 App: Montando layout principal');
			const currentProject = localStorage.getItem('useTestDb') === 'true' ? 'TEST' : 'PRINCIPAL';
			console.log(`📍 Base de Datos configurada en cliente: ${currentProject}`);
		}

		await initializeAuthManager();
		console.log('✅ App: AuthManager inicializado');
	});

	// Esperar a que la autenticación esté inicializada Y el usuario esté autenticado
	$: if ($authInitialized && $userStore) {
		// Pasar el perfil a setupFirestoreListeners para filtrar suscripciones por rol
		if ($userProfile) {
			setupFirestoreListeners($userProfile);
		}
	} else if ($authInitialized && !$userStore) {
		// Limpiar listeners si el usuario se desconecta
		cleanupListeners();
	}

	// Lógica de redirección global
	$: if ($authInitialized && !$authLoading) {
		handleRedirection($page.url.pathname, $userStore, $userProfile);
	}

	function handleRedirection(path: string, user: any, profile: any) {
		const isPublic = isPublicRoute(path);

		// 1. Caso: Usuario NO autenticado
		if (!user) {
			if (!isPublic) {
				console.log('🚫 Acceso denegado: Redirigiendo a login');
				goto('/login');
			}
			return;
		}

		// 2. Caso: Usuario autenticado intentando entrar al login
		if (path === '/login') {
			console.log('🏠 Ya autenticado: Redirigiendo a inicio');
			goto('/');
			return;
		}

		// 3. Caso: Usuario autenticado, verificar roles si el perfil está cargado
		if (profile) {
			const role = profile.role || 'user';

			if (role === 'user') {
				// Si es un usuario básico y está en una ruta de admin, redirigir a propiedades
				if (isAdminOnlyRoute(path)) {
					console.log('⛔ Acceso restringido para usuario regular: Redirigiendo a propiedades');
					goto('/properties');
				}
			}
		}
	}

	function cleanupListeners() {
		console.log('🧹 Limpiando listeners de Firestore...');
		unsubscribes.forEach((unsubscribe) => unsubscribe());
		unsubscribes.length = 0;
	}

	function setupFirestoreListeners(profile: any) {
		const isAdmin = profile?.role === 'admin';
		console.log(`🔗 Configurando listeners de Firestore. Modo Admin: ${isAdmin}`);

		// Limpiar listeners existentes para evitar duplicados
		cleanupListeners();

		// 1. SUSCRIPCIONES DE ADMIN (Contactos y Bitácoras)
		if (isAdmin) {
			console.log('📋 Cargando datos sensibles (Contactos/Bitácoras) para administrador...');
			unsubscribes.push(
				onSnapshot(
					collection(getDb(), 'contacts'),
					(snapshot: QuerySnapshot<DocumentData>) => {
						try {
							const datos = snapshot.docs
								.map((doc) => {
									try {
										const data = doc.data();
										if (!data) return null;

										const docId = doc.id && doc.id.trim() !== '' ? doc.id : null;
										if (!docId) return null;

										return {
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
											modePay: data.modePay || '',
											...data
										};
									} catch (docError) {
										return null;
									}
								})
								.filter((contact) => contact !== null && contact.id && contact.id.trim() !== '');

							if (datos.length > 0) {
								contactsStore.set(datos);
							}
						} catch (error) {
							console.error('Error al procesar los contactos:', error);
						}
					},
					(error) => console.error('Error en el listener de contactos:', error)
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
		} else {
			console.log('🔒 Usuario no-admin: Omitiendo carga de contactos y bitácoras.');
			// Limpiar stores por seguridad si el rol cambia a no-admin
			contactsStore.set([]);
			binnaclesStore.set([]);
		}

		// 2. SUSCRIPCIONES PÚBLICAS (Propiedades)
		// Todos los usuarios autenticados pueden ver propiedades
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
