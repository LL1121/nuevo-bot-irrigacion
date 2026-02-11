const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'controllers', 'webhookController.js');
let content = fs.readFileSync(filePath, 'utf8');

console.log('📝 Aplicando cambios para mostrar títulos completos...\n');

// CAMBIO 1: Capturar título en lugar de ID
const oldInteractive = `        } else if (message.type === 'interactive') {
          // Puede ser list_reply o button_reply
          if (message.interactive.type === 'list_reply') {
            messageBody = message.interactive.list_reply.id;
          } else if (message.interactive.type === 'button_reply') {
            messageBody = message.interactive.button_reply.id;
          }
        }`;

const newInteractive = `        } else if (message.type === 'interactive') {
          // Capturar el TÍTULO completo (con emoji) para mostrar al operador
          let selectedOptionId = '';
          if (message.interactive.type === 'list_reply') {
            messageBody = message.interactive.list_reply.title || message.interactive.list_reply.id;
            selectedOptionId = message.interactive.list_reply.id;
          } else if (message.interactive.type === 'button_reply') {
            messageBody = message.interactive.button_reply.title || message.interactive.button_reply.id;
            selectedOptionId = message.interactive.button_reply.id;
          }
          // Guardar el ID para usarlo en la lógica del bot
          message._optionId = selectedOptionId;
        }`;

if (content.includes(oldInteractive)) {
  content = content.replace(oldInteractive, newInteractive);
  console.log('✅ CAMBIO 1: Captura de título aplicado');
} else {
  console.log('⚠️  CAMBIO 1: No se encontró el patrón exacto');
}

// CAMBIO 2: Pasar optionId a handleUserMessage
const oldHandleCall = `        // Procesar mensaje según el estado actual
        await handleUserMessage(from, messageBody);`;

const newHandleCall = `        // Procesar mensaje según el estado actual
        const optionId = message._optionId || messageBody;
        await handleUserMessage(from, messageBody, optionId);`;

if (content.includes(oldHandleCall)) {
  content = content.replace(oldHandleCall, newHandleCall);
  console.log('✅ CAMBIO 2: Llamada a handleUserMessage actualizada');
} else {
  console.log('⚠️  CAMBIO 2: No se encontró el patrón exacto');
}

// CAMBIO 3: Modificar firma de handleUserMessage
const oldSignature = `const handleUserMessage = async (from, messageBody) => {
  const currentState = userStates[from].step;

  console.log(\`🔄 Estado actual de \${from}: \${currentState}\`);`;

const newSignature = `const handleUserMessage = async (from, messageBody, optionId = null) => {
  const currentState = userStates[from].step;
  
  // Usar optionId para la lógica del bot si está disponible (menú interactivo)
  const optionToProcess = optionId || messageBody;

  console.log(\`🔄 Estado actual de \${from}: \${currentState}\`);`;

if (content.includes(oldSignature)) {
  content = content.replace(oldSignature, newSignature);
  console.log('✅ CAMBIO 3: Firma de handleUserMessage actualizada');
} else {
  console.log('⚠️  CAMBIO 3: No se encontró el patrón exacto');
}

// CAMBIO 4: Usar optionToProcess en MAIN_MENU
const oldMainMenu = `    case 'MAIN_MENU':
      await handleMainMenu(from, messageBody);
      break;`;

const newMainMenu = `    case 'MAIN_MENU':
      await handleMainMenu(from, optionToProcess);
      break;`;

if (content.includes(oldMainMenu)) {
  content = content.replace(oldMainMenu, newMainMenu);
  console.log('✅ CAMBIO 4: Uso de optionToProcess aplicado');
} else {
  console.log('⚠️  CAMBIO 4: No se encontró el patrón exacto');
}

// Guardar el archivo modificado
fs.writeFileSync(filePath, content, 'utf8');
console.log('\n✅ Cambios aplicados correctamente en webhookController.js');
console.log('📋 Ahora el operador verá "📍 Ubicación y Horarios" en lugar de "ubicacion"');
