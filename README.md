# Oracle.DB

Statische Oracle.DB-Wiki fuer das Buchprojekt. Die Seiten werden aus den Akten unter `../Data` generiert und koennen danach direkt per nginx ausgeliefert werden.

## Lokal bauen

```bash
npm run build
```

## Lokal ansehen

```bash
npm run serve
```

Danach: `http://127.0.0.1:4173/`

## Docker

```bash
docker compose up -d --build
```

In ZimaOS/Nginx Proxy Manager den Container-Port `80` bzw. den gemappten Host-Port `4173` als Ziel verwenden.

Hinweis unter Windows/OneDrive: Docker Desktop kann OneDrive-Dateiattribute manchmal nicht als Build-Kontext lesen. In dem Fall:

```powershell
.\docker-build-local.ps1
```

Das Script kopiert `Web2` in einen temporaeren lokalen Ordner und baut daraus `oracle-db-static:latest`. Ein normaler GitHub-Checkout auf ZimaOS ist davon nicht betroffen.

## Quellen

- Mitarbeiter: `../Data/Char`
- Anomale Entitaeten: `../Data/AEs`
- Dossiers: `../Data/Knowledge`
- Chroniksignal: `../../Masterchronicle.yaml`
