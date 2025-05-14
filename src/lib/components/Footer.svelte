<script lang='ts'>
    import { empresa } from '$lib/config/empresa'
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
                <p>Sistema de gestión inmobiliaria V(5.5.14)</p>
                <p>&copy; {year} ATAIR. Todos los derechos reservados.</p>
            </div>
        </div>
        <div class="footer__bottom">
        </div>
    <!-- </div> -->
</footer>

<style>
    footer {
        background-color: var(--bg-color);
        color: var(--text-color);
        /* padding: 2rem 0; */
        margin-top: auto; /* Added to push footer to the bottom when content is short */
        width: 100%;
        position: relative;
        z-index: 10; /* Ensure footer appears above other elements */
    }

    /* .container {
        margin: 0 auto;
        padding: 0 2rem;
    } */

    .footer__content {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: bottom;
    }

    .footer__section {
        margin-bottom: 1rem;
        min-width: 200px;
        font-size: .7rem;
    }

    /* .footer__section h3 {
        margin-bottom: 1rem;
        font-size: 1.2rem;
    }

    .footer__section p {
        margin: 0.5rem 0;
    } */

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