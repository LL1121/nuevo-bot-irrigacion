const axios = require('axios');

(async () => {
  try {
    const login = await axios.post('http://localhost:3000/api/auth/login', { username: 'admin', password: 'admin123' });
    const token = login.data.token;
    console.log('Token OK');

    const headers = { Authorization: `Bearer ${token}` };
    const phone = '5492614666411';

    const payload = { templateName: 'hello_world', languageCode: 'en_US' };
    const resp = await axios.post(`http://localhost:3000/api/chats/${phone}/reactivate`, payload, { headers });
    console.log('Reactivate OK:', resp.data);
  } catch (e) {
    console.error('Error:', e.response?.data || e.message);
    process.exit(1);
  }
})();
