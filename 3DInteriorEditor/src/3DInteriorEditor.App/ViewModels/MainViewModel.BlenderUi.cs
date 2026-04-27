using System.Linq;
using System.Windows;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using _3DInteriorEditor.App.Models;

namespace _3DInteriorEditor.App.ViewModels;

/// <summary>
/// Blender-style viewport navigation hooks (wired from <see cref="Views.MainWindow"/> to <see cref="Views.ViewportPanel"/>).
/// </summary>
public sealed partial class MainViewModel
{
    public Action? NavZoomExtentsAll { get; set; }

    public Action? NavZoomExtentsSelection { get; set; }

    public Action<StandardViewKind>? NavApplyStandardView { get; set; }

    [RelayCommand]
    private void ZoomExtentsAllNavigation() => NavZoomExtentsAll?.Invoke();

    [RelayCommand]
    private void ZoomExtentsSelectionNavigation() => NavZoomExtentsSelection?.Invoke();

    [RelayCommand]
    private void StandardViewTop() => NavApplyStandardView?.Invoke(StandardViewKind.Top);

    [RelayCommand]
    private void StandardViewFront() => NavApplyStandardView?.Invoke(StandardViewKind.Front);

    [RelayCommand]
    private void StandardViewRight() => NavApplyStandardView?.Invoke(StandardViewKind.Right);

    [RelayCommand]
    private void StandardViewHomePerspective() => NavApplyStandardView?.Invoke(StandardViewKind.HomePerspective);

    [RelayCommand]
    private void ToggleSelectAllPlaced()
    {
        if (PlacedAssets.Count > 0 && SelectedAssetIds.Count == PlacedAssets.Count)
        {
            SelectedAssetIds.Clear();
            StatusText = "Auswahl aufgehoben";
            return;
        }

        SetSelectionIds(PlacedAssets.Select(p => p.Id));
        StatusText = "Alles ausgewählt";
    }

    [RelayCommand]
    private void ClearSelectionMenu()
    {
        SelectedAssetIds.Clear();
        StatusText = "Auswahl aufgehoben";
    }

    [RelayCommand]
    private void InvertSelection()
    {
        var selected = SelectedAssetIds.ToHashSet(StringComparer.Ordinal);
        SetSelectionIds(PlacedAssets.Where(p => !selected.Contains(p.Id)).Select(p => p.Id));
        StatusText = "Auswahl invertiert";
    }

    [RelayCommand(CanExecute = nameof(HasAnySelection))]
    private void HideSelectedPlaced()
    {
        if (SelectedAssetIds.Count == 0)
        {
            return;
        }

        History.Push(PlacedAssets.ToList(), CurrentSelectionIds());

        foreach (var id in SelectedAssetIds.ToList())
        {
            UpdatePlacedAsset(id, a => CloneAsset(a, isVisible: false));
        }

        MarkDirty();
        NotifyUndoRedoCommands();
        StatusText = "Auswahl ausgeblendet";
    }

    [RelayCommand]
    private void ShowAllPlaced()
    {
        History.Push(PlacedAssets.ToList(), CurrentSelectionIds());

        foreach (var a in PlacedAssets.ToList())
        {
            UpdatePlacedAsset(a.Id, x => CloneAsset(x, isVisible: true));
        }

        MarkDirty();
        NotifyUndoRedoCommands();
        StatusText = "Alles eingeblendet";
    }

    /// <summary>
    /// Blender-like workspace tab label (reserved for independent panel presets).
    /// </summary>
    [ObservableProperty]
    private string _workspaceTab = "Layout";

    [RelayCommand]
    private void SetWorkspaceTab(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return;
        }

        WorkspaceTab = name.Trim();
        StatusText = $"Workspace: {WorkspaceTab}";
    }

    [RelayCommand]
    private void QuitApplication() => Application.Current.Shutdown();
}
