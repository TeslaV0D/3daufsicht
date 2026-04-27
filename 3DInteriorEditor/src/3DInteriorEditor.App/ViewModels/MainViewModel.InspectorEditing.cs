using System.Globalization;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using _3DInteriorEditor.App.Models;

namespace _3DInteriorEditor.App.ViewModels;

/// <summary>
/// Inspector numeric editing for a single selected <see cref="Models.PlacedAsset"/> (Phase 13).
/// </summary>
public sealed partial class MainViewModel
{
    /// <summary>
    /// Whether the numeric transform editor is shown (exactly one selected asset).
    /// </summary>
    public bool IsInspectorTransformVisible => SelectedAssetIds.Count == 1;

    /// <summary>
    /// Position X (meters), invariant decimal text for editing.
    /// </summary>
    [ObservableProperty]
    private string _inspectorPosXText = "0";

    /// <summary>
    /// Position Y (meters).
    /// </summary>
    [ObservableProperty]
    private string _inspectorPosYText = "0";

    /// <summary>
    /// Position Z (meters).
    /// </summary>
    [ObservableProperty]
    private string _inspectorPosZText = "0";

    /// <summary>
    /// Rotation X (degrees).
    /// </summary>
    [ObservableProperty]
    private string _inspectorRotXText = "0";

    /// <summary>
    /// Rotation Y (degrees).
    /// </summary>
    [ObservableProperty]
    private string _inspectorRotYText = "0";

    /// <summary>
    /// Rotation Z (degrees).
    /// </summary>
    [ObservableProperty]
    private string _inspectorRotZText = "0";

    [RelayCommand(CanExecute = nameof(CanApplyInspectorTransform))]
    private void ApplyInspectorTransform()
    {
        if (SelectedAssetIds.Count != 1)
        {
            return;
        }

        if (!TryParseInspectorVectors(out var pos, out var rot))
        {
            StatusText = "Ungültige Zahl — bitte Dezimalpunkt verwenden";
            return;
        }

        History.Push(PlacedAssets.ToList(), CurrentSelectionIds());

        var id = SelectedAssetIds[0];
        UpdatePlacedAsset(id, a => CloneAsset(a, positionMeters: pos, rotationDegrees: rot));

        MarkDirty();
        NotifyUndoRedoCommands();
        RefreshInspectorTransformFieldsFromScene();
        StatusText = "Transform aktualisiert";
    }

    [RelayCommand(CanExecute = nameof(CanApplyInspectorTransform))]
    private void ResetInspectorTransform()
    {
        RefreshInspectorTransformFieldsFromScene();
        StatusText = "Felder zurückgesetzt";
    }

    private bool CanApplyInspectorTransform() => SelectedAssetIds.Count == 1;

    /// <summary>
    /// Reloads inspector text boxes from the current scene state (single selection only).
    /// </summary>
    internal void RefreshInspectorTransformFieldsFromScene()
    {
        OnPropertyChanged(nameof(IsInspectorTransformVisible));

        if (SelectedAssetIds.Count != 1)
        {
            ClearInspectorTransformTexts();
            NotifyInspectorTransformCommands();
            return;
        }

        var id = SelectedAssetIds[0];
        var asset = PlacedAssets.FirstOrDefault(p => string.Equals(p.Id, id, StringComparison.Ordinal));
        if (asset is null)
        {
            ClearInspectorTransformTexts();
            NotifyInspectorTransformCommands();
            return;
        }

        InspectorPosXText = FormatInvariant(asset.PositionMeters.X);
        InspectorPosYText = FormatInvariant(asset.PositionMeters.Y);
        InspectorPosZText = FormatInvariant(asset.PositionMeters.Z);
        InspectorRotXText = FormatInvariant(asset.RotationDegrees.X);
        InspectorRotYText = FormatInvariant(asset.RotationDegrees.Y);
        InspectorRotZText = FormatInvariant(asset.RotationDegrees.Z);

        NotifyInspectorTransformCommands();
    }

    private void ClearInspectorTransformTexts()
    {
        InspectorPosXText = "0";
        InspectorPosYText = "0";
        InspectorPosZText = "0";
        InspectorRotXText = "0";
        InspectorRotYText = "0";
        InspectorRotZText = "0";
    }

    private static string FormatInvariant(double value) =>
        value.ToString("0.###", CultureInfo.InvariantCulture);

    private bool TryParseInspectorVectors(out JsonVector3 position, out JsonVector3 rotation)
    {
        position = null!;
        rotation = null!;

        if (!TryParseDouble(InspectorPosXText, out var px)
            || !TryParseDouble(InspectorPosYText, out var py)
            || !TryParseDouble(InspectorPosZText, out var pz)
            || !TryParseDouble(InspectorRotXText, out var rx)
            || !TryParseDouble(InspectorRotYText, out var ry)
            || !TryParseDouble(InspectorRotZText, out var rz))
        {
            return false;
        }

        position = new JsonVector3 { X = px, Y = py, Z = pz };
        rotation = new JsonVector3 { X = rx, Y = ry, Z = rz };
        return true;
    }

    private static bool TryParseDouble(string? text, out double value)
    {
        value = 0;
        if (string.IsNullOrWhiteSpace(text))
        {
            return false;
        }

        return double.TryParse(
            text.Trim(),
            NumberStyles.Float | NumberStyles.AllowThousands,
            CultureInfo.InvariantCulture,
            out value);
    }

    private void NotifyInspectorTransformCommands()
    {
        ApplyInspectorTransformCommand.NotifyCanExecuteChanged();
        ResetInspectorTransformCommand.NotifyCanExecuteChanged();
    }
}
