<script lang="ts">
    import "../../styles/main.css"
    import logo from '../images/logo.png'
</script>

<div class="hero">
    <div class="container">
        <div class="header cabezal">
            <div class="logo">
                <img src={logo} alt="Match Home">
            </div>
            <div class="marca">
                <h2>Match Home</h2>
                <h5 class="slogan">¡Tu Patrimnio En Buenas Manos!</h5>
            </div>

        </div>
    </div>
</div>

<style>
    .hero{
        margin: 0 0.5em;
        background-color: var(--primary-color);
        border-radius: 3px;
        font-weight: 600;
    }

    h2{
        font-size: 3.5em;
        font-weight: 400;
        margin: 0;
    }


    img {
        width: 180px;  
        filter: drop-shadow(1px 1px 1.5px rgba(0, 0, 0, 0.25));
    }

    .header {
        display: flex;
        padding: 10px;
    }

    .marca {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

    .logo {
        display: flex;
        align-items: center;
        justify-content: right;
        font-size: 1.5rem;
    }
    
    .cabezal {
        justify-content: space-between;
    }

    @media (max-width: 800px){
        .hero {
            margin: 0 .3em;
        }
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