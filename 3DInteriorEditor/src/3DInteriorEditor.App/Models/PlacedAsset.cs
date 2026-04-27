namespace _3DInteriorEditor.App.Models;

/// <summary>
/// A concrete placed instance of an <see cref="AssetDefinition"/>.
/// </summary>
public sealed class PlacedAsset
{
    /// <summary>
    /// Stable instance identifier (GUID string).
    /// </summary>
    public required string Id { get; init; }

    /// <summary>
    /// References <see cref="AssetDefinition.Id"/>.
    /// </summary>
    public required string AssetDefinitionId { get; init; }

    /// <summary>
    /// World position in meters (X/Y/Z).
    /// </summary>
    public required JsonVector3 PositionMeters { get; init; }

    /// <summary>
    /// Euler rotation in degrees (X/Y/Z).
    /// </summary>
    public required JsonVector3 RotationDegrees { get; init; }

    /// <summary>
    /// Actual dimensions in meters after scaling (width X, height Y, depth Z).
    /// </summary>
    public required JsonVector3 DimensionsMeters { get; init; }

    /// <summary>
    /// Instance color as hex string (e.g. <c>#RRGGBB</c>).
    /// </summary>
    public required string ColorHex { get; init; }

    /// <summary>
    /// User-editable metadata key/value pairs.
    /// </summary>
    public Dictionary<string, string> Metadata { get; init; } = new(StringComparer.Ordinal);

    /// <summary>
    /// Whether the asset is visible in the scene.
    /// </summary>
    public bool IsVisible { get; init; } = true;
}
