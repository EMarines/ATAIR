<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '$lib/firebase_toggle';
	import { collection, getDocs, doc, deleteDoc, addDoc, setDoc } from 'firebase/firestore';
	import { goto } from '$app/navigation';
	import { requireAuth } from '$lib/firebase/authManager';

	// Variables de estado
	let loading = true;
	let analyzing = false;
	let contacts = [];
	let binnacles = [];
	let orphanedBinnacles = [];
	let validBinnacles = [];
	let analysisComplete = false;
	let showBackup = false;
	let backupData = null;

	// Estadísticas
	let stats = {
		totalContacts: 0,
		totalBinnacles: 0,
		orphanedCount: 0,
		validCount: 0,
		percentageToDelete: 0
	};

	// Estados del proceso
	let step = 'analysis'; // 'analysis', 'backup', 'cleanup', 'complete', 'restore'
	let cleanupProgress = 0;
	let cleanupStatus = '';
	let restoreProgress = 0;
	let restoreStatus = '';
	let selectedFile = null;
	let autoMode = false; // Modo automático: backup + limpieza en un paso

	onMount(async () => {
		// Verificar autenticación
		await requireAuth();
		await loadData();
	});

	/**
	 * Carga todos los datos necesarios para el análisis
	 */
	async function loadData() {
		try {
			console.log('🔍 Iniciando carga de datos...');

			// Cargar contactos
			const contactsSnapshot = await getDocs(collection(db, 'contacts'));
			contacts = contactsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data()
			}));

			// Cargar binnacles
			const binnaclesSnapshot = await getDocs(collection(db, 'binnacles'));
			binnacles = binnaclesSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data()
			}));

			console.log(`📊 Datos cargados: ${contacts.length} contactos, ${binnacles.length} binnacles`);

			loading = false;
		} catch (error) {
			console.error('❌ Error cargando datos:', error);
			loading = false;
		}
	}

	/**
	 * Analiza qué binnacles están huérfanas (sin contacto asociado)
	 */
	async function analyzeData() {
		analyzing = true;

		try {
			console.log('🔍 Iniciando análisis de datos...');

			// Crear set de IDs de contactos existentes para búsqueda rápida
			const contactIds = new Set(contacts.map((contact) => contact.id));
			console.log(
				'📝 IDs de contactos encontrados:',
				Array.from(contactIds).slice(0, 5),
				'... (total:',
				contactIds.size,
				')'
			);

			// Mostrar algunos ejemplos de binnacles para debug
			console.log(
				'📝 Ejemplos de binnacles:',
				binnacles.slice(0, 3).map((b) => ({ id: b.id, to: b.to, action: b.action }))
			);

			// Separar binnacles en válidas y huérfanas
			orphanedBinnacles = [];
			validBinnacles = [];

			for (const binnacle of binnacles) {
				const target = (binnacle.to || binnacle.contactId || '').trim();
				// Si está asociado a un contacto existente, es válida
				if (target && contactIds.has(target)) {
					validBinnacles.push(binnacle);
				} else if (target.startsWith('Tel:') || target.startsWith('+') || /^\d{10}$/.test(target)) {
					// Envío directo a teléfono sin contacto registrado (preservar)
					validBinnacles.push(binnacle);
				} else if (target) {
					// Tiene un ID de contacto que ya no existe en contacts (huérfana real)
					orphanedBinnacles.push(binnacle);
				}
			}

			// Calcular estadísticas
			stats = {
				totalContacts: contacts.length,
				totalBinnacles: binnacles.length,
				orphanedCount: orphanedBinnacles.length,
				validCount: validBinnacles.length,
				percentageToDelete:
					binnacles.length > 0 ? Math.round((orphanedBinnacles.length / binnacles.length) * 100) : 0
			};

			analysisComplete = true;
			console.log('✅ Análisis completado:', stats);
		} catch (error) {
			console.error('❌ Error en análisis:', error);
		} finally {
			analyzing = false;
		}
	}

	/**
	 * Genera backup de todas las binnacles antes de cualquier modificación
	 */
	async function createBackup() {
		try {
			console.log('💾 Creando backup de binnacles...');

			backupData = {
				timestamp: new Date().toISOString(),
				totalBinnacles: binnacles.length,
				binnacles: binnacles
			};

			// Crear archivo de descarga
			const backupJson = JSON.stringify(backupData, null, 2);
			const blob = new Blob([backupJson], { type: 'application/json' });
			const url = URL.createObjectURL(blob);

			const a = document.createElement('a');
			a.href = url;
			a.download = `binnacles_backup_${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			showBackup = true;
			console.log('✅ Backup creado exitosamente');
		} catch (error) {
			console.error('❌ Error creando backup:', error);
		}
	}

	/**
	 * Ejecuta limpieza automática: backup + limpieza en un solo proceso
	 */
	async function executeAutoCleanup() {
		if (
			!confirm(
				`¿Realizar limpieza automática?\n\nEsto hará:\n1. Backup automático de todas las binnacles\n2. Eliminación de ${orphanedBinnacles.length} binnacles huérfanas\n\n¿Continuar?`
			)
		) {
			return;
		}

		step = 'cleanup';
		cleanupProgress = 0;

		try {
			// Paso 1: Crear backup automáticamente
			cleanupStatus = 'Creando backup automático...';
			console.log('💾 Creando backup automático...');

			const backupData = {
				timestamp: new Date().toISOString(),
				totalBinnacles: binnacles.length,
				binnacles: binnacles
			};

			const backupJson = JSON.stringify(backupData, null, 2);
			const blob = new Blob([backupJson], { type: 'application/json' });
			const url = URL.createObjectURL(blob);

			const a = document.createElement('a');
			a.href = url;
			a.download = `auto_backup_binnacles_${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			cleanupProgress = 10;
			await new Promise((resolve) => setTimeout(resolve, 1000)); // Pausa para que el usuario vea el backup

			// Paso 2: Ejecutar limpieza
			console.log('🧹 Iniciando limpieza automática...');

			for (let i = 0; i < orphanedBinnacles.length; i++) {
				const binnacle = orphanedBinnacles[i];
				cleanupStatus = `Eliminando binnacle ${i + 1}/${orphanedBinnacles.length}: ${binnacle.id}`;

				await deleteDoc(doc(db, 'binnacles', binnacle.id));

				// Progreso del 10% al 100%
				cleanupProgress = 10 + Math.round(((i + 1) / orphanedBinnacles.length) * 90);

				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			step = 'complete';
			console.log('✅ Limpieza automática completada exitosamente');
		} catch (error) {
			console.error('❌ Error durante la limpieza automática:', error);
			cleanupStatus = `Error: ${error.message}`;
		}
	}

	/**
	 * Ejecuta la limpieza de binnacles huérfanas
	 */
	async function executeCleanup() {
		if (
			!confirm(
				`¿Estás seguro de que quieres eliminar ${orphanedBinnacles.length} binnacles huérfanas?\n\nEsta acción NO se puede deshacer (aunque tienes el backup).`
			)
		) {
			return;
		}

		step = 'cleanup';
		cleanupProgress = 0;

		try {
			console.log('🧹 Iniciando limpieza de binnacles huérfanas...');

			for (let i = 0; i < orphanedBinnacles.length; i++) {
				const binnacle = orphanedBinnacles[i];
				cleanupStatus = `Eliminando binnacle ${i + 1}/${orphanedBinnacles.length}: ${binnacle.id}`;

				// Eliminar documento de Firestore
				await deleteDoc(doc(db, 'binnacles', binnacle.id));

				cleanupProgress = Math.round(((i + 1) / orphanedBinnacles.length) * 100);

				// Pequeña pausa para no saturar Firestore
				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			step = 'complete';
			console.log('✅ Limpieza completada exitosamente');
		} catch (error) {
			console.error('❌ Error durante la limpieza:', error);
			cleanupStatus = `Error: ${error.message}`;
		}
	}

	/**
	 * Maneja la selección de archivo para restaurar
	 */
	function handleFileSelect(event) {
		selectedFile = event.target.files[0];
	}

	/**
	 * Restaura las binnacles desde un archivo de backup
	 */
	async function restoreFromBackup() {
		if (!selectedFile) {
			alert('Por favor selecciona un archivo de backup primero');
			return;
		}

		if (
			!confirm(
				`¿Estás seguro de que quieres restaurar las binnacles desde el backup?\n\nEsto agregará todas las binnacles del backup a la base de datos actual.`
			)
		) {
			return;
		}

		step = 'restore';
		restoreProgress = 0;

		try {
			console.log('📥 Iniciando restauración desde backup...');

			// Leer el archivo JSON
			const fileContent = await selectedFile.text();
			const backupData = JSON.parse(fileContent);

			if (!backupData.binnacles || !Array.isArray(backupData.binnacles)) {
				throw new Error('El archivo no contiene binnacles válidas');
			}

			const binnacles = backupData.binnacles;
			console.log(`📦 Restaurando ${binnacles.length} binnacles...`);

			// Restaurar cada binnacle
			for (let i = 0; i < binnacles.length; i++) {
				const binnacle = binnacles[i];
				restoreStatus = `Restaurando binnacle ${i + 1}/${binnacles.length}: ${binnacle.id || 'Sin ID'}`;

				// Crear documento en Firestore
				// Si tiene ID, usar setDoc, si no, usar addDoc
				if (binnacle.id) {
					// Remover el ID del objeto para evitar conflictos
					const { id, ...binnacleData } = binnacle;
					await setDoc(doc(db, 'binnacles', id), binnacleData);
				} else {
					await addDoc(collection(db, 'binnacles'), binnacle);
				}

				restoreProgress = Math.round(((i + 1) / binnacles.length) * 100);

				// Pequeña pausa para no saturar Firestore
				await new Promise((resolve) => setTimeout(resolve, 50));
			}

			console.log('✅ Restauración completada exitosamente');
			alert(
				`✅ Restauración completada!\n\n${binnacles.length} binnacles restauradas exitosamente.`
			);

			// Recargar datos para reflejar los cambios
			await loadData();
			step = 'analysis';
		} catch (error) {
			console.error('❌ Error durante la restauración:', error);
			restoreStatus = `Error: ${error.message}`;
			alert(`❌ Error durante la restauración: ${error.message}`);
		}
	}

	/**
	 * Navega de vuelta al inicio
	 */
	function goHome() {
		goto('/');
	}
</script>

<svelte:head>
	<title>🧹 Limpieza de Binnacles - ATAIR</title>
</svelte:head>

<main class="cleanup-container">
	<header>
		<h1>🧹 Limpieza de Binnacles Huérfanas</h1>
		<p class="warning">⚠️ Herramienta de administración - Usar con precaución</p>
		<div class="info-note">
			<p>
				<strong>📝 Nota:</strong> A partir de ahora, cuando elimines un contacto, su bitácora se borrará
				automáticamente. Esta herramienta es para limpiar registros históricos huérfanos.
			</p>
		</div>
	</header>

	{#if loading}
		<div class="loading">
			<div class="spinner"></div>
			<p>Cargando datos de Firebase...</p>
		</div>
	{:else if step === 'analysis'}
		<div class="analysis-section">
			<div class="data-summary">
				<h2>📊 Resumen de Datos</h2>
				<div class="stats-grid">
					<div class="stat-card">
						<span class="number">{contacts.length}</span>
						<span class="label">Contactos Activos</span>
					</div>
					<div class="stat-card">
						<span class="number">{binnacles.length}</span>
						<span class="label">Binnacles Totales</span>
					</div>
				</div>
			</div>

			{#if !analysisComplete}
				<div class="action-section">
					<button class="analyze-btn" on:click={analyzeData} disabled={analyzing}>
						{analyzing ? '🔍 Analizando...' : '🔍 Analizar Datos'}
					</button>
				</div>
			{:else}
				<div class="results-section">
					<h2>📋 Resultados del Análisis</h2>
					<div class="stats-grid">
						<div class="stat-card valid">
							<span class="number">{stats.validCount}</span>
							<span class="label">Binnacles Válidas</span>
							<span class="sublabel">(Se mantendrán)</span>
						</div>
						<div class="stat-card danger">
							<span class="number">{stats.orphanedCount}</span>
							<span class="label">Binnacles Huérfanas</span>
							<span class="sublabel">(Se eliminarán - {stats.percentageToDelete}%)</span>
						</div>
					</div>

					{#if orphanedBinnacles.length > 0}
						<div class="orphaned-list">
							<h3>🗑️ Binnacles que se eliminarán:</h3>
							<div class="list-container">
								{#each orphanedBinnacles.slice(0, 10) as binnacle}
									<div class="orphaned-item">
										<strong>ID:</strong>
										{binnacle.id}<br />
										<strong>ContactID (to):</strong>
										{binnacle.to || 'Sin contacto asociado'}<br />
										<strong>Fecha:</strong>
										{binnacle.date ? new Date(binnacle.date).toLocaleString() : 'Sin fecha'}<br />
										<strong>Acción:</strong>
										{binnacle.action || 'Sin acción'}<br />
										<strong>Comentario:</strong>
										{(binnacle.comment || '').substring(0, 50)}...
									</div>
								{/each}
								{#if orphanedBinnacles.length > 10}
									<p class="more-items">...y {orphanedBinnacles.length - 10} más</p>
								{/if}
							</div>
						</div>
					{/if}

					<div class="action-buttons">
						<!-- Modo Automático -->
						{#if orphanedBinnacles.length > 0}
							<button class="auto-cleanup-btn" on:click={executeAutoCleanup}>
								⚡ Limpieza Automática
								<small>Backup + Limpieza en un paso</small>
							</button>
						{/if}

						<!-- Modo Manual -->
						<div class="manual-section">
							<h4>🔧 Modo Manual:</h4>
							<button class="backup-btn" on:click={createBackup}> 💾 Crear Backup Primero </button>

							{#if showBackup}
								<button
									class="cleanup-btn danger"
									on:click={executeCleanup}
									disabled={orphanedBinnacles.length === 0}
								>
									🧹 Ejecutar Limpieza ({orphanedBinnacles.length} items)
								</button>
							{/if}
						</div>
					</div>

					<!-- Sección de Restauración -->
					<div class="restore-section">
						<h3>📥 Restaurar desde Backup</h3>
						<p class="restore-info">
							Si necesitas restaurar las binnacles desde un backup anterior:
						</p>

						<div class="file-input-container">
							<input
								type="file"
								accept=".json"
								on:change={handleFileSelect}
								id="backup-file"
								class="file-input"
							/>
							<label for="backup-file" class="file-label">
								{selectedFile
									? `Archivo: ${selectedFile.name}`
									: '📁 Seleccionar archivo de backup (.json)'}
							</label>
						</div>

						{#if selectedFile}
							<button class="restore-btn" on:click={restoreFromBackup}>
								📥 Restaurar Binnacles desde Backup
							</button>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{:else if step === 'cleanup'}
		<div class="cleanup-progress">
			<h2>🧹 Limpieza en Progreso</h2>
			<div class="progress-bar">
				<div class="progress-fill" style="width: {cleanupProgress}%"></div>
				<span class="progress-text">{cleanupProgress}%</span>
			</div>
			<p class="cleanup-status">{cleanupStatus}</p>
			<p class="warning">⚠️ No cierres esta página hasta que termine</p>
		</div>
	{:else if step === 'restore'}
		<div class="restore-progress">
			<h2>📥 Restauración en Progreso</h2>
			<div class="progress-bar">
				<div class="progress-fill" style="width: {restoreProgress}%"></div>
				<span class="progress-text">{restoreProgress}%</span>
			</div>
			<p class="restore-status">{restoreStatus}</p>
			<p class="warning">⚠️ No cierres esta página hasta que termine</p>
		</div>
	{:else if step === 'complete'}
		<div class="complete-section">
			<div class="success-icon">✅</div>
			<h2>¡Limpieza Completada!</h2>
			<div class="final-stats">
				<p><strong>Binnacles eliminadas:</strong> {orphanedBinnacles.length}</p>
				<p><strong>Binnacles conservadas:</strong> {validBinnacles.length}</p>
				<p><strong>Espacio liberado:</strong> ~{orphanedBinnacles.length} documentos</p>
			</div>

			<div class="final-actions">
				<button class="home-btn" on:click={goHome}> 🏠 Volver al Inicio </button>
				<button class="reload-btn" on:click={() => window.location.reload()}>
					🔄 Ejecutar Otra Limpieza
				</button>
			</div>
		</div>
	{/if}
</main>

<style>
	.cleanup-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
		background: #1a1a1a;
		color: white;
		min-height: 100vh;
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
	}

	header h1 {
		font-size: 2.5rem;
		margin-bottom: 0.5rem;
		color: #ff6b35;
	}

	.warning {
		color: #ffaa00;
		font-weight: bold;
		font-size: 1.1rem;
	}

	.info-note {
		background: #1e3a5f;
		border: 2px solid #2196f3;
		border-radius: 8px;
		padding: 1rem;
		margin-top: 1rem;
		color: #e3f2fd;
	}

	.info-note p {
		margin: 0;
		font-size: 0.95rem;
	}

	.loading {
		text-align: center;
		padding: 4rem;
	}

	.spinner {
		width: 50px;
		height: 50px;
		border: 4px solid #333;
		border-top: 4px solid #ff6b35;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1rem;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin: 1rem 0;
	}

	.stat-card {
		background: #2d2d2d;
		padding: 1.5rem;
		border-radius: 8px;
		text-align: center;
		border: 2px solid #444;
	}

	.stat-card.valid {
		border-color: #4caf50;
	}

	.stat-card.danger {
		border-color: #f44336;
	}

	.stat-card .number {
		display: block;
		font-size: 2.5rem;
		font-weight: bold;
		color: #ff6b35;
	}

	.stat-card .label {
		display: block;
		font-size: 1.1rem;
		margin-top: 0.5rem;
	}

	.stat-card .sublabel {
		display: block;
		font-size: 0.9rem;
		color: #aaa;
		margin-top: 0.25rem;
	}

	.action-section {
		text-align: center;
		margin: 2rem 0;
	}

	.analyze-btn {
		background: #2196f3;
		color: white;
		border: none;
		padding: 1rem 2rem;
		font-size: 1.2rem;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.3s;
	}

	.analyze-btn:hover:not(:disabled) {
		background: #1976d2;
	}

	.analyze-btn:disabled {
		background: #666;
		cursor: not-allowed;
	}

	.orphaned-list {
		margin: 2rem 0;
	}

	.list-container {
		max-height: 400px;
		overflow-y: auto;
		background: #2d2d2d;
		border-radius: 8px;
		padding: 1rem;
	}

	.orphaned-item {
		background: #1a1a1a;
		margin-bottom: 1rem;
		padding: 1rem;
		border-radius: 4px;
		border-left: 4px solid #f44336;
		font-family: monospace;
		font-size: 0.9rem;
	}

	.more-items {
		text-align: center;
		color: #aaa;
		font-style: italic;
	}

	.action-buttons {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		justify-content: center;
		margin-top: 2rem;
	}

	.auto-cleanup-btn {
		background: linear-gradient(135deg, #ff6b35, #ff8f65);
		color: white;
		border: none;
		padding: 1.5rem 2rem;
		font-size: 1.3rem;
		font-weight: bold;
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.auto-cleanup-btn:hover {
		background: linear-gradient(135deg, #ff5722, #ff7043);
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(255, 107, 53, 0.4);
	}

	.auto-cleanup-btn small {
		font-size: 0.9rem;
		opacity: 0.9;
		font-weight: normal;
	}

	.manual-section {
		border: 2px dashed #555;
		padding: 1.5rem;
		border-radius: 8px;
		background: rgba(45, 45, 45, 0.3);
	}

	.manual-section h4 {
		margin: 0 0 1rem 0;
		color: #aaa;
		font-size: 1rem;
	}

	/* .manual-section .action-buttons {
    flex-direction: row;
    margin-top: 1rem;
  } */

	.backup-btn {
		background: #ff9800;
		color: white;
		border: none;
		padding: 1rem 2rem;
		font-size: 1.1rem;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.3s;
	}

	.backup-btn:hover {
		background: #f57c00;
	}

	.cleanup-btn {
		background: #f44336;
		color: white;
		border: none;
		padding: 1rem 2rem;
		font-size: 1.1rem;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.3s;
	}

	.cleanup-btn:hover:not(:disabled) {
		background: #d32f2f;
	}

	.cleanup-btn:disabled {
		background: #666;
		cursor: not-allowed;
	}

	.cleanup-progress {
		text-align: center;
		padding: 2rem;
	}

	.progress-bar {
		position: relative;
		width: 100%;
		height: 30px;
		background: #333;
		border-radius: 15px;
		overflow: hidden;
		margin: 2rem 0;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #4caf50, #8bc34a);
		transition: width 0.3s ease;
	}

	.progress-text {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-weight: bold;
		color: white;
		text-shadow: 1px 1px 2px black;
	}

	.cleanup-status {
		font-family: monospace;
		background: #2d2d2d;
		padding: 1rem;
		border-radius: 4px;
		margin: 1rem 0;
	}

	.restore-progress {
		text-align: center;
		padding: 2rem;
	}

	.restore-status {
		font-family: monospace;
		background: #2d2d2d;
		padding: 1rem;
		border-radius: 4px;
		margin: 1rem 0;
	}

	.restore-section {
		margin-top: 3rem;
		padding: 2rem;
		background: #2d2d2d;
		border-radius: 8px;
		border: 2px solid #4caf50;
	}

	.restore-section h3 {
		color: #4caf50;
		margin-bottom: 1rem;
	}

	.restore-info {
		color: #aaa;
		margin-bottom: 1.5rem;
	}

	.file-input-container {
		margin: 1rem 0;
	}

	.file-input {
		display: none;
	}

	.file-label {
		display: inline-block;
		background: #555;
		color: white;
		padding: 1rem 2rem;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.3s;
		border: 2px dashed #777;
	}

	.file-label:hover {
		background: #666;
		border-color: #4caf50;
	}

	.restore-btn {
		background: #4caf50;
		color: white;
		border: none;
		padding: 1rem 2rem;
		font-size: 1.1rem;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.3s;
		margin-top: 1rem;
	}

	.restore-btn:hover {
		background: #388e3c;
	}

	.complete-section {
		text-align: center;
		padding: 2rem;
	}

	.success-icon {
		font-size: 4rem;
		margin-bottom: 1rem;
	}

	.final-stats {
		background: #2d2d2d;
		padding: 2rem;
		border-radius: 8px;
		margin: 2rem 0;
	}

	.final-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		margin-top: 2rem;
	}

	.home-btn,
	.reload-btn {
		padding: 1rem 2rem;
		font-size: 1.1rem;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.3s;
	}

	.home-btn {
		background: #4caf50;
		color: white;
	}

	.home-btn:hover {
		background: #388e3c;
	}

	.reload-btn {
		background: #2196f3;
		color: white;
	}

	.reload-btn:hover {
		background: #1976d2;
	}

	@media (max-width: 768px) {
		.cleanup-container {
			padding: 1rem;
		}

		.action-buttons,
		.final-actions {
			flex-direction: column;
		}

		.stats-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
