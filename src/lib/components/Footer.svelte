<script>
    const year = new Date().getFullYear();
</script>

<footer>
    <div class="container">
        <div class="footer__content">
            <div class="footer__section">
                <h3>ATAIR</h3>
                <p>Sistema de gestión inmobiliaria</p>
                <p>Tu patrimonio en buenas manos</p>
            </div>
            <div class="footer__section">
                <h3>Contacto</h3>
                <p>Ave. Francisco Villa # 5700</p>
                <p>Email: matchhome@hotmail.com</p>
                <p>Tel: (614) 540-4003</p>
            </div>
        </div>
        <div class="footer__bottom">
            <p>&copy; {year} ATAIR. Todos los derechos reservados.</p>
        </div>
    </div>
</footer>

<style>
    footer {
        background-color: var(--bg-color);
        color: var(--color);
        padding: 1rem 0;
        margin-top: auto;
    }

    .footer__content {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .footer__section h3 {
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
    }

    .footer__section p {
        font-size: 0.8rem;
    }

    .footer__bottom {
        text-align: center;
        padding-top: 1rem;
        border-top: 1px solid var(--color);
        font-size: 0.8rem;
    }

    @media (max-width: 600px) {
        .footer__content {
            grid-template-columns: 1fr;
            text-align: center;
        }
    }
</style>