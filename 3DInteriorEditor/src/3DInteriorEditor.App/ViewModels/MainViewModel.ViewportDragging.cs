using _3DInteriorEditor.App.Models;

namespace _3DInteriorEditor.App.ViewModels;

/// <summary>
/// Viewport-driven interactive transforms (Phase 15).
/// </summary>
public sealed partial class MainViewModel
{
    private bool _isViewportTranslateDragActive;

    /// <summary>
    /// Starts a translate drag operation (pushes undo snapshot once).
    /// </summary>
    public void BeginViewportTranslateDrag()
    {
        if (_isViewportTranslateDragActive)
        {
            return;
        }

        if (SelectedAssetIds.Count != 1)
        {
            return;
        }

        _isViewportTranslateDragActive = true;
        History.Push(PlacedAssets.ToList(), CurrentSelectionIds());
        NotifyUndoRedoCommands();
        StatusText = "Verschieben…";
    }

    /// <summary>
    /// Applies a translate drag update to a specific asset (no additional history snapshots).
    /// </summary>
    public void ApplyViewportTranslateDrag(string assetId, double x, double z)
    {
        if (!_isViewportTranslateDragActive)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(assetId))
        {
            return;
        }

        UpdatePlacedAsset(assetId, a => CloneAsset(a, positionMeters: new JsonVector3
        {
            X = x,
            Y = a.PositionMeters.Y,
            Z = z,
        }));

        MarkDirty();
        RefreshInspectorTransformFieldsFromScene();
    }

    /// <summary>
    /// Ends a translate drag operation.
    /// </summary>
    public void EndViewportTranslateDrag()
    {
        if (!_isViewportTranslateDragActive)
        {
            return;
        }

        _isViewportTranslateDragActive = false;
        StatusText = "Verschoben";
    }
}

