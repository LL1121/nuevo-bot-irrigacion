'use strict';

/**
 * flowCrypto.js — Utilidades criptográficas para WhatsApp Dynamic Flows
 *
 * Meta encripta la data del Flow con AES-128-GCM usando una clave efímera RSA OAEP.
 * Este módulo expone:
 *   - decryptRequest()   → descifra el payload entrante de Meta
 *   - encryptResponse()  → cifra la respuesta que le enviamos a Meta
 *
 * Referencias:
 *   https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint
 */

const crypto = require('crypto');

/**
 * Descifra el payload cifrado que envía Meta al endpoint de Data Exchange.
 *
 * @param {Object} payload
 * @param {string} payload.encrypted_aes_key   - Clave AES cifrada con RSA OAEP (base64)
 * @param {string} payload.encrypted_flow_data - Datos del Flow cifrados con AES-128-GCM (base64)
 * @param {string} payload.initial_vector      - IV original en base64 (16 bytes)
 * @param {string} privateKeyPem               - Clave privada RSA en formato PEM
 * @param {string} [passphrase]                - Passphrase de la clave privada (opcional)
 * @returns {{ decryptedBody: Object, aesKey: Buffer, iv: Buffer }}
 */
const decryptRequest = (payload, privateKeyPem, passphrase) => {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = payload;

  // 1 — Descifrar la clave AES con nuestra clave privada RSA (OAEP + SHA-256)
  const aesKey = crypto.privateDecrypt(
    {
      key: passphrase
        ? { key: privateKeyPem, passphrase }
        : privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(encrypted_aes_key, 'base64'),
  );

  // 2 — Separar auth tag (últimos 16 bytes) del ciphertext
  const flowDataBuffer = Buffer.from(encrypted_flow_data, 'base64');
  const TAG_LENGTH     = 16;
  const encryptedData  = flowDataBuffer.subarray(0, flowDataBuffer.length - TAG_LENGTH);
  const authTag        = flowDataBuffer.subarray(flowDataBuffer.length - TAG_LENGTH);

  const iv = Buffer.from(initial_vector, 'base64');

  // 3 — Descifrar con AES-128-GCM
  const decipher = crypto.createDecipheriv('aes-128-gcm', aesKey, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);

  return {
    decryptedBody: JSON.parse(decrypted.toString('utf8')),
    aesKey,
    iv,
  };
};

/**
 * Cifra la respuesta del servidor para enviarla de vuelta a Meta.
 * Meta exige que el IV de respuesta sea el IV original con todos sus bits invertidos.
 *
 * @param {Object} data    - Objeto a cifrar (será serializado a JSON)
 * @param {Buffer} aesKey  - La misma clave AES obtenida de decryptRequest()
 * @param {Buffer} iv      - El IV original obtenido de decryptRequest()
 * @returns {{ encrypted_data: string }} - Base64 de (ciphertext + auth tag)
 */
const encryptResponse = (data, aesKey, iv) => {
  // Invertir cada byte del IV (requisito de Meta para la respuesta)
  const flippedIv = Buffer.from(iv.map((byte) => ~byte & 0xff));

  const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, flippedIv);

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // Concatenar ciphertext + auth tag y devolver en base64
  return {
    encrypted_data: Buffer.concat([encrypted, tag]).toString('base64'),
  };
};

module.exports = { decryptRequest, encryptResponse };
