using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Win32;
using _3DInteriorEditor.App.Data;
using _3DInteriorEditor.App.Models;
using _3DInteriorEditor.App.Services;

namespace _3DInteriorEditor.App.ViewModels;

/// <summary>
/// Top-level application view model (document + editing mode + shared sub-viewmodels).
/// </summary>
public sealed partial class MainViewModel : ObservableObject
{
    private readonly FileService _fileService = new();

    public AssetLibraryViewModel Library { get; }
    public InspectorViewModel Inspector { get; }

    public HistoryService History { get; } = new();

    [ObservableProperty]
    private LayoutFile _layout = CreateNewLayout();

    [ObservableProperty]
    private string? _currentFilePath;

    [ObservableProperty]
    private bool _hasUnsavedChanges;

    [ObservableProperty]
    private EditorMode _mode = EditorMode.Edit;

    [ObservableProperty]
    private TransformMode _transformMode = TransformMode.Translate;

    [ObservableProperty]
    private string _statusText = "Bereit";

    /// <summary>
    /// Bind this to <see cref="System.Windows.Window.Title"/>.
    /// </summary>
    public string WindowTitle
    {
        get
        {
            var name = string.IsNullOrWhiteSpace(CurrentFilePath)
                ? "Unbenannt"
                : Path.GetFileName(CurrentFilePath);

            var dirty = HasUnsavedChanges ? "*" : "";
            return $"{dirty}{name} — 3D Interior Editor";
        }
    }

    /// <summary>
    /// Observable placed assets for UI/list bindings (kept in sync with <see cref="Layout"/>).
    /// </summary>
    public ObservableCollection<PlacedAsset> PlacedAssets { get; } = new();

    /// <summary>
    /// Observable definitions for UI/list bindings (kept in sync with <see cref="Layout"/>).
    /// </summary>
    public ObservableCollection<AssetDefinition> AssetDefinitions { get; } = new();

    public MainViewModel()
    {
        Library = new AssetLibraryViewModel();
        Inspector = new InspectorViewModel();

        BootstrapLayoutCollections();
        RefreshInspectorSelection();
    }

    partial void OnLayoutChanged(LayoutFile value)
    {
        BootstrapLayoutCollections();
        RefreshInspectorSelection();
        OnPropertyChanged(nameof(WindowTitle));
    }

    partial void OnCurrentFilePathChanged(string? value) => OnPropertyChanged(nameof(WindowTitle));

    partial void OnHasUnsavedChangesChanged(bool value) => OnPropertyChanged(nameof(WindowTitle));

    partial void OnModeChanged(EditorMode value)
    {
        StatusText = value == EditorMode.Edit ? "Edit Mode" : "Presentation Mode";
        OnPropertyChanged(nameof(ModeLabel));
    }

    /// <summary>
    /// Short mode label for status/UI.
    /// </summary>
    public string ModeLabel => Mode == EditorMode.Edit ? "EDIT" : "VIEW";

    [RelayCommand]
    private void NewLayout()
    {
        Layout = CreateNewLayout();
        CurrentFilePath = null;
        HasUnsavedChanges = false;
        History.Clear();
        StatusText = "Neues Layout";
    }

    [RelayCommand]
    private async Task OpenLayoutAsync()
    {
        var dlg = new OpenFileDialog
        {
            Filter = $"3D Interior Layout|*{Constants.LayoutFileExtension}|All files|*.*",
        };

        if (dlg.ShowDialog() != true)
        {
            return;
        }

        await LoadFromPathAsync(dlg.FileName);
    }

    [RelayCommand]
    private async Task SaveLayoutAsync()
    {
        if (string.IsNullOrWhiteSpace(CurrentFilePath))
        {
            await SaveLayoutAsAsync();
            return;
        }

        await SaveToPathAsync(CurrentFilePath);
    }

    [RelayCommand]
    private async Task SaveLayoutAsAsync()
    {
        var dlg = new SaveFileDialog
        {
            Filter = $"3D Interior Layout|*{Constants.LayoutFileExtension}",
            DefaultExt = Constants.LayoutFileExtension.TrimStart('.'),
            AddExtension = true,
        };

        if (dlg.ShowDialog() != true)
        {
            return;
        }

        CurrentFilePath = dlg.FileName;
        await SaveToPathAsync(CurrentFilePath);
    }

    /// <summary>
    /// Place a library template into the scene (spread on the ground plane so instances do not overlap).
    /// </summary>
    [RelayCommand]
    private void PlaceAssetFromLibrary(AssetDefinition? definition)
    {
        if (definition is null)
        {
            return;
        }

        var dims = definition.DefaultDimensionsMeters;
        var halfY = dims.Y * 0.5;

        var idx = PlacedAssets.Count;
        const int columns = 8;
        var x = (idx % columns) * (dims.X + 0.35);
        var z = (idx / columns) * (dims.Z + 0.35);

        var placed = new PlacedAsset
        {
            Id = Guid.NewGuid().ToString("N"),
            AssetDefinitionId = definition.Id,
            PositionMeters = new JsonVector3 { X = x, Y = halfY, Z = z },
            RotationDegrees = new JsonVector3 { X = 0, Y = 0, Z = 0 },
            DimensionsMeters = new JsonVector3 { X = dims.X, Y = dims.Y, Z = dims.Z },
            ColorHex = definition.DefaultColorHex,
            Metadata = new Dictionary<string, string>(definition.MetadataTemplates, StringComparer.Ordinal),
            IsVisible = true,
        };

        PlacedAssets.Add(placed);
        MarkDirty();
    }

    /// <summary>
    /// Clears viewport-driven selection (inspector + status).
    /// </summary>
    public void ClearViewportSelection()
    {
        Inspector.SetSelection(Array.Empty<PlacedAsset>());
        StatusText = "Bereit";
    }

    /// <summary>
    /// Applies selection after a viewport hit-test (single asset).
    /// </summary>
    public void ApplyViewportPick(PlacedAsset picked)
    {
        Inspector.SetSelection(new[] { picked });
        var label = AssetDefinitions.FirstOrDefault(d =>
                string.Equals(d.Id, picked.AssetDefinitionId, StringComparison.Ordinal))
            ?.DisplayName ?? picked.AssetDefinitionId;
        StatusText = $"Auswahl: {label}";
    }

    /// <summary>
    /// Marks the document dirty (call from future editing commands).
    /// </summary>
    public void MarkDirty()
    {
        HasUnsavedChanges = true;
    }

    private async Task LoadFromPathAsync(string path)
    {
        try
        {
            StatusText = "Lade Layout…";
            var loaded = await _fileService.LoadAsync(path);

            Layout = loaded;
            CurrentFilePath = path;
            HasUnsavedChanges = false;
            History.Clear();

            StatusText = "Layout geladen";
        }
        catch (Exception ex)
        {
            StatusText = $"Laden fehlgeschlagen: {ex.Message}";
        }
    }

    private async Task SaveToPathAsync(string path)
    {
        try
        {
            StatusText = "Speichere…";

            // Persist collections back into the layout document before saving.
            SyncCollectionsToLayout();

            await _fileService.SaveAsync(path, Layout);

            HasUnsavedChanges = false;
            StatusText = "Gespeichert";
        }
        catch (Exception ex)
        {
            StatusText = $"Speichern fehlgeschlagen: {ex.Message}";
        }
    }

    private void BootstrapLayoutCollections()
    {
        PlacedAssets.Clear();
        foreach (var a in Layout.PlacedAssets)
        {
            PlacedAssets.Add(a);
        }

        AssetDefinitions.Clear();
        foreach (var d in Layout.AssetDefinitions)
        {
            AssetDefinitions.Add(d);
        }

        // Ensure built-ins exist at minimum (later phases may dedupe/customize).
        foreach (var builtIn in DefaultAssets.All)
        {
            if (AssetDefinitions.Any(x => string.Equals(x.Id, builtIn.Id, StringComparison.Ordinal)))
            {
                continue;
            }

            AssetDefinitions.Add(builtIn);
        }

        SyncCollectionsToLayout();
    }

    private void SyncCollectionsToLayout()
    {
        Layout.PlacedAssets.Clear();
        foreach (var a in PlacedAssets)
        {
            Layout.PlacedAssets.Add(a);
        }

        Layout.AssetDefinitions.Clear();
        foreach (var d in AssetDefinitions)
        {
            Layout.AssetDefinitions.Add(d);
        }
    }

    private void RefreshInspectorSelection()
    {
        // Selection system arrives in Phase 10; keep inspector stable until then.
        Inspector.SetSelection(Array.Empty<PlacedAsset>());
    }

    private static LayoutFile CreateNewLayout()
    {
        return new LayoutFile
        {
            AssetDefinitions = DefaultAssets.All.ToList(),
            PlacedAssets = [],
            TextLabels = [],
            Decals = [],
            Lighting = new LightingSettings(),
        };
    }
}
