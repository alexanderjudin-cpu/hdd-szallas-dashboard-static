# HDD Szállás dashboard – napi statikus HTML generálás

Cél: a Retool iframe ne élőben kérdezze a Supabase-t, hanem egy napi egyszer legenerált, statikus `index.html`-t töltsön be.

A dashboard kinézete nem változik. A generátor csak a `window.DASH` adatblokkot cseréli ki a build során.

## Működés

```text
Supabase adatok
  ↓ GitHub Actions napi egyszer
cache tábla frissítés / olvasás
  ↓
statikus dist/index.html
  ↓ GitHub Pages
fix publikus URL
  ↓
Retool iframe
```

## 1. Supabase SQL

Supabase SQL Editorben futtasd le:

```text
supabase/safe-cache-setup.sql
```

Ez nem dropol, nem truncate-ol, nem töröl. Létrehoz egy külön táblát:

```text
public.housing_city_pin_feed_cache_v2
```

A GitHub Actions ebből fog olvasni.

## 2. GitHub Secrets

A repo Settings → Secrets and variables → Actions alatt add hozzá:

```text
SUPABASE_URL=https://qyteyqhtatuuiqcwdtvf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Supabase service_role key>
```

Fontos: a `service_role` kulcs csak GitHub Secretben legyen. Ne kerüljön HTML-be, Retool client JS-be vagy publikus fájlba.

## 3. GitHub Pages

Repo Settings → Pages:

```text
Source: GitHub Actions
```

## 4. Manuális futtatás

GitHub repo → Actions → `Build static szállás dashboard` → `Run workflow`.

Sikeres futás után a Retool iframe URL a GitHub Pages URL lesz, például:

```text
https://<github-user>.github.io/<repo-name>/
```

## 5. Helyi teszt mintaadattal

```bash
npm run build:sample
```

Ez létrehozza:

```text
dist/index.html
```

## 6. Helyi teszt Supabase-ből

```bash
export SUPABASE_URL="https://qyteyqhtatuuiqcwdtvf.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="..."
npm run build
```

Windows PowerShellben:

```powershell
$env:SUPABASE_URL="https://qyteyqhtatuuiqcwdtvf.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="..."
npm run build
```

## Retool iframe

Retoolban az iframe URL mezőbe idézőjelek nélkül:

```text
https://<github-user>.github.io/<repo-name>/
```

Ne így:

```text
"https://<github-user>.github.io/<repo-name>/"
```

mert abból lehet `%22` 404.
