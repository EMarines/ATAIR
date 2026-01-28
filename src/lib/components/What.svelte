<script>
// // @ts-nocheck

    import { Contact, Button} from '$components';
//     import { currContList, currPropList } from './stores/store';
//     // import { dbProperties } from '../firebase'

//     $: totProp = $currPropList.length;
//     $: totCont = $currContList.length;
  
 </script>
<div class="container grid">
    <div class="what">
        <h3>Que Hacemos</h3>
        <!-- <p><strong>Actualmente tenemos {totProp} propiedades en venta, y {totCont} clientes registrados que están buscando alguna propiedad como la tuya. </strong> Lorem ipsum dolor sit amet consectetur adipisicing elit. Ratione id odio quasi quos, vitae sit dolore, libero magnam eaque inventore quas officia rem. Error qui fugit officia amet laboriosam at eos officiis in optio voluptatum. -->
        <!-- </p> -->
        <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Itaque ut, eius illo pariatur voluptate nobis nostrum perspiciatis eaque doloribus neque dolorem. Harum, possimus! Laborum, magnam ducimus cumque temporibus at, voluptatem expedita tempora facilis exercitationem odio impedit natus? Tempore, sapiente inventore.
        </p>

        <!-- <Button class = "secondary" id = "a-botton" size = "medium">
            Call To Action >>>
        </Button> -->
        <Button element="a" variant="outline" href="/properties">Call To Action >>></Button>

    </div>
 <Contact />
</div>



<style>
    .grid{
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 2em;
    }
    .what{
        grid-column: span 8;
    }
    
    h3{
        padding-bottom: 0.5em;
        margin-bottom: 0.5em;
        font-size: 2em;
        font-weight: 500;
        border-bottom: 1px solid #ddd;
    }

    @media(max-width: 800px) {
        .grid {
            display: flex;
            flex-direction: column;
            padding: 20px;
        }
    }
</style>