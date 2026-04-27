using System.IO;

namespace _3DInteriorEditor.App;

/// <summary>
/// Application-wide constants. Avoid magic numbers/strings outside this type.
/// </summary>
public static class Constants
{
    /// <summary>
    /// Default snap/grid unit (meters).
    /// </summary>
    public const double SnapUnitDefault = 1.0;

    /// <summary>
    /// Maximum undo/redo entries kept in history.
    /// </summary>
    public const int MaxHistoryEntries = 80;

    /// <summary>
    /// Interval for auto-save ticks (seconds).
    /// </summary>
    public const int AutoSaveIntervalSeconds = 30;

    /// <summary>
    /// Paste offset along X (meters).
    /// </summary>
    public const double PasteOffsetX = 1.0;

    /// <summary>
    /// Paste offset along Z (meters).
    /// </summary>
    public const double PasteOffsetZ = 1.0;

    /// <summary>
    /// Default rotation snap increment (degrees).
    /// </summary>
    public const double RotationSnapDegrees = 15.0;

    /// <summary>
    /// Minimum asset dimension along any axis (meters).
    /// </summary>
    public const double MinAssetDimension = 0.1;

    /// <summary>
    /// Placement ghost preview opacity (0..1).
    /// </summary>
    public const double GhostOpacity = 0.4;

    /// <summary>
    /// FPS threshold below which performance warnings may trigger.
    /// </summary>
    public const double FpsWarningThreshold = 20.0;

    /// <summary>
    /// Duration (seconds) FPS must stay below <see cref="FpsWarningThreshold"/> before warning UX triggers.
    /// </summary>
    public const double FpsWarningDurationSeconds = 3.0;

    /// <summary>
    /// Minimum instance count of the same asset type before batching is considered.
    /// </summary>
    public const int InstancingThreshold = 5;

    /// <summary>
    /// Camera distance (meters) beyond which simplified LOD may be used for imported meshes.
    /// </summary>
    public const double LodDistanceFar = 50.0;

    /// <summary>
    /// Duration (milliseconds) for animated camera preset transitions.
    /// </summary>
    public const int CameraTransitionDurationMs = 400;

    /// <summary>
    /// Toast notification duration (milliseconds).
    /// </summary>
    public const int ToastDurationMs = 3000;

    /// <summary>
    /// Native layout file extension (including dot).
    /// </summary>
    public const string LayoutFileExtension = ".3dei";

    /// <summary>
    /// Layout JSON schema version written into <see cref="Models.LayoutFile.SchemaVersion"/>.
    /// </summary>
    public const string LayoutSchemaVersion = "v3";

    /// <summary>
    /// Auto-save directory under %APPDATA%.
    /// </summary>
    public static readonly string AutoSavePath =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "3DInteriorEditor", "AutoSave");

    /// <summary>
    /// Application settings file path under %APPDATA%.
    /// </summary>
    public static readonly string SettingsPath =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "3DInteriorEditor", "settings.json");

    /// <summary>
    /// Default UI color swatches (hex, without alpha).
    /// </summary>
    public static readonly string[] DefaultColorSwatches =
    [
        "#e03131",
        "#f08c00",
        "#f59f00",
        "#2f9e44",
        "#0ca678",
        "#15aabf",
        "#1c7ed6",
        "#3d8bfd",
        "#5f3dc4",
        "#7048e8",
        "#c2255c",
        "#495057",
    ];
}
