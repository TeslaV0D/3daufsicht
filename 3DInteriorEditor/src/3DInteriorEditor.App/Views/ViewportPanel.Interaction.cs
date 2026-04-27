using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Media3D;
using HelixToolkit.Wpf;
using _3DInteriorEditor.App.Models;
using _3DInteriorEditor.App.Scene;
using _3DInteriorEditor.App.ViewModels;
using Constants = _3DInteriorEditor.App.Constants;

namespace _3DInteriorEditor.App.Views;

/// <summary>
/// Box/circle selection overlay, context menu, zoom preference wiring.
/// </summary>
public partial class ViewportPanel
{
    private MainViewModel? _chromeVm;

    private bool _boxDragging;
    private Point _boxStartViewport;

    private void HookViewportChrome(MainViewModel vm)
    {
        UnhookViewportChrome();
        _chromeVm = vm;
        vm.PropertyChanged += VmOnPropertyChanged;
        vm.ApplyZoomAroundMousePreference = z => Viewport.ZoomAroundMouseDownPoint = z;
        Viewport.ZoomAroundMouseDownPoint = vm.Settings.ZoomAroundMouseCursor;
        UpdateInteractionOverlay();
    }

    private void UnhookViewportChrome()
    {
        if (_chromeVm is null)
        {
            return;
        }

        _chromeVm.PropertyChanged -= VmOnPropertyChanged;
        _chromeVm.ApplyZoomAroundMousePreference = null;
        _chromeVm = null;
    }

    private void VmOnPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(MainViewModel.ViewportInteractionMode))
        {
            UpdateInteractionOverlay();
        }
    }

    private void UpdateInteractionOverlay()
    {
        var vm = ViewModel;
        if (InteractionOverlay is null || vm is null)
        {
            return;
        }

        var mode = vm.ViewportInteractionMode;
        InteractionOverlay.IsHitTestVisible = mode != ViewportInteractionMode.Normal;
        if (mode == ViewportInteractionMode.Normal)
        {
            BoxSelectRectangle.Visibility = Visibility.Collapsed;
            _boxDragging = false;
        }
    }

    private void Viewport_OnPreviewMouseRightButtonDown(object sender, MouseButtonEventArgs e)
    {
        var vm = ViewModel;
        if (vm is null || vm.Mode != EditorMode.Edit)
        {
            return;
        }

        if (vm.ViewportInteractionMode != ViewportInteractionMode.Normal)
        {
            return;
        }

        var pt = e.GetPosition(Viewport.Viewport);
        if (_presenter is null || !_presenter.TryPickPlaced(pt, out var picked) || picked is null)
        {
            return;
        }

        vm.ApplyViewportPickReplace(picked);

        var menu = new ContextMenu();
        menu.Items.Add(CreateMenuItem("Duplizieren", () => vm.DuplicateSelectedCommand.Execute(null)));
        menu.Items.Add(CreateMenuItem("Löschen", () => vm.DeleteSelectedCommand.Execute(null)));
        menu.Items.Add(new Separator());
        menu.Items.Add(CreateMenuItem("Ausblenden", () => vm.HideSelectedPlacedCommand.Execute(null)));
        menu.Items.Add(CreateMenuItem("Local View (/)", () => vm.ToggleIsolateSelectionCommand.Execute(null)));

        menu.PlacementTarget = Viewport;
        menu.Placement = PlacementMode.MousePoint;
        menu.IsOpen = true;
        e.Handled = true;
    }

    private static MenuItem CreateMenuItem(string header, Action action)
    {
        var mi = new MenuItem { Header = header };
        mi.Click += (_, _) => action();
        return mi;
    }

    private void Overlay_OnMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        var vm = ViewModel;
        if (vm is null || vm.Mode != EditorMode.Edit)
        {
            return;
        }

        var ptViewport = e.GetPosition(Viewport.Viewport);

        if (vm.ViewportInteractionMode == ViewportInteractionMode.CircleSelect)
        {
            ApplyCircleBrush(ptViewport);
            e.Handled = true;
            return;
        }

        if (vm.ViewportInteractionMode != ViewportInteractionMode.BoxSelect)
        {
            return;
        }

        _boxDragging = true;
        _boxStartViewport = e.GetPosition(InteractionOverlay);
        Canvas.SetLeft(BoxSelectRectangle, _boxStartViewport.X);
        Canvas.SetTop(BoxSelectRectangle, _boxStartViewport.Y);
        BoxSelectRectangle.Width = 0;
        BoxSelectRectangle.Height = 0;
        BoxSelectRectangle.Visibility = Visibility.Visible;
        InteractionOverlay?.CaptureMouse();
        e.Handled = true;
    }

    private void Overlay_OnMouseMove(object sender, MouseEventArgs e)
    {
        if (!_boxDragging || ViewModel?.ViewportInteractionMode != ViewportInteractionMode.BoxSelect)
        {
            return;
        }

        var cur = e.GetPosition(InteractionOverlay);
        var x = Math.Min(_boxStartViewport.X, cur.X);
        var y = Math.Min(_boxStartViewport.Y, cur.Y);
        var w = Math.Abs(cur.X - _boxStartViewport.X);
        var h = Math.Abs(cur.Y - _boxStartViewport.Y);
        Canvas.SetLeft(BoxSelectRectangle, x);
        Canvas.SetTop(BoxSelectRectangle, y);
        BoxSelectRectangle.Width = w;
        BoxSelectRectangle.Height = h;
        e.Handled = true;
    }

    private void Overlay_OnMouseLeftButtonUp(object sender, MouseButtonEventArgs e)
    {
        if (!_boxDragging)
        {
            return;
        }

        _boxDragging = false;
        InteractionOverlay?.ReleaseMouseCapture();

        var vm = ViewModel;
        if (vm is null)
        {
            return;
        }

        var cur = e.GetPosition(InteractionOverlay);
        var x = Math.Min(_boxStartViewport.X, cur.X);
        var y = Math.Min(_boxStartViewport.Y, cur.Y);
        var w = Math.Abs(cur.X - _boxStartViewport.X);
        var h = Math.Abs(cur.Y - _boxStartViewport.Y);
        var rect = new Rect(x, y, Math.Max(w, 1), Math.Max(h, 1));

        var ids = CollectAssetsInScreenRect(rect);
        var additive = Keyboard.Modifiers == ModifierKeys.Shift;
        vm.ApplyViewportBrushSelection(ids, additive);

        BoxSelectRectangle.Visibility = Visibility.Collapsed;
        vm.CancelViewportModesCommand.Execute(null);
        e.Handled = true;
    }

    private List<string> CollectAssetsInScreenRect(Rect rectViewport)
    {
        var ids = new List<string>();
        var vm = ViewModel;
        if (vm is null || _presenter is null)
        {
            return ids;
        }

        foreach (var p in vm.PlacedAssets.Where(a => a.IsVisible))
        {
            var center = new Point3D(p.PositionMeters.X, p.PositionMeters.Y, p.PositionMeters.Z);
            var sp = Viewport3DHelper.Point3DtoPoint2D(Viewport.Viewport, center);
            if (double.IsNaN(sp.X) || double.IsNaN(sp.Y))
            {
                continue;
            }

            if (rectViewport.Contains(sp))
            {
                ids.Add(p.Id);
            }
        }

        return ids;
    }

    private void ApplyCircleBrush(Point viewportPt)
    {
        var vm = ViewModel;
        if (vm is null)
        {
            return;
        }

        var ids = new List<string>();
        var r = Constants.CircleSelectRadiusPixels;
        var r2 = r * r;

        foreach (var p in vm.PlacedAssets.Where(a => a.IsVisible))
        {
            var center = new Point3D(p.PositionMeters.X, p.PositionMeters.Y, p.PositionMeters.Z);
            var sp = Viewport3DHelper.Point3DtoPoint2D(Viewport.Viewport, center);
            if (double.IsNaN(sp.X) || double.IsNaN(sp.Y))
            {
                continue;
            }

            var dx = sp.X - viewportPt.X;
            var dy = sp.Y - viewportPt.Y;
            if (dx * dx + dy * dy <= r2)
            {
                ids.Add(p.Id);
            }
        }

        var additive = Keyboard.Modifiers == ModifierKeys.Shift;
        vm.ApplyViewportBrushSelection(ids, additive);
    }
}
