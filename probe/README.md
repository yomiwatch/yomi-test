# TV probe

A measurement tool to test on the real TV what the browser can do (codecs, HDR, HLS playback, key codes), and whether a public https page may reach a server on the home network. Plan: `../docs/superpowers/plans/2026-11-22-tv-probe.md`.

## TV

Philips Ambilight 55" OLED760 4K (2025), Titan OS `TPN258E_V058.010.026.001`.

## Running (on the Mac)

```sh
cd probe
sh certs/fetch-cert.sh    # once: public test certificate *.local-ip.sh
sh media/make-media.sh    # once: test videos in media/out/
npm test                  # unit tests
npm run server            # https on 8443, http on 8080; prints the URLs
```

Among other things, the server prints `https://192-168-2-6.local-ip.sh:8443/page/index.html?server=192-168-2-6`. Reports are saved in `results/`.

## Hosting

GitHub Pages publishes `probe/page/` on every push to `main` (workflow `.github/workflows/probe-page.yml`). One-time setup: *Settings → Pages → Source: GitHub Actions*. Open on the TV:

```
https://yomiwatch.github.io/yomi-test/index.html?server=192-168-2-6
```

`?server=` is the Mac's LAN address with dashes. Make sure the probe server is running on the Mac.

## Rounds on the TV

1. The TV's internet browser, page from the public host.
2. The TV's internet browser, page from the Mac: `https://192-168-2-6.local-ip.sh:8443/page/index.html?server=192-168-2-6`.
3. DevView (once access is granted), page from the public host.

After each round, press the keys from the "Keys" section; the report is then sent again.

## Reference

`results/` also contains a measurement with Chrome on the Mac (user agent "Macintosh") for comparison.
