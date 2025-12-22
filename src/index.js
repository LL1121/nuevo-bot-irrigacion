require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/webhook', webhookRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Bot de WhatsApp - Irrigación funcionando correctamente');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📱 Webhook URL: http://localhost:${PORT}/webhook`);
});
