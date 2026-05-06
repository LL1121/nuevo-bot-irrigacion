const { botState } = require('../../services/botStateContext');
const { getWebhookDeps } = require('./webhookDeps');
const logger = require('../../services/logService');

/**
 * Orquestación del flujo conversacional por estado (antes en webhookController).
 */
module.exports = async function handleUserMessageFlow(from, messageBody, optionId = null) {
  const d = getWebhookDeps();
  const currentState = botState().step;
  const optionToProcess = optionId || messageBody;


  if (messageBody === 'btn_descargar_boleto') {
    await d.handleDescargarBoleto(from);
    return;
  }

  if (messageBody === 'btn_cambiar_dni') {
    const changeDniMsg = '📝 Entendido. Por favor escribí el nuevo DNI o CUIT a consultar (sin puntos ni guiones).';
    await d.sendMessageAndSave(from, changeDniMsg);
    botState().step = 'AWAITING_DNI';
    return;
  }

  switch (currentState) {
    case 'START':
    default: {
      const startContext = d.buildStartContext(botState());
      const shouldHandleSubdelegacionAfterGreeting =
        startContext.needsSubdelegacionPrompt &&
        startContext.hasName &&
        !startContext.needsNamePrompt;

      if (startContext.shouldGreet && !shouldHandleSubdelegacionAfterGreeting) {
        await d.sendWelcomeMessage(from, startContext);
        botState().shouldGreet = false;
      }

      if (startContext.needsNamePrompt && !botState().namePromptSent) {
        botState().namePromptSent = true;
        botState().step = 'AWAITING_USER_NAME';
        break;
      }

      if (startContext.needsSubdelegacionPrompt) {
        if (startContext.hasName) {
          const firstName = d.formatPersonName(botState().nombreCliente).split(' ')[0];
          const subdelegacionIntro = startContext.shouldGreet
            ? `👋 ¡Hola *${firstName}*! Antes de continuar seleccioná tu subdelegación.`
            : 'Antes de continuar seleccioná tu subdelegación.';
          await d.sendMessageAndSave(from, subdelegacionIntro);
          botState().shouldGreet = false;
        }
        await d.sendSubdelegacionPrompt(from);
        botState().step = 'AWAITING_SUBDELEGACION';
        break;
      }

      await d.sendMenuList(from, false);
      botState().step = 'MAIN_MENU';
      break;
    }

    case 'MAIN_MENU':
      await d.handleMainMenu(from, optionToProcess);
      break;

    case 'AWAITING_DNI':
      await d.handleDniInput(from, messageBody);
      break;

    case 'AWAITING_SUBDELEGACION':
      await d.handleSubdelegacionChoice(from, optionToProcess, messageBody);
      break;

    case 'AWAITING_DNI_BOLETO':
      await d.handleDniInputBoleto(from, messageBody);
      break;

    case 'AWAITING_MODO_CONSULTA': {
      const candidate = optionToProcess || messageBody;
      const menuKey = d.resolveMainMenuKey(candidate);
      if (menuKey && d.mainMenuRowIds.has(menuKey)) {
        botState().step = 'MAIN_MENU';
        await d.handleMainMenu(from, menuKey);
        break;
      }
      await d.handleModoConsulta(from, optionToProcess);
      break;
    }

    case 'AWAITING_DNI_CHOICE':
      await d.handleDniChoice(from, optionToProcess);
      break;

    case 'AWAITING_PADRON_GLOBAL_CHOICE':
      await d.handlePadronGlobalChoice(from, optionToProcess);
      break;

    case 'AWAITING_PADRON_CHOICE':
      await d.handlePadronChoice(from, optionToProcess);
      break;

    case 'AWAITING_DNI_PADRON_SELECTION':
      await d.handleDniPadronSelectionChoice(from, optionToProcess);
      break;

    case 'AWAITING_DNI_PADRON_SEARCH':
      await d.handleDniPadronSearchInput(from, messageBody);
      break;

    case 'AWAITING_TIPO_PADRON':
      await d.handleTipoPadron(from, optionToProcess);
      break;

    case 'AWAITING_PADRON_SUPERFICIAL':
      await d.handlePadronSuperficial(from, messageBody);
      break;

    case 'AWAITING_PADRON_SUBTERRANEO':
      await d.handlePadronSubterraneo(from, messageBody);
      break;

    case 'AWAITING_PADRON_CONTAMINACION':
      await d.handlePadronContaminacion(from, messageBody);
      break;

    case 'AWAITING_USER_NAME':
      await d.handleUserNameInput(from, messageBody);
      break;

    case 'AWAITING_TIPO_CUOTA':
      await d.handleTipoCuota(from, optionToProcess);
      break;

    case 'AWAITING_TIPO_CUOTA_PADRON':
      await d.handleTipoCuotaPadron(from, optionToProcess);
      break;

    case 'AWAITING_BOLETO_POST_DEUDA':
      await d.handlePostDeudaBoletoChoice(from, optionToProcess);
      break;

    case 'AWAITING_PAGO_DEUDA':
      await d.handlePagoDeudaChoice(from, optionToProcess);
      break;

    case 'AWAITING_PAGO_BOLETO':
      await d.handlePagoBoletoChoice(from, optionToProcess);
      break;

    case 'AWAITING_PERFORACION_HELP':
      await d.handlePerforacionHelpChoice(from, optionToProcess);
      break;

    case 'AWAITING_OPCION_BOLETO_PADRON':
      await d.handleOpcionBoletoPadron(from, optionToProcess);
      break;

    case 'AWAITING_PADRON':
      await d.handlePadronInput(from, messageBody);
      break;

    case 'AWAITING_TURNO_METHOD':
      await d.handleTurnoMethodChoice(from, optionToProcess);
      break;

    case 'AWAITING_TURNO_TITULAR_CHOICE':
      await d.handleTurnoTitularChoice(from, optionToProcess);
      break;

    case 'AWAITING_TURNO_TITULAR':
      await d.handleTurnoTitularInput(from, messageBody);
      break;

    case 'AWAITING_TURNO_TITULAR_API_OPTION':
      await d.handleTurnoTitularApiOptionInput(from, messageBody);
      break;

    case 'AWAITING_TURNO_CCPP_CHOICE':
      await d.handleTurnoCCPPChoice(from, optionToProcess);
      break;

    case 'AWAITING_TURNO_CCPP':
      await d.handleTurnoCCPPInput(from, messageBody);
      break;

    case 'AUTH_MENU':
      await d.handleAuthMenu(from, messageBody);
      break;

    case 'AWAITING_OPERATOR_CHOICE': {
      logger.info(`🔵 Opción recibida en AWAITING_OPERATOR_CHOICE: "${optionToProcess}"`);
      if (optionToProcess === 'op_si_operador') {
        const handoff = await d.intentarDerivarOperador(from, 'SCRAPER_ERROR_OPERATOR_CHOICE');
        if (handoff.enEspera) {
          botState().step = 'AWAITING_OPERATOR_ASSIGNMENT';
          logger.info(`👤 Usuario ${from} en espera de operador por error en scraper`);
        } else if (handoff.fueraHorario) {
          botState().step = 'MAIN_MENU';
          logger.info(`🕒 Fuera de horario de operador para ${from}`);
        } else {
          botState().step = 'MAIN_MENU';
        }
      } else if (optionToProcess === 'op_no_operador') {
        await d.sendMenuList(from, true);
        botState().step = 'MAIN_MENU';
        logger.info(`📋 Usuario ${from} continúa con menú principal después de error`);
      } else if (optionToProcess === 'op_reintentar_dni') {
        const retryMsg = `📝 Ingresá nuevamente tu DNI/CUIT.\n\nPor favor, verificá que el número sea correcto.`;
        await d.sendMessageAndSave(from, retryMsg);
        botState().step = 'AWAITING_DNI';
        logger.info(`🔄 Usuario ${from} reintentando con nuevo DNI`);
      } else {
        logger.warn(`⚠️ Opción no reconocida en AWAITING_OPERATOR_CHOICE: "${optionToProcess}"`);
        const invalidMsg = '❌ Opción no válida. Por favor, elige una de las opciones disponibles.';
        await d.sendMessageAndSave(from, invalidMsg);
      }
      break;
    }

    case 'AWAITING_OPERATOR_ASSIGNMENT':
      await d.handleOperatorWaitingInput(from, messageBody, optionToProcess);
      break;

    case 'AWAITING_OPERATOR_SURVEY':
      await d.handleOperatorSurveyResponse(from, optionToProcess);
      break;

    case 'AWAITING_OPINION_CHOICE':
      await d.handleOpinionChoice(from, optionToProcess);
      break;

    case 'AWAITING_OPINION_TEXT':
      await d.handleOpinionText(from, messageBody);
      break;

    case 'AWAITING_OPERATOR_FOLLOWUP':
      await d.handleOperatorPostFollowUp(from, optionToProcess);
      break;
  }
};
