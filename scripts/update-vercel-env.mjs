import { execSync } from 'child_process';

const envVars = {
    VITE_FIREBASE_API_KEY: 'AIzaSyCPSB4ynujCJ7B8TFmJQFEiXSj3LpGzE9A',
    VITE_FIREBASE_AUTH_DOMAIN: 'matchhome-crm-46de4.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'matchhome-crm-46de4',
    VITE_FIREBASE_STORAGE_BUCKET: 'matchhome-crm-46de4.firebasestorage.app',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '73269189317',
    VITE_FIREBASE_APP_ID: '1:73269189317:web:f90e43bb2806b813ddaeac'
};

const environments = ['production', 'preview', 'development'];

console.log('🚀 Agregando nuevas variables a Vercel...\n');

for (const [key, value] of Object.entries(envVars)) {
    for (const env of environments) {
        try {
            console.log(`➕ Agregando ${key} (${env})...`);
            execSync(`vercel env add ${key} ${env}`, {
                input: `${value}\n`,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            console.log(`   ✅ ${key} (${env}) configurada`);
        } catch (e) {
            console.error(`   ❌ Error agregando ${key} (${env}):`, e.message);
        }
    }
}

console.log('\n🎉 ¡Todas las variables de entorno de Vercel fueron agregadas exitosamente!');
