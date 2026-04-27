namespace _3DInteriorEditor.App.Models;

/// <summary>
/// A single undo/redo snapshot containing a deep copy of scene instances and selection.
/// </summary>
public sealed class HistorySnapshot
{
    /// <summary>
    /// Timestamp when the snapshot was recorded (UTC).
    /// </summary>
    public DateTimeOffset CreatedAtUtc { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Full copy of all placed assets at the time of the snapshot.
    /// </summary>
    public required List<PlacedAsset> Assets { get; init; }

    /// <summary>
    /// Selected asset ids at the time of the snapshot.
    /// </summary>
    public required List<string> SelectedAssetIds { get; init; }
}
