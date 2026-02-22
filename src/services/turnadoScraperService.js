const puppeteer = require('puppeteer');
const browserPool = require('./browserPool');

const BASE_URL = 'https://irrigacionmalargue.com/login_g/turnado-online.php';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extrae información detallada de horarios haciendo click en "presiona aquí"
 * @param {Page} page - Página de Puppeteer
 * @returns {Promise<Object>} Información detallada de inicio y fin de turno
 */
async function extraerHorariosDetallados(page) {
  try {
    console.log('🔍 Buscando botón "presiona aquí"...');
    
    // Buscar y hacer click en el botón que contiene "presiona aquí"
    const clickedButton = await page.evaluate(() => {
      // Buscar todos los botones, enlaces y elementos clickeables
      const allElements = Array.from(document.querySelectorAll('button, a, span, div, input[type="button"]'));
      
      // Buscar el que contiene "presiona aquí" (case insensitive)
      const targetButton = allElements.find(el => {
        const text = (el.textContent || '').toLowerCase();
        return text.includes('presiona aquí') || text.includes('presiona aqui') || text.includes('presiona');
      });
      
      if (targetButton) {
        console.log('✅ Botón encontrado:', targetButton.textContent);
        targetButton.click();
        return true;
      }
      
      console.log('❌ No se encontró el botón "presiona aquí"');
      return false;
    });
    
    if (!clickedButton) {
      console.log('⚠️ No se pudo hacer click en el botón, continuando con datos generales');
      return null;
    }
    
    console.log('⏳ Esperando que aparezca el recuadro con horarios...');
    await delay(2500);
    
    // Extraer la información del recuadro nuevo
    const horariosDetallados = await page.evaluate(() => {
      console.log('🔍 Buscando horarios detallados...');
      
      // Obtener todo el texto visible de la página
      const pageText = document.body.innerText || document.body.textContent || '';
      console.log('📄 Texto de la página:\n', pageText);
      
      // Buscar todos los inputs (pueden ser inputs, divs, spans, etc.)
      const allElements = Array.from(document.querySelectorAll('input, div, span, p, label'));
      
      // Recopilar todos los valores visibles
      const valores = [];
      allElements.forEach(el => {
        const valor = el.value || el.textContent || el.innerText || '';
        const textoLimpio = valor.trim();
        
        // Solo si tiene contenido y no es muy largo (probablemente no sea contenedor)
        if (textoLimpio && textoLimpio.length < 100) {
          valores.push(textoLimpio);
        }
      });
      
      console.log('📋 Valores encontrados:', valores);
      
      // Buscar días de la semana
      const diasSemana = ['lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo'];
      
      // Patrones para buscar
      const dateTimePattern = /(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2})/;
      const horaPattern = /^(\d{1,2}:\d{2})$/;
      const diaPattern = new RegExp(`^(${diasSemana.join('|')})$`, 'i');
      
      let resultado = {
        encontrado: false,
        fechaInicio: null,
        diaInicio: null,
        horaInicio: null,
        diaFin: null,
        horaFin: null
      };
      
      // Buscar la secuencia en los valores
      for (let i = 0; i < valores.length - 4; i++) {
        const val0 = valores[i]; // Fecha + hora
        const val1 = valores[i + 1]; // Día inicio
        const val2 = valores[i + 2]; // Hora inicio
        const val3 = valores[i + 3]; // Día fin
        const val4 = valores[i + 4]; // Hora fin
        
        if (
          dateTimePattern.test(val0) &&
          diaPattern.test(val1) &&
          horaPattern.test(val2) &&
          diaPattern.test(val3) &&
          horaPattern.test(val4)
        ) {
          resultado = {
            encontrado: true,
            fechaInicio: val0,
            diaInicio: val1,
            horaInicio: val2,
            diaFin: val3,
            horaFin: val4
          };
          console.log('✅ Secuencia encontrada:', resultado);
          break;
        }
      }
      
      // Si no se encontró de forma directa, buscar en el texto de la página
      if (!resultado.encontrado) {
        console.log('🔍 Buscando en texto de página...');
        
        // Buscar fecha + hora
        const dateMatch = pageText.match(dateTimePattern);
        if (dateMatch) {
          resultado.fechaInicio = dateMatch[1];
          
          // Buscar días después de la fecha
          const diasMatches = Array.from(pageText.matchAll(new RegExp(`(${diasSemana.join('|')})`, 'ig')));
          if (diasMatches.length >= 2) {
            resultado.diaInicio = diasMatches[0][1];
            resultado.diaFin = diasMatches[1][1];
            
            // Buscar horas
            const horasMatches = Array.from(pageText.matchAll(horaPattern));
            if (horasMatches.length >= 2) {
              resultado.horaInicio = horasMatches[0][1];
              resultado.horaFin = horasMatches[1][1];
              resultado.encontrado = true;
            }
          }
        }
      }
      
      return resultado;
    });
    
    console.log('📅 Horarios detallados extraídos:', horariosDetallados);
    
    if (horariosDetallados.encontrado) {
      return {
        inicioDetallado: `${horariosDetallados.diaInicio} ${horariosDetallados.horaInicio}`,
        finDetallado: `${horariosDetallados.diaFin} ${horariosDetallados.horaFin}`,
        fechaInicioCompleta: horariosDetallados.fechaInicio
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ Error extrayendo horarios detallados:', error);
    return null;
  }
}

/**
 * Busca información de turnado por nombre y apellido
 * @param {string} nombreCompleto - APELLIDO seguido del nombre
 * @returns {Promise<Object>} Información del turno
 */
async function buscarPorTitular(nombreCompleto) {
  let browserData;
  let page;
  
  try {
    console.log(`🔍 Buscando turnado por titular: ${nombreCompleto}`);
    
    browserData = await browserPool.getBrowser();
    const browser = browserData.browser;
    page = await browser.newPage();
    
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1280, height: 720 });
    
    console.log('📄 Navegando a página de turnado...');
    await page.goto(BASE_URL, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Esperar a que la página cargue completamente
    await delay(2000);
    
    // Buscar y hacer click en el elemento que muestra el formulario de búsqueda por titular
    console.log('🖱️ Activando formulario de búsqueda por titular...');
    const formShown = await page.evaluate(() => {
      // Buscar elementos que puedan activar el formulario de titular
      // Puede ser un botón, enlace, o elemento clickeable
      const elements = Array.from(document.querySelectorAll('button, a, div[onclick], span[onclick]'));
      
      // Buscar elemento que mencione "titular" o que tenga onclick relacionado
      const targetElement = elements.find(el => {
        const text = (el.textContent || '').toLowerCase();
        const onclick = (el.getAttribute('onclick') || '').toLowerCase();
        
        return text.includes('titular') || onclick.includes('titular') || onclick.includes('showtitular');
      });
      
      if (targetElement) {
        targetElement.click();
        return true;
      }
      
      // Si no lo encuentra, intentar mostrar directamente el input
      const input = document.getElementById('titular');
      if (input && input.offsetParent === null) {
        // Está oculto, intentar hacer visible su contenedor
        let parent = input.parentElement;
        while (parent && parent !== document.body) {
          if (parent.style.display === 'none' || parent.hidden) {
            parent.style.display = 'block';
            parent.hidden = false;
          }
          parent = parent.parentElement;
        }
        return true;
      }
      
      return false;
    });
    
    console.log('🔍 Formulario activado:', formShown);
    await delay(1500);
    
    // Llenar el campo #titular directamente
    console.log('✍️ Ingresando nombre en campo #titular...');
    console.log('📝 Nombre:', nombreCompleto);
    
    try {
      await page.type('#titular', nombreCompleto, { delay: 50 });
      console.log('✅ Nombre ingresado via type');
    } catch (e) {
      console.log('⚠️ Error typing en #titular, usando setValue directo');
      await page.evaluate((value) => {
        const inp = document.getElementById('titular');
        if (inp) {
          inp.value = value;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, nombreCompleto);
      console.log('✅ Nombre seteado directamente');
    }
    
    await delay(500);
    
    // Click en botón "Buscar" de titular
    console.log('🔎 Haciendo click en Buscar (titular)...');
    await page.click('#buscadortitular');
    
    // Esperar resultados - aumentar tiempo
    console.log('⏳ Esperando resultados (5 segundos)...');
    await delay(5000);
    
    // Verificar URL actual
    const currentUrl = page.url();
    console.log('🌐 URL actual después de búsqueda:', currentUrl);
    await delay(2000);
    
    // Extraer información del recuadro de resultados
    console.log('📋 Extrayendo información del turno...');
    const turnoInfo = await page.evaluate(() => {
      // Buscar el contenedor de resultados
      const resultContainer = document.querySelector('.resultado, .info-turno, div[class*="result"]') || document.body;
      
      const text = resultContainer.innerText || resultContainer.textContent || '';
      
      // Extraer datos con patrones más flexibles
      const extractField = (patterns) => {
        for (const pattern of patterns) {
          const regex = new RegExp(pattern, 'im'); // m = multiline
          const match = text.match(regex);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
        return null;
      };
      
      return {
        rawText: text, // Incluir texto completo para debug
        inspeccion: extractField([
          'Inspección de cauce[:\\s]*([^\\n]+)',
          'Canal[:\\s]*([^\\n]+)',
          'Inspeccion[:\\s]*([^\\n]+)'
        ]),
        hijuela: extractField([
          'Hijuela[:\\s]*([^\\n]+)',
          'hijuela[:\\s]*([^\\n]+)',
          'HIJUELA[:\\s]*([^\\n]+)'
        ]),
        ccpp: extractField([
          'CC-PP[:\\s]*([\\d-]+)',
          'C\\.C\\.-?P\\.P\\.?[:\\s]*([\\d-]+)',
          'CCPP[:\\s]*([\\d-]+)',
          'Padrón[:\\s]*([\\d-]+)',
          'Padron[:\\s]*([\\d-]+)'
        ]),
        titular: extractField([
          'Titular[:\\s]*([^\\n]+)',
          'Nombre[:\\s]*([^\\n]+)'
        ]),
        inicioTurno: extractField([
          'inicio turno[:\\s]*\\n?([^\\n]+)',
          'Inicio de turno[:\\s]*\\n?([^\\n]+)',
          'Inicio del turno[:\\s]*\\n?([^\\n]+)',
          'Inicio[:\\s]*\\n?(\\d{1,2}[^\\n]+)',
          'Desde[:\\s]*\\n?(\\d{1,2}[^\\n]+)'
        ]),
        finTurno: extractField([
          'fin turno[:\\s]*\\n?([^\\n]+)',
          'Fin de turno[:\\s]*\\n?([^\\n]+)',
          'Fin del turno[:\\s]*\\n?([^\\n]+)',
          'Fin[:\\s]*\\n?(\\d{1,2}[^\\n]+)',
          'Hasta[:\\s]*\\n?(\\d{1,2}[^\\n]+)'
        ])
      };
    });
    
    console.log('📝 Texto completo capturado:');
    console.log(turnoInfo.rawText);
    console.log('✅ Información extraída:', turnoInfo);
    
    // Validar que se encontraron datos
    if (!turnoInfo.ccpp && !turnoInfo.titular) {
      throw new Error('No se encontró información del turno. Verifique que el nombre sea correcto.');
    }
    
    // Intentar extraer horarios detallados
    console.log('🕐 Intentando extraer horarios detallados...');
    const horariosDetallados = await extraerHorariosDetallados(page);
    
    // Si se encontraron horarios detallados, reemplazar los generales
    if (horariosDetallados) {
      console.log('✅ Horarios detallados obtenidos');
      turnoInfo.inicioTurno = horariosDetallados.inicioDetallado;
      turnoInfo.finTurno = horariosDetallados.finDetallado;
      turnoInfo.fechaInicioCompleta = horariosDetallados.fechaInicioCompleta;
    } else {
      console.log('ℹ️ Usando horarios generales');
    }
    
    return {
      success: true,
      data: turnoInfo
    };
    
  } catch (error) {
    console.error('❌ Error en scraping de turnado:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (_) {}
    }
    if (browserData) {
      await browserPool.releaseBrowser(browserData.browser);
    }
  }
}

/**
 * Busca información de turnado por C.C.-P.P.
 * @param {string} ccpp - Código C.C.-P.P. (sin ceros después del guión)
 * @returns {Promise<Object>} Información del turno
 */
async function buscarPorCCPP(ccpp) {
  let browserData;
  let page;
  
  try {
    console.log(`🔍 Buscando turnado por C.C.-P.P.: ${ccpp}`);
    
    browserData = await browserPool.getBrowser();
    const browser = browserData.browser;
    page = await browser.newPage();
    
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1280, height: 720 });
    
    console.log('📄 Navegando a página de turnado...');
    await page.goto(BASE_URL, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Esperar a que la página cargue completamente
    await delay(2000);
    
    // Activar formulario de C.C.-P.P.
    console.log('🖱️ Activando formulario de búsqueda por C.C.-P.P....');
    const formShown = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button, a, div[onclick], span[onclick]'));
      const targetElement = elements.find(el => {
        const text = (el.textContent || '').toLowerCase();
        const onclick = (el.getAttribute('onclick') || '').toLowerCase();
        return text.includes('ccpp') || text.includes('c.c.p.p') || onclick.includes('ccpp');
      });
      
      if (targetElement) {
        targetElement.click();
        return true;
      }
      
      const input = document.getElementById('ccpp');
      if (input && input.offsetParent === null) {
        let parent = input.parentElement;
        while (parent && parent !== document.body) {
          if (parent.style.display === 'none' || parent.hidden) {
            parent.style.display = 'block';
            parent.hidden = false;
          }
          parent = parent.parentElement;
        }
        return true;
      }
      return false;
    });
    
    console.log('🔍 Formulario activado:', formShown);
    await delay(1500);
    
    // Llenar el campo directamente
    console.log('✍️ Ingresando C.C.-P.P. en campo...');
    
    // Intentar con el ID que probablemente tenga
    const inputInfo = await page.evaluate(() => {
      // Primero intentar encontrar input#ccpp directamente
      let ccppInput = document.getElementById('ccpp');
      if (ccppInput) {
        return {
          id: 'ccpp',
          found: 'directById'
        };
      }
      
      // Si no, buscar en el formulario más cercano a buscadorccpp
      const form = document.getElementById('buscadorccpp')?.closest('form');
      if (form) {
        const inputs = Array.from(form.querySelectorAll('input[type="text"]'));
        console.log('Inputs encontrados en form:', inputs.length);
        inputs.forEach((inp, idx) => {
          console.log(`Input ${idx}: id="${inp.id}", name="${inp.name}", value="${inp.value}"`);
        });
        if (inputs.length > 0) {
          return {
            id: inputs[0].id,
            name: inputs[0].name,
            found: 'inForm'
          };
        }
      }
      
      // Último fallback: buscar cualquier input visible
      const allInputs = Array.from(document.querySelectorAll('input[type="text"]'));
      const visibleInputs = allInputs.filter(inp => inp.offsetParent !== null);
      console.log('Total inputs visibles:', visibleInputs.length);
      if (visibleInputs.length > 0) {
        return {
          id: visibleInputs[0].id,
          name: visibleInputs[0].name,
          found: 'firstVisible'
        };
      }
      
      return { found: 'notFound' };
    });
    
    console.log('📝 Input info encontrado:', inputInfo);
    console.log('📝 Ingresando C.C.-P.P.:', ccpp);
    
    if (inputInfo.id) {
      try {
        await page.type(`#${inputInfo.id}`, ccpp, { delay: 50 });
        console.log('✅ Valor ingresado en campo:', inputInfo.id);
      } catch (e) {
        console.log('⚠️ Error typing en #' + inputInfo.id + ':', e.message);
        // Fallback: usar setValue directo
        await page.evaluate((id, value) => {
          const inp = document.getElementById(id);
          if (inp) {
            inp.value = value;
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, inputInfo.id, ccpp);
        console.log('✅ Valor seteado directamente en:', inputInfo.id);
      }
    } else {
      console.log('❌ No se encontró input para C.C.-P.P.');
      throw new Error('No se encontró campo de entrada para C.C.-P.P. en la página');

    }
    
    await delay(500);
    
    // Click en botón "Buscar" de CCPP
    console.log('🔎 Haciendo click en Buscar (C.C.-P.P.)...');
    await page.click('#buscadorccpp');
    
    // Esperar resultados - aumentar tiempo de espera
    console.log('⏳ Esperando resultados (5 segundos)...');
    await delay(5000);
    
    // Verificar URL actual
    const currentUrl = page.url();
    console.log('🌐 URL actual después de búsqueda:', currentUrl);
    
    // Extraer información
    console.log('📋 Extrayendo información del turno...');
    const turnoInfo = await page.evaluate(() => {
      const resultContainer = document.querySelector('.resultado, .info-turno, div[class*="result"]') || document.body;
      const text = resultContainer.innerText || resultContainer.textContent || '';
      
      console.log('Texto completo encontrado:', text); // Debug
      
      const extractField = (patterns) => {
        for (const pattern of patterns) {
          const regex = new RegExp(pattern, 'im');
          const match = text.match(regex);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
        return null;
      };
      
      return {
        rawText: text,
        inspeccion: extractField([
          'Inspección de cauce[:\\s]*([^\\n]+)',
          'Canal[:\\s]*([^\\n]+)',
          'Inspeccion[:\\s]*([^\\n]+)'
        ]),
        hijuela: extractField([
          'Hijuela[:\\s]*([^\\n]+)',
          'hijuela[:\\s]*([^\\n]+)',
          'HIJUELA[:\\s]*([^\\n]+)'
        ]),
        ccpp: extractField([
          'CC-PP[:\\s]*([\\d-]+)',
          'C\\.C\\.-?P\\.P\\.?[:\\s]*([\\d-]+)',
          'CCPP[:\\s]*([\\d-]+)',
          'Padrón[:\\s]*([\\d-]+)',
          'Padron[:\\s]*([\\d-]+)'
        ]),
        titular: extractField([
          'Titular[:\\s]*([^\\n]+)',
          'Nombre[:\\s]*([^\\n]+)'
        ]),
        inicioTurno: extractField([
          'inicio turno[:\\s]*\\n?([^\\n]+)',
          'Inicio de turno[:\\s]*\\n?([^\\n]+)',
          'Inicio del turno[:\\s]*\\n?([^\\n]+)',
          'Inicio[:\\s]*\\n?(\\d{1,2}/\\d{1,2}/\\d{2,4}[^\\n]*)',
          'Desde[:\\s]*\\n?(\\d{1,2}/\\d{1,2}/\\d{2,4}[^\\n]*)'
        ]),
        finTurno: extractField([
          'fin turno[:\\s]*\\n?([^\\n]+)',
          'Fin de turno[:\\s]*\\n?([^\\n]+)',
          'Fin del turno[:\\s]*\\n?([^\\n]+)',
          'Fin[:\\s]*\\n?(\\d{1,2}/\\d{1,2}/\\d{2,4}[^\\n]*)',
          'Hasta[:\\s]*\\n?(\\d{1,2}/\\d{1,2}/\\d{2,4}[^\\n]*)'
        ])
      };
    });
    
    console.log('✅ Información extraída:', turnoInfo);
    
    if (!turnoInfo.ccpp && !turnoInfo.titular) {
      console.log('❌ No se encontró CC-PP ni Titular');
      console.log('Texto completo de la página:', turnoInfo.rawText);    console.log('⚠️ Posibles causas:');
    console.log('   1. El C.C.-P.P. no existe en el sistema');
    console.log('   2. El C.C.-P.P. está en un formato incorrecto');
    console.log('   3. La búsqueda no retornó resultados');      throw new Error('No se encontró información del turno. Verifique que el C.C.-P.P. sea correcto.');
    }
    
    // Intentar extraer horarios detallados
    console.log('🕐 Intentando extraer horarios detallados...');
    const horariosDetallados = await extraerHorariosDetallados(page);
    
    // Si se encontraron horarios detallados, reemplazar los generales
    if (horariosDetallados) {
      console.log('✅ Horarios detallados obtenidos');
      turnoInfo.inicioTurno = horariosDetallados.inicioDetallado;
      turnoInfo.finTurno = horariosDetallados.finDetallado;
      turnoInfo.fechaInicioCompleta = horariosDetallados.fechaInicioCompleta;
    } else {
      console.log('ℹ️ Usando horarios generales');
    }
    
    return {
      success: true,
      data: turnoInfo
    };
    
  } catch (error) {
    console.error('❌ Error en scraping de turnado:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (_) {}
    }
    if (browserData) {
      await browserPool.releaseBrowser(browserData.browser);
    }
  }
}

module.exports = {
  buscarPorTitular,
  buscarPorCCPP
};
