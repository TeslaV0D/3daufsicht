using _3DInteriorEditor.App.Models;
using _3DInteriorEditor.App.Models.Enums;

namespace _3DInteriorEditor.App.Data;

/// <summary>
/// Built-in asset templates bundled with the application (library defaults).
/// </summary>
public static class DefaultAssets
{
    /// <summary>
    /// Stable IDs for built-in definitions (referenced by placed instances).
    /// </summary>
    public static class Ids
    {
        public const string ProductionLine = "builtin.production-line";
        public const string Workplace = "builtin.workplace";
        public const string ServiceTpmZone = "builtin.service-tpm-zone";

        public const string RackBlock = "builtin.rack-block";
        public const string PalletJack = "builtin.pallet-jack";
        public const string CrateStack = "builtin.crate-stack";
        public const string Conveyor = "builtin.conveyor";

        public const string Employee = "builtin.employee";

        public const string OfficeBlock = "builtin.office-block";

        public const string ConeMarker = "builtin.cone-marker";
        public const string SphereBuffer = "builtin.sphere-buffer";
        public const string HexStation = "builtin.hex-station";

        public const string SimpleRectangle = "builtin.simple-rectangle";
        public const string SimpleCircle = "builtin.simple-circle";
    }

    /// <summary>
    /// Built-in categories used by the asset library grouping UI.
    /// </summary>
    public static class Categories
    {
        public const string Production = "Produktion";
        public const string Logistics = "Logistik";
        public const string Personnel = "Personal";
        public const string Administration = "Verwaltung";
        public const string Shapes = "Formen";
        public const string Basics = "Basis";
    }

    /// <summary>
    /// All built-in templates shipped with the app.
    /// </summary>
    /// <remarks>
    /// The product spec header mentions “12 assets”, but the detailed bullet list includes additional “Basis” templates.
    /// This collection follows the explicit template list (unique built-in definitions).
    /// </remarks>
    public static IReadOnlyList<AssetDefinition> All { get; } =
    [
        new AssetDefinition
        {
            Id = Ids.ProductionLine,
            DisplayName = "Produktionslinie",
            CategoryName = Categories.Production,
            DefaultDimensionsMeters = Dim(5.0, 1.8, 1.2),
            Shape = AssetShapeKind.Box,
            DefaultColorHex = "#3d8bfd",
            MetadataTemplates = Meta(("Bereich", ""), ("Kapazität", ""), ("Verantwortlich", "")),
        },
        new AssetDefinition
        {
            Id = Ids.Workplace,
            DisplayName = "Arbeitsplatz",
            CategoryName = Categories.Production,
            DefaultDimensionsMeters = Dim(1.2, 1.2, 1.0),
            Shape = AssetShapeKind.Cylinder,
            DefaultColorHex = "#f08c00",
            MetadataTemplates = Meta(("Bereich", ""), ("Schicht", ""), ("Personal", "")),
        },
        new AssetDefinition
        {
            Id = Ids.ServiceTpmZone,
            DisplayName = "Service/TPM-Zone",
            CategoryName = Categories.Production,
            DefaultDimensionsMeters = Dim(2.2, 2.2, 1.6),
            Shape = AssetShapeKind.Rhombus,
            DefaultColorHex = "#e03131",
            MetadataTemplates = Meta(("Bereich", ""), ("Status", ""), ("Letzte Wartung", "")),
        },

        new AssetDefinition
        {
            Id = Ids.RackBlock,
            DisplayName = "Regalblock",
            CategoryName = Categories.Logistics,
            DefaultDimensionsMeters = Dim(0.8, 2.4, 1.8),
            Shape = AssetShapeKind.Box,
            DefaultColorHex = "#2f9e44",
            MetadataTemplates = Meta(("Bereich", ""), ("Inhalt", ""), ("Reichweite", "")),
        },
        new AssetDefinition
        {
            Id = Ids.PalletJack,
            DisplayName = "Hubwagen",
            CategoryName = Categories.Logistics,
            DefaultDimensionsMeters = Dim(2.4, 1.1, 1.6),
            Shape = AssetShapeKind.Box,
            DefaultColorHex = "#f59f00",
            MetadataTemplates = Meta(("Bereich", ""), ("Status", ""), ("Fahrer", "")),
        },
        new AssetDefinition
        {
            Id = Ids.CrateStack,
            DisplayName = "Kistenstack",
            CategoryName = Categories.Logistics,
            DefaultDimensionsMeters = Dim(1.2, 1.2, 1.2),
            Shape = AssetShapeKind.Box,
            DefaultColorHex = "#8d6e63",
            MetadataTemplates = Meta(("Bereich", ""), ("Inhalt", ""), ("Bestand", "")),
        },
        new AssetDefinition
        {
            Id = Ids.Conveyor,
            DisplayName = "Förderband",
            CategoryName = Categories.Logistics,
            DefaultDimensionsMeters = Dim(3.0, 0.8, 0.6),
            Shape = AssetShapeKind.Box,
            DefaultColorHex = "#868e96",
            MetadataTemplates = Meta(("Bereich", ""), ("Status", ""), ("Geschwindigkeit", "")),
        },

        new AssetDefinition
        {
            Id = Ids.Employee,
            DisplayName = "Mitarbeiter",
            CategoryName = Categories.Personnel,
            DefaultDimensionsMeters = Dim(0.8, 1.75, 0.8),
            Shape = AssetShapeKind.Cylinder,
            DefaultColorHex = "#15aabf",
            MetadataTemplates = Meta(("Bereich", ""), ("Schicht", ""), ("Anzahl", "")),
        },

        new AssetDefinition
        {
            Id = Ids.OfficeBlock,
            DisplayName = "Büroblock",
            CategoryName = Categories.Administration,
            DefaultDimensionsMeters = Dim(2.0, 2.1, 2.8),
            Shape = AssetShapeKind.Box,
            DefaultColorHex = "#7048e8",
            MetadataTemplates = Meta(("Bereich", ""), ("Nutzung", ""), ("Plätze", "")),
        },

        new AssetDefinition
        {
            Id = Ids.ConeMarker,
            DisplayName = "Kegel-Markierung",
            CategoryName = Categories.Shapes,
            DefaultDimensionsMeters = Dim(0.6, 0.8, 0.6),
            Shape = AssetShapeKind.Cone,
            DefaultColorHex = "#ff6b6b",
            MetadataTemplates = new Dictionary<string, string>(StringComparer.Ordinal),
        },
        new AssetDefinition
        {
            Id = Ids.SphereBuffer,
            DisplayName = "Kugel-Puffer",
            CategoryName = Categories.Shapes,
            DefaultDimensionsMeters = Dim(0.8, 0.8, 0.8),
            Shape = AssetShapeKind.Sphere,
            DefaultColorHex = "#38d9a9",
            MetadataTemplates = new Dictionary<string, string>(StringComparer.Ordinal),
        },
        new AssetDefinition
        {
            Id = Ids.HexStation,
            DisplayName = "Hex-Station",
            CategoryName = Categories.Shapes,
            DefaultDimensionsMeters = Dim(2.0, 1.2, 1.7),
            Shape = AssetShapeKind.Hexagon,
            DefaultColorHex = "#74c0fc",
            MetadataTemplates = new Dictionary<string, string>(StringComparer.Ordinal),
        },

        new AssetDefinition
        {
            Id = Ids.SimpleRectangle,
            DisplayName = "Einfaches Rechteck",
            CategoryName = Categories.Basics,
            DefaultDimensionsMeters = Dim(1.0, 1.0, 1.0),
            Shape = AssetShapeKind.Box,
            DefaultColorHex = "#5c7cfa",
            MetadataTemplates = new Dictionary<string, string>(StringComparer.Ordinal),
        },
        new AssetDefinition
        {
            Id = Ids.SimpleCircle,
            DisplayName = "Einfacher Kreis",
            CategoryName = Categories.Basics,
            DefaultDimensionsMeters = Dim(1.0, 1.0, 1.0),
            Shape = AssetShapeKind.Circle,
            DefaultColorHex = "#20c997",
            MetadataTemplates = new Dictionary<string, string>(StringComparer.Ordinal),
        },
    ];

    private static JsonVector3 Dim(double widthX, double heightY, double depthZ) =>
        new() { X = widthX, Y = heightY, Z = depthZ };

    private static Dictionary<string, string> Meta(params (string Key, string Value)[] pairs)
    {
        var dict = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (key, value) in pairs)
        {
            dict[key] = value;
        }

        return dict;
    }
}
