using System.Linq;
using _3DInteriorEditor.App.Models;

namespace _3DInteriorEditor.App.ViewModels;

/// <summary>
/// Viewport-driven interactive transforms (Phase 15–17).
/// </summary>
public sealed partial class MainViewModel
{
    private bool _isViewportTranslateDragActive;
    private bool _isViewportRotateDragActive;
    private bool _isViewportScaleDragActive;

    private double _translateDragAnchorX;
    private double _translateDragAnchorZ;

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

        var id = SelectedAssetIds[0];
        var cur = PlacedAssets.FirstOrDefault(p => string.Equals(p.Id, id, StringComparison.Ordinal));
        if (cur is null)
        {
            return;
        }

        _translateDragAnchorX = cur.PositionMeters.X;
        _translateDragAnchorZ = cur.PositionMeters.Z;

        _isViewportTranslateDragActive = true;
        History.Push(PlacedAssets.ToList(), CurrentSelectionIds());
        NotifyUndoRedoCommands();
        StatusText = TranslatePlaneConstraint == TranslatePlaneConstraint.None
            ? "Verschieben…"
            : $"Verschieben (Achse {TranslatePlaneConstraint})…";
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

        switch (TranslatePlaneConstraint)
        {
            case TranslatePlaneConstraint.AxisX:
                z = _translateDragAnchorZ;
                break;
            case TranslatePlaneConstraint.AxisZ:
                x = _translateDragAnchorX;
                break;
            case TranslatePlaneConstraint.None:
                break;
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
        TranslatePlaneConstraint = TranslatePlaneConstraint.None;
        StatusText = "Verschoben";
    }

    /// <summary>
    /// Starts a rotate drag operation (pushes undo snapshot once).
    /// </summary>
    public void BeginViewportRotateDrag()
    {
        if (_isViewportRotateDragActive)
        {
            return;
        }

        if (SelectedAssetIds.Count != 1)
        {
            return;
        }

        _isViewportRotateDragActive = true;
        History.Push(PlacedAssets.ToList(), CurrentSelectionIds());
        NotifyUndoRedoCommands();
        StatusText = "Drehen…";
    }

    /// <summary>
    /// Applies a rotate drag update (no additional history snapshots).
    /// </summary>
    public void ApplyViewportRotateDrag(string assetId, double rotationYDegrees)
    {
        if (!_isViewportRotateDragActive)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(assetId))
        {
            return;
        }

        UpdatePlacedAsset(assetId, a => CloneAsset(a, rotationDegrees: new JsonVector3
        {
            X = a.RotationDegrees.X,
            Y = rotationYDegrees,
            Z = a.RotationDegrees.Z,
        }));

        MarkDirty();
        RefreshInspectorTransformFieldsFromScene();
    }

    /// <summary>
    /// Ends a rotate drag operation.
    /// </summary>
    public void EndViewportRotateDrag()
    {
        if (!_isViewportRotateDragActive)
        {
            return;
        }

        _isViewportRotateDragActive = false;
        StatusText = "Gedreht";
    }

    /// <summary>
    /// Starts a uniform scale drag (pushes undo snapshot once).
    /// </summary>
    public void BeginViewportScaleDrag()
    {
        if (_isViewportScaleDragActive)
        {
            return;
        }

        if (SelectedAssetIds.Count != 1)
        {
            return;
        }

        _isViewportScaleDragActive = true;
        History.Push(PlacedAssets.ToList(), CurrentSelectionIds());
        NotifyUndoRedoCommands();
        StatusText = "Skalieren…";
    }

    /// <summary>
    /// Applies uniform scale to instance dimensions (no additional history snapshots).
    /// </summary>
    public void ApplyViewportScaleDrag(string assetId, JsonVector3 dimensionsMeters)
    {
        if (!_isViewportScaleDragActive)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(assetId))
        {
            return;
        }

        UpdatePlacedAsset(assetId, a => CloneAsset(a, dimensionsMeters: dimensionsMeters));

        MarkDirty();
        RefreshInspectorTransformFieldsFromScene();
    }

    /// <summary>
    /// Ends a scale drag operation.
    /// </summary>
    public void EndViewportScaleDrag()
    {
        if (!_isViewportScaleDragActive)
        {
            return;
        }

        _isViewportScaleDragActive = false;
        StatusText = "Skaliert";
    }
}

