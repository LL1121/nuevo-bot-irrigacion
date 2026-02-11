const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'controllers', 'webhookController.js');
let content = fs.readFileSync(filePath, 'utf8');

console.log('📝 Aplicando cambios para mostrar títulos completos...\n');

// CAMBIO 1: Capturar título en lugar de ID (usando el formato exacto del archivo)
const oldPattern1 = `        } else if (message.type === 'interactive') {
          // Puede ser list_reply o button_reply
          if (message.interactive.type === 'list_reply') {
            messageBody = message.interactive.list_reply.id;
          } else if (message.interactive.type === 'button_reply') {
            messageBody = message.interactive.button_reply.id;
          }
        }`;

const newPattern1 = `        } else if (message.type === 'interactive') {
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

if (content.includes(oldPattern1)) {
  content = content.replace(oldPattern1, newPattern1);
  console.log('✅ CAMBIO 1: Captura de título completo aplicado');
} else {
  console.log('⚠️  CAMBIO 1: Patrón no encontrado');
}

// CAMBIO 2: Pasar optionId a handleUserMessage
const oldPattern2 = `        // Procesar mensaje según el estado actual
        await handleUserMessage(from, messageBody);`;

const newPattern2 = `        // Procesar mensaje según el estado actual
        const optionId = message._optionId || messageBody;
        await handleUserMessage(from, messageBody, optionId);`;

if (content.includes(oldPattern2)) {
  content = content.replace(oldPattern2, newPattern2);
  console.log('✅ CAMBIO 2: Llamada a handleUserMessage actualizada');
} else {
  console.log('⚠️  CAMBIO 2: Patrón no encontrado');
}

// CAMBIO 3: Modificar firma de handleUserMessage
const oldPattern3 = `const handleUserMessage = async (from, messageBody) => {
  const currentState = userStates[from].step;

  console.log(\`🔄 Estado actual de \${from}: \${currentState}\`);`;

const newPattern3 = `const handleUserMessage = async (from, messageBody, optionId = null) => {
  const currentState = userStates[from].step;
  
  // Usar optionId para la lógica del bot si está disponible (menú interactivo)
  const optionToProcess = optionId || messageBody;

  console.log(\`🔄 Estado actual de \${from}: \${currentState}\`);`;

if (content.includes(oldPattern3)) {
  content = content.replace(oldPattern3, newPattern3);
  console.log('✅ CAMBIO 3: Firma de handleUserMessage actualizada');
} else {
  console.log('⚠️  CAMBIO 3: Patrón no encontrado');
}

// CAMBIO 4: Usar optionToProcess en MAIN_MENU
const oldPattern4 = `    case 'MAIN_MENU':
      await handleMainMenu(from, messageBody);
      break;`;

const newPattern4 = `    case 'MAIN_MENU':
      await handleMainMenu(from, optionToProcess);
      break;`;

if (content.includes(oldPattern4)) {
  content = content.replace(oldPattern4, newPattern4);
  console.log('✅ CAMBIO 4: Uso de optionToProcess aplicado');
} else {
  console.log('⚠️  CAMBIO 4: Patrón no encontrado');
}

// Guardar el archivo modificado
fs.writeFileSync(filePath, content, 'utf8');
console.log('\n✅ Cambios guardados en webhookController.js');
console.log('📋 Ahora el operador verá "📍 Ubicación y Horarios" en lugar de "ubicacion"');
