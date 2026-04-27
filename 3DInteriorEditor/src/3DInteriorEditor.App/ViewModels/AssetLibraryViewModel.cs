using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using _3DInteriorEditor.App.Data;
using _3DInteriorEditor.App.Models;

namespace _3DInteriorEditor.App.ViewModels;

/// <summary>
/// View model for the left asset library (search + template list).
/// </summary>
public sealed partial class AssetLibraryViewModel : ObservableObject
{
    [ObservableProperty]
    private string _searchText = string.Empty;

    /// <summary>
    /// All known asset templates (built-in for now; custom templates are added in later phases).
    /// </summary>
    public ObservableCollection<AssetDefinition> AllDefinitions { get; } = new(DefaultAssets.All);

    /// <summary>
    /// Filtered list for the current <see cref="SearchText"/>.
    /// </summary>
    public ObservableCollection<AssetDefinition> FilteredDefinitions { get; } = new();

    public AssetLibraryViewModel()
    {
        ResetFilter();
    }

    partial void OnSearchTextChanged(string value) => ApplyFilter();

    /// <summary>
    /// Re-applies the current search filter.
    /// </summary>
    public void ApplyFilter()
    {
        FilteredDefinitions.Clear();

        var q = SearchText.Trim();
        foreach (var def in AllDefinitions)
        {
            if (string.IsNullOrWhiteSpace(q))
            {
                FilteredDefinitions.Add(def);
                continue;
            }

            if (def.DisplayName.Contains(q, StringComparison.OrdinalIgnoreCase)
                || def.CategoryName.Contains(q, StringComparison.OrdinalIgnoreCase)
                || def.Id.Contains(q, StringComparison.OrdinalIgnoreCase))
            {
                FilteredDefinitions.Add(def);
            }
        }
    }

    private void ResetFilter()
    {
        SearchText = string.Empty;
    }
}
