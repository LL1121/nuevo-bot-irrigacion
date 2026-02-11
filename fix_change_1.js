const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'controllers', 'webhookController.js');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

console.log('📝 Aplicando CAMBIO 1: Capturar títulos en mensajes interactivos...\n');

// Buscar la línea exacta
let foundLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('messageBody = message.interactive.list_reply.id;')) {
    foundLine = i;
    break;
  }
}

if (foundLine !== -1) {
  console.log(`✅ Encontrado en línea ${foundLine + 1}`);
  
  // Encontrar el inicio del bloque (línea con "} else if (message.type === 'interactive') {")
  let startLine = -1;
  for (let i = foundLine; i >= 0; i--) {
    if (lines[i].includes("} else if (message.type === 'interactive') {")) {
      startLine = i;
      break;
    }
  }
  
  // Encontrar el final del bloque (próximo "} else if")
  let endLine = -1;
  for (let i = foundLine; i < lines.length; i++) {
    if (i > foundLine && lines[i].includes("} else if (message.type === ")) {
      endLine = i - 1;
      break;
    }
  }
  
  if (startLine !== -1 && endLine !== -1) {
    console.log(`📍 Bloque encontrado: líneas ${startLine + 1} a ${endLine + 1}`);
    
    // Obtener la indentación base
    const baseIndent = lines[startLine].match(/^(\s*)/)[1];
    const innerIndent = baseIndent + '  ';
    const deepIndent = baseIndent + '    ';
    const deeperIndent = baseIndent + '      ';
    
    // Crear el nuevo código
    const newCode = [
      `${baseIndent}} else if (message.type === 'interactive') {`,
      `${innerIndent}// Puede ser list_reply o button_reply`,
      `${innerIndent}let selectedOptionId = '';`,
      `${innerIndent}if (message.interactive.type === 'list_reply') {`,
      `${deepIndent}messageBody = message.interactive.list_reply.title || message.interactive.list_reply.id;`,
      `${deepIndent}selectedOptionId = message.interactive.list_reply.id;`,
      `${innerIndent}} else if (message.interactive.type === 'button_reply') {`,
      `${deepIndent}messageBody = message.interactive.button_reply.title || message.interactive.button_reply.id;`,
      `${deepIndent}selectedOptionId = message.interactive.button_reply.id;`,
      `${innerIndent}}`,
      `${innerIndent}// Guardar el ID para la lógica del bot`,
      `${innerIndent}message._optionId = selectedOptionId;`
    ];
    
    // Reemplazar las líneas
    const newLines = [
      ...lines.slice(0, startLine),
      ...newCode,
      ...lines.slice(endLine + 1)
    ];
    
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
    console.log('\n✅ CAMBIO 1 aplicado exitosamente!');
    console.log('\n📌 IMPORTANTE: Debes reiniciar el servidor para que los cambios surtan efecto');
  } else {
    console.log('⚠️  No se pudo determinar el bloque completo');
  }
} else {
  console.log('⚠️  No se encontró la línea con message.interactive.list_reply.id');
}
