using System.Globalization;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using _3DInteriorEditor.App.Helpers;
using _3DInteriorEditor.App.Models;

namespace _3DInteriorEditor.App.ViewModels;

/// <summary>
/// Inspector numeric editing for a single selected <see cref="Models.PlacedAsset"/> (Phase 13).
/// Appearance (dimensions + color): Phase 18.
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

    /// <summary>
    /// Dimensions width X / height Y / depth Z (meters), invariant decimal text.
    /// </summary>
    [ObservableProperty]
    private string _inspectorDimXText = "1";

    [ObservableProperty]
    private string _inspectorDimYText = "1";

    [ObservableProperty]
    private string _inspectorDimZText = "1";

    /// <summary>
    /// Instance diffuse color hex (<c>#RRGGBB</c> / <c>#AARRGGBB</c> accepted on input).
    /// </summary>
    [ObservableProperty]
    private string _inspectorColorHexText = "#808080";

    /// <summary>
    /// Built-in swatches bound in the inspector color palette (<see cref="Constants.DefaultColorSwatches"/>).
    /// </summary>
    public IReadOnlyList<string> InspectorColorPalette => Constants.DefaultColorSwatches;

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

    [RelayCommand(CanExecute = nameof(CanApplyInspectorAppearance))]
    private void ApplyInspectorAppearance()
    {
        if (SelectedAssetIds.Count != 1)
        {
            return;
        }

        if (!TryParseInspectorAppearance(out var dims, out var colorHex))
        {
            StatusText = "Ungültige Maße oder Farbe";
            return;
        }

        History.Push(PlacedAssets.ToList(), CurrentSelectionIds());

        var id = SelectedAssetIds[0];
        UpdatePlacedAsset(id, a => CloneAsset(a, dimensionsMeters: dims, colorHex: colorHex));

        MarkDirty();
        NotifyUndoRedoCommands();
        RefreshInspectorTransformFieldsFromScene();
        StatusText = "Maße/Farbe aktualisiert";
    }

    [RelayCommand(CanExecute = nameof(CanApplyInspectorAppearance))]
    private void ResetInspectorAppearance()
    {
        RefreshInspectorAppearanceFieldsFromScene();
        StatusText = "Maße/Farbe zurückgesetzt";
    }

    [RelayCommand]
    private void PickInspectorColorSwatch(string? hex)
    {
        if (string.IsNullOrWhiteSpace(hex))
        {
            return;
        }

        InspectorColorHexText = hex.Trim();
    }

    private bool CanApplyInspectorAppearance() => SelectedAssetIds.Count == 1;

    /// <summary>
    /// Reloads inspector text boxes from the current scene state (single selection only).
    /// </summary>
    internal void RefreshInspectorTransformFieldsFromScene()
    {
        OnPropertyChanged(nameof(IsInspectorTransformVisible));

        if (SelectedAssetIds.Count != 1)
        {
            ClearInspectorTransformTexts();
            ClearInspectorAppearanceTexts();
            NotifyInspectorTransformCommands();
            NotifyInspectorAppearanceCommands();
            return;
        }

        var id = SelectedAssetIds[0];
        var asset = PlacedAssets.FirstOrDefault(p => string.Equals(p.Id, id, StringComparison.Ordinal));
        if (asset is null)
        {
            ClearInspectorTransformTexts();
            ClearInspectorAppearanceTexts();
            NotifyInspectorTransformCommands();
            NotifyInspectorAppearanceCommands();
            return;
        }

        InspectorPosXText = FormatInvariant(asset.PositionMeters.X);
        InspectorPosYText = FormatInvariant(asset.PositionMeters.Y);
        InspectorPosZText = FormatInvariant(asset.PositionMeters.Z);
        InspectorRotXText = FormatInvariant(asset.RotationDegrees.X);
        InspectorRotYText = FormatInvariant(asset.RotationDegrees.Y);
        InspectorRotZText = FormatInvariant(asset.RotationDegrees.Z);

        InspectorDimXText = FormatInvariant(asset.DimensionsMeters.X);
        InspectorDimYText = FormatInvariant(asset.DimensionsMeters.Y);
        InspectorDimZText = FormatInvariant(asset.DimensionsMeters.Z);
        InspectorColorHexText = FormatColorHexRgb(asset.ColorHex);

        NotifyInspectorTransformCommands();
        NotifyInspectorAppearanceCommands();
    }

    /// <summary>
    /// Reloads appearance fields only (single selection).
    /// </summary>
    internal void RefreshInspectorAppearanceFieldsFromScene()
    {
        if (SelectedAssetIds.Count != 1)
        {
            ClearInspectorAppearanceTexts();
            NotifyInspectorAppearanceCommands();
            return;
        }

        var id = SelectedAssetIds[0];
        var asset = PlacedAssets.FirstOrDefault(p => string.Equals(p.Id, id, StringComparison.Ordinal));
        if (asset is null)
        {
            ClearInspectorAppearanceTexts();
            NotifyInspectorAppearanceCommands();
            return;
        }

        InspectorDimXText = FormatInvariant(asset.DimensionsMeters.X);
        InspectorDimYText = FormatInvariant(asset.DimensionsMeters.Y);
        InspectorDimZText = FormatInvariant(asset.DimensionsMeters.Z);
        InspectorColorHexText = FormatColorHexRgb(asset.ColorHex);

        NotifyInspectorAppearanceCommands();
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

    private void ClearInspectorAppearanceTexts()
    {
        InspectorDimXText = "1";
        InspectorDimYText = "1";
        InspectorDimZText = "1";
        InspectorColorHexText = "#808080";
    }

    private static string FormatColorHexRgb(string? hex)
    {
        if (!ColorHexHelper.TryParseColor(hex, out var c))
        {
            return "#808080";
        }

        return $"#{c.R:X2}{c.G:X2}{c.B:X2}";
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

    private bool TryParseInspectorAppearance(out JsonVector3 dimensions, out string colorHexRgb)
    {
        dimensions = null!;
        colorHexRgb = string.Empty;

        if (!TryParseDouble(InspectorDimXText, out var dx)
            || !TryParseDouble(InspectorDimYText, out var dy)
            || !TryParseDouble(InspectorDimZText, out var dz))
        {
            return false;
        }

        dx = Math.Max(Constants.MinAssetDimension, dx);
        dy = Math.Max(Constants.MinAssetDimension, dy);
        dz = Math.Max(Constants.MinAssetDimension, dz);

        dimensions = new JsonVector3 { X = dx, Y = dy, Z = dz };

        if (!ColorHexHelper.TryParseColor(InspectorColorHexText, out var c))
        {
            return false;
        }

        colorHexRgb = $"#{c.R:X2}{c.G:X2}{c.B:X2}";
        return true;
    }

    private void NotifyInspectorAppearanceCommands()
    {
        ApplyInspectorAppearanceCommand.NotifyCanExecuteChanged();
        ResetInspectorAppearanceCommand.NotifyCanExecuteChanged();
    }
}
