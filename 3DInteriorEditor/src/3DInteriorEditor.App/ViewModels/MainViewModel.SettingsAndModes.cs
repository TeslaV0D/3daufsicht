using System.Collections.Generic;
using System.IO;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Win32;
using _3DInteriorEditor.App.Models;
using _3DInteriorEditor.App.Models.Enums;
using _3DInteriorEditor.App.Services;
using _3DInteriorEditor.App.Views;

namespace _3DInteriorEditor.App.ViewModels;

/// <summary>
/// Isolate/box/circle modes, translation axis lock on XZ plane, prefs, import/export wiring.
/// </summary>
public sealed partial class MainViewModel
{
    private readonly AppSettingsStore _settingsStore = new();

    /// <summary>
    /// Blender-style extended viewport mode (box / circle selection).
    /// </summary>
    [ObservableProperty]
    private ViewportInteractionMode _viewportInteractionMode = ViewportInteractionMode.Normal;

    /// <summary>
    /// Optional local-view isolation backup (id → was visible).
    /// </summary>
    private Dictionary<string, bool>? _isolateVisibilityBackup;

    /// <summary>
    /// Locks interactive translation on the XZ plane (world axes).
    /// </summary>
    [ObservableProperty]
    private TranslatePlaneConstraint _translatePlaneConstraint = TranslatePlaneConstraint.None;

    /// <summary>
    /// Called by <see cref="Views.ViewportPanel"/> when Helix zoom preference should be reapplied.
    /// </summary>
    public Action<bool>? ApplyZoomAroundMousePreference { get; set; }

    partial void OnViewportInteractionModeChanged(ViewportInteractionMode value)
    {
        OnPropertyChanged(nameof(IsBoxSelectModeActive));
        OnPropertyChanged(nameof(IsCircleSelectModeActive));
    }

    /// <summary>
    /// UI hint for overlay hit-testing in the viewport.
    /// </summary>
    public bool IsBoxSelectModeActive => ViewportInteractionMode == ViewportInteractionMode.BoxSelect;

    public bool IsCircleSelectModeActive => ViewportInteractionMode == ViewportInteractionMode.CircleSelect;

    [RelayCommand]
    private void StartBoxSelectMode()
    {
        ViewportInteractionMode = ViewportInteractionMode.BoxSelect;
        StatusText = "Box Select: Rechteck ziehen (Esc: beenden)";
    }

    [RelayCommand]
    private void StartCircleSelectMode()
    {
        ViewportInteractionMode = ViewportInteractionMode.CircleSelect;
        StatusText = "Circle Select: Klick für Pinsel (Umschalt additiv) · Esc beendet";
    }

    [RelayCommand]
    private void CancelViewportModes()
    {
        ViewportInteractionMode = ViewportInteractionMode.Normal;
        TranslatePlaneConstraint = TranslatePlaneConstraint.None;
        StatusText = "Bereit";
    }

    [RelayCommand]
    private void LockTranslateAxisX()
    {
        TranslatePlaneConstraint = TranslatePlaneConstraint.AxisX;
        StatusText = "Achse: X (nur entlang Welt-X auf XZ-Ebene)";
    }

    [RelayCommand]
    private void LockTranslateAxisZ()
    {
        TranslatePlaneConstraint = TranslatePlaneConstraint.AxisZ;
        StatusText = "Achse: Z (nur entlang Welt-Z auf XZ-Ebene)";
    }

    [RelayCommand]
    private void ClearTranslateAxisLock()
    {
        TranslatePlaneConstraint = TranslatePlaneConstraint.None;
        StatusText = "Achsen-Lock aufgehoben";
    }

    [RelayCommand(CanExecute = nameof(CanToggleIsolate))]
    private void ToggleIsolateSelection()
    {
        if (_isolateVisibilityBackup is not null)
        {
            History.Push(PlacedAssets.ToList(), CurrentSelectionIds());

            foreach (var p in PlacedAssets.ToList())
            {
                if (_isolateVisibilityBackup.TryGetValue(p.Id, out var vis))
                {
                    UpdatePlacedAsset(p.Id, a => CloneAsset(a, isVisible: vis));
                }
            }

            _isolateVisibilityBackup = null;
            MarkDirty();
            NotifyUndoRedoCommands();
            StatusText = "Local View beendet";
            ToggleIsolateSelectionCommand.NotifyCanExecuteChanged();
            return;
        }

        if (SelectedAssetIds.Count == 0)
        {
            return;
        }

        History.Push(PlacedAssets.ToList(), CurrentSelectionIds());
        _isolateVisibilityBackup = PlacedAssets.ToDictionary(a => a.Id, a => a.IsVisible, StringComparer.Ordinal);

        var sel = SelectedAssetIds.ToHashSet(StringComparer.Ordinal);
        foreach (var p in PlacedAssets.ToList())
        {
            var vis = sel.Contains(p.Id);
            UpdatePlacedAsset(p.Id, a => CloneAsset(a, isVisible: vis));
        }

        MarkDirty();
        NotifyUndoRedoCommands();
        StatusText = "Local View (nur Auswahl sichtbar) — erneut / zum Beenden";
        ToggleIsolateSelectionCommand.NotifyCanExecuteChanged();
    }

    private bool CanToggleIsolate() =>
        HasAnySelection() || _isolateVisibilityBackup is not null;

    [RelayCommand]
    private void ShowPreferencesDialog()
    {
        var dlg = new PreferencesWindow(Settings)
        {
            Owner = System.Windows.Application.Current.MainWindow,
        };

        if (dlg.ShowDialog() == true && dlg.ResultSettings is not null)
        {
            Settings = dlg.ResultSettings;
            UiScale = Settings.UiScale;
            _settingsStore.Save(Settings);
            ApplyZoomAroundMousePreference?.Invoke(Settings.ZoomAroundMouseCursor);
            StatusText = "Einstellungen gespeichert";
        }
    }

    [RelayCommand]
    private async Task ImportModelAsync()
    {
        var dlg = new OpenFileDialog
        {
            Title = "glTF / glB importieren",
            Filter = "glTF/glB|*.gltf;*.glb|Alle Dateien|*.*",
        };

        if (!string.IsNullOrWhiteSpace(Settings.LastImportDirectory) && Directory.Exists(Settings.LastImportDirectory))
        {
            dlg.InitialDirectory = Settings.LastImportDirectory;
        }

        if (dlg.ShowDialog() != true)
        {
            return;
        }

        var dir = Path.GetDirectoryName(dlg.FileName);
        if (!string.IsNullOrWhiteSpace(dir))
        {
            Settings.LastImportDirectory = dir;
        }

        _settingsStore.Save(Settings);

        var fileLabel = Path.GetFileNameWithoutExtension(dlg.FileName);
        var id = Guid.NewGuid().ToString("N");

        var def = new AssetDefinition
        {
            Id = id,
            DisplayName = string.IsNullOrWhiteSpace(fileLabel) ? "Import" : fileLabel,
            CategoryName = "Import",
            DefaultDimensionsMeters = new JsonVector3 { X = 2, Y = 2, Z = 2 },
            Shape = AssetShapeKind.Box,
            DefaultColorHex = "#90A4AE",
            ImportedModelPath = dlg.FileName,
            MetadataTemplates = new Dictionary<string, string>(StringComparer.Ordinal),
        };

        AssetDefinitions.Add(def);
        PlaceAssetFromLibrary(def);

        await Task.CompletedTask;
        StatusText = $"Importiert: {def.DisplayName}";
    }

    [RelayCommand]
    private async Task ExportLayoutJsonAsync()
    {
        var dlg = new SaveFileDialog
        {
            Title = "Layout als JSON exportieren",
            Filter = "JSON|*.json|Alle Dateien|*.*",
            DefaultExt = "json",
            AddExtension = true,
        };

        if (!string.IsNullOrWhiteSpace(Settings.LastExportDirectory) && Directory.Exists(Settings.LastExportDirectory))
        {
            dlg.InitialDirectory = Settings.LastExportDirectory;
        }

        if (dlg.ShowDialog() != true)
        {
            return;
        }

        var exportDir = Path.GetDirectoryName(dlg.FileName);
        if (!string.IsNullOrWhiteSpace(exportDir))
        {
            Settings.LastExportDirectory = exportDir;
        }

        _settingsStore.Save(Settings);

        SyncCollectionsToLayout();
        await _fileService.ExportJsonAsync(dlg.FileName, Layout).ConfigureAwait(true);
        StatusText = "JSON exportiert";
    }

    /// <summary>
    /// Invoked after loading a layout from disk so isolation state cannot leak across files.
    /// </summary>
    public void ResetViewportModesAfterDocumentSwitch()
    {
        _isolateVisibilityBackup = null;
        ViewportInteractionMode = ViewportInteractionMode.Normal;
        TranslatePlaneConstraint = TranslatePlaneConstraint.None;
    }
}
