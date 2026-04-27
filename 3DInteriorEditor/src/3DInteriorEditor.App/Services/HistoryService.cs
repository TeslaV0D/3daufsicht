using _3DInteriorEditor.App.Models;

namespace _3DInteriorEditor.App.Services;

/// <summary>
/// Undo/redo stacks storing deep snapshots of scene assets + selection.
/// </summary>
public sealed class HistoryService
{
    private readonly LinkedList<HistorySnapshot> _undo = new();
    private readonly LinkedList<HistorySnapshot> _redo = new();

    /// <summary>
    /// Whether undo is available.
    /// </summary>
    public bool CanUndo => _undo.Count > 0;

    /// <summary>
    /// Whether redo is available.
    /// </summary>
    public bool CanRedo => _redo.Count > 0;

    /// <summary>
    /// Clears both stacks (typically after loading a new document).
    /// </summary>
    public void Clear()
    {
        _undo.Clear();
        _redo.Clear();
    }

    /// <summary>
    /// Pushes a new snapshot onto the undo stack and clears redo.
    /// </summary>
    /// <param name="assets">Current placed assets.</param>
    /// <param name="selectedAssetIds">Currently selected asset ids.</param>
    public void Push(IReadOnlyList<PlacedAsset> assets, IReadOnlyList<string> selectedAssetIds)
    {
        var snapshot = new HistorySnapshot
        {
            Assets = DeepCopy.CloneList(assets),
            SelectedAssetIds = DeepCopy.CloneList(selectedAssetIds),
        };

        _undo.AddLast(snapshot);
        TrimOldestUndo();
        _redo.Clear();
    }

    /// <summary>
    /// Undoes to the previous snapshot (if possible).
    /// </summary>
    /// <returns><see langword="true"/> if a snapshot was restored.</returns>
    public bool TryUndo(out HistorySnapshot? snapshot)
    {
        snapshot = null;
        if (_undo.Last is null)
        {
            return false;
        }

        snapshot = _undo.Last.Value;
        _undo.RemoveLast();
        return true;
    }

    /// <summary>
    /// Moves the last undone snapshot back onto the undo stack (if possible).
    /// </summary>
    /// <returns><see langword="true"/> if a snapshot was reapplied.</returns>
    public bool TryRedo(out HistorySnapshot? snapshot)
    {
        snapshot = null;
        if (_redo.Last is null)
        {
            return false;
        }

        snapshot = _redo.Last.Value;
        _redo.RemoveLast();
        return true;
    }

    /// <summary>
    /// Captures the provided snapshot onto the redo stack (used when undo moves backwards).
    /// </summary>
    public void PushRedo(HistorySnapshot snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        _redo.AddLast(snapshot);
        TrimOldestRedo();
    }

    /// <summary>
    /// Captures the provided snapshot onto the undo stack (used when redo moves forwards).
    /// </summary>
    public void PushUndo(HistorySnapshot snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        _undo.AddLast(snapshot);
        TrimOldestUndo();
    }

    private void TrimOldestUndo()
    {
        while (_undo.Count > Constants.MaxHistoryEntries && _undo.First is not null)
        {
            _undo.RemoveFirst();
        }
    }

    private void TrimOldestRedo()
    {
        while (_redo.Count > Constants.MaxHistoryEntries && _redo.First is not null)
        {
            _redo.RemoveFirst();
        }
    }
}
