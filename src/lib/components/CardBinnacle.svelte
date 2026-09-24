<script lang="ts">
	// @ts-nocheck
	import { formatDate } from '$lib/functions/dateFunctions';
	import { db } from '$lib/firebase_toggle';
	import { doc, deleteDoc, updateDoc } from 'firebase/firestore';

	export let binn: any = {};

	let isEditing = false;
	let editedComment = '';
	let isSaving = false;

	function startEdit() {
		editedComment = binn.comment || '';
		isEditing = true;
	}

	function cancelEdit() {
		isEditing = false;
		editedComment = '';
	}

	async function saveEdit() {
		if (!binn?.id) {
			alert('No se encontró el ID del registro para actualizar');
			return;
		}
		if (!editedComment.trim()) {
			alert('El comentario no puede estar vacío');
			return;
		}

		isSaving = true;
		try {
			const binnRef = doc(db, 'binnacles', binn.id);
			await updateDoc(binnRef, {
				comment: editedComment.trim(),
				updatedAt: Date.now()
			});
			binn.comment = editedComment.trim();
			isEditing = false;
		} catch (error) {
			console.error('Error al actualizar nota de bitácora:', error);
			alert('Error al guardar cambios: ' + error);
		} finally {
			isSaving = false;
		}
	}

	async function deleteBinnacle() {
		if (!binn?.id) {
			alert('No se encontró el ID del registro para eliminar');
			return;
		}

		if (confirm('¿Deseas eliminar esta entrada de la bitácora?')) {
			try {
				const binnRef = doc(db, 'binnacles', binn.id);
				await deleteDoc(binnRef);
			} catch (error) {
				console.error('Error al eliminar registro de bitácora:', error);
				alert('Error al eliminar: ' + error);
			}
		}
	}
</script>

<div class="binnacle__row" class:is-editing={isEditing}>
	<div class="cell__icon">
		{#if binn.action === 'WhatsApp enviado: '}
			<i class="fa-brands fa-square-whatsapp"></i>
		{:else if binn.action === 'Se editó a: '}
			<i class="fa-solid fa-file-pen"></i>
		{:else if binn.action === 'Nota agregada: '}
			<i class="fa-solid fa-square-poll-horizontal"></i>
		{:else if binn.action === 'Se agregó a: '}
			<i class="fa-solid fa-user-check"></i>
		{:else if binn.action === 'Propiedad enviada: '}
			<i class="fa-solid fa-house-circle-check"></i>
		{:else}
			{binn.action}
		{/if}
	</div>

	<div class="cell__date">
		<div>{formatDate(binn.date)}</div>
	</div>

	{#if isEditing}
		<div class="cell__edit">
			<input
				type="text"
				class="edit__input"
				bind:value={editedComment}
				on:keydown={(e) => {
					if (e.key === 'Enter') saveEdit();
					if (e.key === 'Escape') cancelEdit();
				}}
				disabled={isSaving}
				autofocus
			/>
			<div class="edit__buttons">
				<button
					type="button"
					class="action-icon save-btn"
					on:click={saveEdit}
					title="Guardar cambios (Enter)"
					disabled={isSaving}
				>
					<i class="fa-solid fa-check"></i>
				</button>
				<button
					type="button"
					class="action-icon cancel-btn"
					on:click={cancelEdit}
					title="Cancelar (Esc)"
					disabled={isSaving}
				>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>
		</div>
	{:else}
		<div class="cell__comment" title={binn.comment}>
			{binn.comment}
		</div>

		<div class="cell__actions">
			<i
				on:click|stopPropagation={startEdit}
				on:keydown={() => {}}
				class="fa-regular fa-pen-to-square action-icon edit-icon"
				role="button"
				tabindex="0"
				aria-label="Editar nota"
				title="Editar nota"
			></i>
			<i
				on:click|stopPropagation={deleteBinnacle}
				on:keydown={() => {}}
				class="fa-regular fa-trash-can action-icon delete-icon"
				role="button"
				tabindex="0"
				aria-label="Eliminar nota"
				title="Eliminar de bitácora"
			></i>
		</div>
	{/if}
</div>

<style>
	.binnacle__row {
		display: grid;
		grid-template-columns: 35px minmax(75px, 15%) 1fr auto;
		align-items: center;
		grid-row-gap: 0;
		width: 100%;
		max-width: 100%;
		padding: 6px 4px;
		margin-bottom: 6px;
		border-radius: 6px;
		column-gap: 10px;
		transition: background-color 0.18s ease;
	}

	.binnacle__row:hover {
		background: rgba(255, 255, 255, 0.03);
	}

	.binnacle__row.is-editing {
		background: rgba(37, 99, 235, 0.08);
		border: 1px solid rgba(37, 99, 235, 0.25);
	}

	.cell__icon {
		width: 32px;
		align-self: flex-start;
		display: flex;
		justify-content: center;
		padding-top: 2px;
	}

	.cell__date {
		display: flex;
		min-width: 70px;
		justify-content: flex-start;
		align-self: flex-start;
		padding-top: 3px;
		font-size: 0.82rem;
		color: #94a3b8;
	}

	.cell__date div {
		margin-top: 0;
		line-height: 1.2;
		white-space: nowrap;
	}

	.cell__comment {
		align-self: flex-start;
		line-height: 1.35;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		word-break: break-word;
		font-size: 0.85rem;
		padding-top: 2px;
		color: #f1f5f9;
	}

	.cell__actions {
		display: flex;
		align-items: center;
		gap: 6px;
		opacity: 0;
		transform: translateX(4px);
		transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		pointer-events: none;
		align-self: center;
		margin-left: 6px;
		padding-right: 4px;
	}

	.binnacle__row:hover .cell__actions {
		opacity: 1;
		transform: translateX(0);
		pointer-events: auto;
	}

	.action-icon {
		width: 28px !important;
		height: 28px !important;
		font-size: 0.85rem !important;
		display: inline-flex !important;
		align-items: center !important;
		justify-content: center !important;
		border-radius: 50% !important;
		cursor: pointer;
		box-sizing: border-box !important;
		padding: 0 !important;
		margin: 0 !important;
	}

	/* Modos de edición inline */
	.cell__edit {
		display: flex;
		align-items: center;
		gap: 8px;
		grid-column: 3 / span 2;
		width: 100%;
	}

	.edit__input {
		flex: 1;
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid #3b82f6;
		color: #f8fafc;
		border-radius: 6px;
		padding: 4px 8px;
		font-size: 0.85rem;
		outline: none;
		transition: border-color 0.2s ease;
	}

	.edit__input:focus {
		border-color: #60a5fa;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
	}

	.edit__buttons {
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.save-btn {
		background: rgba(22, 163, 74, 0.15) !important;
		border: 1px solid rgba(22, 163, 74, 0.35) !important;
		color: #22c55e !important;
	}

	.save-btn:hover {
		background: rgba(234, 179, 8, 0.25) !important;
		border-color: rgba(234, 179, 8, 0.6) !important;
		color: #eab308 !important;
		box-shadow: 0 0 8px rgba(234, 179, 8, 0.4) !important;
		transform: scale(1.1);
	}

	.cancel-btn {
		background: rgba(148, 163, 184, 0.12) !important;
		border: 1px solid rgba(148, 163, 184, 0.25) !important;
		color: #94a3b8 !important;
	}

	.cancel-btn:hover {
		background: rgba(239, 68, 68, 0.2) !important;
		border-color: rgba(239, 68, 68, 0.5) !important;
		color: #ef4444 !important;
		box-shadow: 0 0 8px rgba(239, 68, 68, 0.35) !important;
		transform: scale(1.1);
	}

	i {
		font-size: 1.4rem;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.binnacle__row {
			grid-template-columns: 30px minmax(65px, 20%) 1fr auto;
			column-gap: 8px;
		}

		.cell__actions {
			opacity: 0.9;
			transform: none;
			pointer-events: auto;
		}
	}
</style>