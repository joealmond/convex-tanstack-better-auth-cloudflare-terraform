# Sütik és helyi tárolás — TERVEZET

Verzió: `[POLICY_VERSION]` · Hatálybalépés: `[EFFECTIVE_DATE]`

A táblát a **telepített** webalkalmazás böngészős vizsgálatával töltsd ki kijelentkezve, bejelentkezve és az engedélyezett opcionális funkciókkal. Ellenőrizd a szolgáltató vagy admin felület által hozzáadott scripteket is. A fizetési szolgáltató saját oldalán elhelyezett sütiket külön írd le.

| Név / kulcs    | Első vagy harmadik fél | Cél és továbbítás         | Szükséges vagy opcionális   | Lejárat / törlés | Választási lehetőség |
| -------------- | ---------------------- | ------------------------- | --------------------------- | ---------------- | -------------------- |
| `[ACTUAL_KEY]` | `[PARTY]`              | `[PURPOSE_AND_RECIPIENT]` | `[CLASSIFICATION_REVIEWED]` | `[LIFETIME]`     | `[CONTROL]`          |

Vizsgálandó: sütik, local/session storage, IndexedDB, Cache Storage/service worker, mobil eszköztárolás és a beágyazott szolgáltatók. Opcionális használathoz szükséges választási és visszavonási folyamat: `[CONSENT_AND_WITHDRAWAL_UI]`. Nem szükséges tárolást csak a megfelelő döntés után indíts.
