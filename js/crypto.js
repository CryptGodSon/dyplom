// Wspólne funkcje odszyfrowywania (AES-256-GCM, klucz z hasła przez PBKDF2-SHA256).
// Pliki .enc.json powstają lokalnie skryptem tools/encrypt.mjs; w repo nie ma treści jawnej.

const OrderCrypto = (() => {
  const SESSION_KEY = "order-usmiechu-pass";

  function fromB64(s) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function deriveKey(password, salt, iterations) {
    const base = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
  }

  // Zwraca odszyfrowany tekst albo rzuca błąd (złe hasło => OperationError).
  async function decryptFile(url, password) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.json();

    const key = await deriveKey(password, fromB64(blob.salt), blob.iter);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(blob.iv) },
      key,
      fromB64(blob.ct)
    );
    return new TextDecoder().decode(plain);
  }

  function isSupported() {
    return !!(window.crypto && window.crypto.subtle && window.TextEncoder);
  }

  function rememberPassword(password) {
    sessionStorage.setItem(SESSION_KEY, password);
  }

  function storedPassword() {
    return sessionStorage.getItem(SESSION_KEY);
  }

  function forget() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  return { decryptFile, isSupported, rememberPassword, storedPassword, forget };
})();
