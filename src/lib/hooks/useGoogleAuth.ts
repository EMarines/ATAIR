// import { auth } from '../firebase'
// import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
// import { goto } from '$app/navigation'

// export function useGoogleAuth() {
//     const provider = new GoogleAuthProvider()
    
//     async function loginGoogle() {
//         try {
//             await signInWithPopup(auth, provider)
//             goto('/')
//         } catch (error) {
//             console.error('Error al iniciar sesión con Google:', error)
//         }
//     }

//     return { loginGoogle }
// } 