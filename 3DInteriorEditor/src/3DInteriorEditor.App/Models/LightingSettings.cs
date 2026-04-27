using _3DInteriorEditor.App.Models.Enums;

namespace _3DInteriorEditor.App.Models;

/// <summary>
/// Scene lighting configuration persisted with layouts.
/// </summary>
public sealed class LightingSettings
{
    /// <summary>
    /// Ambient light intensity multiplier (implementation-defined scale).
    /// </summary>
    public double AmbientIntensity { get; init; } = 0.35;

    /// <summary>
    /// Directional light intensity multiplier.
    /// </summary>
    public double DirectionalIntensity { get; init; } = 1.0;

    /// <summary>
    /// Directional light color as hex string (e.g. <c>#RRGGBB</c>).
    /// </summary>
    public string DirectionalColorHex { get; init; } = "#FFFFFF";

    /// <summary>
    /// Directional light position/direction vector in world space (meters).
    /// </summary>
    public JsonVector3 DirectionalVector { get; init; } = new() { X = 1, Y = 2, Z = 1 };

    /// <summary>
    /// Whether shadow mapping is enabled.
    /// </summary>
    public bool ShadowsEnabled { get; init; } = true;

    /// <summary>
    /// Shadow quality preset.
    /// </summary>
    public ShadowQuality ShadowQuality { get; init; } = ShadowQuality.Medium;

    /// <summary>
    /// HDRI environment preset selection.
    /// </summary>
    public HdriPreset HdriPreset { get; init; } = HdriPreset.Warehouse;
}
