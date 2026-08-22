# hugo-theme-recipes

Hugo-Theme für das Familienkochbuch „RezeptBuck“: strukturierte Rezepte
(Schema v1), Kochmodus mit Timern und Bildschirm-Wachhalter, Suche mit
Fuse.js, responsive Bilder über Hugos Bildpipeline.

## Features

- Strukturierte Rezeptseiten (Zutatengruppen, Schritte, Timer, Nährwerte,
  Portionsrechner) auf Basis von `schemaVersion: 1`
- Kochmodus als Dialog mit großen Schritten, Timern und Wake Lock
- Client-Suche (Fuse.js, lokal vendored) inklusive Tag- und Dauerfilter
- Responsive WebP-Varianten für Originalbilder (`optimized-image.html`)
- Noindex-Unterstützung via `params.noIndex`
- i18n-Strings (de/en)

## Installation

Als Git-Submodule in eine Hugo-Site (Hugo Extended ≥ 0.140):

```bash
git submodule add https://github.com/Rasalas/hugo-theme-recipes.git themes/recipes
echo "theme = 'recipes'" >> hugo.toml
```

## Konfiguration

Relevante Site-Parameter:

| Parameter        | Bedeutung                                              |
|------------------|--------------------------------------------------------|
| `noIndex`        | setzt `noindex, nofollow, noarchive` Meta/Robots       |
| `isDevelopment`  | verlinkt den Rezepteditor lokal auf `localhost:3000`   |

Rezepte werden als Markdown unter `content/recipe/` erwartet; das
Front-Matter-Schema ist in `schemas/recipe-v1.schema.json` des
Hauptprojekts beschrieben. Neues Rezept:

```bash
hugo new --kind recipe recipe/mein-rezept.md
```

## Tests

```bash
node --test tests/*.test.js
```

## Lizenz

siehe [LICENSE](LICENSE)
