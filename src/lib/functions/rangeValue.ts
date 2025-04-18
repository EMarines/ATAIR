export let lowRange: number = 0;
export let upRange: number = 0;
let rng: string = "";

export function setRange(rng: string) {
    if(rng === "prm"){
        lowRange = 0; upRange = 1000000                 // PRM
    }
    else if (rng === "sgn") {
        lowRange = 1000001; upRange=2500000           // SGN
    }
    
    else if (rng === "trc") {
        lowRange = 2500001; upRange=5000000           // TRC
    }
    else if (rng === "crt") {
        lowRange = 5000001; upRange=8000000           // CRT
    }
    else if (rng === "qnt") {                       // QNT
        console.log("si")
        lowRange = 8000001; upRange=12000000
         
    }
        else if (rng === "sxt") {
        lowRange = 12000000; upRange=1500000000       // SXT
    } 
};
  

    export function ranPrice(price: number) {
        if(price <= 1000000){
            lowRange = 0; upRange = 1000000   
            return "prm"               // PRM
        }
        else if (price <= 2500000) {
            lowRange = 1000001; upRange = 2500000 
            return "sgn"               // SGN
        }
        else if (price <= 5000000) {
            lowRange = 2500001; upRange = 5000000 
            return "trc"               // TRC
        }
        else if (price <= 8000000) {
            lowRange = 5000001; upRange = 8000000 
            return "crt"               // CRT
        }
        else if (price <= 12000000) {                       // QNT
            lowRange = 8000001; upRange = 12000000
            return "qnt"
        }
        else if (price > 12000000) {
            lowRange = 12000000; upRange = 1500000000       // SXT
            return "sxt"
        } 
        return rng
    }

  // Devuelve el rango en letras de un valor
    /**
 * @param {number} price
 */
    export function mosRange(price: number){
      if(price <= 1000000){
        rng = "prm";                 // PRM
      }
      else if (price <= 2500000) {
        rng = "sgn"            // SGN
      }
      else if (price <= 5000000) {
        rng = "trc"            // TRC
      }
      else if (price <= 8000000) {
        rng = "crt"            // CRT
      }
      else if (price <= 12000000) {   // QNT
        rng = "qnt"  
      }
        else if (price > 12000000) {
        rng = "sxt"            // SXT
      } 
      if(rng === undefined){
        rng = ""
      }
      return rng     
    };

