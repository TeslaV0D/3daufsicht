using System.Text.Json.Serialization;
using _3DInteriorEditor.App.Models.Enums;

namespace _3DInteriorEditor.App.Models;

/// <summary>
/// Describes an asset template (type) that can be instantiated in the scene.
/// </summary>
public sealed class AssetDefinition
{
    /// <summary>
    /// Stable identifier for this asset type (unique within a layout).
    /// </summary>
    public required string Id { get; init; }

    /// <summary>
    /// Human-readable display name shown in UI.
    /// </summary>
    public required string DisplayName { get; init; }

    /// <summary>
    /// Category label used for grouping in the asset library UI.
    /// </summary>
    public required string CategoryName { get; init; }

    /// <summary>
    /// Default dimensions in meters as (width X, height Y, depth Z).
    /// </summary>
    public required JsonVector3 DefaultDimensionsMeters { get; init; }

    /// <summary>
    /// Built-in primitive shape used when <see cref="ImportedModelPath"/> is not set.
    /// </summary>
    public required AssetShapeKind Shape { get; init; }

    /// <summary>
    /// Default color as hex string (e.g. <c>#RRGGBB</c>).
    /// </summary>
    public required string DefaultColorHex { get; init; }

    /// <summary>
    /// Metadata keys with default placeholder values for newly placed instances.
    /// </summary>
    public Dictionary<string, string> MetadataTemplates { get; init; } = new(StringComparer.Ordinal);

    /// <summary>
    /// Optional absolute or relative path to an imported model file backing this definition.
    /// </summary>
    public string? ImportedModelPath { get; init; }
}
