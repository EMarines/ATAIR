<script lang="ts">
	 export let identifier: string;
	 export let name: string;  
	 export let value: string;
</script>

    <label class="label__title" for={identifier} >
      <p class={value  ? ' above' : ' center'}>{name}</p>
      <input id={identifier} class="in__sel capitalize" type="text" bind:value placeholder={name} />
    </label>

    <style>
    /* inputs dessigns   */
    .above, .center {
      position: absolute;
      transform: translateY(-50%);
      min-width: 150px;
      pointer-events: none;
      border-radius: 4px;
      padding: 0 6px;
      font-size: .8em;
    }

    .above {
      top: 0;
      left: 24px;
      color: whitesmoke;
      background: navy;
      border: 1px solid blue;
      font-size: .7em;
    }

    .center {
      top: 50%;
      left: 6px;
      border: 1px solid transparent;
      opacity: 0;
    }

    .label__title {
      position: relative; 
      border: 1px solid navy;
      border-radius: 5px;
      padding: 5px 3px 7px 3px;
    }

    .in__sel {  
      padding: 3px 0 3px 5px;
      width: 250px;
      border-color: 2px solid blue;
      border-radius: 8px;
      font-size: .8em;
      padding: 3px;
      font-weight: 600;
      color: darkblue;    
      }


      input::placeholder{
        color: navy;
      }

      .capitalize {
        text-transform: capitalize;
      }

    /* Quita las flechas en Chrome, Safari, Edge, Opera */
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    /* Quita las flechas en Firefox */
    /*
    input[type="number"] {
      -moz-appearance: textfield;
      appearance: textfield;
    }
    */
    </style>
