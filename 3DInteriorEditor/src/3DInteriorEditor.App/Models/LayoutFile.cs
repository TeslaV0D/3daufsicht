namespace _3DInteriorEditor.App.Models;

/// <summary>
/// Root layout document persisted as JSON (<c>.3dei</c>).
/// </summary>
public sealed class LayoutFile
{
    /// <summary>
    /// Schema version written by the application.
    /// </summary>
    public string SchemaVersion { get; init; } = Constants.LayoutSchemaVersion;

    /// <summary>
    /// When the layout was saved (UTC).
    /// </summary>
    public DateTimeOffset SavedAtUtc { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Custom and built-in asset definitions required to interpret instances.
    /// </summary>
    public List<AssetDefinition> AssetDefinitions { get; init; } = [];

    /// <summary>
    /// Placed asset instances.
    /// </summary>
    public List<PlacedAsset> PlacedAssets { get; init; } = [];

    /// <summary>
    /// Text labels.
    /// </summary>
    public List<TextLabel> TextLabels { get; init; } = [];

    /// <summary>
    /// Decals.
    /// </summary>
    public List<Decal> Decals { get; init; } = [];

    /// <summary>
    /// Lighting settings for the scene.
    /// </summary>
    public LightingSettings Lighting { get; init; } = new();
}
