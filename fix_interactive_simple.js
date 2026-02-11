const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'controllers', 'webhookController.js');
let content = fs.readFileSync(filePath, 'utf8');
const originalContent = content;

console.log('📝 Aplicando fix para títulos completos en mensajes interactivos...\n');

// CAMBIO 1: Capturar título en lugar de ID (línea 100-107)
const oldCode1 = `        } else if (message.type === 'interactive') {
          // Puede ser list_reply o button_reply
          if (message.interactive.type === 'list_reply') {
            messageBody = message.interactive.list_reply.id;
          } else if (message.interactive.type === 'button_reply') {
            messageBody = message.interactive.button_reply.id;
          }`;

const newCode1 = `        } else if (message.type === 'interactive') {
          // Puede ser list_reply o button_reply
          let selectedOptionId = '';
          if (message.interactive.type === 'list_reply') {
            messageBody = message.interactive.list_reply.title || message.interactive.list_reply.id;
            selectedOptionId = message.interactive.list_reply.id;
          } else if (message.interactive.type === 'button_reply') {
            messageBody = message.interactive.button_reply.title || message.interactive.button_reply.id;
            selectedOptionId = message.interactive.button_reply.id;
          }
          // Guardar el ID para la lógica del bot
          message._optionId = selectedOptionId;`;

if (content.includes(oldCode1)) {
  content = content.replace(oldCode1, newCode1);
  console.log('✅ CAMBIO 1: Captura de título completado');
} else {
  console.log('⚠️  CAMBIO 1: Patrón no encontrado (posible problema de formato)');
}

// CAMBIO 2: Pasar optionId a handleUserMessage (cerca de línea 189)
const oldCode2 = 'await handleUserMessage(from, messageBody);';
const newCode2 = `const optionId = message._optionId || messageBody;
        await handleUserMessage(from, messageBody, optionId);`;

if (content.includes(oldCode2)) {
  // Buscar y reemplazar solo la primera ocurrencia en el contexto correcto
  const lines = content.split('\n');
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === oldCode2.trim() && !found) {
      lines[i] = lines[i].replace(oldCode2.trim(), newCode2.replace(/\n\s+/g, '\n' + lines[i].match(/^\s*/)[0]));
      found = true;
      break;
    }
  }
  if (found) {
    content = lines.join('\n');
    console.log('✅ CAMBIO 2: Paso de optionId completado');
  } else {
    console.log('⚠️  CAMBIO 2: No se pudo aplicar');
  }
} else {
  console.log('⚠️  CAMBIO 2: Patrón no encontrado');
}

// CAMBIO 3: Modificar firma de handleUserMessage (cerca de línea 207)
const oldCode3 = `const handleUserMessage = async (from, messageBody) => {
  const currentState = userStates[from].step;
  console.log(\`🔄 Estado actual de \${from}: \${currentState}\`);`;

const newCode3 = `const handleUserMessage = async (from, messageBody, optionId = null) => {
  const currentState = userStates[from].step;
  const optionToProcess = optionId || messageBody;
  console.log(\`🔄 Estado actual de \${from}: \${currentState}\`);`;

if (content.includes('const handleUserMessage = async (from, messageBody) => {')) {
  content = content.replace(
    'const handleUserMessage = async (from, messageBody) => {',
    'const handleUserMessage = async (from, messageBody, optionId = null) => {'
  );
  content = content.replace(
    'const currentState = userStates[from].step;\n  console.log(`🔄 Estado actual de ${from}: ${currentState}`);',
    'const currentState = userStates[from].step;\n  const optionToProcess = optionId || messageBody;\n  console.log(`🔄 Estado actual de ${from}: ${currentState}`);'
  );
  console.log('✅ CAMBIO 3: Firma de handleUserMessage modificada');
} else {
  console.log('⚠️  CAMBIO 3: Patrón no encontrado');
}

// CAMBIO 4: Usar optionToProcess en MAIN_MENU (cerca de línea 245)
const oldCode4 = "case 'MAIN_MENU':\n      await handleMainMenu(from, messageBody);";
const newCode4 = "case 'MAIN_MENU':\n      await handleMainMenu(from, optionToProcess);";

if (content.includes("case 'MAIN_MENU':")) {
  content = content.replace(
    /case 'MAIN_MENU':\s*await handleMainMenu\(from, messageBody\);/,
    "case 'MAIN_MENU':\n      await handleMainMenu(from, optionToProcess);"
  );
  console.log('✅ CAMBIO 4: Uso de optionToProcess en MAIN_MENU completado');
} else {
  console.log('⚠️  CAMBIO 4: Patrón no encontrado');
}

// Verificar si hubo cambios
if (content !== originalContent) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('\n✅ Cambios guardados exitosamente en webhookController.js');
  console.log('\n📌 IMPORTANTE: Debes reiniciar el servidor para que los cambios surtan efecto');
} else {
  console.log('\n⚠️  No se aplicaron cambios. Revisa los patrones.');
}
