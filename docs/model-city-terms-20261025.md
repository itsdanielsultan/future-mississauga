# City data terms notice correction

Follow-up to the prepared Artform/M City preview release. The originally reviewed c9732ad source and 81b49fa publication were not pushed before the City terms requirement was clarified.

The M City standalone routes now show the official City data terms before any model request. Visitors choose Load model to start rendering; downloads have their own adjacent terms notice. The city map similarly waits for Load city map before importing the application or fetching model geometry. The notice describes acceptance by loading, using or downloading and the downstream requirement to provide the terms or URL and require recipients to agree. No checkbox, saved consent, preselection or claim of retroactive assent is introduced. Artform has no City-mesh flag and retains its automatic preview.

Official terms URL: https://mississauga.maps.arcgis.com/sharing/rest/content/items/961c790805c14d8da258ec91bf4117e3/data

Verified source PDF: 200,246 bytes; SHA-256 76e0c18b3d807639b0aa9df04df41a9bfc999bdad10762954a333bdd939cbce4. The PDF is linked from the site, not duplicated into publication. Architectural design and reference-image rights remain separate.

Two shared files, city-data-terms.js and city-data-terms.css, implement the notice. The preview manifest marks only M1/M2 as City-derived. Model downloads, existing original files and geometry bytes are unchanged. Credits include the official URL and downstream distribution condition. A context restore cannot bypass the initial model-load choice.

Validation: 75 Node tests; npm run check; npm run build. Browser evidence is held with the local release QA. The final output is 758 files / 999,878,681 bytes, leaving 121,318 bytes under the unchanged 999,999,999-byte maximum. Physical Duo/Safari 27.1 testing remains unrun.

This correction changes the exact prepared source/static commit identities. Publication is pending confirmation of those corrected identities; no new model batch or hosting change is included.
