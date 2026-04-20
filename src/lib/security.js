import crypto from 'crypto';

/**
 * Lightweight sanitization for LinkedIn data.
 * Replaces heavy DOMPurify/JSDOM for serverless compatibility.
 */
export const sanitizeData = (content) => {
  if (typeof content !== 'string') return content;
  
  // Basic HTML tag stripping but keeping safe ones if needed
  // Since jsPDF is used on client, we just need clean strings
  return content
    .replace(/<[^>]*>?/gm, '') // Remove all HTML tags
    .replace(/[<>]/g, '')      // Remove any lingering brackets
    .trim();
};

// Encryption Configuration
const ALGORITHM = 'aes-256-cbc';
// Fallback key for build-time safety
const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY || 'f7d4bdee0027fae15a61fb19f40747f43d79398bb06f233b9fbfd2e93a7e53fc'; 
const IV_LENGTH = 16;

export const encrypt = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.substring(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

export const decrypt = (text) => {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.substring(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return text; // Fallback to raw text if decryption fails
  }
};
