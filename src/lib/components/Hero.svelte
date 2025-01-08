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
                <h2>Match Home</h2>
                <h5>¡Tu Patrimonio En Buenas Manos!</h5>
            </div>

        </div>
    </div>
</div>

<style>
    .hero{
        padding: 0.5em 0;
        background-color: var(--primary-color);
        /* color: white; */
    }

    h2{
        font-size: 3.5em;
        font-weight: 400;
        margin: 0;
    }

    h5 {
        font-size: 1.5em;
        font-weight: 150;
    }

    img{
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
            display: felx;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        h2 {
            font-size: 2.5rem;
        }
        h5 {
            font-size: 1.2rem;
        }
    }
</style>