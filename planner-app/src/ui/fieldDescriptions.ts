/**
 * Zentrale Kurztexte für Info-Icons (1–2 Sätze, deutsch).
 * Nur in Tooltips, nicht als sichtbare Absätze.
 */
export const FIELD_DESC = {
  libraryFavoritesEmpty:
    'Über das Menü (⋮) bei einer Vorlage „Zu Favoriten hinzufügen“ wählen.',

  libraryRecentsEmpty: 'Erscheint automatisch, sobald Sie Assets in der Szene platzieren.',

  inspectorInstance:
    'Kompakte Übersicht: Geometrie-Typ, Kategorie, Näherungsmaße aus der Vorlage, Weltposition und Kurz-ID.',

  inspectorTransform: 'Position, Drehung und Skalierung der Instanz in Meter bzw. Grad.',

  assetLock:
    'Gesperrte Assets lassen sich in der Szene nicht verschieben, drehen oder skalieren; Anpassungen nur hier im Inspector, wo freigegeben.',

  transformPositionAxis: 'Position der Instanz entlang der Weltachsen (Meter).',

  transformRotationAxis: 'Drehung um die lokalen Achsen in Grad.',

  transformScaleHint:
    'Skalierung stufenlos; der Schieberegler setzt alle Achsen gleich. Einzelachsen für Breite, Höhe und Länge.',

  transformScaleUniformSlider: 'Setzt Breite, Höhe und Länge auf denselben Faktor.',

  transformScaleAxis: 'Skalierungsfaktor entlang dieser Achse (Minimum 0,01).',

  materialOverview:
    'Farbe und Beschaffenheit für Primitive und STL. Bei GLB/GLTF zusätzlich Modus Original (Datei-Material) oder Override (einheitliche Färbung).',

  materialModeGlb:
    'Original nutzt die Materialien aus der Datei. Override färbt alle Meshes mit der gewählten Basis-Farbe und Deckkraft.',

  materialColor:
    'Basisfarbe des Assets. Bei importierten GLB/GLTF nur im Modus „Override“ sichtbar; Bild-Decals liegen als eigene Fläche darüber.',

  assetOpacity:
    'Durchsichtigkeit des gesamten Assets: 0 % unsichtbar, 100 % deckend. Kombiniert mit Modell-Material, falls vorhanden.',

  decalImage:
    'PNG, JPEG oder WebP auf eine Fläche legen; Seite unten wählen. Orientierung über die Bounding-Box — bei komplexen Meshes ggf. andere Seite probieren.',

  decalSide: 'Welche Modell-Seite die Decal-Fläche trägt (Bounding-Box).',

  decalNoImage: 'Noch kein Bild — über „Bild importieren“ ein Decal hinzufügen.',

  decalGifPerf:
    'GIFs werden als Frame-Sequenz abgespielt und können die Darstellung stärker belasten. Empfohlen: weniger als 60 Frames; große Dateien vermeiden.',

  decalGifPlay: 'Animation ein- oder ausblenden (letzter Frame bzw. erstes Bild bleibt sichtbar).',

  decalGifSpeed: 'Wiedergabe-Geschwindigkeit: 0,5× langsamer bis 2× schneller (relativ zu den GIF-Verzögerungen).',

  decalGifLoop: 'Endlos wiederholen oder nach dem letzten Frame stoppen.',

  saveFromSceneTitle:
    'Erzeugt eine neue Vorlage unter „Eigene Assets“ aus dem aktuellen Objektzustand (Geometrie, optional Farbe, Skalierung, Decals, Metadaten).',

  saveFromSceneName: 'Anzeigename der neuen Bibliotheks-Vorlage.',

  saveFromSceneDescription: 'Beschreibung der gespeicherten Vorlage.',

  saveFromSceneZone: 'Optionaler Zonen-/Typ für die Vorlage.',

  saveFromSceneMaterial: 'Basisfarbe, Deckkraft und GLB-Materialmodus (Override/Original) übernehmen.',

  saveFromSceneScale: 'Die aktuelle X/Y/Z-Skalierung der Instanz als Standard für neu platzierte Objekte.',

  saveFromSceneDecals: 'Alle Decals inkl. GIF-Einstellungen und Data-URLs in der Vorlage speichern.',

  saveFromSceneMetadata: 'Name, Beschreibung, Zone, Custom-Metadata und Textinhalt (Labels) der Instanz übernehmen.',

  decalSize: 'Relative Größe der Decal-Fläche zur gewählten Modellseite.',

  decalOpacity: 'Deckkraft nur des Bild-Decals (nicht des gesamten Assets).',

  decalOffsetX: 'Verschiebung des Decals entlang der ersten Tangente der Fläche.',

  decalOffsetY: 'Verschiebung entlang der zweiten Tangente der Fläche.',

  decalRotation: 'Drehung des Decals in der Fläche (Grad).',

  textContent: 'Wird im 3D-Label in der Szene angezeigt (maximal 160 Zeichen).',

  inspectorInfoSection:
    'Anzeigename, Beschreibung und Zonen-/Typ-Kennung dieser Instanz; mit Bearbeiten und Leeren.',

  metaName:
    'Anzeigename des Assets in Bibliothek, Inspector und Präsentations-Info. Mit × oder „Leeren“ entfernen — dann kein eigener Name (Anzeige „—“; Vorlagen-Typ bleibt in der Instanz-Zeile).',

  metaDescription: 'Freitext; erscheint im Präsentations-Popup und in der Bibliothek.',

  metaZoneType:
    'Optionales Schlagwort (z. B. Produktion, Lager) für Filter und Anzeige. Vorschläge aus der Szene; freie Eingabe möglich.',

  customMetaSection:
    'Eigene Schlüssel-Wert-Felder. Namen sind editierbar; Einträge werden im Layout mitgespeichert.',

  customMetaPair:
    'Benutzerdefiniertes Metadatum: Feldname und Wert. Über „Feld bearbeiten“ eine eigene (?)-Hilfe hinterlegen.',

  customMetaFieldEdit:
    'Feldname, Wert und optional eigene Kurzbeschreibung für das Info-Icon. „Hilfe zurücksetzen“ stellt den Standard-Tooltip wieder her.',

  batchMultiSelect:
    'Mehrfachauswahl: Stapel-Transformation nur, wenn mindestens zwei nicht gesperrte Assets gewählt sind. Gesperrte werden ausgelassen.',

  batchMaterialColor: 'Setzt die Basis-Farbe für alle gewählten Assets gleichzeitig.',

  batchAlignTools:
    'Ausrichten und Verteilen; weitere Werkzeuge auch unter „⋮ Werkzeuge“ in der Toolbar.',

  floorPresentationGrid:
    'Im Präsentationsmodus ist das Raster ausgeblendet; die Bodenfarbe bleibt sichtbar.',

  floorColor: 'Grundfarbe der Bodenebene in der Szene.',

  modelWireframe: 'Zeigt nur die Kanten des Meshes (Debugging / Übersicht).',

  modelFlatShading: 'Facetten-Schattierung wie in vielen CAD-Ansichten (nur STL sinnvoll).',

  floorGridVisible: 'Raster nur im Bearbeitungsmodus; hilft beim Ausrichten.',

  floorGridColor: 'Farbe der Rasterlinien auf dem Boden.',

  floorGridSpacing: 'Abstand der Rasterzellen in Metern.',

  floorSize: 'Ausdehnung der Bodenfläche in Metern.',

  snapSection: 'Einrasten beim Platzieren und Verschieben am Raster.',

  snapEnabled:
    'Hält neue und verschobene Assets am Raster aus (Halten von STRG temporär frei, falls unterstützt).',

  snapStep: 'Rasterabstand für das Einrasten in Metern.',

  inspectorEmpty:
    'Wählen Sie ein platziertes Asset für Infos und Transform — oder den Boden (keine Auswahl), um Boden und Raster zu bearbeiten.',

  templateDetailsName: 'Anzeigename der Bibliotheks-Vorlage.',

  templateDetailsDescription: 'Beschreibungstext der Vorlage (Bibliothek, Details).',

  templateDetailsTypeId: 'Interne Typ-Kennung; eindeutig pro Vorlage.',

  templateDetailsGeometryKind: 'Art der Geometrie (Primitive, Text oder importiertes Modell).',

  templateDetailsDimensions: 'Näherungsabmessungen aus der Vorlage (Editor-Einheiten).',

  templateDetailsDimensionsMm: 'Gleiche Maße umgerechnet in Millimetern.',

  templateDetailsScale: 'Skalierungsfaktoren des Templates vor dem Platzieren.',

  templateDetailsMaterialColor: 'Standard-Basisfarbe beim Platzieren aus dieser Vorlage.',

  templateDetailsFavorite: 'Ob die Vorlage in den Favoriten der Bibliothek liegt.',

  templateDetailsUserGroup: 'Benutzerdefinierte Bibliotheks-Gruppe oder Standard-Kategorie.',

  templateDetailsTags: 'Schlagwörter für Suche und Organisation.',

  templateDetailsImportedAt: 'Zeitpunkt des Imports (nur eigene Modelle).',

  templateDetailsImportBuiltin: 'Eingebaute Vorlage ohne Import-Zeitstempel.',

  templateDetailsModelFormat: 'Dateiformat des importierten Modells.',

  templateDetailsModelUrl: 'Kurzansicht der Modell-Daten-URL (Data-URL oder Pfad).',

  templateMetaName: 'Name der Vorlage in der Bibliothek.',

  templateMetaDescription: 'Beschreibung der Vorlage.',

  templateMetaTags: 'Kommagetrennte Schlagwörter für Filter und Suche.',

  exportWorkspace:
    'Exportiert nur die aktuelle Szene: platzierte Assets, Transformation, Farben, Beleuchtung und Boden. Eigene Modelle werden minimal referenziert.',

  exportComplete:
    'Voller Projekt-Export: Bibliothek, Gruppen, Favoriten, UI-Zustand und Präsentationsmodus.',

  loadAutoLayout: 'Zuletzt automatisch gesicherter Stand (Speichern-Button in der Toolbar).',

  loadExternalFile: 'JSON-Datei, die über „Export“ erzeugt wurde.',

  templatePreviewControls: 'Maus: Szene drehen, zoomen und schwenken (Orbit-Steuerung).',

  lightingPresets:
    'Schnellstart-Presets für Hauptlicht, Umgebung und HDRI — überschreibt die aktuellen Werte mit bewährten Kombinationen.',

  lightingMainType:
    'Directional: parallele Sonne. Point: Punktlicht. Spot: Kegellicht mit Winkel und Penumbra.',

  lightingMainIntensity: 'Helligkeit des Hauptlichts (relativ zur Szene).',

  lightingAmbientIntensity: 'Gleichmäßige Grundhelligkeit ohne Richtung.',

  lightingMainColor: 'Farbtemperatur bzw. Tönung des Hauptlichts.',

  lightingAmbientColor: 'Grundton der Umgebungsbeleuchtung.',

  lightingPosition: 'Position des Hauptlichts in Metern (Weltkoordinaten).',

  lightingSpotAngle: 'Öffnungswinkel des Spot-Kegels.',

  lightingSpotPenumbra: 'Weichheit des Spot-Rands (0 = hart, 1 = weich).',

  lightingCastShadow: 'Ob das Hauptlicht Schatten auf andere Objekte wirft.',

  lightingShadowMapSize: 'Auflösung der Schatten-Karte (höher = schärfer, teurer).',

  lightingShadowRadius: 'Weichzeichner für Schattenkanten (PCF-Radius).',

  lightingEnvironmentIntensity: 'Stärke der HDRI-Umgebungsbeleuchtung (Reflexionen und Fill).',

  lightingFogToggle: 'Nebel für Tiefe und Atmosphäre; Farbe und Distanz steuern, wie schnell Objekte ausblenden.',

  lightingFogColor: 'Farbe des Nebels (wirkt mit Hintergrund und HDRI).',

  lightingFogNear: 'Distanz ab der der Nebel merklich wird (Meter).',

  lightingFogFar: 'Distanz, ab der Objekte im Nebel kaum noch sichtbar sind (Meter).',
} as const

export type FieldDescriptionKey = keyof typeof FIELD_DESC
