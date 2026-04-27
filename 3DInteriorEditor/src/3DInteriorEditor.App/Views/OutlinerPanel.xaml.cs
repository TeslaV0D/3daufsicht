using System.Collections.Specialized;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using _3DInteriorEditor.App.Models;
using _3DInteriorEditor.App.ViewModels;

namespace _3DInteriorEditor.App.Views;

public partial class OutlinerPanel
{
    private MainViewModel? _vm;
    private bool _suppressSelectionSync;

    public OutlinerPanel()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
        DataContextChanged += (_, _) => HookViewModel();
    }

    private void OnLoaded(object sender, RoutedEventArgs e) => HookViewModel();

    private void OnUnloaded(object sender, RoutedEventArgs e) => UnhookViewModel();

    private void HookViewModel()
    {
        UnhookViewModel();
        _vm = DataContext as MainViewModel;
        if (_vm is null)
        {
            return;
        }

        _vm.SelectedAssetIds.CollectionChanged += OnVmSelectionChanged;
        _vm.PlacedAssets.CollectionChanged += OnPlacedAssetsChanged;
        SyncFromViewModel();
    }

    private void UnhookViewModel()
    {
        if (_vm is not null)
        {
            _vm.SelectedAssetIds.CollectionChanged -= OnVmSelectionChanged;
            _vm.PlacedAssets.CollectionChanged -= OnPlacedAssetsChanged;
        }

        _vm = null;
    }

    private void OnVmSelectionChanged(object? sender, NotifyCollectionChangedEventArgs e) => SyncFromViewModel();

    private void OnPlacedAssetsChanged(object? sender, NotifyCollectionChangedEventArgs e) => SyncFromViewModel();

    private void SyncFromViewModel()
    {
        if (_suppressSelectionSync || _vm is null)
        {
            return;
        }

        _suppressSelectionSync = true;
        SceneList.SelectedItems.Clear();
        foreach (var asset in _vm.PlacedAssets)
        {
            if (_vm.SelectedAssetIds.Contains(asset.Id))
            {
                SceneList.SelectedItems.Add(asset);
            }
        }

        _suppressSelectionSync = false;
    }

    private void SceneList_OnSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_suppressSelectionSync || DataContext is not MainViewModel vm)
        {
            return;
        }

        var ids = SceneList.SelectedItems.Cast<PlacedAsset>().Select(p => p.Id);
        vm.SetSelectionIds(ids);
    }
}
