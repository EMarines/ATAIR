<!-- src/routes/login/+page.svelte -->
<!-- Pantalla de Login y Registro de Asociados para ATAIR CRM con Estética Oscura Original -->

<script lang="ts">
	import {
		loginWithEmailPassword,
		registerWithEmailPassword,
		sendPasswordReset,
		userStore,
		userProfile,
		authLoading,
		authInitialized,
		setDevRole
	} from '$lib/firebase/authManager';
	import { notifications } from '$lib/stores/notificationStore';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { empresa } from '$lib/config/empresa';

	let email = '';
	let password = '';
	let name = '';
	let phone = '';
	let city_id = 'cuu';
	let isLoading = false;
	let error: string | null = null;
	let mode: 'login' | 'register' | 'forgot' = 'login';
	let rememberMe = true;

	const redirectUrl = $page.url.searchParams.get('redirect') || '/';

	onMount(() => {
		const savedEmail = localStorage.getItem('atair_saved_email');
		if (savedEmail) {
			email = savedEmail;
		}

		if ($userStore || $userProfile) {
			goto(redirectUrl);
		}
	});

	$: if ($authInitialized && ($userStore || $userProfile)) {
		goto(redirectUrl);
	}

	function resetForm() {
		password = '';
		error = null;
	}

	async function handleSubmit() {
		if (!email) {
			error = 'Por favor ingresa tu correo electrónico';
			return;
		}

		if (mode !== 'forgot' && !password) {
			error = 'Por favor ingresa tu contraseña';
			return;
		}

		try {
			isLoading = true;
			error = null;

			if (mode === 'login') {
				const res = await loginWithEmailPassword(email, password);
				if (res.success) {
					if (rememberMe) {
						localStorage.setItem('atair_saved_email', email);
					} else {
						localStorage.removeItem('atair_saved_email');
					}
					notifications.success('¡Bienvenido a ATAIR CRM!');
					await goto(redirectUrl);
				} else {
					error = translateFirebaseError(res.code || '');
					resetForm();
				}
			} else if (mode === 'register') {
				if (!name.trim()) {
					error = 'Por favor ingresa tu nombre completo';
					isLoading = false;
					return;
				}

				const res = await registerWithEmailPassword(email, password, {
					name: name.trim(),
					phone: phone.trim(),
					city_id: city_id,
					role: 'asociado'
				});

				if (res.success) {
					notifications.success('Registro exitoso como Asociado');
					await goto(redirectUrl);
				} else {
					error = translateFirebaseError(res.code || '');
				}
			} else if (mode === 'forgot') {
				const res = await sendPasswordReset(email);
				if (res.success) {
					notifications.info('Enlace de recuperación enviado a tu correo');
					mode = 'login';
				} else {
					error = translateFirebaseError(res.code || '');
				}
			}
		} catch (err: any) {
			error = `Error inesperado: ${err?.message || 'Intenta de nuevo'}`;
		} finally {
			isLoading = false;
		}
	}

	function translateFirebaseError(code: string): string {
		const errorMap: Record<string, string> = {
			'auth/invalid-credential': 'Email o contraseña incorrectos.',
			'auth/user-not-found': 'No existe una cuenta registrada con este correo.',
			'auth/wrong-password': 'Contraseña incorrecta.',
			'auth/email-already-in-use': 'Este correo ya tiene una cuenta registrada.',
			'auth/invalid-email': 'Formato de correo no válido.',
			'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
			'auth/user-disabled': 'Esta cuenta ha sido deshabilitada por administración.',
			'auth/too-many-requests': 'Demasiados intentos fallidos. Intenta más tarde.',
			'auth/network-request-failed': 'Error de conexión. Verifica tu internet.'
		};
		return errorMap[code] || `Error de autenticación (${code || 'desconocido'})`;
	}
</script>

<svelte:head>
	<title>{mode === 'register' ? 'Registro Asociada' : 'Acceso'} | ATAIR CRM</title>
</svelte:head>

<div class="auth-page-container">
	<div class="auth-card">
		<!-- Cabecera de Marca -->
		<div class="card-brand">
			<div class="brand-badge">ATAIR CRM</div>
			<h2>{empresa.companyName}</h2>
			<p class="subtitle">
				{#if mode === 'login'}
					Acceso al Sistema de Gestión Inmobiliaria
				{:else if mode === 'register'}
					Alta de Nueva Asociada Comercial
				{:else}
					Recuperación de Contraseña
				{/if}
			</p>
		</div>

		<!-- Alerta de Error -->
		{#if error}
			<div class="error-banner" role="alert">
				<i class="fa-solid fa-circle-exclamation"></i>
				<span>{error}</span>
			</div>
		{/if}

		<!-- Formulario Principal -->
		<form on:submit|preventDefault={handleSubmit}>
			{#if mode === 'register'}
				<div class="input-group">
					<label for="name">Nombre Completo</label>
					<input
						id="name"
						type="text"
						bind:value={name}
						placeholder="Ej. Claudia Morales"
						disabled={isLoading}
						required
					/>
				</div>

				<div class="grid-2-cols">
					<div class="input-group">
						<label for="phone">Teléfono Móvil</label>
						<input
							id="phone"
							type="tel"
							bind:value={phone}
							placeholder="614 123 4567"
							disabled={isLoading}
						/>
					</div>

					<div class="input-group">
						<label for="city_id">Plaza / Ciudad</label>
						<select id="city_id" bind:value={city_id} disabled={isLoading}>
							<option value="cuu">Chihuahua (CUU)</option>
							<option value="del">Cd. Delicias (DEL)</option>
						</select>
					</div>
				</div>
			{/if}

			<div class="input-group">
				<label for="email">Correo Electrónico</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					placeholder="tu.correo@matchhome.com"
					disabled={isLoading}
					autocomplete="email"
					required
				/>
			</div>

			{#if mode !== 'forgot'}
				<div class="input-group">
					<div class="label-row">
						<label for="password">Contraseña</label>
						{#if mode === 'login'}
							<button
								type="button"
								class="forgot-link"
								on:click={() => { mode = 'forgot'; error = null; }}
							>
								¿Olvidaste tu contraseña?
							</button>
						{/if}
					</div>
					<input
						id="password"
						type="password"
						bind:value={password}
						placeholder="••••••••"
						disabled={isLoading}
						autocomplete={mode === 'register' ? 'new-password' : 'current-password'}
						required
					/>
				</div>
			{/if}

			{#if mode === 'login'}
				<div class="remember-row">
					<label class="checkbox-container">
						<input type="checkbox" bind:checked={rememberMe} />
						<span class="checkmark"></span>
						<span class="checkbox-text">Recordar usuario</span>
					</label>
				</div>
			{/if}

			<!-- Botón de Envío -->
			<button type="submit" class="submit-btn" disabled={isLoading}>
				{#if isLoading}
					<div class="btn-spinner"></div>
					<span>Procesando...</span>
				{:else if mode === 'login'}
					<i class="fa-solid fa-right-to-bracket"></i>
					<span>Entrar al CRM</span>
				{:else if mode === 'register'}
					<i class="fa-solid fa-user-plus"></i>
					<span>Registrarse como Asociada</span>
				{:else}
					<i class="fa-solid fa-paper-plane"></i>
					<span>Enviar Enlace</span>
				{/if}
			</button>
		</form>

		<!-- Opciones de Navegación entre Modos -->
		<div class="card-footer-options">
			{#if mode === 'login'}
				<p>
					¿Vas a colaborar con nosotros?
					<button type="button" class="mode-switch-btn" on:click={() => { mode = 'register'; resetForm(); }}>
						Regístrate aquí
					</button>
				</p>
			{:else}
				<p>
					¿Ya tienes cuenta activa?
					<button type="button" class="mode-switch-btn" on:click={() => { mode = 'login'; resetForm(); }}>
						Inicia sesión
					</button>
				</p>
			{/if}
		</div>

		<!-- Acceso Rápido Directo (Dev / Demostración / Dirección) -->
		<div class="dev-quick-access">
			<div class="dev-divider">
				<span>ACCESO DIRECTO RÁPIDO (CERO CONTRASEÑA)</span>
			</div>
			<div class="dev-buttons-row">
				<button
					type="button"
					class="btn-dev-admin"
					on:click={async () => {
						await setDevRole('admin');
						notifications.success('¡Sesión iniciada como Enrique Marines (Director Admin)!');
						await goto(redirectUrl === '/login' ? '/' : redirectUrl);
					}}
				>
					<i class="fa-solid fa-crown"></i>
					<span>Entrar como Administrador (Enrique Marines)</span>
				</button>
				<button
					type="button"
					class="btn-dev-asociado"
					on:click={async () => {
						await setDevRole('asociado');
						notifications.info('Sesión iniciada como Asociada de Campo (CUU)');
						await goto(redirectUrl === '/login' ? '/' : redirectUrl);
					}}
				>
					<i class="fa-solid fa-handshake"></i>
					<span>Entrar como Asociada (Prueba)</span>
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	/* Acceso Rápido Dev / Dirección */
	.dev-quick-access {
		margin-top: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		width: 100%;
	}

	.dev-divider {
		display: flex;
		align-items: center;
		text-align: center;
		color: #71717a;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.06em;
	}

	.dev-divider::before,
	.dev-divider::after {
		content: '';
		flex: 1;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.dev-divider span {
		padding: 0 0.6rem;
	}

	.dev-buttons-row {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.btn-dev-admin {
		background: linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(126, 34, 206, 0.25) 100%);
		border: 1px solid rgba(168, 85, 247, 0.5);
		color: #e9d5ff;
		border-radius: 8px;
		padding: 0.7rem 1rem;
		font-size: 0.88rem;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		transition: all 0.15s ease;
	}

	.btn-dev-admin:hover {
		background: linear-gradient(135deg, rgba(168, 85, 247, 0.4) 0%, rgba(126, 34, 206, 0.4) 100%);
		border-color: #c084fc;
		transform: translateY(-1px);
	}

	.btn-dev-asociado {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #d4d4d8;
		border-radius: 8px;
		padding: 0.65rem 1rem;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		transition: all 0.15s ease;
	}

	.btn-dev-asociado:hover {
		background: rgba(255, 255, 255, 0.08);
		color: #ffffff;
	}
	.auth-page-container {
		min-height: calc(100vh - 140px);
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 2rem 1rem;
		background: radial-gradient(circle at 50% 20%, rgba(12, 191, 246, 0.08) 0%, rgba(0, 0, 0, 0.95) 100%);
	}

	.auth-card {
		width: 100%;
		max-width: 440px;
		background-color: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 12px;
		padding: 2.25rem 2rem;
		box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
	}

	.card-brand {
		text-align: center;
		margin-bottom: 1.75rem;
	}

	.brand-badge {
		display: inline-block;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		background: rgba(12, 191, 246, 0.15);
		color: #0cbff6;
		border: 1px solid rgba(12, 191, 246, 0.35);
		padding: 0.2rem 0.65rem;
		border-radius: 9999px;
		margin-bottom: 0.6rem;
		text-transform: uppercase;
	}

	.card-brand h2 {
		font-size: 1.6rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0;
	}

	.subtitle {
		font-size: 0.82rem;
		color: #a1a1aa;
		margin-top: 0.35rem;
	}

	.error-banner {
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.4);
		color: #fca5a5;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		font-size: 0.82rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 1.25rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
	}

	.grid-2-cols {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.85rem;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		text-align: left;
	}

	.label-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	label {
		font-size: 0.8rem;
		font-weight: 500;
		color: #d4d4d8;
	}

	input, select {
		width: 100%;
		padding: 0.75rem 0.9rem;
		background-color: #27272a;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 6px;
		color: #ffffff;
		font-size: 0.9rem;
		outline: none;
		transition: border-color 0.2s, box-shadow 0.2s;
	}

	input:focus, select:focus {
		border-color: #0cbff6;
		box-shadow: 0 0 0 2px rgba(12, 191, 246, 0.25);
	}

	input::placeholder {
		color: #71717a;
	}

	.forgot-link {
		background: none;
		border: none;
		color: #0cbff6;
		font-size: 0.75rem;
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
	}

	.forgot-link:hover {
		color: #38bdf8;
	}

	.remember-row {
		display: flex;
		align-items: center;
	}

	.checkbox-container {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.82rem;
		color: #a1a1aa;
	}

	.checkbox-container input[type="checkbox"] {
		width: 16px;
		height: 16px;
		accent-color: #0cbff6;
		cursor: pointer;
	}

	.submit-btn {
		margin-top: 0.5rem;
		padding: 0.85rem 1.25rem;
		background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
		border: 1px solid rgba(12, 191, 246, 0.4);
		border-radius: 8px;
		color: #ffffff;
		font-size: 0.92rem;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);
		transition: all 0.2s ease;
	}

	.submit-btn:hover:not(:disabled) {
		background: linear-gradient(135deg, #0369a1 0%, #075985 100%);
		transform: translateY(-1px);
		box-shadow: 0 6px 20px rgba(2, 132, 199, 0.45);
	}

	.submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-spinner {
		width: 18px;
		height: 18px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-left-color: #ffffff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.card-footer-options {
		margin-top: 1.75rem;
		text-align: center;
		font-size: 0.82rem;
		color: #a1a1aa;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		padding-top: 1.25rem;
	}

	.mode-switch-btn {
		background: none;
		border: none;
		color: #0cbff6;
		font-weight: 600;
		cursor: pointer;
		text-decoration: underline;
		margin-left: 0.25rem;
		padding: 0;
	}

	.mode-switch-btn:hover {
		color: #38bdf8;
	}
</style>
