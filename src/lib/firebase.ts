// Importar el módulo firebase_toggle.ts que maneja la alternancia entre bases de datos
import { app, db, auth, useTestDb } from './firebase_toggle';

// Reexportamos para mantener la compatibilidad con el código existente
// Ahora todo el código que usa '$lib/firebase' obtendrá las mismas instancias
// que están configuradas con el mecanismo de toggle
export { app as firebaseApp, auth, db, useTestDb };