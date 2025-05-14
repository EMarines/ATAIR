export let lowRange: number = 0;
export let upRange: number = 0;
let rng: string = "";

export function setRange(rng: string) {
  console.log(rng);
    if(rng === "PRM"){
        lowRange = 0; upRange = 1000000                 // PRM
    }
    else if (rng === "SGN") {
        lowRange = 1000001; upRange=2500000           // SGN
    }
    
    else if (rng === "TRC") {
        lowRange = 2500001; upRange=5000000           // TRC
    }
    else if (rng === "CRT") {
        lowRange = 5000001; upRange=8000000           // CRT
    }
    else if (rng === "QNT") {                       // QNT
        lowRange = 8000001; upRange=12000000
         
    }
        else if (rng === "SXT") {
        lowRange = 12000000; upRange=1500000000       // SXT
    } 
};
  

    export function ranPrice(price: number) {
        if(price <= 1000000){
            lowRange = 0; upRange = 1000000   
            return "PRM"               // PRM
        }
        else if (price <= 2500000) {
            lowRange = 1000001; upRange = 2500000 
            return "SGN"               // SGN
        }
        else if (price <= 5000000) {
            lowRange = 2500001; upRange = 5000000 
            return "TRC"               // TRC
        }
        else if (price <= 8000000) {
            lowRange = 5000001; upRange = 8000000 
            return "CRT"               // CRT
        }
        else if (price <= 12000000) {                       // QNT
            lowRange = 8000001; upRange = 12000000
            return "QNT"
        }
        else if (price > 12000000) {
            lowRange = 12000000; upRange = 1500000000       // SXT
            return "SXT"
        } 
        return rng
    }

  // Devuelve el rango en letras de un valor
    /**
 * @param {number} price
 */
    export function mosRange(price: number){
      if(price <= 1000000){
        rng = "PRM";                 // PRM
      }
      else if (price <= 2500000) {
        rng = "SGN"            // SGN
      }
      else if (price <= 5000000) {
        rng = "TRC"            // TRC
      }
      else if (price <= 8000000) {
        rng = "CRT"            // CRT
      }
      else if (price <= 12000000) {   // QNT
        rng = "QNT"  
      }
        else if (price > 12000000) {
        rng = "SCT"            // SXT
      } 
      if(rng === undefined){
        rng = ""
      }
      return rng     
    };

