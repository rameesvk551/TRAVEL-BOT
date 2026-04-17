const crypto = require('crypto');

function getWhatsappFlowPrivateKey() {
  const raw = String(process.env.WHATSAPP_FLOW_PRIVATE_KEY || '').trim();
  if (!raw) {
    throw new Error('WHATSAPP_FLOW_PRIVATE_KEY is not configured');
  }

  return raw.startsWith('LS0t')
    ? Buffer.from(raw, 'base64').toString('utf8')
    : raw;
}

function decryptFlowRequest(encryptedAesKey, encryptedFlowData, initialVector) {
  const privateKey = crypto.createPrivateKey({
    key: getWhatsappFlowPrivateKey(),
    format: 'pem',
  });

  const decryptedAesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(encryptedAesKey, 'base64')
  );

  const flowDataBuffer = Buffer.from(encryptedFlowData, 'base64');
  const ivBuffer = Buffer.from(initialVector, 'base64');
  const authTagLength = 16;
  const encryptedData = flowDataBuffer.subarray(0, flowDataBuffer.length - authTagLength);
  const authTag = flowDataBuffer.subarray(flowDataBuffer.length - authTagLength);

  const decipher = crypto.createDecipheriv('aes-128-gcm', decryptedAesKey, ivBuffer);
  decipher.setAuthTag(authTag);

  let decryptedData = decipher.update(encryptedData);
  decryptedData = Buffer.concat([decryptedData, decipher.final()]);

  return {
    decryptedBody: JSON.parse(decryptedData.toString('utf8')),
    aesKeyBuffer: decryptedAesKey,
    initialVectorBuffer: ivBuffer,
  };
}

function encryptFlowResponse(responseObj, aesKeyBuffer, initialVectorBuffer) {
  const flippedIv = Buffer.alloc(initialVectorBuffer.length);
  for (let i = 0; i < initialVectorBuffer.length; i += 1) {
    flippedIv[i] = ~initialVectorBuffer[i];
  }

  const cipher = crypto.createCipheriv('aes-128-gcm', aesKeyBuffer, flippedIv);
  const responseStr = JSON.stringify(responseObj);
  let encrypted = cipher.update(responseStr, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const authTag = cipher.getAuthTag();
  return Buffer.concat([encrypted, authTag]).toString('base64');
}

function getWhatsappFlowPublicKeyPem() {
  const privateKeyPem = getWhatsappFlowPrivateKey();
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  return crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });
}

module.exports = {
  decryptFlowRequest,
  encryptFlowResponse,
  getWhatsappFlowPrivateKey,
  getWhatsappFlowPublicKeyPem,
};
