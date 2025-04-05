<script>
    import logo from '../images/logo.png'
</script>

<div class="hero">
    <div class="container">
        <div class="header cabezal">
            <div class="logo">
                <img src={logo} alt="Match Home">
            </div>
            <div>
                <h1>Match Home</h1>
                <h2 class="subtitle">¡Tu Patrimonio En Buenas Manos!</h2>
            </div>
        </div>
    </div>
</div>

<style>
    .hero{
        padding: 0.5em 0;
        background-color: var(--primary-color);
    }

    h1 {
        font-size: 3.5em;
        font-weight: 400;
        margin: 0;
    }

    h2.subtitle {
        font-size: 1.5em;
        font-weight: 150;
        margin: 0;
    }

    img {
        width: 180px;  
    }

    .header {
        display: flex;
        padding: 10px;
    }

    .logo {
        display: flex;
        align-items: center;
        justify-content: right;
    }

    .cabezal {
        justify-content: space-between;
    }

    @media (max-width: 800px){
        .header {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        h1 {
            font-size: 2.5rem;
        }
        h2.subtitle {
            font-size: 1.2rem;
        }
    }
</style>