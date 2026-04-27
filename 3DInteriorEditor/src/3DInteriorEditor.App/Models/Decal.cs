namespace _3DInteriorEditor.App.Models;

/// <summary>
/// An image projected onto an asset surface.
/// </summary>
public sealed class Decal
{
    /// <summary>
    /// Stable decal identifier (GUID string).
    /// </summary>
    public required string Id { get; init; }

    /// <summary>
    /// Target asset instance id (<see cref="PlacedAsset.Id"/>).
    /// </summary>
    public required string TargetAssetId { get; init; }

    /// <summary>
    /// Path to the backing image file on disk.
    /// </summary>
    public required string ImagePath { get; init; }

    /// <summary>
    /// Position on the asset surface in normalized/asset-local coordinates (implementation-defined).
    /// </summary>
    public required JsonVector3 SurfacePosition { get; init; }

    /// <summary>
    /// Rotation in degrees (implementation-defined axes).
    /// </summary>
    public required JsonVector3 RotationDegrees { get; init; }

    /// <summary>
    /// Uniform or per-axis scale factors (implementation-defined).
    /// </summary>
    public required JsonVector3 Scale { get; init; }

    /// <summary>
    /// Whether the decal is animated (GIF).
    /// </summary>
    public bool IsAnimatedGif { get; init; }

    /// <summary>
    /// Optional extracted GIF frames (e.g., as file paths or embedded references).
    /// </summary>
    public IReadOnlyList<string>? AnimatedFrames { get; init; }

    /// <summary>
    /// Playback speed multiplier for GIF animation.
    /// </summary>
    public double PlaybackSpeed { get; init; } = 1.0;
}
