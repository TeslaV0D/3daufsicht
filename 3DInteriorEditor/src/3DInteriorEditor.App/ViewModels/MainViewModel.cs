using System.Collections.Generic;
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
    /// Current selection (placed asset instance ids).
    /// Kept as ids so it can be persisted/restored via history without holding stale references.
    /// </summary>
    public ObservableCollection<string> SelectedAssetIds { get; } = new();

    /// <summary>
    /// Observable definitions for UI/list bindings (kept in sync with <see cref="Layout"/>).
    /// </summary>
    public ObservableCollection<AssetDefinition> AssetDefinitions { get; } = new();

    public MainViewModel()
    {
        Library = new AssetLibraryViewModel();
        Inspector = new InspectorViewModel();

        SelectedAssetIds.CollectionChanged += (_, _) => SyncSelectionToInspector();

        InspectorMetadataRows.CollectionChanged += (_, _) => OnPropertyChanged(nameof(InspectorMetadataEmptyVisible));

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

    /// <summary>
    /// Toolbar highlight: active transform tool matches <see cref="TransformMode.Translate"/>.
    /// </summary>
    public bool IsTransformTranslateActive => TransformMode == TransformMode.Translate;

    /// <summary>
    /// Toolbar highlight: active transform tool matches <see cref="TransformMode.Rotate"/>.
    /// </summary>
    public bool IsTransformRotateActive => TransformMode == TransformMode.Rotate;

    /// <summary>
    /// Toolbar highlight: active transform tool matches <see cref="TransformMode.Scale"/>.
    /// </summary>
    public bool IsTransformScaleActive => TransformMode == TransformMode.Scale;

    partial void OnTransformModeChanged(TransformMode value)
    {
        OnPropertyChanged(nameof(IsTransformTranslateActive));
        OnPropertyChanged(nameof(IsTransformRotateActive));
        OnPropertyChanged(nameof(IsTransformScaleActive));
    }

    /// <summary>
    /// Sets the active viewport transform tool (toolbar + drag gestures).
    /// </summary>
    [RelayCommand]
    private void SetTransformTool(TransformMode mode)
    {
        TransformMode = mode;
        StatusText = mode switch
        {
            TransformMode.Translate => "Werkzeug: Verschieben",
            TransformMode.Rotate => "Werkzeug: Drehen",
            TransformMode.Scale => "Werkzeug: Skalieren",
            _ => StatusText,
        };
    }

    [RelayCommand]
    private void NewLayout()
    {
        Layout = CreateNewLayout();
        CurrentFilePath = null;
        HasUnsavedChanges = false;
        History.Clear();
        StatusText = "Neues Layout";
        NotifyUndoRedoCommands();
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

        History.Push(PlacedAssets.ToList(), CurrentSelectionIds());

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
        SetSelectionIds(new[] { placed.Id });
        MarkDirty();
        NotifyUndoRedoCommands();
    }

    [RelayCommand(CanExecute = nameof(HasAnySelection))]
    private void DeleteSelected()
    {
        if (SelectedAssetIds.Count == 0)
        {
            return;
        }

        History.Push(PlacedAssets.ToList(), CurrentSelectionIds());

        var toDelete = SelectedAssetIds.ToHashSet(StringComparer.Ordinal);
        for (var i = PlacedAssets.Count - 1; i >= 0; i--)
        {
            if (toDelete.Contains(PlacedAssets[i].Id))
            {
                PlacedAssets.RemoveAt(i);
            }
        }

        SelectedAssetIds.Clear();
        MarkDirty();
        NotifyUndoRedoCommands();
        StatusText = "Gelöscht";
    }

    [RelayCommand(CanExecute = nameof(HasAnySelection))]
    private void NudgeSelected(string direction)
    {
        if (SelectedAssetIds.Count == 0)
        {
            return;
        }

        var step = direction.EndsWith("Fine", StringComparison.Ordinal)
            ? Constants.SnapUnitDefault * 0.1
            : Constants.SnapUnitDefault;

        var dir = direction.Replace("Fine", "", StringComparison.Ordinal);
        (double dx, double dz) = dir switch
        {
            "Left" => (-step, 0d),
            "Right" => (step, 0d),
            "Forward" => (0d, -step),
            "Back" => (0d, step),
            _ => (0d, 0d),
        };

        if (dx == 0 && dz == 0)
        {
            return;
        }

        History.Push(PlacedAssets.ToList(), CurrentSelectionIds());

        foreach (var id in SelectedAssetIds.ToList())
        {
            UpdatePlacedAsset(id, a => CloneAsset(a, positionMeters: new JsonVector3
            {
                X = a.PositionMeters.X + dx,
                Y = a.PositionMeters.Y,
                Z = a.PositionMeters.Z + dz,
            }));
        }

        MarkDirty();
        NotifyUndoRedoCommands();
        RefreshInspectorTransformFieldsFromScene();
    }

    [RelayCommand(CanExecute = nameof(HasAnySelection))]
    private void RotateSelected(string direction)
    {
        if (SelectedAssetIds.Count == 0)
        {
            return;
        }

        var step = direction.EndsWith("Fine", StringComparison.Ordinal)
            ? 5.0
            : Constants.RotationSnapDegrees;

        var dir = direction.Replace("Fine", "", StringComparison.Ordinal);
        var delta = dir switch
        {
            "Left" => -step,
            "Right" => step,
            _ => 0,
        };

        if (delta == 0)
        {
            return;
        }

        History.Push(PlacedAssets.ToList(), CurrentSelectionIds());

        foreach (var id in SelectedAssetIds.ToList())
        {
            UpdatePlacedAsset(id, a => CloneAsset(a, rotationDegrees: new JsonVector3
            {
                X = a.RotationDegrees.X,
                Y = a.RotationDegrees.Y + delta,
                Z = a.RotationDegrees.Z,
            }));
        }

        MarkDirty();
        NotifyUndoRedoCommands();
        RefreshInspectorTransformFieldsFromScene();
    }

    [RelayCommand(CanExecute = nameof(CanUndo))]
    private void Undo()
    {
        var current = CaptureSnapshot();
        if (!History.TryUndo(out var prev) || prev is null)
        {
            return;
        }

        History.PushRedo(current);
        ApplySnapshot(prev);
        StatusText = "Rückgängig";
        NotifyUndoRedoCommands();
    }

    private bool CanUndo() => History.CanUndo;

    [RelayCommand(CanExecute = nameof(CanRedo))]
    private void Redo()
    {
        var current = CaptureSnapshot();
        if (!History.TryRedo(out var next) || next is null)
        {
            return;
        }

        History.PushUndo(current);
        ApplySnapshot(next);
        StatusText = "Wiederholen";
        NotifyUndoRedoCommands();
    }

    private bool CanRedo() => History.CanRedo;

    private bool HasAnySelection() => SelectedAssetIds.Count > 0;

    [RelayCommand(CanExecute = nameof(HasAnySelection))]
    private void DuplicateSelected()
    {
        if (SelectedAssetIds.Count == 0)
        {
            return;
        }

        History.Push(PlacedAssets.ToList(), CurrentSelectionIds());

        var selectedIds = SelectedAssetIds.ToList();
        var newIds = new List<string>();

        foreach (var id in selectedIds)
        {
            var src = PlacedAssets.FirstOrDefault(p => string.Equals(p.Id, id, StringComparison.Ordinal));
            if (src is null)
            {
                continue;
            }

            var copyId = Guid.NewGuid().ToString("N");
            var copy = CloneAsset(src, positionMeters: new JsonVector3
            {
                X = src.PositionMeters.X + Constants.PasteOffsetX,
                Y = src.PositionMeters.Y,
                Z = src.PositionMeters.Z + Constants.PasteOffsetZ,
            });

            // CloneAsset keeps id; override id for the new instance.
            copy = new PlacedAsset
            {
                Id = copyId,
                AssetDefinitionId = copy.AssetDefinitionId,
                PositionMeters = copy.PositionMeters,
                RotationDegrees = copy.RotationDegrees,
                DimensionsMeters = copy.DimensionsMeters,
                ColorHex = copy.ColorHex,
                Metadata = copy.Metadata,
                IsVisible = copy.IsVisible,
            };

            PlacedAssets.Add(copy);
            newIds.Add(copyId);
        }

        if (newIds.Count > 0)
        {
            SetSelectionIds(newIds);
        }

        MarkDirty();
        NotifyUndoRedoCommands();
        StatusText = "Dupliziert";
    }

    private HistorySnapshot CaptureSnapshot()
    {
        return new HistorySnapshot
        {
            Assets = DeepCopy.CloneList(PlacedAssets),
            SelectedAssetIds = DeepCopy.CloneList(CurrentSelectionIds()),
        };
    }

    private void ApplySnapshot(HistorySnapshot snap)
    {
        PlacedAssets.Clear();
        foreach (var a in snap.Assets)
        {
            PlacedAssets.Add(a);
        }

        SyncCollectionsToLayout();

        SetSelectionIds(snap.SelectedAssetIds);
        MarkDirty();
    }

    private List<string> CurrentSelectionIds() =>
        SelectedAssetIds.ToList();

    private void NotifyUndoRedoCommands()
    {
        UndoCommand.NotifyCanExecuteChanged();
        RedoCommand.NotifyCanExecuteChanged();
    }

    /// <summary>
    /// Clears viewport-driven selection (inspector + status).
    /// </summary>
    public void ClearViewportSelection()
    {
        SelectedAssetIds.Clear();
        StatusText = "Bereit";
    }

    /// <summary>
    /// Applies selection after a viewport hit-test (single asset).
    /// </summary>
    public void ApplyViewportPick(PlacedAsset picked)
    {
        ToggleSelectionId(picked.Id);
        var label = AssetDefinitions.FirstOrDefault(d =>
                string.Equals(d.Id, picked.AssetDefinitionId, StringComparison.Ordinal))
            ?.DisplayName ?? picked.AssetDefinitionId;
        StatusText = $"Auswahl: {label}";
    }

    public void SetSelectionIds(IEnumerable<string> ids)
    {
        SelectedAssetIds.Clear();
        foreach (var id in ids.Distinct(StringComparer.Ordinal))
        {
            SelectedAssetIds.Add(id);
        }
    }

    private void ToggleSelectionId(string id)
    {
        var idx = SelectedAssetIds.IndexOf(id);
        if (idx >= 0)
        {
            SelectedAssetIds.RemoveAt(idx);
            return;
        }

        SelectedAssetIds.Add(id);
    }

    private void UpdatePlacedAsset(string id, Func<PlacedAsset, PlacedAsset> updater)
    {
        for (var i = 0; i < PlacedAssets.Count; i++)
        {
            if (!string.Equals(PlacedAssets[i].Id, id, StringComparison.Ordinal))
            {
                continue;
            }

            var updated = updater(PlacedAssets[i]);
            if (!string.Equals(updated.Id, id, StringComparison.Ordinal))
            {
                throw new InvalidOperationException("Updater must not change the instance id.");
            }

            PlacedAssets[i] = updated;
            return;
        }
    }

    private static PlacedAsset CloneAsset(
        PlacedAsset a,
        JsonVector3? positionMeters = null,
        JsonVector3? rotationDegrees = null,
        JsonVector3? dimensionsMeters = null,
        string? colorHex = null,
        bool? isVisible = null,
        IReadOnlyDictionary<string, string>? metadata = null)
    {
        return new PlacedAsset
        {
            Id = a.Id,
            AssetDefinitionId = a.AssetDefinitionId,
            PositionMeters = positionMeters ?? a.PositionMeters,
            RotationDegrees = rotationDegrees ?? a.RotationDegrees,
            DimensionsMeters = dimensionsMeters ?? a.DimensionsMeters,
            ColorHex = colorHex ?? a.ColorHex,
            Metadata = metadata is not null
                ? new Dictionary<string, string>(metadata, StringComparer.Ordinal)
                : new Dictionary<string, string>(a.Metadata, StringComparer.Ordinal),
            IsVisible = isVisible ?? a.IsVisible,
        };
    }

    private void SyncSelectionToInspector()
    {
        var selected = SelectedAssetIds
            .Select(id => PlacedAssets.FirstOrDefault(p => string.Equals(p.Id, id, StringComparison.Ordinal)))
            .Where(a => a is not null)
            .Cast<PlacedAsset>()
            .ToList();

        Inspector.SetSelection(selected);
        RefreshInspectorTransformFieldsFromScene();
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
            NotifyUndoRedoCommands();
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
        SelectedAssetIds.Clear();

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
