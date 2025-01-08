
export function sendWhatsApp(tel: string, msg: string) { 
  const link: string = (`https://api.whatsapp.com/send?phone=52${tel}&text=${msg}`)
  window.open(link, "ventana1","width=350,height=350,scrollbars=NO" );
}



// export function closeWindow(linkToSend) {
//   console.log("ya es tiempo de cerrar", linkToSend);
//   myWindow.close();
// } 
