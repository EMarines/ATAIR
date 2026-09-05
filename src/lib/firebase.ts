// Importar desde firebase_toggle.ts (ahora es la única fuente de Firebase)
import { app, db, auth, storage, propertiesDb, isSandbox, currentProjectId } from './firebase_toggle';

// Reexportamos para mantener la compatibilidad con el código existente
export { app as firebaseApp, auth, db, storage, propertiesDb, isSandbox, currentProjectId };