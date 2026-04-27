using System;
using System.Windows;
using System.Windows.Media.Media3D;
using System.Windows.Input;
using HelixToolkit.Wpf;
using _3DInteriorEditor.App.Models;
using _3DInteriorEditor.App.Scene;
using _3DInteriorEditor.App.ViewModels;
using Constants = _3DInteriorEditor.App.Constants;

namespace _3DInteriorEditor.App.Views;

/// <summary>
/// WPF 3D viewport host (HelixToolkit). Camera interaction is handled by <c>HelixViewport3D</c>.
/// </summary>
public partial class ViewportPanel
{
    private PlacedAssetScenePresenter? _presenter;
    private bool _isTranslateDragging;
    private bool _isRotateDragging;
    private bool _isScaleDragging;
    private string? _dragAssetId;
    private double _dragPlaneY;
    private Point3D _dragStartWorld;
    private double _dragStartX;
    private double _dragStartZ;
    private double _rotatePointerStartX;
    private double _rotateStartYawDegrees;
    private double _scalePointerStartY;
    private JsonVector3 _scaleStartDimensionsMeters = new();

    public ViewportPanel()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (DataContext is MainViewModel vm)
        {
            _presenter = new PlacedAssetScenePresenter(Viewport, vm);
        }
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        _presenter?.Dispose();
        _presenter = null;
    }

    private void Viewport_OnPreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        // Phase 15: Shift+drag translates selection on a plane (XZ at asset Y).
        if (Keyboard.Modifiers == ModifierKeys.Shift)
        {
            TryBeginTranslateDrag(e);
            return;
        }

        // Phase 16: Alt+drag rotates selection around world Y (yaw).
        if (Keyboard.Modifiers == ModifierKeys.Alt)
        {
            TryBeginRotateDrag(e);
            return;
        }

        // Phase 17: Strg+Umschalt+drag uniformly scales instance dimensions.
        if (Keyboard.Modifiers == (ModifierKeys.Control | ModifierKeys.Shift))
        {
            TryBeginScaleDrag(e);
            return;
        }

        if (Keyboard.Modifiers != ModifierKeys.Control)
        {
            return;
        }

        if (_presenter is null || DataContext is not MainViewModel vm)
        {
            return;
        }

        var pt = e.GetPosition(Viewport.Viewport);

        if (!_presenter.TryPickPlaced(pt, out var picked) || picked is null)
        {
            vm.ClearViewportSelection();
            return;
        }

        e.Handled = true;
        vm.ApplyViewportPick(picked);
    }

    private void Viewport_OnPreviewMouseMove(object sender, MouseEventArgs e)
    {
        if (_isTranslateDragging && _dragAssetId is not null)
        {
            if (DataContext is not MainViewModel vm)
            {
                CancelTranslateDrag();
                return;
            }

            var pt = e.GetPosition(Viewport.Viewport);
            if (!TryUnprojectToPlaneY(pt, _dragPlaneY, out var world))
            {
                return;
            }

            var dx = world.X - _dragStartWorld.X;
            var dz = world.Z - _dragStartWorld.Z;

            vm.ApplyViewportTranslateDrag(_dragAssetId, _dragStartX + dx, _dragStartZ + dz);
            e.Handled = true;
            return;
        }

        if (_isRotateDragging && _dragAssetId is not null)
        {
            if (DataContext is not MainViewModel vm)
            {
                CancelRotateDrag();
                return;
            }

            var pt = e.GetPosition(Viewport.Viewport);
            var deltaX = pt.X - _rotatePointerStartX;
            var yaw = _rotateStartYawDegrees + deltaX * Constants.ViewportRotateDragDegreesPerPixel;
            vm.ApplyViewportRotateDrag(_dragAssetId, yaw);
            e.Handled = true;
            return;
        }

        if (_isScaleDragging && _dragAssetId is not null)
        {
            if (DataContext is not MainViewModel vm)
            {
                CancelScaleDrag();
                return;
            }

            var pt = e.GetPosition(Viewport.Viewport);
            var deltaY = pt.Y - _scalePointerStartY;
            var mult = 1.0 - (deltaY * Constants.ViewportScaleDragMultiplierPerPixel);
            mult = Math.Clamp(mult, Constants.ViewportScaleDragMinMultiplier, Constants.ViewportScaleDragMaxMultiplier);

            var dims = new JsonVector3
            {
                X = Math.Max(Constants.MinAssetDimension, _scaleStartDimensionsMeters.X * mult),
                Y = Math.Max(Constants.MinAssetDimension, _scaleStartDimensionsMeters.Y * mult),
                Z = Math.Max(Constants.MinAssetDimension, _scaleStartDimensionsMeters.Z * mult),
            };

            vm.ApplyViewportScaleDrag(_dragAssetId, dims);
            e.Handled = true;
        }
    }

    private void Viewport_OnPreviewMouseLeftButtonUp(object sender, MouseButtonEventArgs e)
    {
        if (_isTranslateDragging)
        {
            if (DataContext is MainViewModel vm)
            {
                vm.EndViewportTranslateDrag();
            }

            CancelTranslateDrag();
            e.Handled = true;
            return;
        }

        if (_isRotateDragging)
        {
            if (DataContext is MainViewModel vm)
            {
                vm.EndViewportRotateDrag();
            }

            CancelRotateDrag();
            e.Handled = true;
            return;
        }

        if (_isScaleDragging)
        {
            if (DataContext is MainViewModel vm)
            {
                vm.EndViewportScaleDrag();
            }

            CancelScaleDrag();
            e.Handled = true;
        }
    }

    private void Viewport_OnLostMouseCapture(object sender, MouseEventArgs e)
    {
        if (_isTranslateDragging)
        {
            if (DataContext is MainViewModel vm)
            {
                vm.EndViewportTranslateDrag();
            }

            CancelTranslateDrag();
            return;
        }

        if (_isRotateDragging)
        {
            if (DataContext is MainViewModel vm)
            {
                vm.EndViewportRotateDrag();
            }

            CancelRotateDrag();
            return;
        }

        if (_isScaleDragging)
        {
            if (DataContext is MainViewModel vm)
            {
                vm.EndViewportScaleDrag();
            }

            CancelScaleDrag();
        }
    }

    private void TryBeginTranslateDrag(MouseButtonEventArgs e)
    {
        if (_presenter is null || DataContext is not MainViewModel vm)
        {
            return;
        }

        if (vm.Mode != EditorMode.Edit || vm.TransformMode != TransformMode.Translate)
        {
            return;
        }

        var pt = e.GetPosition(Viewport.Viewport);
        if (!_presenter.TryPickPlaced(pt, out var picked) || picked is null)
        {
            return;
        }

        // Force a single selection for dragging.
        vm.SetSelectionIds(new[] { picked.Id });

        _dragAssetId = picked.Id;
        _dragPlaneY = picked.PositionMeters.Y;
        _dragStartX = picked.PositionMeters.X;
        _dragStartZ = picked.PositionMeters.Z;

        if (!TryUnprojectToPlaneY(pt, _dragPlaneY, out _dragStartWorld))
        {
            _dragAssetId = null;
            return;
        }

        _isTranslateDragging = true;
        vm.BeginViewportTranslateDrag();

        e.Handled = true;
        Viewport.CaptureMouse();
    }

    private void CancelTranslateDrag()
    {
        _isTranslateDragging = false;
        _dragAssetId = null;
        Viewport.ReleaseMouseCapture();
    }

    private void TryBeginRotateDrag(MouseButtonEventArgs e)
    {
        if (_presenter is null || DataContext is not MainViewModel vm)
        {
            return;
        }

        if (vm.Mode != EditorMode.Edit || vm.TransformMode != TransformMode.Rotate)
        {
            return;
        }

        var pt = e.GetPosition(Viewport.Viewport);
        if (!_presenter.TryPickPlaced(pt, out var picked) || picked is null)
        {
            return;
        }

        vm.SetSelectionIds(new[] { picked.Id });

        _dragAssetId = picked.Id;
        _rotatePointerStartX = pt.X;
        _rotateStartYawDegrees = picked.RotationDegrees.Y;

        _isRotateDragging = true;
        vm.BeginViewportRotateDrag();

        e.Handled = true;
        Viewport.CaptureMouse();
    }

    private void CancelRotateDrag()
    {
        _isRotateDragging = false;
        _dragAssetId = null;
        Viewport.ReleaseMouseCapture();
    }

    private void TryBeginScaleDrag(MouseButtonEventArgs e)
    {
        if (_presenter is null || DataContext is not MainViewModel vm)
        {
            return;
        }

        if (vm.Mode != EditorMode.Edit || vm.TransformMode != TransformMode.Scale)
        {
            return;
        }

        var pt = e.GetPosition(Viewport.Viewport);
        if (!_presenter.TryPickPlaced(pt, out var picked) || picked is null)
        {
            return;
        }

        vm.SetSelectionIds(new[] { picked.Id });

        _dragAssetId = picked.Id;
        _scalePointerStartY = pt.Y;
        _scaleStartDimensionsMeters = new JsonVector3
        {
            X = picked.DimensionsMeters.X,
            Y = picked.DimensionsMeters.Y,
            Z = picked.DimensionsMeters.Z,
        };

        _isScaleDragging = true;
        vm.BeginViewportScaleDrag();

        e.Handled = true;
        Viewport.CaptureMouse();
    }

    private void CancelScaleDrag()
    {
        _isScaleDragging = false;
        _dragAssetId = null;
        Viewport.ReleaseMouseCapture();
    }

    private bool TryUnprojectToPlaneY(Point viewportPointPixels, double planeY, out Point3D world)
    {
        world = default;

        var ray = Viewport3DHelper.Point2DtoRay3D(Viewport.Viewport, viewportPointPixels);
        if (ray is null)
        {
            return false;
        }

        var normal = new Vector3D(0, 1, 0);
        return ray.PlaneIntersection(new Point3D(0, planeY, 0), normal, out world);
    }
}
