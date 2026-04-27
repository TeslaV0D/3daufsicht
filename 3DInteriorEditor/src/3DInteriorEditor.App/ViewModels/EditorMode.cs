namespace _3DInteriorEditor.App.ViewModels;

/// <summary>
/// High-level application mode.
/// </summary>
public enum EditorMode
{
    /// <summary>Full editing experience (default).</summary>
    Edit,

    /// <summary>Read-only / kiosk style (UI is hidden in later phases).</summary>
    Presentation,
}
