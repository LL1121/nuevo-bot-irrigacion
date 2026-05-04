const { AsyncLocalStorage } = require('async_hooks');
const botStateStore = require('./botStateStore');

const als = new AsyncLocalStorage();

/**
 * Estado mutable del usuario durante el manejo de un webhook (misma referencia que se persiste al final).
 * @returns {object}
 */
const botState = () => {
  const store = als.getStore();
  if (!store || !store.state) {
    throw new Error('botState() fuera de contexto de sesión del bot');
  }
  return store.state;
};

const tryBotState = () => {
  const store = als.getStore();
  return store?.state || null;
};

/**
 * Reemplaza el objeto de estado completo (p. ej. reset a START).
 * @param {object} next
 */
const replaceBotStateRoot = (next) => {
  const store = als.getStore();
  if (!store) {
    throw new Error('replaceBotStateRoot fuera de contexto');
  }
  store.state = next;
};

/**
 * @param {string} from
 * @param {object} state
 * @param {() => Promise<void>} fn
 */
const runBotStateSession = async (from, state, fn) => {
  const store = { from, state };
  return await als.run(store, async () => {
    try {
      await fn();
      await botStateStore.setUserState(from, store.state);
    } catch (err) {
      try {
        await botStateStore.setUserState(from, store.state);
      } catch (_) {
        // ignore
      }
      throw err;
    }
  });
};

module.exports = {
  botState,
  tryBotState,
  replaceBotStateRoot,
  runBotStateSession
};
