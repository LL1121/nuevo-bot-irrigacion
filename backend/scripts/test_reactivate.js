const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OPERATOR_USERNAME = process.env.OPERATOR_USERNAME || 'admin';
const OPERATOR_PASSWORD = process.env.OPERATOR_PASSWORD;
const TARGET_PHONE = process.env.TARGET_PHONE || '5492614666411';
const TEMPLATE_NAME = process.env.TEMPLATE_NAME || 'hello_world';
const LANGUAGE_CODE = process.env.LANGUAGE_CODE || 'en_US';

if (!OPERATOR_PASSWORD) {
  throw new Error('Falta OPERATOR_PASSWORD en variables de entorno');
}

(async () => {
  try {
    const login = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: OPERATOR_USERNAME,
      password: OPERATOR_PASSWORD
    });
    const token = login.data.token;
    console.log('Token OK');

    const headers = { Authorization: `Bearer ${token}` };

    const payload = { templateName: TEMPLATE_NAME, languageCode: LANGUAGE_CODE };
    const resp = await axios.post(`${BASE_URL}/api/chats/${TARGET_PHONE}/reactivate`, payload, { headers });
    console.log('Reactivate OK:', resp.data);
  } catch (e) {
    console.error('Error:', e.response?.data || e.message);
    process.exit(1);
  }
})();
