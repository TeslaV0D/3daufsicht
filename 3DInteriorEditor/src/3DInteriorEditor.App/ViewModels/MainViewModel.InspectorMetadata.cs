using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using CommunityToolkit.Mvvm.Input;
using _3DInteriorEditor.App.Models;

namespace _3DInteriorEditor.App.ViewModels;

/// <summary>
/// Inspector metadata editing (Phase 19).
/// </summary>
public sealed partial class MainViewModel
{
    /// <summary>
    /// Rows built from the selected asset’s metadata plus its definition’s template keys.
    /// </summary>
    public ObservableCollection<InspectorMetadataRowViewModel> InspectorMetadataRows { get; } = new();

    /// <summary>
    /// True when one asset is selected but there are no metadata keys to edit.
    /// </summary>
    public bool InspectorMetadataEmptyVisible => SelectedAssetIds.Count == 1 && InspectorMetadataRows.Count == 0;

    [RelayCommand(CanExecute = nameof(CanApplyInspectorMetadata))]
    private void ApplyInspectorMetadata()
    {
        if (SelectedAssetIds.Count != 1)
        {
            return;
        }

        History.Push(PlacedAssets.ToList(), CurrentSelectionIds());

        var id = SelectedAssetIds[0];
        var dict = InspectorMetadataRows.ToDictionary(r => r.Key, r => r.ValueText ?? string.Empty, StringComparer.Ordinal);

        UpdatePlacedAsset(id, a => CloneAsset(a, metadata: dict));

        MarkDirty();
        NotifyUndoRedoCommands();
        RefreshInspectorTransformFieldsFromScene();
        StatusText = "Metadaten aktualisiert";
    }

    [RelayCommand(CanExecute = nameof(CanApplyInspectorMetadata))]
    private void ResetInspectorMetadata()
    {
        RebuildInspectorMetadataRows();
        StatusText = "Metadaten zurückgesetzt";
    }

    private bool CanApplyInspectorMetadata() => SelectedAssetIds.Count == 1;

    internal void RebuildInspectorMetadataRows()
    {
        InspectorMetadataRows.Clear();

        if (SelectedAssetIds.Count != 1)
        {
            NotifyInspectorMetadataCommands();
            OnPropertyChanged(nameof(InspectorMetadataEmptyVisible));
            return;
        }

        var id = SelectedAssetIds[0];
        var asset = PlacedAssets.FirstOrDefault(p => string.Equals(p.Id, id, StringComparison.Ordinal));
        if (asset is null)
        {
            NotifyInspectorMetadataCommands();
            OnPropertyChanged(nameof(InspectorMetadataEmptyVisible));
            return;
        }

        var def = AssetDefinitions.FirstOrDefault(d =>
            string.Equals(d.Id, asset.AssetDefinitionId, StringComparison.Ordinal));

        var keys = new SortedSet<string>(StringComparer.Ordinal);
        if (def?.MetadataTemplates is not null)
        {
            foreach (var k in def.MetadataTemplates.Keys)
            {
                keys.Add(k);
            }
        }

        foreach (var k in asset.Metadata.Keys)
        {
            keys.Add(k);
        }

        foreach (var key in keys)
        {
            string value;
            if (asset.Metadata.TryGetValue(key, out var stored))
            {
                value = stored;
            }
            else if (def?.MetadataTemplates is not null && def.MetadataTemplates.TryGetValue(key, out var template))
            {
                value = template;
            }
            else
            {
                value = string.Empty;
            }

            InspectorMetadataRows.Add(new InspectorMetadataRowViewModel(key, value));
        }

        NotifyInspectorMetadataCommands();
        OnPropertyChanged(nameof(InspectorMetadataEmptyVisible));
    }

    private void NotifyInspectorMetadataCommands()
    {
        ApplyInspectorMetadataCommand.NotifyCanExecuteChanged();
        ResetInspectorMetadataCommand.NotifyCanExecuteChanged();
    }
}
