/**
 * betCrypto.js
 * Client-side AES-256-GCM encryption for private bets.
 * All crypto uses the browser's built-in Web Crypto API — no external dependencies.
 *
 * Key format: 64-character hex string (32 bytes).
 * Encrypted format: "enc:<base64(12-byte-IV + ciphertext)>"
 * Invite link fragment: "#key=<hexKey>"
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function importKey(hexKey, usage) {
  const keyBytes = hexToBytes(hexKey);
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [usage]);
}

// ─── Key generation ──────────────────────────────────────────────────────────

/**
 * Generate a random 256-bit key, returned as a 64-char hex string.
 * This is also the on-chain invite key (passed as bytes32 to registerWithKey).
 */
export function generateBetKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToHex(bytes);
}

/**
 * Convert a hex key to the 0x-prefixed bytes32 form needed by ethers.js / the contract.
 */
export function hexKeyToBytes32(hexKey) {
  return "0x" + hexKey;
}

// ─── Encrypt / Decrypt ──────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string.
 * @returns {Promise<string>} "enc:<base64>" — safe to store on-chain or in MongoDB.
 */
export async function encryptText(text, hexKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await importKey(hexKey, "encrypt");
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      new TextEncoder().encode(text)
    )
  );
  const combined = new Uint8Array(12 + ciphertext.length);
  combined.set(iv);
  combined.set(ciphertext, 12);
  return "enc:" + btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt an "enc:<base64>" string back to plaintext.
 * Returns the original string unchanged if it doesn't start with "enc:".
 */
export async function decryptText(encryptedStr, hexKey) {
  if (!encryptedStr || !encryptedStr.startsWith("enc:")) return encryptedStr;
  try {
    const combined = Uint8Array.from(atob(encryptedStr.slice(4)), (c) =>
      c.charCodeAt(0)
    );
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const cryptoKey = await importKey(hexKey, "decrypt");
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null; // wrong key or corrupted data
  }
}

/**
 * Encrypt both title and description for a private bet.
 */
export async function encryptBetContent({ title, description }, hexKey) {
  const [encryptedTitle, encryptedDescription] = await Promise.all([
    encryptText(title, hexKey),
    encryptText(description, hexKey),
  ]);
  return { encryptedTitle, encryptedDescription };
}

/**
 * Decrypt both title and description fetched from the backend.
 * Returns null values for any field that can't be decrypted.
 */
export async function decryptBetContent(
  { encryptedTitle, encryptedDescription },
  hexKey
) {
  const [title, description] = await Promise.all([
    decryptText(encryptedTitle, hexKey),
    decryptText(encryptedDescription, hexKey),
  ]);
  return { title, description };
}

// ─── Proof URL encryption ────────────────────────────────────────────────────

/**
 * Encrypt a proof URL for a private bet.
 * Returns "enc:<base64>" — prepend "enc://" on-chain for URL scheme validation.
 */
export async function encryptProofUrl(url, hexKey) {
  const blob = await encryptText(url, hexKey);
  // On-chain format: "enc://<base64>" passes the _isValidUrlScheme check
  return "enc://" + blob.slice(4); // replace "enc:" prefix with "enc://"
}

/**
 * Decrypt a proof URL that was stored as "enc://<base64>".
 */
export async function decryptProofUrl(encUrl, hexKey) {
  if (!encUrl || !encUrl.startsWith("enc://")) return encUrl;
  return decryptText("enc:" + encUrl.slice(6), hexKey);
}

// ─── Invite link ─────────────────────────────────────────────────────────────

/**
 * Build an invite link. The key travels in the URL fragment (#) which is
 * never sent to the server — end-to-end private.
 */
export function buildInviteLink(betAddress, hexKey) {
  const base = window.location.origin;
  return `${base}/BetDetails?address=${betAddress}#key=${hexKey}`;
}

/**
 * Extract a 64-char hex key from the current URL's hash (invite link).
 * Returns null if not present.
 */
export function extractKeyFromHash() {
  const match = window.location.hash.match(/#key=([0-9a-fA-F]{64})/);
  return match ? match[1] : null;
}

// ─── LocalStorage key store (scoped per wallet address) ──────────────────────

function storeKey(walletAddress) {
  return `proofbet_private_keys_${(walletAddress || "").toLowerCase()}`;
}

function readStore(walletAddress) {
  try {
    return JSON.parse(localStorage.getItem(storeKey(walletAddress)) || "{}");
  } catch {
    return {};
  }
}

export function savePrivateKey(betAddress, hexKey, walletAddress) {
  const store = readStore(walletAddress);
  store[betAddress.toLowerCase()] = hexKey;
  localStorage.setItem(storeKey(walletAddress), JSON.stringify(store));
}

export function getPrivateKey(betAddress, walletAddress) {
  return readStore(walletAddress)[betAddress.toLowerCase()] || null;
}

export function getAllStoredBetAddresses(walletAddress) {
  return Object.keys(readStore(walletAddress));
}

export function removePrivateKey(betAddress, walletAddress) {
  const store = readStore(walletAddress);
  delete store[betAddress.toLowerCase()];
  localStorage.setItem(storeKey(walletAddress), JSON.stringify(store));
}
