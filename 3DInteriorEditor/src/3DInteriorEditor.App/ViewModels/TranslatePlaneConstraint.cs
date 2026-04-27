namespace _3DInteriorEditor.App.ViewModels;

/// <summary>
/// Constrains interactive XZ translation on the ground plane (Y fixed per instance).
/// </summary>
public enum TranslatePlaneConstraint
{
    None,
    /// <summary>Move only along world X (Z fixed at drag start).</summary>
    AxisX,
    /// <summary>Move only along world Z (X fixed at drag start).</summary>
    AxisZ,
}
