namespace _3DInteriorEditor.App.Models;

/// <summary>
/// A free-positioned 3D text label (billboard rendering is handled later).
/// </summary>
public sealed class TextLabel
{
    /// <summary>
    /// Stable label identifier (GUID string).
    /// </summary>
    public required string Id { get; init; }

    /// <summary>
    /// Optional reference to a <see cref="PlacedAsset.Id"/> this label is associated with.
    /// </summary>
    public string? AttachedAssetId { get; init; }

    /// <summary>
    /// Label text content.
    /// </summary>
    public required string Text { get; init; }

    /// <summary>
    /// World position in meters.
    /// </summary>
    public required JsonVector3 PositionMeters { get; init; }

    /// <summary>
    /// Font size in arbitrary WPF units (same convention as rendering later).
    /// </summary>
    public required double FontSize { get; init; }

    /// <summary>
    /// Font family name (e.g. <c>Segoe UI</c>).
    /// </summary>
    public required string FontFamily { get; init; }

    /// <summary>
    /// Text color as hex string (e.g. <c>#RRGGBB</c> or <c>#AARRGGBB</c>).
    /// </summary>
    public required string TextColorHex { get; init; }

    /// <summary>
    /// Background color as hex string; may include alpha for transparency.
    /// </summary>
    public required string BackgroundColorHex { get; init; }

    /// <summary>
    /// Whether the label is visible.
    /// </summary>
    public bool IsVisible { get; init; } = true;
}
