<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { doc, updateDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase_toggle';
	import { sendWhatsApp } from '$lib/functions/whatsapp';
	import { infoToBinnacle } from '$lib/functions/binnSaver';
	import type { CopilotoTodoMeta, Todo } from '$lib/types';

	export let todoItem: Todo;

	const dispatch = createEventDispatcher<{
		complete: Todo;
		close: void;
		updated: void;
	}>();

	$: meta = (todoItem.copilotoMeta || {}) as CopilotoTodoMeta;

	let draftText = todoItem.copilotoMeta?.whatsappDraft || '';
	let isBusy = false;
	let feedbackMsg = '';

	$: if (todoItem?.id && todoItem.copilotoMeta?.whatsappDraft !== undefined && !draftText) {
		draftText = todoItem.copilotoMeta.whatsappDraft;
	}

	function cleanPhone(raw: string): string {
		return String(raw || '').replace(/\D/g, '');
	}

	async function executeWhatsAppSend() {
		if (!meta.telephon || isBusy) return;
		isBusy = true;
		feedbackMsg = '';
		try {
			sendWhatsApp(meta.telephon, draftText);

			if (
				(meta.stage === 'E4' || meta.stage === 'E1') &&
				Array.isArray(meta.propertyIds) &&
				meta.propertyIds.length > 0
			) {
				for (const propId of meta.propertyIds) {
					await infoToBinnacle({
						date: Date.now(),
						to: meta.contactId,
						comment: propId,
						action: 'Propiedad enviada: '
					});
				}
			} else {
				const isPausedCard = meta.stage === 'PAU' || Boolean(meta.isPausedCheckIn);
				const actionLabel = isPausedCard
					? 'Chequeo trimestral Pausado (Copiloto): '
					: meta.coldStep === 'step1_check'
						? 'Reactivación >180d Paso 1 (Copiloto): '
						: meta.coldStep === 'step2_send_link'
							? 'Reactivación >180d Paso 2 - Link /buscar (Copiloto): '
							: meta.stage === 'E3'
								? 'Formulario E3 enviado por WhatsApp: '
								: 'WhatsApp Copiloto enviado: ';
				await infoToBinnacle({
					date: Date.now(),
					to: meta.contactId,
					comment: draftText.slice(0, 220),
					action: actionLabel
				});
			}

			const isPausedCard = meta.stage === 'PAU' || Boolean(meta.isPausedCheckIn);
			const nowMs = Date.now();
			const contactPatch: Record<string, any> = {
				lastContact: nowMs
			};
			// En chequeo PAU: NO reactivar al cliente; permanece en pausa y se reprograma 3 meses más
			if (isPausedCard) {
				contactPatch.isActive = false;
				contactPatch.inactiveReason = 'pausado';
				contactPatch.reactivateAt = nowMs + 90 * 86_400_000;
			}

			await updateDoc(doc(db, 'contacts', meta.contactId), contactPatch).catch(() => {});

			feedbackMsg = isPausedCard
				? '✅ Chequeo enviado. El contacto sigue en PAUSA (próximo chequeo en 3 meses salvo que confirme reinicio).'
				: '✅ WhatsApp abierto y registrado en bitácora.';
			if (!todoItem.isCompleted) {
				dispatch('complete', todoItem);
			} else {
				dispatch('updated');
			}
		} catch (err: any) {
			feedbackMsg = '⚠️ Error al registrar envío: ' + (err?.message || err);
		} finally {
			isBusy = false;
		}
	}

	async function logCallOutcome(answered: boolean) {
		if (isBusy) return;
		isBusy = true;
		feedbackMsg = '';
		try {
			await infoToBinnacle({
				date: Date.now(),
				to: meta.contactId,
				action: answered ? 'Llamada concretada (Copiloto): ' : 'Llamada sin respuesta (Copiloto): ',
				comment: answered
					? `Contacto telefónico realizado. Objetivo: ${meta.objective}`
					: 'Se intentó llamada telefónica y no contestó.'
			});

			await updateDoc(doc(db, 'contacts', meta.contactId), {
				lastContact: Date.now(),
				...(answered ? { lastResponse: Date.now() } : {})
			}).catch(() => {});

			feedbackMsg = answered
				? '✅ Llamada registrada. Puedes actualizar la ficha o marcar completada.'
				: '📝 Llamada sin respuesta registrada en bitácora.';

			if (!todoItem.isCompleted) {
				dispatch('complete', todoItem);
			} else {
				dispatch('updated');
			}
		} catch (err: any) {
			feedbackMsg = '⚠️ Error al guardar llamada: ' + (err?.message || err);
		} finally {
			isBusy = false;
		}
	}

	async function applySuggestedStageChange() {
		const target = meta.suggestedStageChange;
		if (!target || target === 'NONE' || isBusy) return;
		isBusy = true;
		feedbackMsg = '';
		try {
			const stageLabel =
				target === 'E3'
					? 'Etapa 3 · Filtro / Reactivación'
					: target === 'E2'
						? 'Etapa 2 · Perfilamiento'
						: 'Etapa 4 · Búsqueda Activa';
			await updateDoc(doc(db, 'contacts', meta.contactId), {
				contactStage: stageLabel,
				stage: target
			});

			await infoToBinnacle({
				date: Date.now(),
				to: meta.contactId,
				action: 'Cambio de etapa (Copiloto): ',
				comment: `Movido de ${meta.stage} a ${stageLabel} por criterio de seguimiento.`
			});

			feedbackMsg = `✅ Contacto movido a ${stageLabel}.`;
			if (!todoItem.isCompleted) {
				dispatch('complete', todoItem);
			} else {
				dispatch('updated');
			}
		} catch (err: any) {
			feedbackMsg = '⚠️ No se pudo cambiar etapa: ' + (err?.message || err);
		} finally {
			isBusy = false;
		}
	}

	function confirmProposedClose() {
		if (!todoItem.isCompleted) {
			dispatch('complete', todoItem);
		}
	}

	async function copyQuickStep2Reply() {
		if (!meta.e3FormUrl) return;
		const firstName = String(meta.fullName || '').trim().split(/\s+/)[0] || '';
		const greeting = firstName ? `Hola ${firstName}, ` : 'Hola, ';
		const replyMsg = `${greeting}te envío el link para que nos digas qué características tiene la casa de tus sueños y poder buscártela:\n\n${meta.e3FormUrl}`;
		try {
			await navigator.clipboard.writeText(replyMsg);
			feedbackMsg = '📋 Respuesta con link /buscar copiada: lista para pegar si contesta "sí".';
		} catch {
			feedbackMsg = `🔗 Link listo: ${meta.e3FormUrl}`;
		}
	}

	async function pauseContact3Months() {
		if (!meta.contactId || isBusy) return;
		isBusy = true;
		feedbackMsg = '';
		try {
			const nowMs = Date.now();
			const reactivateAt = nowMs + 90 * 86_400_000;
			const nextDate = new Date(reactivateAt).toLocaleDateString('es-MX', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric'
			});
			await updateDoc(doc(db, 'contacts', meta.contactId), {
				isActive: false,
				inactiveReason: 'pausado',
				pausedAt: nowMs,
				reactivateAt
			});
			await infoToBinnacle({
				date: nowMs,
				to: meta.contactId,
				action: 'Contacto pausado 3 meses (Copiloto): ',
				comment: `Pausado ("de momento no"). Chequeo programado para ${nextDate}; permanecerá en pausa hasta que confirme reinicio.`
			});
			feedbackMsg = `⏸️ Contacto pausado. Próximo chequeo en 3 meses (${nextDate}).`;
			if (!todoItem.isCompleted) {
				dispatch('complete', todoItem);
			} else {
				dispatch('updated');
			}
		} catch (err: any) {
			feedbackMsg = '⚠️ Error al pausar contacto: ' + (err?.message || err);
		} finally {
			isBusy = false;
		}
	}

	async function markContactInactiveDefinitive() {
		if (!meta.contactId || isBusy) return;
		isBusy = true;
		feedbackMsg = '';
		try {
			const nowMs = Date.now();
			await updateDoc(doc(db, 'contacts', meta.contactId), {
				isActive: false,
				inactiveReason: 'no_interesa',
				reactivateAt: null
			});
			await infoToBinnacle({
				date: nowMs,
				to: meta.contactId,
				action: 'Contacto inactivo definitivo (Copiloto): ',
				comment: 'Marcado como inactivo definitivo (ya compró / no le interesa). Sin futuros envíos.'
			});
			feedbackMsg = '🚫 Contacto marcado como inactivo definitivo.';
			if (!todoItem.isCompleted) {
				dispatch('complete', todoItem);
			} else {
				dispatch('updated');
			}
		} catch (err: any) {
			feedbackMsg = '⚠️ Error al inactivar contacto: ' + (err?.message || err);
		} finally {
			isBusy = false;
		}
	}

	async function reactivatePausedContact() {
		if (!meta.contactId || isBusy) return;
		isBusy = true;
		feedbackMsg = '';
		try {
			const nowMs = Date.now();
			await updateDoc(doc(db, 'contacts', meta.contactId), {
				isActive: true,
				inactiveReason: '',
				pausedAt: null,
				reactivateAt: null,
				lastResponse: nowMs
			});
			await infoToBinnacle({
				date: nowMs,
				to: meta.contactId,
				action: 'Contacto reactivado (Copiloto): ',
				comment: 'El cliente confirmó que reinició su búsqueda de inmueble. Reactivado en el embudo.'
			});
			feedbackMsg = '✅ Contacto reactivado: volvió al embudo activo.';
			if (!todoItem.isCompleted) {
				dispatch('complete', todoItem);
			} else {
				dispatch('updated');
			}
		} catch (err: any) {
			feedbackMsg = '⚠️ Error al reactivar contacto: ' + (err?.message || err);
		} finally {
			isBusy = false;
		}
	}
</script>

<div class="copiloto-drawer" on:click|stopPropagation on:keydown|stopPropagation role="region" aria-label="Detalle Copiloto IA">
	{#if meta.proposedClose && !todoItem.isCompleted}
		<div class="proposed-close-banner">
			<div class="proposed-close-info">
				<span>📱</span>
				<div>
					<strong>Respondiste desde tu teléfono por WhatsApp</strong>
					<p>{meta.proposedCloseReason || 'La IA detectó actividad saliente reciente con este lead.'}</p>
				</div>
			</div>
			<button type="button" class="btn-confirm-close" on:click={confirmProposedClose} disabled={isBusy}>
				<i class="fa-solid fa-check"></i> Confirmar Cierre (1 Clic)
			</button>
		</div>
	{/if}

	<div class="drawer-header">
		<div class="drawer-badges">
			<span class="stage-pill stage-{String(meta.stage || 'E1').toLowerCase()}">{meta.stage || 'IA'}</span>
			<span class="lead-name">{meta.fullName || 'Lead'}</span>
			{#if meta.telephon}
				<span class="lead-phone">📞 {meta.telephon}</span>
			{/if}
			{#if meta.isColdOver180Days}
				<span
					class="cold-pill"
					class:cold-pill-hot={meta.repliedToStep1}
					title="Estrategia unificada de reactivación >180 días (2 pasos)"
				>
					{#if meta.repliedToStep1}
						🔥 Respondió Paso 1 · Enviar link
					{:else if meta.coldStep === 'step2_send_link'}
						🔗 &gt;180d · Paso 2/2 (Con link)
					{:else}
						❄️ &gt;180d · Paso 1/2 (Sin link)
					{/if}
				</span>
			{/if}
			{#if (meta.callsWithoutReply || 0) > 0 || (meta.propertySendsWithoutReply || 0) > 0}
				<span class="silence-pill" title="Intentos acumulados sin respuesta">
					Sin respuesta: {meta.callsWithoutReply || 0} llam. / {meta.propertySendsWithoutReply || 0} env.
				</span>
			{/if}
		</div>

		<div class="drawer-header-links">
			{#if meta.contactId}
				<a class="link-ficha" href={`/contact/${meta.contactId}`} target="_blank" rel="noopener noreferrer">
					<i class="fa-solid fa-user-pen"></i> Abrir Ficha ↗
				</a>
			{/if}
			<button type="button" class="btn-collapse" on:click={() => dispatch('close')} title="Contraer tarjeta">
				<i class="fa-solid fa-chevron-up"></i>
			</button>
		</div>
	</div>

	<div class="info-cards-grid">
		<div class="info-card">
			<div class="info-label">🎯 Acción Sugerida</div>
			<p class="info-text strong">{meta.action}</p>
		</div>

		<div class="info-card">
			<div class="info-label">🧭 Qué se pretende (Objetivo)</div>
			<p class="info-text">{meta.objective}</p>
		</div>

		<div class="info-card">
			<div class="info-label">🧠 Porqué (Análisis de Bitácora)</div>
			<p class="info-text">{meta.why}</p>
		</div>
	</div>

	{#if meta.suggestedStageChange && meta.suggestedStageChange !== 'NONE'}
		<div class="stage-suggest-box">
			<span>⚡ Sugerencia de embudo: mover a <strong>{meta.suggestedStageChange}</strong></span>
			<button type="button" class="btn-stage-move" on:click={applySuggestedStageChange} disabled={isBusy}>
				Mover a {meta.suggestedStageChange}
			</button>
		</div>
	{/if}

	<div class="action-section">
		<div class="info-label">💬 Mensaje WhatsApp Redactado (Editable)</div>
		<textarea
			class="draft-textarea"
			rows="4"
			bind:value={draftText}
			placeholder="Borrador del mensaje..."
		></textarea>

		<div class="execute-bar">
			{#if meta.recommendedExecution === 'call'}
				<a class="btn-exec btn-call" href={`tel:${cleanPhone(meta.telephon)}`}>
					<i class="fa-solid fa-phone"></i> Llamar
				</a>
				<button type="button" class="btn-exec btn-answered" on:click={() => logCallOutcome(true)} disabled={isBusy}>
					✓ Contestó
				</button>
				<button type="button" class="btn-exec btn-no-answer" on:click={() => logCallOutcome(false)} disabled={isBusy}>
					✗ No contestó
				</button>
				<button type="button" class="btn-exec btn-wa-alt" on:click={executeWhatsAppSend} disabled={isBusy || !meta.telephon}>
					<i class="fa-brands fa-whatsapp"></i> Enviar WA
				</button>
			{:else}
				<button type="button" class="btn-exec btn-wa-primary" on:click={executeWhatsAppSend} disabled={isBusy || !meta.telephon}>
					<i class="fa-brands fa-whatsapp"></i>
					{#if meta.stage === 'PAU' || meta.isPausedCheckIn}
						Enviar chequeo 3m (Mantiene pausa)
					{:else if meta.coldStep === 'step1_check'}
						Enviar Paso 1 por WhatsApp (Sin link)
					{:else if meta.coldStep === 'step2_send_link'}
						Enviar Link /buscar · Paso 2 (1 Clic)
					{:else if meta.stage === 'E3'}
						Enviar Formulario E3 (1 Clic)
					{:else}
						Enviar WhatsApp (1 Clic)
					{/if}
				</button>
				{#if meta.coldStep === 'step1_check' && meta.e3FormUrl}
					<button
						type="button"
						class="btn-exec btn-copy-link"
						on:click={copyQuickStep2Reply}
						title="Copia el mensaje con el link personalizado por si el lead responde 'sí' de inmediato"
					>
						<i class="fa-solid fa-link"></i> Copiar respuesta con link
					</button>
				{/if}
				{#if meta.stage === 'PAU' || meta.isPausedCheckIn}
					<button
						type="button"
						class="btn-exec btn-reactivate"
						on:click={reactivatePausedContact}
						disabled={isBusy}
						title="Solo usar si el cliente confirmó que SÍ reinició su búsqueda"
					>
						✅ Reinició búsqueda
					</button>
					<button
						type="button"
						class="btn-exec btn-inactive"
						on:click={markContactInactiveDefinitive}
						disabled={isBusy}
						title="Marcar inactivo definitivo (sin futuros mensajes)"
					>
						🚫 Inactivo
					</button>
				{:else}
					<button
						type="button"
						class="btn-exec btn-pause"
						on:click={pauseContact3Months}
						disabled={isBusy}
						title="El cliente dijo 'de momento no': pausar y preguntar de nuevo en 3 meses"
					>
						⏸️ Pausar 3m
					</button>
					<a class="btn-exec btn-call-alt" href={`tel:${cleanPhone(meta.telephon)}`}>
						<i class="fa-solid fa-phone"></i> Llamar
					</a>
				{/if}
			{/if}
		</div>

		{#if feedbackMsg}
			<div class="feedback-line">{feedbackMsg}</div>
		{/if}
	</div>
</div>

<style>
	.copiloto-drawer {
		box-sizing: border-box;
		width: 100%;
		max-width: 100%;
		background: rgba(99, 102, 241, 0.05);
		border: 1px solid rgba(99, 102, 241, 0.25);
		border-radius: 12px;
		padding: 1rem 1.15rem;
		margin: 0.25rem 0 0.5rem;
	}

	:global([data-theme="dark"]) .copiloto-drawer {
		background: rgba(15, 23, 42, 0.95);
		border-color: rgba(212, 175, 55, 0.35);
	}

	.proposed-close-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		background: rgba(16, 185, 129, 0.12);
		border: 1px solid rgba(16, 185, 129, 0.4);
		border-radius: 10px;
		padding: 0.65rem 0.9rem;
		margin-bottom: 0.85rem;
	}

	.proposed-close-info {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.83rem;
	}

	.proposed-close-info p {
		margin: 2px 0 0;
		font-size: 0.76rem;
		opacity: 0.85;
	}

	.btn-confirm-close {
		background: #10b981;
		color: #06281e;
		border: none;
		border-radius: 8px;
		padding: 0.45rem 0.9rem;
		font-weight: 700;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-bottom: 0.85rem;
		padding-bottom: 0.6rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.2);
		width: 100%;
		box-sizing: border-box;
	}

	.drawer-badges {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		min-width: 0;
	}

	.stage-pill {
		font-size: 0.72rem;
		font-weight: 800;
		padding: 2px 8px;
		border-radius: 999px;
		color: #fff;
	}

	.stage-e1 { background: #ef4444; }
	.stage-e2 { background: #f97316; }
	.stage-e3 { background: #eab308; color: #111827; }
	.stage-e4 { background: #10b981; }
	.stage-pau { background: #64748b; }

	.lead-name {
		font-weight: 700;
		font-size: 0.95rem;
	}

	.lead-phone {
		font-size: 0.8rem;
		color: var(--text-muted, #64748b);
	}

	.silence-pill {
		font-size: 0.72rem;
		padding: 2px 8px;
		border-radius: 6px;
		background: rgba(245, 158, 11, 0.14);
		color: #d97706;
		font-weight: 600;
	}

	.cold-pill {
		font-size: 0.72rem;
		padding: 2px 8px;
		border-radius: 6px;
		background: rgba(56, 189, 248, 0.16);
		color: #0284c7;
		font-weight: 700;
	}

	:global([data-theme="dark"]) .cold-pill {
		color: #7dd3fc;
	}

	.cold-pill-hot {
		background: rgba(239, 68, 68, 0.16);
		color: #dc2626;
	}

	:global([data-theme="dark"]) .cold-pill-hot {
		color: #fca5a5;
	}

	.btn-copy-link {
		background: rgba(99, 102, 241, 0.16);
		color: #4f46e5;
		border: 1px solid rgba(99, 102, 241, 0.35);
	}

	:global([data-theme="dark"]) .btn-copy-link {
		color: #c7d2fe;
	}

	.btn-pause {
		background: rgba(100, 116, 139, 0.18);
		color: #475569;
		border: 1px solid rgba(100, 116, 139, 0.35);
	}

	:global([data-theme="dark"]) .btn-pause {
		color: #cbd5e1;
	}

	.btn-reactivate {
		background: #10b981;
		color: #ffffff;
	}

	.btn-inactive {
		background: rgba(239, 68, 68, 0.15);
		color: #dc2626;
		border: 1px solid rgba(239, 68, 68, 0.35);
	}

	:global([data-theme="dark"]) .btn-inactive {
		color: #fca5a5;
	}

	:global([data-theme="dark"]) .silence-pill {
		color: #fbbf24;
	}

	.drawer-header-links {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.link-ficha {
		font-size: 0.78rem;
		font-weight: 600;
		color: #6366f1;
		text-decoration: none;
		padding: 0.35rem 0.7rem;
		border-radius: 7px;
		border: 1px solid rgba(99, 102, 241, 0.35);
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	:global([data-theme="dark"]) .link-ficha {
		color: #a5b4fc;
	}

	.btn-collapse {
		background: transparent;
		border: 1px solid rgba(148, 163, 184, 0.3);
		color: inherit;
		border-radius: 7px;
		padding: 0.3rem 0.55rem;
		cursor: pointer;
	}

	.info-cards-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
		margin-bottom: 0.85rem;
		width: 100%;
		box-sizing: border-box;
	}

	@media (max-width: 860px) {
		.info-cards-grid {
			grid-template-columns: 1fr;
		}
	}

	.info-card {
		background: rgba(255, 255, 255, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.22);
		border-radius: 9px;
		padding: 0.65rem 0.85rem;
		box-sizing: border-box;
		min-width: 0;
	}

	:global([data-theme="dark"]) .info-card {
		background: rgba(30, 41, 59, 0.65);
		border-color: rgba(255, 255, 255, 0.08);
	}

	.info-label {
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #6366f1;
		margin-bottom: 4px;
	}

	:global([data-theme="dark"]) .info-label {
		color: #fbbf24;
	}

	.info-text {
		margin: 0;
		font-size: 0.83rem;
		line-height: 1.4;
	}

	.info-text.strong {
		font-weight: 600;
	}

	.stage-suggest-box {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		background: rgba(245, 158, 11, 0.14);
		border: 1px solid rgba(245, 158, 11, 0.4);
		border-radius: 9px;
		padding: 0.5rem 0.75rem;
		font-size: 0.8rem;
		margin-bottom: 0.85rem;
		box-sizing: border-box;
	}

	.btn-stage-move {
		background: #f59e0b;
		color: #111827;
		border: none;
		border-radius: 6px;
		padding: 0.35rem 0.7rem;
		font-weight: 700;
		font-size: 0.76rem;
		cursor: pointer;
	}

	.action-section {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		width: 100%;
		box-sizing: border-box;
	}

	.draft-textarea {
		box-sizing: border-box;
		width: 100%;
		max-width: 100%;
		min-width: 0;
		border-radius: 9px;
		border: 1px solid rgba(148, 163, 184, 0.35);
		padding: 0.75rem 0.9rem;
		font-family: inherit;
		font-size: 0.86rem;
		line-height: 1.5;
		overflow-wrap: break-word;
		word-break: break-word;
		resize: vertical;
		background: rgba(255, 255, 255, 0.85);
		color: #0f172a;
	}

	:global([data-theme="dark"]) .draft-textarea {
		background: rgba(15, 23, 42, 0.9);
		border-color: rgba(255, 255, 255, 0.16);
		color: #f1f5f9;
	}

	.execute-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.55rem;
		margin-top: 0.25rem;
		width: 100%;
		box-sizing: border-box;
	}

	.btn-exec {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		padding: 0.55rem 1rem;
		border-radius: 8px;
		font-size: 0.82rem;
		font-weight: 700;
		border: none;
		cursor: pointer;
		text-decoration: none;
		box-sizing: border-box;
	}

	.btn-wa-primary {
		background: #22c55e;
		color: #ffffff;
		flex: 1 1 auto;
		min-width: 200px;
	}

	.btn-wa-primary:hover {
		background: #16a34a;
	}

	.btn-call {
		background: #4f46e5;
		color: #ffffff;
	}

	.btn-call:hover {
		background: #4338ca;
	}

	.btn-answered {
		background: #10b981;
		color: #ffffff;
	}

	.btn-no-answer {
		background: #f59e0b;
		color: #111827;
	}

	.btn-wa-alt, .btn-call-alt {
		background: rgba(148, 163, 184, 0.2);
		color: inherit;
		border: 1px solid rgba(148, 163, 184, 0.35);
	}

	.feedback-line {
		font-size: 0.78rem;
		font-weight: 600;
		color: #10b981;
		margin-top: 0.2rem;
	}
</style>
