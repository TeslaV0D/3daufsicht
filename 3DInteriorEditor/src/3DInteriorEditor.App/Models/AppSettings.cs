namespace _3DInteriorEditor.App.Models;

/// <summary>
/// Persisted user preferences (JSON under <see cref="Constants.SettingsPath"/>).
/// </summary>
public sealed class AppSettings
{
    public int Version { get; set; } = 1;

    /// <summary>
    /// UI scale factor (1.0 = 100%).
    /// </summary>
    public double UiScale { get; set; } = 1.0;

    /// <summary>
    /// When true, Helix zoom uses the pointer position as anchor (Blender-like).
    /// </summary>
    public bool ZoomAroundMouseCursor { get; set; } = true;

    /// <summary>
    /// Remember last directory for import dialogs.
    /// </summary>
    public string? LastImportDirectory { get; set; }

    /// <summary>
    /// Remember last directory for export dialogs.
    /// </summary>
    public string? LastExportDirectory { get; set; }
}
