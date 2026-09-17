# Order Uśmiechu

Strona-podziękowanie w formie dyplomu, chroniona hasłem, z dołączoną
mini-encyklopedią. Cała treść (dyplom i encyklopedia) jest w repozytorium
**zaszyfrowana** (AES-256-GCM, klucz z hasła przez PBKDF2-SHA256, 310 000
iteracji). Bez hasła w kodzie nie ma nic do przeczytania; hasło nie jest
nigdzie zapisane, poprawność sprawdza się przez udane odszyfrowanie.

## Struktura
- `index.html`, `js/gate.js` — ekran hasła; po odszyfrowaniu wstrzykuje dyplom
- `encyklopedia.html`, `js/encyklopedia.js` — encyklopedia (wyszukiwarka,
  kategorie, hasła powiązane, nawigacja klawiaturą, linki `#slug`)
- `js/crypto.js` — wspólne odszyfrowywanie (Web Crypto API)
- `content/message.enc.json`, `content/wiki.enc.json` — zaszyfrowana treść
- `css/` — style (paleta pergamin/złoto/czerwień, styl wydruku)
- `tools/encrypt.mjs` — skrypt szyfrujący
- `private/` — **nie w repo** (gitignore): jawne źródła `message.html`
  i `encyklopedia-data.js`

## Zmiana treści
1. Edytuj pliki w `private/`.
2. Zaszyfruj ponownie (hasło podajesz w zmiennej środowiskowej, nie w pliku):

   ```
   ORDER_PASSWORD="..." node tools/encrypt.mjs
   ```

3. `git add content && git commit && git push`.

Zmiana hasła = ten sam krok 2 z nowym hasłem.

## Uruchomienie lokalne
Strona używa `fetch` i Web Crypto, więc otwórz ją przez serwer HTTP:

```
python -m http.server 8000
```

i wejdź na `http://localhost:8000/`.

## Hosting
GitHub Pages, branch `main`, root. Obie strony mają `noindex, nofollow`.
