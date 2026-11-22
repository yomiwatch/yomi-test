# Tv-proef

Meetgereedschap om op de echte tv te testen wat de browser kan (codecs, HDR, afspelen van HLS, toetscodes), en of een publieke https-pagina een server in het thuisnetwerk mag bereiken. Plan: `../docs/superpowers/plans/2026-11-22-tv-proef.md`.

## Tv

Philips Ambilight 55" OLED760 4K (2025), Titan OS `TPN258E_V058.010.026.001`.

## Draaien (op de Mac)

```sh
cd proef
sh certs/haal-cert.sh     # eenmalig: publiek testcertificaat *.local-ip.sh
sh media/maak-media.sh    # eenmalig: vijf testvideo's in media/uit/
npm test                  # unit-tests
npm run server            # https op 8443, http op 8080; print de URL's
```

De server print o.a. `https://192-168-2-6.local-ip.sh:8443/pagina/index.html?server=192-168-2-6`. Rapporten komen in `resultaten/`.

## Hosting (door de eigenaar)

Upload de **inhoud van `proef/pagina/`** (`index.html`, `proef.js`, `codecs.js`, `netwerk.js`, `ok.txt`) naar een publieke https-host. Open op de tv:

```
https://<jouw-host>/<pad>/index.html?server=192-168-2-6
```

`?server=` is het LAN-adres van de Mac met streepjes. Zorg dat de proefserver op de Mac draait.

## Rondes op de tv

1. Internetbrowser van de tv, pagina van de publieke host.
2. Internetbrowser van de tv, pagina vanaf de Mac: `https://192-168-2-6.local-ip.sh:8443/pagina/index.html?server=192-168-2-6`.
3. DevView (zodra toegang er is), pagina van de publieke host.

Druk na elke ronde op de toetsen uit de sectie "Toetsen"; het rapport wordt dan opnieuw verstuurd.

## Referentie

`resultaten/` bevat ook een meting met Chrome op de Mac (user-agent "Macintosh") als vergelijking.
