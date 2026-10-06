<script lang="ts">
	import { empresa } from '$lib/config/empresa';
	import { version } from '$lib/config/version';
	const year = new Date().getFullYear();
</script>

<footer class="footer">
	<!-- <div class="container"> -->
	<div class="footer__content">
		<div class="footer__section">
			<h3>Contacto</h3>
			<p>Ave. Francisco Villa # 5700</p>
			<p>{empresa.email}</p>
			<p>Tel: {empresa.phoneNumber}</p>
		</div>
		<p class="slogan">{empresa.slogan}</p>
		<div class="footer__section">
			<h3>Sistema ATAIR</h3>
			<p>Sistema de gestión inmobiliaria {version}</p>
			<p>&copy; {year} ATAIR. Todos los derechos reservados.</p>
		</div>
	</div>
	<div class="footer__bottom"></div>
	<!-- </div> -->
</footer>

<style>
	footer {
		background-color: var(--bg-color);
		color: var(--footer-text, var(--text-color));
		margin-top: auto;
		width: 100%;
		position: relative;
		z-index: 10;
	}

	.footer__content {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: bottom;
	}

	.footer__section {
		margin-bottom: 1rem;
		min-width: 200px;
		font-size: 0.75rem;
		color: var(--footer-muted, #a1a1aa);
	}

	.footer__section h3 {
		color: var(--footer-text, #ffffff);
		font-size: 0.85rem;
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.footer__section p {
		margin: 0.15rem 0;
		color: var(--footer-muted, #a1a1aa);
	}

	.footer__bottom {
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		/* padding-top: 1.5rem; */
		margin-top: 1rem;
		text-align: bottom;
	}

	/* .footer__bottom p {
        font-size: 0.9rem;
    } */

	@media (max-width: 768px) {
		.footer__content {
			flex-direction: column;
		}
	}
</style>
