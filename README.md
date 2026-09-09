# Oracle.DB

Statische Oracle.DB-Wiki fuer das Buchprojekt. Ausführliche, menschenlesbare Akten und verbindliche
Kanon-Kurzdaten werden in einem eingecheckten Inhaltssnapshot zusammengeführt. Dadurch kann das
GitHub-/GHCR-Projekt vollständig aus dem Ordner `Web2` gebaut werden.

## Lokal bauen

```bash
npm run build
```

Der Build verwendet ausschließlich `content/wiki-source.json`, `content/personnel-tags.json` und die Assets in diesem Repository.
Er benötigt weder die übergeordnete CanonDB noch den Ordner `Wiki page/Data`.

`personnel-tags.json` enthält die bewusst redaktionell getrennten Tagfelder der Personalakten. Der
Build entfernt ihre früher zusammengeklebten Rohzeilen aus dem Fließtext und setzt die Tags als
einzelne Pillen. Für neue oder geänderte Personalakten werden Tagfelder dort abschnittsweise gepflegt.

## Inhalte aus dem Gesamtprojekt aktualisieren

Nach Änderungen an Akten oder CanonDB im vollständigen ORACLE-Arbeitsordner:

```bash
npm run refresh
```

`refresh` synchronisiert die benötigten Akten, Canon-Kurzstände und Bilder nach `Web2` und erzeugt
anschließend alle statischen Seiten neu. Der aktualisierte Inhaltssnapshot wird zusammen mit Web2
eingecheckt, damit GitHub Actions und GHCR reproduzierbar bauen können.

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

## Quellen im Gesamtprojekt

- Menschenlesbare Akten: `../Data/Char`, `../Data/AEs`, `../Data/Knowledge`
- Verbindlicher Kanonstatus: `../../oracle_data/canon_state.json`
- Stabile IDs und Datensatzpfade: `../../oracle_data/provenance/id_registry.json`
- Selbständiger Web2-Snapshot: `content/wiki-source.json`
- Redaktionelle Tagfelder: `content/personnel-tags.json`

Die Textakten bleiben die ausführliche, menschenlesbare Artikelbasis. Der Canon-Snapshot liefert
verbindliche aktuelle Status-, Orts- und ID-Daten sowie Prüfregeln; er ersetzt die Dossiertexte nicht.
