// Szyfruje jawne źródła z katalogu private/ do plików .enc.json w repo.
// Użycie:  ORDER_PASSWORD="haslo" node tools/encrypt.mjs
// Format wyjścia: { v, kdf, iter, salt, iv, ct } (wszystko base64, AES-256-GCM, PBKDF2-SHA256).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const subtle = webcrypto.subtle;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ITERATIONS = 310000;

const password = process.env.ORDER_PASSWORD;
if (!password) {
  console.error("Brak hasła. Uruchom:  ORDER_PASSWORD=\"...\" node tools/encrypt.mjs");
  process.exit(1);
}

const b64 = (bytes) => Buffer.from(bytes).toString("base64");

async function deriveKey(pass, salt) {
  const base = await subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
}

async function encryptText(plain) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return { v: 1, kdf: "PBKDF2-SHA256", iter: ITERATIONS, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

// 1. Dyplom (HTML)
const message = readFileSync(join(root, "private/message.html"), "utf8");

// 2. Encyklopedia: plik JS definiuje WIKI_ENTRIES (+ opcjonalnie WIKI_META) — wykonujemy go w sandboxie.
const dataSrc = readFileSync(join(root, "private/encyklopedia-data.js"), "utf8");
const sandbox = {};
vm.runInNewContext(dataSrc + "\n;this.__entries = WIKI_ENTRIES; this.__meta = typeof WIKI_META !== 'undefined' ? WIKI_META : null;", sandbox);
const wikiPayload = {
  meta: sandbox.__meta || {
    title: "Specialty & Hospital — ściągawka na staż",
    subtitle:
      "Praktyczne wyjaśnienia pojęć, skrótów i umiejętności, które przydają się w dziale Specialty & Hospital. Każde hasło ma krótką definicję, rozwinięcie, a często także wskazówkę, dlaczego warto je znać na stażu, i odsyłacze do haseł powiązanych.",
  },
  entries: sandbox.__entries,
};

mkdirSync(join(root, "content"), { recursive: true });
writeFileSync(join(root, "content/message.enc.json"), JSON.stringify(await encryptText(message)));
writeFileSync(join(root, "content/wiki.enc.json"), JSON.stringify(await encryptText(JSON.stringify(wikiPayload))));

console.log(`OK: content/message.enc.json (${message.length} znaków), content/wiki.enc.json (${wikiPayload.entries.length} haseł)`);
