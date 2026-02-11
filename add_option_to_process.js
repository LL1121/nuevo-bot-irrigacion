const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'controllers', 'webhookController.js');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

console.log('📝 Agregando const optionToProcess...\n');

// Buscar la línea con "const currentState = userStates[from].step;"
let foundLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const currentState = userStates[from].step;')) {
    foundLine = i;
    break;
  }
}

if (foundLine !== -1) {
  console.log(`✅ Encontrado en línea ${foundLine + 1}`);
  
  // Obtener la indentación
  const indent = lines[foundLine].match(/^(\s*)/)[1];
  
  // Insertar la nueva línea después de currentState
  lines.splice(foundLine + 1, 0, `${indent}const optionToProcess = optionId || messageBody;`);
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  console.log('✅ const optionToProcess agregado exitosamente!');
} else {
  console.log('⚠️  No se encontró la línea');
}
