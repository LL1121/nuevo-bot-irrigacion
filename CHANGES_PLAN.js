// CAMBIOS NECESARIOS para mostrar títulos completos en lugar de IDs

// 1. En la captura del mensaje (línea ~100-110):
// ANTES:
} else if (message.type === 'interactive') {
  if (message.interactive.type === 'list_reply') {
    messageBody = message.interactive.list_reply.id;
  } else if (message.interactive.type === 'button_reply') {
    messageBody = message.interactive.button_reply.id;
  }
}

// DESPUÉS:
} else if (message.type === 'interactive') {
  let selectedOptionId = '';
  if (message.interactive.type === 'list_reply') {
    // Guardar el TÍTULO completo para mostrar al operador
    messageBody = message.interactive.list_reply.title || message.interactive.list_reply.id;
    // Guardar el ID para la lógica del bot
    selectedOptionId = message.interactive.list_reply.id;
  } else if (message.interactive.type === 'button_reply') {
    messageBody = message.interactive.button_reply.title || message.interactive.button_reply.id;
    selectedOptionId = message.interactive.button_reply.id;
  }
  // Pasar el ID a handleUserMessage para la lógica del bot
  message._optionId = selectedOptionId;
}

// 2. Modificar handleUserMessage (línea ~208):
// ANTES:
await handleUserMessage(from, messageBody);

// DESPUÉS:
const optionId = message._optionId || messageBody; // Usar ID si está disponible, sino messageBody
await handleUserMessage(from, messageBody, optionId);

// 3. Modificar la firma de handleUserMessage (línea ~208):
// ANTES:
const handleUserMessage = async (from, messageBody) => {

// DESPUÉS:
const handleUserMessage = async (from, messageBody, optionId = null) => {
  const currentState = userStates[from].step;
  
  // Usar optionId para la lógica del bot si está disponible
  const optionToProcess = optionId || messageBody;

// 4. En handleMainMenu, usar optionToProcess:
// ANTES:
case 'MAIN_MENU':
  await handleMainMenu(from, messageBody);
  break;

// DESPUÉS:
case 'MAIN_MENU':
  await handleMainMenu(from, optionToProcess);
  break;
