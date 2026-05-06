#!/usr/bin/env node

/**
 * Script de rotación de secretos
 * Usa este script para rotar secretos de forma segura
 * 
 * Uso:
 *   node scripts/rotate_secrets.js --type whatsapp
 *   node scripts/rotate_secrets.js --type jwt
 *   node scripts/rotate_secrets.js --type all
 */

const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function generateSecret(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

async function rotateJWTSecret() {
  console.log('\n🔐 Rotación de JWT_SECRET');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const confirm = await question('⚠️  Esto invalidará todos los tokens JWT existentes. ¿Continuar? (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Operación cancelada');
    return;
  }

  const newSecret = generateSecret(64);
  
  console.log('\n✅ Nuevo JWT_SECRET generado:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(newSecret);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n📋 Pasos siguientes:');
  console.log('1. Actualizar GitHub Secret:');
  console.log(`   gh secret set JWT_SECRET --body "${newSecret}"`);
  console.log('2. Actualizar .env en servidor de producción');
  console.log('3. Reiniciar la aplicación');
  console.log('4. Notificar a usuarios que deben volver a autenticarse');
}

async function rotateWhatsAppToken() {
  console.log('\n📱 Rotación de WHATSAPP_TOKEN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n📋 Pasos manuales requeridos:');
  console.log('1. Ir a https://business.facebook.com/');
  console.log('2. Navegar a WhatsApp → API Setup');
  console.log('3. Generar nuevo token de acceso');
  console.log('4. Copiar el token generado');
  
  const newToken = await question('\n🔑 Pega el nuevo token aquí (o presiona Enter para omitir): ');
  
  if (!newToken.trim()) {
    console.log('⏭️  Token no proporcionado. Continúa manualmente.');
    return;
  }

  console.log('\n✅ Token recibido');
  console.log('\n📋 Pasos siguientes:');
  console.log('1. Actualizar GitHub Secret:');
  console.log(`   gh secret set WHATSAPP_TOKEN --body "${newToken}"`);
  console.log('2. Actualizar .env en servidor de producción');
  console.log('3. Reiniciar la aplicación');
  console.log('4. Verificar logs: debe aparecer "✅ WhatsApp API conectada"');
  console.log('5. Invalidar token anterior en Meta Dashboard');
}

async function rotateWebhookSecret() {
  console.log('\n🔗 Rotación de WEBHOOK_APP_SECRET');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n📋 Pasos manuales requeridos:');
  console.log('1. Ir a https://developers.facebook.com/apps/');
  console.log('2. Seleccionar tu app');
  console.log('3. Navegar a Settings → Basic');
  console.log('4. En "App Secret", hacer clic en "Show" y luego "Reset"');
  console.log('5. Copiar el nuevo App Secret');
  
  const newSecret = await question('\n🔑 Pega el nuevo secret aquí (o presiona Enter para omitir): ');
  
  if (!newSecret.trim()) {
    console.log('⏭️  Secret no proporcionado. Continúa manualmente.');
    return;
  }

  console.log('\n✅ Secret recibido');
  console.log('\n⚠️  IMPORTANTE: También debes actualizar la configuración del webhook en Meta');
  console.log('\n📋 Pasos siguientes:');
  console.log('1. Actualizar GitHub Secret:');
  console.log(`   gh secret set WEBHOOK_APP_SECRET --body "${newSecret}"`);
  console.log('2. Actualizar .env en servidor de producción');
  console.log('3. Reiniciar la aplicación');
  console.log('4. Probar webhook: node scripts/test_security.js');
}

async function rotateDatabasePassword() {
  console.log('\n🗄️  Rotación de DB_PASSWORD');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const newPassword = generateSecret(32);
  
  console.log('\n✅ Nueva contraseña generada:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(newPassword);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n📋 Pasos siguientes:');
  console.log('1. Conectar a MySQL:');
  console.log('   mysql -u root -p');
  console.log('2. Cambiar contraseña:');
  console.log(`   ALTER USER 'root'@'localhost' IDENTIFIED BY '${newPassword}';`);
  console.log('   FLUSH PRIVILEGES;');
  console.log('3. Actualizar GitHub Secret:');
  console.log(`   gh secret set DB_PASSWORD --body "${newPassword}"`);
  console.log('4. Actualizar .env en servidor de producción');
  console.log('5. Reiniciar la aplicación');
}

async function main() {
  const args = process.argv.slice(2);
  const typeArg = args.find(arg => arg.startsWith('--type='));
  const type = typeArg ? typeArg.split('=')[1] : null;

  console.log('╔════════════════════════════════════════════╗');
  console.log('║   🔐 ROTACIÓN DE SECRETOS - Bot Irrigación  ║');
  console.log('╚════════════════════════════════════════════╝');

  if (!type || type === 'help') {
    console.log('\nUso:');
    console.log('  node scripts/rotate_secrets.js --type=whatsapp');
    console.log('  node scripts/rotate_secrets.js --type=webhook');
    console.log('  node scripts/rotate_secrets.js --type=jwt');
    console.log('  node scripts/rotate_secrets.js --type=db');
    console.log('  node scripts/rotate_secrets.js --type=all');
    rl.close();
    return;
  }

  switch (type) {
    case 'whatsapp':
      await rotateWhatsAppToken();
      break;
    case 'webhook':
      await rotateWebhookSecret();
      break;
    case 'jwt':
      await rotateJWTSecret();
      break;
    case 'db':
      await rotateDatabasePassword();
      break;
    case 'all':
      await rotateJWTSecret();
      await rotateWhatsAppToken();
      await rotateWebhookSecret();
      await rotateDatabasePassword();
      break;
    default:
      console.log(`❌ Tipo desconocido: ${type}`);
      console.log('Tipos válidos: whatsapp, webhook, jwt, db, all');
  }

  console.log('\n✅ Proceso completado');
  console.log('📚 Ver docs/SECRETS_MANAGEMENT.md para más detalles');
  
  rl.close();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  rl.close();
  process.exit(1);
});
