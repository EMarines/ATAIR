<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		systStatus,
		propertiesStore,
		property as propertyStore,
		contactsStore
	} from '$lib/stores/dataStore';
	import {
		Search,
		Tags,
		Ubication,
		InputText,
		InputOptions,
		InputEmail,
		InputNumber,
		CardProperty,
		Button
	} from '$components';
	import {
		typeContacts,
		modeContact,
		typeProperties,
		modePays,
		oneToFive,
		oneToFour,
		oneToThree,
		contStage,
		range
	} from '$lib/parameters';
	import type { Property, Contact, AddContactEvents } from '$lib/types';
	import { ranPrice } from '$lib/functions/rangeValue';
	import { convertOperationEbFb } from '$lib/functions/converterEb-Fb';
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';

	const dispatch = createEventDispatcher<AddContactEvents>();

	// Validaciones
	const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const PHONE_REGEX = /^\+?[\d\s-]{10,}$/;

	interface ErroresFormulario {
		name?: string;
		lastname?: string;
		email?: string;
		telephon?: string;
		general?: string;
	}

	let erroresFormulario: ErroresFormulario = {};
	// Crear un tipo para los campos que queremos validar
	type CamposValidados = Pick<Contact, 'name' | 'lastname' | 'email' | 'telephon'>;
	let camposModificados: Record<keyof CamposValidados, boolean> = {
		name: false,
		lastname: false,
		email: false,
		telephon: false
	};
	let isDirty = false;
	let isSubmitting = false;
	let showProp = false;
	let searchTerm = '';
	let propToRender = $propertiesStore;
	let showAdditionalFields = false;
	let errorMessage = ''; // Variable para almacenar mensajes de error
	let showFooter = true; // Variable para controlar la visibilidad del footer
	let selectedProperties: string[] = [];

	// Variables para notificación automática (solo errores)
	let showNotification = false;
	let notificationMessage = '';
	let notificationType: 'error' | 'success' = 'error';
	let sendWelcomeWA = true; // Control para enviar mensaje de bienvenida por WA

	// Función para mostrar notificación
	function showAutoNotification(message: string, type: 'error' | 'success' = 'error') {
		notificationMessage = message;
		notificationType = type;
		showNotification = true;

		// Asegurar que la animación se ejecute después de que el DOM se actualice
		setTimeout(() => {
			const notification = document.querySelector('.auto-notification');
			if (notification) {
				notification.classList.add('show');
			}
		}, 50);

		setTimeout(() => {
			showNotification = false;
		}, 1500);
	} // Variables para n8n webhook configuration
	// Auto-detección de entorno
	const isLocalhost =
		typeof window !== 'undefined' &&
		(window.location.hostname === 'localhost' ||
			window.location.hostname === '127.0.0.1' ||
			window.location.hostname.includes('localhost'));
	const environment = isLocalhost ? 'TEST' : 'PRODUCTION';
	const useTestMode = isLocalhost; // true para localhost (test), false para producción

	const webhookUrlBase =
		import.meta.env.VITE_N8N_WEBHOOK_BASE ||
		'https://n8n-n8n.wjj5il.easypanel.host/webhook/12c11a13-4b9f-416e-99c7-7e9cb5806fd5';
	const webhookUrlTest = webhookUrlBase + '?test=true';
	const webhookUrlProd = webhookUrlBase;

	// Estado unificado del formulario
	export let existingContact: Contact | null = null;

	// Función para enviar datos del contacto a n8n para sincronización con Google Contacts
	async function sendToN8n(contactData: Contact) {
		const startTime = Date.now();
		const webhookUrl = useTestMode ? webhookUrlTest : webhookUrlProd;

		try {
			// Preparar el paquete de datos para n8n (siguiendo el patrón exitoso de propiedades)
			const dataPackage = {
				contact: {
					id: contactData.id,
					name: contactData.name,
					lastname: contactData.lastname || '',
					fullName: `${contactData.name} ${contactData.lastname || ''}`.trim(),
					email: contactData.email || '',
					phone: contactData.telephon || '',
					notes: contactData.notes || '',
					typeContact: contactData.typeContact || '',
					contactMode: contactData.selecMC || '',
					budget: contactData.budget || 0,
					propertyType: contactData.selecTP || '',
					contactStage: contactData.contactStage || ''
				},
				metadata: {
					timestamp: Date.now(),
					timestampISO: new Date().toISOString(),
					source: 'ATAIR_APP',
					action: 'CREATE_CONTACT',
					requestedBy: 'AddContact_Component',
					testMode: useTestMode,
					version: '1.0',
					environment: environment
				},
				// Información adicional para Google Contacts
				googleContactsData: {
					displayName: contactData.name,
					givenName: contactData.name.split(' ')[0] || contactData.name,
					familyName: contactData.lastname || contactData.name.split(' ').slice(1).join(' ') || '',
					phoneNumbers: [
						{
							value: contactData.telephon,
							type: 'mobile'
						}
					],
					emailAddresses: contactData.email
						? [
								{
									value: contactData.email,
									type: 'home'
								}
							]
						: [],
					organizations: [
						{
							name: 'ATAIR Contact',
							title: contactData.typeContact || 'Cliente'
						}
					]
				}
			};

			console.log('📦 PAQUETE COMPLETO A ENVIAR:', JSON.stringify(dataPackage, null, 2));

			// DEBUG: Verificar serialización
			const jsonString = JSON.stringify(dataPackage);
			console.log('🔍 JSON STRING LENGTH:', jsonString.length);
			console.log('🔍 JSON STRING PREVIEW:', jsonString.substring(0, 100) + '...');
			console.log(
				'🔍 JSON IS VALID:',
				(() => {
					try {
						JSON.parse(jsonString);
						return true;
					} catch {
						return false;
					}
				})()
			);

			// ASEGURAR que el body sea una cadena JSON válida
			const bodyToSend = jsonString; // Usar la cadena ya serializada
			console.log('🔍 BODY TYPE:', typeof bodyToSend);
			console.log('🔍 BODY IS STRING:', typeof bodyToSend === 'string');
			console.log('🔍 ENVIRONMENT:', import.meta.env.MODE);
			console.log('🔍 IS PRODUCTION BUILD:', import.meta.env.PROD);
			console.log(
				'🔍 VERCEL ENV:',
				typeof window !== 'undefined' ? window.location.hostname : 'SSR'
			);

			console.log('🔗 URL del webhook:', webhookUrl);

			// Crear AbortController para timeout
			const controller = new AbortController();
			// Timeout más corto para modo test (3s vs 30s)
			const timeoutMs = useTestMode ? 3000 : 30000;
			const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

			console.log(`⏱️ Timeout configurado a ${timeoutMs}ms (${timeoutMs / 1000}s)`);
			console.log('📤 Headers a enviar:', {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'X-Requested-With': 'XMLHttpRequest'
			});

			// Función para enviar con modo específico
			const sendWithMode = async (mode) => {
				return await fetch(webhookUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
						'X-Requested-With': 'XMLHttpRequest'
					},
					body: bodyToSend, // Usar la cadena ya serializada
					signal: controller.signal,
					mode: mode
				});
			};

			try {
				let response;

				// En modo test, usar directamente no-cors
				if (useTestMode) {
					console.log('🧪 Modo TEST: usando no-cors directamente');
					response = await sendWithMode('no-cors');
				} else {
					// En producción, intentar primero con CORS, si falla usar no-cors
					console.log('🚀 Modo PRODUCCIÓN: intentando con CORS primero');
					try {
						response = await sendWithMode('cors');
						console.log('✅ CORS exitoso en producción');
					} catch (corsError) {
						console.log('⚠️ CORS falló, intentando con no-cors como fallback');
						console.log('Error CORS:', corsError.message);
						response = await sendWithMode('no-cors');
						console.log('✅ Fallback no-cors exitoso');
					}
				}

				clearTimeout(timeoutId); // Cancelar timeout si la respuesta llega

				const duration = Date.now() - startTime;
				console.log(`⏱️ Tiempo de respuesta: ${duration}ms`);
				console.log('📡 Respuesta de n8n - Status:', response.status);
				console.log('📡 Respuesta de n8n - StatusText:', response.statusText);
				console.log(
					'📡 Respuesta de n8n - Headers:',
					Object.fromEntries(response.headers.entries())
				);
				console.log('🔍 URL utilizada:', webhookUrl);
				console.log(`🔧 Modo: ${useTestMode ? 'TEST' : 'PRODUCCIÓN'}`);

				// En modo no-cors, status 0 es normal y significa que la petición se envió
				if (response.status === 0) {
					console.log('✅ MODO NO-CORS: Petición enviada exitosamente (status 0 es normal)');

					return; // Salir exitosamente
				}

				if (response.ok) {
					let result;
					try {
						const responseText = await response.text();
						console.log('📄 Respuesta cruda:', responseText);

						if (responseText) {
							result = JSON.parse(responseText);
						} else {
							result = { message: 'Success - No response body' };
						}
					} catch (parseError) {
						console.log('⚠️ No se pudo parsear JSON, pero la respuesta fue exitosa');
						result = { message: 'Success - Response not JSON' };
					}

					console.log('✅ ÉXITO: Contacto enviado a n8n:', result);

					// 🔥 NUEVO: Capturar googleContactId si está presente
					if (result && result.googleContactId) {
						console.log('🆔 Google Contact ID recibido:', result.googleContactId);

						// Actualizar el contacto en Firebase con el googleContactId
						try {
							const updatedContactData = {
								...contactData,
								googleContactId: result.googleContactId,
								googleSyncedAt: Date.now()
							};

							console.log('💾 Actualizando contacto con Google ID...');
							const updateResult = await contactsStore.update(updatedContactData);

							if (updateResult.success) {
								console.log('✅ Google Contact ID guardado en Firebase');
							} else {
								console.error('❌ Error guardando Google Contact ID:', updateResult.error);
							}
						} catch (updateError) {
							console.error('❌ Error actualizando contacto con Google ID:', updateError);
						}
					} else {
						console.log('⚠️ No se recibió googleContactId en la respuesta');
					}
				} else {
					// Intentar obtener el cuerpo de la respuesta de error
					let errorBody = '';
					try {
						errorBody = await response.text();
					} catch (e) {
						errorBody = 'No se pudo leer el cuerpo del error';
					}

					throw new Error(`HTTP ${response.status}: ${response.statusText}\nDetalle: ${errorBody}`);
				}
			} catch (fetchError) {
				clearTimeout(timeoutId);

				if (fetchError.name === 'AbortError') {
					throw new Error('Timeout: El servidor n8n no respondió en 30 segundos');
				}
				throw fetchError;
			}
		} catch (error) {
			const duration = Date.now() - startTime;
			console.error('❌ ERROR COMPLETO al enviar a n8n:', error);
			console.error('❌ Duración hasta el error:', duration + 'ms');

			// Mostrar alerta de error detallada
			let errorMessage = '';
			if (error.message.includes('Failed to fetch')) {
				errorMessage =
					`🌐 Error de conectividad con n8n:\n\n` +
					`• El webhook funciona desde terminal, pero el navegador lo bloquea\n` +
					`• Esto es típico por políticas CORS del navegador\n` +
					`• El contacto se guardó en Firebase correctamente\n` +
					`• Tiempo transcurrido: ${duration}ms\n\n` +
					`💡 SOLUCIONES:\n` +
					`1. Verificar configuración CORS en n8n\n` +
					`2. Usar modo "Listen for test event" para desarrollo\n` +
					`3. Configurar un proxy para producción\n\n` +
					`URL: ${webhookUrl}`;
			} else if (error.message.includes('Timeout')) {
				errorMessage =
					`⏱️ Timeout al conectar con n8n:\n\n` +
					`El servidor tardó más de 30 segundos en responder.\n` +
					`Verifica el estado de tu servidor n8n.`;
			} else if (error.message.includes('NetworkError') || error.message.includes('CORS')) {
				errorMessage =
					`🚫 Error CORS detectado:\n\n` +
					`El navegador está bloqueando la petición por políticas de seguridad.\n` +
					`El webhook funciona (confirmado por terminal).\n` +
					`El contacto se guardó correctamente en Firebase.\n\n` +
					`💡 Para solucionar:\n` +
					`• Configura CORS en tu servidor n8n\n` +
					`• Usa "Listen for test event" para desarrollo`;
			} else {
				errorMessage =
					`❌ Error: ${error.message}\n\n` +
					`Tiempo: ${duration}ms\n` +
					`El contacto se guardó en Firebase correctamente.\n\n` +
					`💡 El webhook funciona desde terminal, pero hay un problema de conectividad desde el navegador.`;
			}

			// Mostrar notificación de error simplificada
			showAutoNotification(
				'⚠️ Contacto guardado en Firebase. Error de conexión con Google Contacts.',
				'error'
			);
		}
	}

	// 🔄 FUNCIÓN PARA ACTUALIZAR CONTACTO EN GOOGLE CONTACTS
	async function updateContactInGoogle(contactData: Contact) {
		if (!contactData.googleContactId) {
			console.log('⚠️ No se puede actualizar: contacto sin googleContactId');
			return { success: false, error: 'No Google Contact ID' };
		}

		console.log('🔄 INICIANDO ACTUALIZACIÓN EN GOOGLE CONTACTS');
		console.log('🆔 Google Contact ID:', contactData.googleContactId);

		const startTime = Date.now();

		// Configurar URLs según el modo
		const webhookUrl = useTestMode ? webhookUrlTest : webhookUrlProd;

		const dataPackage = {
			action: 'UPDATE',
			googleContactId: contactData.googleContactId,
			contact: {
				id: contactData.id,
				name: contactData.name,
				lastname: contactData.lastname || '',
				fullName: `${contactData.name} ${contactData.lastname || ''}`.trim(),
				email: contactData.email || '',
				phone: contactData.telephon || '',
				notes: contactData.notes || '',
				typeContact: contactData.typeContact || '',
				contactMode: contactData.selecMC || '',
				budget: contactData.budget || 0,
				propertyType: contactData.selecTP || '',
				contactStage: contactData.contactStage || ''
			},
			googleContactsData: {
				displayName: contactData.name,
				givenName: contactData.name.split(' ')[0] || contactData.name,
				familyName: contactData.lastname || contactData.name.split(' ').slice(1).join(' ') || '',
				phoneNumbers: [
					{
						value: contactData.telephon,
						type: 'mobile'
					}
				],
				emailAddresses: contactData.email
					? [
							{
								value: contactData.email,
								type: 'home'
							}
						]
					: [],
				organizations: [
					{
						name: 'ATAIR Contact',
						title: contactData.typeContact || 'Cliente'
					}
				]
			},
			metadata: {
				timestamp: Date.now(),
				timestampISO: new Date().toISOString(),
				source: 'ATAIR_APP',
				action: 'UPDATE_CONTACT',
				requestedBy: 'AddContact_Component',
				testMode: useTestMode,
				version: '1.0',
				environment: environment
			}
		};

		try {
			const controller = new AbortController();
			const timeoutMs = useTestMode ? 3000 : 30000;
			const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

			console.log('📦 PAQUETE UPDATE A ENVIAR:', JSON.stringify(dataPackage, null, 2));

			const response = await fetch(webhookUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(dataPackage),
				signal: controller.signal,
				mode: useTestMode ? 'no-cors' : 'cors'
			});

			clearTimeout(timeoutId);
			const duration = Date.now() - startTime;

			console.log(`✅ UPDATE enviado exitosamente en ${duration}ms`);
			return { success: true, duration };
		} catch (error) {
			const duration = Date.now() - startTime;
			console.error('❌ Error actualizando en Google:', error);
			return { success: false, error: error.message, duration };
		}
	}

	// 🗑️ FUNCIÓN PARA ELIMINAR CONTACTO DE GOOGLE CONTACTS
	async function deleteContactFromGoogle(contactData: Contact) {
		if (!contactData.googleContactId) {
			console.log('⚠️ No se puede eliminar: contacto sin googleContactId');
			return { success: false, error: 'No Google Contact ID' };
		}

		console.log('🗑️ INICIANDO ELIMINACIÓN EN GOOGLE CONTACTS');
		console.log('🆔 Google Contact ID:', contactData.googleContactId);

		const startTime = Date.now();

		// Configurar URLs según el modo
		const webhookUrl = useTestMode ? webhookUrlTest : webhookUrlProd;

		const dataPackage = {
			action: 'DELETE',
			googleContactId: contactData.googleContactId,
			contact: {
				id: contactData.id,
				name: contactData.name,
				fullName: `${contactData.name} ${contactData.lastname || ''}`.trim()
			},
			metadata: {
				timestamp: Date.now(),
				timestampISO: new Date().toISOString(),
				source: 'ATAIR_APP',
				action: 'DELETE_CONTACT',
				requestedBy: 'AddContact_Component',
				testMode: useTestMode,
				version: '1.0',
				environment: environment
			}
		};

		try {
			const controller = new AbortController();
			const timeoutMs = useTestMode ? 3000 : 30000;
			const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

			console.log('📦 PAQUETE DELETE A ENVIAR:', JSON.stringify(dataPackage, null, 2));

			const response = await fetch(webhookUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(dataPackage),
				signal: controller.signal,
				mode: useTestMode ? 'no-cors' : 'cors'
			});

			clearTimeout(timeoutId);
			const duration = Date.now() - startTime;

			console.log(`✅ DELETE enviado exitosamente en ${duration}ms`);
			return { success: true, duration };
		} catch (error) {
			const duration = Date.now() - startTime;
			console.error('❌ Error eliminando de Google:', error);
			return { success: false, error: error.message, duration };
		}
	}

	// 🚀 AUTOMATIZACIÓN WA (PHASE 1)
	async function triggerWAAutomation(contactData: Contact, propertyData: Property | null) {
		if (!contactData.telephon) return;

		console.log('🚀 Triggering WA Automation...');
		try {
			// Usamos endpoint relativo para que funcione en dev y prod
			const response = await fetch('/api/whatsapp/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contact: contactData,
					property: propertyData
				})
			});
			const result = await response.json();
			if (result.success) {
				console.log('✅ WA automated message sent!', result.data);
				showAutoNotification('Mensaje de bienvenida enviado por WA', 'success');
			} else {
				console.error('❌ WA automation failed:', result.error);
			}
		} catch (e) {
			console.error('❌ WA fetch error:', e);
		}
	}

	let contact: Contact = existingContact
		? { ...existingContact }
		: {
				budget: 0, // Valor numérico por defecto
				comContact: '',
				contactStage: 'Etapa 1',
				createdAt: Date.now(),
				email: '',
				halfBathroom: 0,
				id: '',
				lastname: '',
				locaProperty: [],
				modePay: '',
				name: '',
				notes: '',
				numBaths: 0,
				numBeds: 0,
				numParks: 0,
				propCont: '',
				rangeProp: '',
				selecMC: '',
				selecTP: '',
				tagsProperty: [],
				telephon: '',
				typeContact: ''
			};

	// Variable string para el input de presupuesto, inicializada desde el contact.budget actual (que ya considera existingContact)
	let budgetStringForInput: string = String(contact.budget);

	// Función para generar un UUID
	function generateUUID() {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			const r = (Math.random() * 16) | 0;
			const v = c === 'x' ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
	}

	function handleBlur(field: keyof CamposValidados) {
		if (field in camposModificados) {
			camposModificados[field] = true;
			validateField(field, contact[field]);
		}
	}

	function validateField(field: keyof CamposValidados, value: any) {
		// Solo validar si el campo ha sido tocado o si el formulario está siendo enviado
		if (!camposModificados[field] && !isDirty) {
			return;
		}
		erroresFormulario[field] = '';
		switch (field) {
			case 'name':
				if (!value || !value.trim()) {
					erroresFormulario.name = 'El nombre es requerido';
				} else if (value.length < 2) {
					erroresFormulario.name = 'El nombre es muy corto';
				}
				break;
			case 'telephon':
				if (!value || !value.trim()) {
					erroresFormulario.telephon = 'El teléfono es requerido';
				} else if (!PHONE_REGEX.test(value)) {
					erroresFormulario.telephon = 'Formato de teléfono inválido';
				}
				break;
			case 'email':
				if (!value || !value.trim()) {
					erroresFormulario.email = 'El email es requerido';
				} else if (!EMAIL_REGEX.test(value)) {
					erroresFormulario.email = 'Email inválido';
				}
				break;
			case 'lastname':
				if (!value || !value.trim()) {
					erroresFormulario.lastname = 'El apellido es requerido';
				} else if (value.length < 2) {
					erroresFormulario.lastname = 'El apellido es muy corto';
				}
				break;
		}
		console.log('Errores formulario:', erroresFormulario);
	}

	async function handleSubmit() {
		console.log(
			'[AddContact] handleSubmit: budgetStringForInput (valor del input) AL INICIO:',
			budgetStringForInput,
			'Tipo:',
			typeof budgetStringForInput
		);
		// El contact.budget original no se modifica directamente por el input bindeado a budgetStringForInput
		// console.log($propertyStore, contact, "handleSubmit");
		try {
			isSubmitting = true;

			// Validar que los campos requeridos estén presentes
			if (!contact.name || !contact.telephon) {
				errorMessage = 'Nombre y teléfono son campos obligatorios';
				return;
			}

			// Parsear budgetStringForInput a número para guardar
			let parsedBudgetNumber: number = 0;
			if (
				budgetStringForInput !== null &&
				budgetStringForInput !== undefined &&
				String(budgetStringForInput).trim() !== ''
			) {
				let numericStringToParse = String(budgetStringForInput).trim();
				const lastComma = numericStringToParse.lastIndexOf(',');
				const lastDot = numericStringToParse.lastIndexOf('.');

				if (lastComma !== -1 && (lastDot === -1 || lastDot < lastComma)) {
					// Coma es decimal
					numericStringToParse = numericStringToParse.replace(/\./g, '').replace(',', '.');
				} else {
					// Punto es decimal o no hay decimal, comas son miles
					numericStringToParse = numericStringToParse.replace(/,/g, '');
				}
				// Eliminar cualquier caracter que no sea dígito o el primer punto decimal
				numericStringToParse = numericStringToParse.replace(
					/[^\d.]/g,
					(match, offset, fullString) => {
						return match === '.' && fullString.indexOf('.') === offset ? '.' : '';
					}
				);

				const tempParsedValue = parseFloat(numericStringToParse);
				parsedBudgetNumber = isNaN(tempParsedValue) ? 0 : tempParsedValue;
			}
			console.log(
				`[AddContact] handleSubmit: budgetStringForInput ('${budgetStringForInput}') parseado a parsedBudgetNumber:`,
				parsedBudgetNumber
			);

			// Crear una copia limpia del contacto con valores por defecto para campos vacíos
			const cleanContactData: Contact = {
				id: contact.id || '',
				createdAt: contact.createdAt || Date.now(),
				name: contact.name || '',
				lastname: contact.lastname || '',
				email: contact.email || '',
				telephon: contact.telephon || '',
				selecMC: contact.selecMC || 'Lona en Propiedad',
				comContact: contact.comContact || '',
				contactStage: contact.contactStage || 'Etapa 1',
				isActive: contact.isActive !== undefined ? contact.isActive : true,
				budget: parsedBudgetNumber, // Usar el valor parseado
				selecTP: contact.selecTP || '',
				rangeProp: contact.rangeProp || '',
				numBaths: contact.numBaths || 0,
				numBeds: contact.numBeds || 0,
				numParks: contact.numParks || 0,
				halfBathroom: contact.halfBathroom || '',
				locaProperty: Array.isArray(contact.locaProperty) ? contact.locaProperty : [],
				tagsProperty: Array.isArray(contact.tagsProperty) ? contact.tagsProperty : [],
				modePay: contact.modePay || '',
				typeContact: contact.typeContact || '',
				// Propiedades opcionales - usar cadenas vacías para campos de texto
				color: contact.color || '',
				contactType: contact.contactType || '',
				contMode: contact.contMode || '',
				notes: contact.notes || '',
				propCont: contact.propCont || '',
				// selecTO: contact.selecTO || '',
				// selecTO: convertOperationEbFb($propertyStore.selecTO) || '',

				sendedProperties: Array.isArray(contact.sendedProperties) ? contact.sendedProperties : [],
				title: contact.title || '',
				typeOperation: contact.typeOperation || '',
				typeProperty: contact.typeProperty || ''
			};
			// console.log(cleanContactData.typeContact)

			// Añadir propiedades opcionales de tipo number solo si tienen un valor
			if (contact.lastContact) {
				cleanContactData.lastContact = contact.lastContact;
			}

			if (contact.lastResponse) {
				cleanContactData.lastResponse = contact.lastResponse;
			}

			// Asegurarse de que el contacto tenga un ID válido
			if (!cleanContactData.id || cleanContactData.id.trim() === '') {
				// Generar un ID único si no existe
				cleanContactData.id = generateUUID();
				// console.log('Generando nuevo ID para el contacto:', cleanContactData.id);
			}

			// Validación final del ID
			if (!cleanContactData.id || cleanContactData.id.trim() === '') {
				console.error('Error crítico: Fallo al asignar ID al contacto', cleanContactData);
				throw new Error('Error crítico: Fallo al asignar ID al contacto');
			}

			// Añadir fecha de creación si no existe
			if (!cleanContactData.createdAt) {
				cleanContactData.createdAt = Date.now();
			}

			// console.log('Guardando contacto con ID:', cleanContactData.id);
			console.log(
				'[AddContact] handleSubmit: cleanContactData (DATOS FINALES A GUARDAR):',
				cleanContactData
			);
			console.log('🔥🔥🔥 ESTE LOG DEBE APARECER - SI NO LO VES HAY PROBLEMA DE CACHE 🔥🔥🔥');

			// Guardar el contacto en Firebase
			console.log('💾 Iniciando guardado en Firebase...');
			console.log('💾 existingContact:', existingContact);
			console.log('💾 Operación:', existingContact ? 'UPDATE' : 'ADD');

			let result;
			if (existingContact) {
				console.log('📝 Ejecutando contactsStore.update...');
				result = await contactsStore.update(cleanContactData);
			} else {
				console.log('➕ Ejecutando contactsStore.add...');
				result = await contactsStore.add(cleanContactData);
			}

			console.log('🎯 Resultado de Firebase:', result);

			if (!result.success) {
				const errorMessage = result.error
					? typeof result.error === 'string'
						? result.error
						: JSON.stringify(result.error)
					: 'Error al guardar el contacto';
				throw new Error(errorMessage);
			}

			// Asegurarse de que el contacto tenga el ID correcto después de guardarlo
			if (!existingContact && result.success && 'id' in result && result.id) {
				cleanContactData.id = result.id;
			}

			// Forzar una actualización manual del store para asegurar que el contacto aparezca en la lista
			if (!existingContact) {
				// Obtener la lista actual de contactos
				const currentContacts = get(contactsStore);

				// Verificar si el contacto ya existe en la lista
				const existingIndex = currentContacts.findIndex((c) => c.id === cleanContactData.id);

				if (existingIndex >= 0) {
					// Actualizar el contacto existente
					currentContacts[existingIndex] = { ...cleanContactData };
				} else {
					// Añadir el nuevo contacto a la lista
					currentContacts.push({ ...cleanContactData });
				}

				// Actualizar el store con la nueva lista
				contactsStore.set([...currentContacts]);

				console.log('📊 Store actualizado exitosamente');
				// console.log('Contacto añadido/actualizado manualmente en el store:', cleanContactData);
			}

			console.log('🚀 Punto de control: llegando al código de n8n...');

			// IMPORTANTE: Enviar a n8n ANTES del dispatch para evitar interrupciones
			console.log('🔍 Verificando si enviar a n8n...');
			console.log('🔍 existingContact:', existingContact);
			console.log('🔍 Es contacto nuevo?', !existingContact);

			// Determinar si es un contacto nuevo basándose en el resultado de Firebase
			const isNewContact = !existingContact && result.success && 'id' in result;
			const isUpdatedContact = existingContact && result.success;
			console.log('🔍 Es contacto REALMENTE nuevo (por Firebase)?', isNewContact);
			console.log('🔍 Es contacto ACTUALIZADO?', isUpdatedContact);

			if (isNewContact) {
				console.log('✅ Enviando contacto NUEVO a n8n...');
				try {
					await sendToN8n(cleanContactData);
				} catch (n8nError) {
					console.error('❌ Error enviando a n8n:', n8nError);
					// No bloqueamos el flujo si n8n falla
				}
				// 🚀 TRIGGER WA AUTOMATION
				if (sendWelcomeWA) {
					try {
						const currentProp = get(propertyStore);
						// Solo enviar si hay propiedad seleccionada o al menos intentar
						triggerWAAutomation(cleanContactData, currentProp);
					} catch (waError) {
						console.error('❌ Error triggering WA:', waError);
					}
				}
			} else if (isUpdatedContact && cleanContactData.googleContactId) {
				console.log('📝 Actualizando contacto EXISTENTE en Google...');
				try {
					await updateContactInGoogle(cleanContactData);
				} catch (updateError) {
					console.error('❌ Error actualizando en Google:', updateError);
					// No bloqueamos el flujo si la actualización falla
				}
			} else {
				console.log('⏭️ SALTANDO sincronización - sin googleContactId o error de guardado');
			}

			// Emitir evento de éxito
			dispatch('success', { contact: cleanContactData });

			// Verificar nuevamente que el ID sea válido antes de redirigir
			if (cleanContactData.id && cleanContactData.id.trim() !== '') {
				// console.log('ID válido para redirección:', cleanContactData.id);

				// Establecer el estado del sistema para activar la sección de comentarios en la página de detalles
				$systStatus = 'addContact';

				// Redirigir a la página de detalles del contacto
				goto(`/contact/${cleanContactData.id}`);
			} else {
				console.error('Error: ID inválido después de guardar', cleanContactData);
			}
		} catch (error) {
			console.error('Error en handleSubmit:', error);
			// Manejar el error de manera segura verificando su tipo
			let errorMsg = 'Desconocido';
			if (error instanceof Error) {
				errorMsg = error.message;
			} else if (typeof error === 'string') {
				errorMsg = error;
			} else if (error && typeof error === 'object') {
				errorMsg = JSON.stringify(error);
			}
			errorMessage = `Error: ${errorMsg}`;
		} finally {
			isSubmitting = false;
			// $systStatus = '';
			// contact.propCont = '';
			// contact.selecTP = '';
			// contact.rangeProp = '';
		}
	}

	function handlePropertySelection(property: string) {
		if (selectedProperties.includes(property)) {
			// Si la propiedad ya está seleccionada, la eliminamos
			selectedProperties = selectedProperties.filter((p) => p !== property);
		} else {
			// Si la propiedad no está seleccionada, la agregamos
			selectedProperties = [...selectedProperties, property];
		}
	}

	async function onCancel() {
		if (isDirty) {
			if (!confirm('¿Está seguro que desea cancelar? Se perderán los cambios no guardados.')) {
				return;
			}
		}
		$systStatus = '';
		dispatch('cancel');
	}

	// Agregar función para manejar clics fuera del componente
	function handleClickOutside(event: MouseEvent) {
		const searchContainer = document.querySelector('.search-container');
		if (searchContainer && !searchContainer.contains(event.target as Node)) {
			showProp = false;
		}
	}

	// Agregar y remover el event listener cuando el componente se monta/desmonta
	onMount(() => {
		document.addEventListener('click', handleClickOutside);
	});

	onDestroy(() => {
		document.removeEventListener('click', handleClickOutside);
	});

	// Modificar la función searProp
	function searProp(searchTerm: string) {
		if (searchTerm.length !== 0) {
			showProp = true;
			propToRender = $propertiesStore.filter((property) => {
				const searchInfo =
					`${property.location} ${property.title} ${property.public_id}`.toLowerCase();
				return searchInfo.includes(searchTerm.toLowerCase());
			});
		} else {
			showProp = false;
			propToRender = [];
		}
	}

	// // Agregar esta función
	// const autofocus = (node: HTMLElement) => {
	//     node.focus();
	// };

	// Función reactiva que no hace nada con el footer
	$: {
		if (showProp && propToRender.length > 0) {
			// No hacemos nada con el footer
		} else {
			// No hacemos nada con el footer
		}
	}
</script>

<div class="cont__alta">
	<h1 class="title">Alta de Contacto</h1>
	<form on:submit|preventDefault={handleSubmit} id="altaContactos" class="form-container">
		{#if erroresFormulario.general}
			<div class="error-message">
				{erroresFormulario.general}
			</div>
		{/if}

		<div class="features">
			<div class="inp__lat">
				<div class="input-group">
					<InputText
						identifier="name"
						name="Nombre *"
						bind:value={contact.name}
						on:blur={() => handleBlur('name')}
					/>
					{#if camposModificados.name && erroresFormulario.name}
						<span class="field-error">{erroresFormulario.name}</span>
					{/if}
				</div>

				<div class="input-group">
					<InputText
						identifier="lastname"
						name="Apellido"
						bind:value={contact.lastname}
						on:blur={() => handleBlur('lastname')}
					/>
					{#if camposModificados.lastname && erroresFormulario.lastname}
						<span class="field-error">{erroresFormulario.lastname}</span>
					{/if}
				</div>
			</div>

			<div class="inp__lat">
				<div class="input-group">
					<InputText
						identifier="telephon"
						name="Teléfono *"
						bind:value={contact.telephon}
						on:blur={() => handleBlur('telephon')}
					/>
					{#if camposModificados.telephon && erroresFormulario.telephon}
						<span class="field-error">{erroresFormulario.telephon}</span>
					{/if}
				</div>

				<div class="input-group">
					<InputEmail
						identifier="email"
						name="Email"
						bind:value={contact.email}
						on:blur={() => handleBlur('email')}
					/>
					{#if camposModificados.email && erroresFormulario.email}
						<span class="field-error">{erroresFormulario.email}</span>
					{/if}
				</div>
			</div>

			<div class="inp__lat">
				<InputOptions
					identificador="typeContact"
					name="Tipo de Contacto"
					choices={typeContacts}
					value={contact.typeContact}
					on:change={(e) => (contact.typeContact = e.detail)}
				/>
				<InputOptions
					identificador="selecMC"
					name="Modo de Contacto"
					choices={modeContact}
					value={contact.selecMC}
					on:change={(e) => (contact.selecMC = e.detail)}
				/>
			</div>

			<div class="inp__lat">
				<textarea class="notes" placeholder="Notas adicionales..." bind:value={contact.notes}
				></textarea>
			</div>

			<!-- Agregar el componente de búsqueda aquí -->
			<div class="search-container">
				<Search
					placeHolder="Buscar propiedad..."
					bind:searchTerm
					on:input={() => searProp(searchTerm)}
				/>

				{#if showProp && propToRender.length > 0}
					<div class="search-results">
						{#each propToRender as property}
							<div class="property-item">
								<div class="card-wrapper">
									<CardProperty
										{property}
										selectable={true}
										isSelected={contact.propCont === property.public_id}
										onSelect={() => {
											contact.propCont = property.public_id;
											contact.selecTP = property.property_type || '';
											(contact.typeContact = convertOperationEbFb(property.selecTO) || ''),
												(contact.rangeProp = property.price ? ranPrice(property.price) : '');
											// Guardar la propiedad seleccionada en el store
											propertyStore.set(property);
											// Si se quisiera que el precio de la propiedad llene el presupuesto:
											// contact.budget = property.price || 0;
											// budgetStringForInput = String(contact.budget);
											propToRender = [];
											showProp = false;
											searchTerm = '';
										}}
									/>
								</div>
							</div>
						{/each}
					</div>
				{:else if showProp && searchTerm}
					<div class="no-results">No se encontraron propiedades</div>
				{/if}
			</div>

			<!-- Botón para mostrar campos adicionales -->
			<div class="form-actions">
				<Button
					element="button"
					type="button"
					variant="solid"
					style="background-color: #6b21a8; border-color: #6b21a8;"
					on:click={() => (showAdditionalFields = !showAdditionalFields)}
				>
					{showAdditionalFields ? 'Ocultar campos adicionales' : 'Mostrar campos adicionales'}
				</Button>
			</div>

			{#if showAdditionalFields}
				<div class="additional-fields">
					<div class="inp__lat">
						<InputOptions
							identificador="selecTP"
							name="Tipo de Propiedad"
							choices={typeProperties}
							value={contact.selecTP ? String(contact.selecTP) : ''}
							on:change={(e) => (contact.selecTP = e.detail)}
						/>

						<InputOptions
							identificador="modePay"
							name="Modo de Pago"
							choices={modePays}
							value={contact.modePay ? String(contact.modePay) : ''}
							on:change={(e) => (contact.modePay = e.detail)}
						/>

						<InputOptions
							identificador="contactStage"
							name="Etapa"
							choices={contStage}
							value={contact.contactStage ? String(contact.contactStage) : ''}
							on:change={(e) => (contact.contactStage = e.detail)}
						/>
					</div>
					<div class="inp__lat">
						<InputText identifier="budget" name="Presupuesto" bind:value={budgetStringForInput} />
						<InputOptions
							identificador="rangeProp"
							name="Rango de Propiedad"
							choices={range}
							value={contact.rangeProp ? String(contact.rangeProp) : ''}
							on:change={(e) => (contact.rangeProp = e.detail)}
						/>
					</div>

					<div class="inp__lat">
						<InputOptions
							identificador="numBeds"
							name="Recámaras"
							choices={oneToFive}
							value={contact.numBeds ? String(contact.numBeds) : ''}
							on:change={(e) => (contact.numBeds = e.detail)}
						/>
						<InputOptions
							identificador="numBaths"
							name="Baños Completos"
							choices={oneToFour}
							value={contact.numBaths ? String(contact.numBaths) : ''}
							on:change={(e) => (contact.numBaths = e.detail)}
						/>
					</div>

					<div class="inp__lat">
						<InputOptions
							identificador="halfBathroom"
							name="Medios Baños"
							choices={oneToThree}
							value={contact.halfBathroom ? String(contact.halfBathroom) : ''}
							on:change={(e) => (contact.halfBathroom = e.detail)}
						/>
						<InputOptions
							identificador="numParks"
							name="Estacionamientos"
							choices={oneToFour}
							value={contact.numParks ? String(contact.numParks) : ''}
							on:change={(e) => (contact.numParks = e.detail)}
						/>
					</div>

					<div class="inp__lat">
						<Tags bind:propTags={contact.tagsProperty} />
						<Ubication bind:ubication={contact.locaProperty} />
					</div>
				</div>
			{/if}

			<div class="form-actions wa-toggle">
				<label class="toggle-container">
					<input type="checkbox" bind:checked={sendWelcomeWA} />
					<span class="toggle-label">Enviar bienvenida por WA</span>
				</label>
			</div>

			<div class="form-actions">
				<Button
					element="button"
					type="submit"
					variant="solid"
					disabled={isSubmitting || Object.values(erroresFormulario).some((error) => error)}
				>
					{isSubmitting ? 'Guardando...' : 'Guardar'}
				</Button>

				<Button element="button" type="button" variant="danger" on:click={onCancel}>
					Cancelar
				</Button>
			</div>
		</div>
	</form>
</div>

<!-- Notificación automática (solo errores) -->
{#if showNotification}
	<div
		class="auto-notification"
		class:show={showNotification}
		class:error={notificationType === 'error'}
		class:success={notificationType === 'success'}
	>
		<span class="notification-text">{notificationMessage}</span>
	</div>
{/if}

{#if showFooter}
	<!-- Aquí va el contenido del footer -->
{/if}

<style>
	.form-container {
		max-width: 800px;
		margin: 0 auto;
		padding: 20px;
		font-family: 'Poppins', sans-serif;
	}

	.title {
		text-align: center;
		color: #6b21a8;
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid #6b21a8;
		font-family: 'Poppins', sans-serif;
	}

	.input-group {
		position: relative;
		flex: 1;
	}

	.field-error {
		color: #ff3e3e;
		font-size: 0.8rem;
		margin-top: 4px;
		position: absolute;
		bottom: -20px;
	}

	.error-message {
		background-color: #fff1f1;
		border: 1px solid #ff3e3e;
		color: #ff3e3e;
		padding: 10px;
		border-radius: 4px;
		margin-bottom: 20px;
	}

	.form-actions {
		display: flex;
		gap: 10px;
		justify-content: center;
		margin-top: 20px;
	}

	.features {
		display: flex;
		flex-direction: column;
		gap: 30px;
	}

	.inp__lat {
		display: flex;
		gap: 20px;
		position: relative;
		flex-wrap: wrap;
		justify-content: space-between;
	}

	:global(.inp__lat > div) {
		flex: 1;
		min-width: 150px;
	}

	.additional-fields {
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding: 20px;
		border: 2px solid #6b21a8;
		border-radius: 10px;
		background-color: rgba(107, 33, 168, 0.05);
		margin: 10px 0;
		box-sizing: border-box;
	}

	.notes {
		width: 100%;
		min-height: 100px;
		padding: 10px;
		border: 1px solid #ccc;
		border-radius: 4px;
		resize: vertical;
	}

	.search-container {
		position: relative;
		width: 100%;
		z-index: 100;
	}

	.search-results {
		width: 100%;
		background: #1f1f1f;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0 0 4px 4px; /* Opcional: ajustar si se ve raro sin el input arriba */
		box-shadow:
			0 2px 4px rgba(0, 0, 0, 0.3),
			0 8px 16px rgba(0, 0, 0, 0.5);
		z-index: 100;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		padding: 1rem;
		max-height: 850px; /* Limita la altura máxima en pantallas grandes */
		overflow-y: auto; /* Añade scroll vertical si es necesario */
		margin-top: 5px; /* Opcional: añade un pequeño espacio tras la barra de búsqueda */
	}

	.no-results {
		padding: 1rem;
		text-align: center;
		color: #ccc;
		background: #2a2a2a;
		border-radius: 4px;
		grid-column: 1 / -1;
	}

	.property-item {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 8px;
		overflow: hidden;
		position: relative;
		transition:
			transform 0.2s,
			box-shadow 0.2s;
		cursor: pointer;
		z-index: 100;
	}

	.property-item:hover {
		transform: translateY(-5px);
	}

	.card-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
		z-index: 100;
	}

	/* .property-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 10px 0;
    }
  
    .property-table td {
        padding: 0;
        border: none;
        width: 33.33%;
        vertical-align: top;
    } */

	:global(.property-table .in__sel) {
		width: 100%;
		font-size: 0.8rem;
		padding-right: 15px;
	}

	:global(.property-table .label__title) {
		width: 100%;
		font-size: 0.85rem;
	}

	@media (max-width: 600px) {
		/* .property-table, .property-table tbody, .property-table tr {
            display: block;
            width: 100%;
        }
  
        .property-table td {
            display: block;
            width: 100%;
            margin-bottom: 10px;
        } */

		.inp__lat {
			flex-direction: column;
			gap: 15px;
		}

		/* Ajuste para pantallas angostas */
		.search-results {
			max-height: 80vh; /* Limitar altura en pantallas pequeñas usando viewport height */
		}
	}

	/* Estilos para notificación automática (solo errores) */
	.auto-notification {
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 9999;
		padding: 16px 24px;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		font-family: 'Poppins', sans-serif;
		font-weight: 500;
		max-width: 400px;
		transform: translateX(120%);
		opacity: 0;
		transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		will-change: transform, opacity;
		background-color: #333;
		color: white;
		border-left: 4px solid #6b21a8;
	}

	.auto-notification.error {
		background-color: #ef4444;
		border-left: 4px solid #dc2626;
	}

	.auto-notification.success {
		background-color: #10b981;
		border-left: 4px solid #059669;
	}

	.auto-notification.show {
		transform: translateX(0);
		opacity: 1;
	}

	.notification-text {
		font-size: 14px;
		line-height: 1.4;
		white-space: nowrap;
	}
</style>
