let deps = null;

const registerWebhookDeps = (next) => {
  deps = next;
};

const getWebhookDeps = () => {
  if (!deps) {
    throw new Error('registerWebhookDeps debe llamarse al cargar webhookController');
  }
  return deps;
};

module.exports = { registerWebhookDeps, getWebhookDeps };
