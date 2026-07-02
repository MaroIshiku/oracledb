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
docker compose pull
docker compose up -d
```

Das Compose-File nutzt standardmaessig:

- Image: `ghcr.io/maroishiku/oracledb:latest`
- Host-Port: `4173`
- Container-Port: `80`
- Datenpfad: `./data:/data`
- optionaler nginx-Konfigurationspfad: `./config/nginx:/etc/nginx/conf.d/custom:ro`
- Logo/Icon: `https://raw.githubusercontent.com/MaroIshiku/oracledb/main/assets/img/oracle-logo.png`

In ZimaOS/Nginx Proxy Manager den gemappten Host-Port `4173` als Ziel verwenden.

### ZimaOS / CasaOS

`docker-compose.yml` enthaelt `x-casaos`-Metadaten fuer App-Name, Kategorie, Icon, Port und Web-UI. Beim Import sollte Oracle.DB direkt mit Logo und Weblink erscheinen.

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
