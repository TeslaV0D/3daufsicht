using System.Collections.Specialized;
using System.Linq;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Media3D;
using HelixToolkit.Wpf;
using _3DInteriorEditor.App.Models;
using _3DInteriorEditor.App.ViewModels;

namespace _3DInteriorEditor.App.Scene;

/// <summary>
/// Keeps Helix viewport children in sync with <see cref="MainViewModel.PlacedAssets"/> and resolves pick hits.
/// </summary>
public sealed class PlacedAssetScenePresenter : IDisposable
{
    private readonly HelixViewport3D _viewport;
    private readonly MainViewModel _viewModel;
    private readonly int _staticChildCount;
    private readonly Dictionary<DependencyObject, string> _placedIdByVisual = new();
    private bool _disposed;

    public PlacedAssetScenePresenter(HelixViewport3D viewport, MainViewModel viewModel)
    {
        _viewport = viewport;
        _viewModel = viewModel;
        _staticChildCount = viewport.Children.Count;

        viewModel.PlacedAssets.CollectionChanged += OnPlacedAssetsChanged;
        viewModel.SelectedAssetIds.CollectionChanged += OnSelectionChanged;
        RebuildPlacedVisuals();
    }

    private void OnPlacedAssetsChanged(object? sender, NotifyCollectionChangedEventArgs e) =>
        RebuildPlacedVisuals();

    private void OnSelectionChanged(object? sender, NotifyCollectionChangedEventArgs e) =>
        RebuildPlacedVisuals();

    /// <summary>
    /// Hit-test at viewport pixel coordinates and return the closest placed asset, if any.
    /// </summary>
    public bool TryPickPlaced(Point viewportPositionPixels, out PlacedAsset? placed)
    {
        placed = null;
        foreach (var hit in Viewport3DHelper.FindHits(_viewport.Viewport, viewportPositionPixels))
        {
            if (!TryResolvePlacedId(hit.Visual, out var id))
            {
                continue;
            }

            placed = _viewModel.PlacedAssets.FirstOrDefault(p => string.Equals(p.Id, id, StringComparison.Ordinal));
            if (placed is not null)
            {
                return true;
            }
        }

        return false;
    }

    private void RebuildPlacedVisuals()
    {
        while (_viewport.Children.Count > _staticChildCount)
        {
            _viewport.Children.RemoveAt(_viewport.Children.Count - 1);
        }

        _placedIdByVisual.Clear();
        var selected = _viewModel.SelectedAssetIds.Count == 0
            ? null
            : _viewModel.SelectedAssetIds.ToHashSet(StringComparer.Ordinal);

        foreach (var asset in _viewModel.PlacedAssets)
        {
            if (!asset.IsVisible)
            {
                continue;
            }

            var def = _viewModel.AssetDefinitions.FirstOrDefault(d =>
                string.Equals(d.Id, asset.AssetDefinitionId, StringComparison.Ordinal));

            var isSelected = selected?.Contains(asset.Id) == true;
            var visual = PlacedAssetVisualFactory.CreateVisual(asset, def, isSelected);
            visual.Transform = BuildWorldTransform(asset);
            _placedIdByVisual[visual] = asset.Id;

            _viewport.Children.Add(visual);
        }
    }

    private bool TryResolvePlacedId(DependencyObject? hit, out string id)
    {
        id = string.Empty;
        var obj = hit;
        while (obj != null)
        {
            if (_placedIdByVisual.TryGetValue(obj, out id!))
            {
                return true;
            }

            obj = VisualTreeHelper.GetParent(obj);
        }

        return false;
    }

    private static Transform3D BuildWorldTransform(PlacedAsset asset)
    {
        var rot = asset.RotationDegrees;
        var pos = asset.PositionMeters;

        var group = new Transform3DGroup();
        group.Children.Add(new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(1, 0, 0), rot.X)));
        group.Children.Add(new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(0, 1, 0), rot.Y)));
        group.Children.Add(new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(0, 0, 1), rot.Z)));
        group.Children.Add(new TranslateTransform3D(pos.X, pos.Y, pos.Z));
        return group;
    }

    /// <inheritdoc />
    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        _viewModel.PlacedAssets.CollectionChanged -= OnPlacedAssetsChanged;
        _viewModel.SelectedAssetIds.CollectionChanged -= OnSelectionChanged;
    }
}
