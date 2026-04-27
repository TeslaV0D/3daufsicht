using CommunityToolkit.Mvvm.ComponentModel;
using _3DInteriorEditor.App.Models;

namespace _3DInteriorEditor.App.ViewModels;

/// <summary>
/// View model for the right inspector (selection details).
/// </summary>
public sealed partial class InspectorViewModel : ObservableObject
{
    [ObservableProperty]
    private IReadOnlyList<PlacedAsset> _selectedAssets = Array.Empty<PlacedAsset>();

    partial void OnSelectedAssetsChanged(IReadOnlyList<PlacedAsset> value)
    {
        OnPropertyChanged(nameof(SelectedCount));
        OnPropertyChanged(nameof(HeaderText));
    }

    /// <summary>
    /// Number of currently selected assets.
    /// </summary>
    public int SelectedCount => SelectedAssets.Count;

    /// <summary>
    /// Human-readable header for the inspector.
    /// </summary>
    public string HeaderText => SelectedCount switch
    {
        0 => "Keine Auswahl",
        1 => "Asset",
        _ => $"{SelectedCount} Assets ausgewählt",
    };

    /// <summary>
    /// Updates the current selection and raises related notifications.
    /// </summary>
    public void SetSelection(IReadOnlyList<PlacedAsset> selected)
    {
        SelectedAssets = selected;
    }
}
