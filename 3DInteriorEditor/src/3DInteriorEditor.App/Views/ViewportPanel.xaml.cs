using System;
using System.Linq;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media.Media3D;
using HelixToolkit.Wpf;
using _3DInteriorEditor.App.Models;
using _3DInteriorEditor.App.Scene;
using _3DInteriorEditor.App.ViewModels;
using Constants = _3DInteriorEditor.App.Constants;

namespace _3DInteriorEditor.App.Views;

/// <summary>
/// WPF 3D viewport host (HelixToolkit). Blender-style camera: MMB orbit, Shift+MMB pan, wheel zoom.
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

    private Point _lmbDownPos;
    private bool _lmbDown;
    private PlacedAsset? _lmbCandidate;
    private ModifierKeys _lmbMods;
    private bool _lmbDragCommitted;

    public ViewportPanel()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        ConfigureBlenderCameraGestures();

        if (DataContext is MainViewModel vm)
        {
            vm.NavZoomExtentsAll = ZoomExtentsAll;
            vm.NavZoomExtentsSelection = ZoomExtentsSelection;
            vm.NavApplyStandardView = ApplyStandardView;
            _presenter = new PlacedAssetScenePresenter(Viewport, vm);
            HookViewportChrome(vm);
        }
    }

    /// <summary>
    /// Blender defaults: orbit with MMB (free middle button from Helix pan #2).
    /// </summary>
    private void ConfigureBlenderCameraGestures()
    {
        Viewport.RotateGesture = new MouseGesture(MouseAction.MiddleClick);
        Viewport.PanGesture = new MouseGesture(MouseAction.MiddleClick, ModifierKeys.Shift);
        Viewport.ClearValue(HelixViewport3D.PanGesture2Property);
    }

    /// <summary>
    /// Fits the entire scene in view (Home).
    /// </summary>
    public void ZoomExtentsAll()
    {
        var visible = ViewModel?.PlacedAssets.Where(a => a.IsVisible) ?? Enumerable.Empty<PlacedAsset>();
        var rect = PlacedAssetBounds.UnionBounds(visible);
        Viewport.ZoomExtents(rect, 1.05);
    }

    /// <summary>
    /// Frames current selection (Numpad . / F — when selection exists).
    /// </summary>
    public void ZoomExtentsSelection()
    {
        var vm = ViewModel;
        if (vm is null || vm.SelectedAssetIds.Count == 0)
        {
            ZoomExtentsAll();
            return;
        }

        var sel = vm.SelectedAssetIds.ToHashSet(StringComparer.Ordinal);
        var selectedAssets = vm.PlacedAssets.Where(p => sel.Contains(p.Id)).ToList();
        if (selectedAssets.Count == 0)
        {
            ZoomExtentsAll();
            return;
        }

        var rect = PlacedAssetBounds.UnionBounds(selectedAssets);
        Viewport.ZoomExtents(rect, 1.15);
    }

    /// <summary>
    /// Snaps camera to standard orthographic-like views (scene Y-up, ground XZ).
    /// </summary>
    public void ApplyStandardView(StandardViewKind kind)
    {
        if (Viewport.Camera is not PerspectiveCamera cam)
        {
            return;
        }

        switch (kind)
        {
            case StandardViewKind.Top:
                cam.Position = new Point3D(0, 28, 0);
                cam.LookDirection = new Vector3D(0, -1, 0);
                cam.UpDirection = new Vector3D(0, 0, 1);
                break;
            case StandardViewKind.Front:
                cam.Position = new Point3D(0, 6, 26);
                cam.LookDirection = new Vector3D(0, 0, -1);
                cam.UpDirection = new Vector3D(0, 1, 0);
                break;
            case StandardViewKind.Right:
                cam.Position = new Point3D(26, 6, 0);
                cam.LookDirection = new Vector3D(-1, 0, 0);
                cam.UpDirection = new Vector3D(0, 1, 0);
                break;
            case StandardViewKind.HomePerspective:
                cam.Position = new Point3D(14, 11, 14);
                cam.LookDirection = new Vector3D(-14, -11, -14);
                cam.UpDirection = new Vector3D(0, 1, 0);
                cam.FieldOfView = 55;
                break;
        }
    }

    private MainViewModel? ViewModel => DataContext as MainViewModel;

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        if (DataContext is MainViewModel vm)
        {
            vm.NavZoomExtentsAll = null;
            vm.NavZoomExtentsSelection = null;
            vm.NavApplyStandardView = null;
            UnhookViewportChrome();
        }

        _presenter?.Dispose();
        _presenter = null;
    }

    private void Viewport_OnPreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (ViewModel is not { Mode: EditorMode.Edit })
        {
            return;
        }

        _lmbDown = true;
        _lmbDragCommitted = false;
        _lmbDownPos = e.GetPosition(Viewport.Viewport);
        _lmbMods = Keyboard.Modifiers;

        _lmbCandidate = null;
        if (_presenter is not null && _presenter.TryPickPlaced(_lmbDownPos, out var picked) && picked is not null)
        {
            _lmbCandidate = picked;
        }
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
            return;
        }

        if (!_lmbDown || _lmbDragCommitted || ViewModel is not MainViewModel vmEdit || vmEdit.Mode != EditorMode.Edit)
        {
            return;
        }

        if (_lmbCandidate is null)
        {
            return;
        }

        var movePt = e.GetPosition(Viewport.Viewport);
        var dist = (movePt - _lmbDownPos).Length;
        if (dist < Constants.ViewportClickDragThresholdPixels)
        {
            return;
        }

        if (!vmEdit.SelectedAssetIds.Contains(_lmbCandidate.Id))
        {
            vmEdit.SetSelectionIds(new[] { _lmbCandidate.Id });
        }

        switch (vmEdit.TransformMode)
        {
            case TransformMode.Translate:
                StartTranslateDragFromCandidate(_lmbCandidate);
                break;
            case TransformMode.Rotate:
                StartRotateDragFromCandidate(_lmbCandidate);
                break;
            case TransformMode.Scale:
                StartScaleDragFromCandidate(_lmbCandidate);
                break;
        }

        _lmbDragCommitted = true;
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
            ClearLmbState();
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
            ClearLmbState();
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
            ClearLmbState();
            return;
        }

        if (!_lmbDown || ViewModel is not MainViewModel vmClick)
        {
            return;
        }

        _lmbDown = false;

        if (!_lmbDragCommitted)
        {
            if (_lmbCandidate is not null)
            {
                if (_lmbMods == ModifierKeys.Shift)
                {
                    vmClick.ApplyViewportPickToggle(_lmbCandidate);
                }
                else if (_lmbMods == ModifierKeys.Alt)
                {
                    vmClick.SelectAssetsSameDefinition(_lmbCandidate);
                }
                else
                {
                    vmClick.ApplyViewportPickReplace(_lmbCandidate);
                }

                e.Handled = true;
            }
            else if (_lmbMods == ModifierKeys.None)
            {
                vmClick.ClearViewportSelection();
                e.Handled = true;
            }
        }

        ClearLmbState();
    }

    private void ClearLmbState()
    {
        _lmbCandidate = null;
        _lmbDragCommitted = false;
    }

    private void Viewport_OnLostMouseCapture(object sender, MouseEventArgs e)
    {
        _lmbDown = false;
        ClearLmbState();

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

    private void StartTranslateDragFromCandidate(PlacedAsset picked)
    {
        if (_presenter is null || DataContext is not MainViewModel vm)
        {
            return;
        }

        if (vm.TransformMode != TransformMode.Translate)
        {
            return;
        }

        var pt = Mouse.GetPosition(Viewport.Viewport);

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

        Viewport.CaptureMouse();
    }

    private void StartRotateDragFromCandidate(PlacedAsset picked)
    {
        if (_presenter is null || DataContext is not MainViewModel vm)
        {
            return;
        }

        if (vm.TransformMode != TransformMode.Rotate)
        {
            return;
        }

        var pt = Mouse.GetPosition(Viewport.Viewport);

        _dragAssetId = picked.Id;
        _rotatePointerStartX = pt.X;
        _rotateStartYawDegrees = picked.RotationDegrees.Y;

        _isRotateDragging = true;
        vm.BeginViewportRotateDrag();

        Viewport.CaptureMouse();
    }

    private void StartScaleDragFromCandidate(PlacedAsset picked)
    {
        if (_presenter is null || DataContext is not MainViewModel vm)
        {
            return;
        }

        if (vm.TransformMode != TransformMode.Scale)
        {
            return;
        }

        var pt = Mouse.GetPosition(Viewport.Viewport);

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

        Viewport.CaptureMouse();
    }

    private void CancelTranslateDrag()
    {
        _isTranslateDragging = false;
        _dragAssetId = null;
        Viewport.ReleaseMouseCapture();
    }

    private void CancelRotateDrag()
    {
        _isRotateDragging = false;
        _dragAssetId = null;
        Viewport.ReleaseMouseCapture();
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
