const { cacheGet, cacheSet, cacheExists, isRedisReady } = require('./cacheService');

const USER_KEY = (phone) => `bot:userState:${phone}`;
const PROCESSED_KEY = (messageId) => `bot:processedMsg:${messageId}`;

const USER_STATE_TTL_SEC = Number(process.env.BOT_USER_STATE_TTL_SEC || 604800);
const PROCESSED_TTL_SEC = Number(process.env.BOT_PROCESSED_MSG_TTL_SEC || 300);

const memoryUserStates = new Map();
const memoryProcessed = new Set();

const useMemoryFallback = () => {
  if (isRedisReady()) return false;
  return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
};

/**
 * @param {string} phone
 * @returns {Promise<object|null>}
 */
const getUserState = async (phone) => {
  const key = USER_KEY(phone);
  if (!useMemoryFallback()) {
    const data = await cacheGet(key);
    return data && typeof data === 'object' ? data : null;
  }
  return memoryUserStates.get(phone) || null;
};

/**
 * @param {string} phone
 * @param {object} state
 * @returns {Promise<void>}
 */
const setUserState = async (phone, state) => {
  const key = USER_KEY(phone);
  if (!useMemoryFallback()) {
    await cacheSet(key, state, USER_STATE_TTL_SEC);
    return;
  }
  memoryUserStates.set(phone, state);
};

/**
 * @param {string} messageId
 * @returns {Promise<boolean>}
 */
const isMessageProcessed = async (messageId) => {
  const key = PROCESSED_KEY(messageId);
  if (!useMemoryFallback()) {
    return cacheExists(key);
  }
  return memoryProcessed.has(messageId);
};

/**
 * @param {string} messageId
 * @returns {Promise<void>}
 */
const markMessageProcessed = async (messageId) => {
  const key = PROCESSED_KEY(messageId);
  if (!useMemoryFallback()) {
    await cacheSet(key, { t: Date.now() }, PROCESSED_TTL_SEC);
    return;
  }
  memoryProcessed.add(messageId);
  setTimeout(() => memoryProcessed.delete(messageId), PROCESSED_TTL_SEC * 1000);
};

/** Solo tests: sembrar estado en memoria */
const _testSetUserState = (phone, partial) => {
  const prev = memoryUserStates.get(phone) || {};
  memoryUserStates.set(phone, { ...prev, ...partial });
};

const _testClearAll = () => {
  memoryUserStates.clear();
  memoryProcessed.clear();
};

module.exports = {
  getUserState,
  setUserState,
  isMessageProcessed,
  markMessageProcessed,
  _testSetUserState,
  _testClearAll
};
