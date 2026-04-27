using System.Windows;
using System.Windows.Input;
using _3DInteriorEditor.App.Scene;
using _3DInteriorEditor.App.ViewModels;

namespace _3DInteriorEditor.App.Views;

/// <summary>
/// WPF 3D viewport host (HelixToolkit). Camera interaction is handled by <c>HelixViewport3D</c>.
/// </summary>
public partial class ViewportPanel
{
    private PlacedAssetScenePresenter? _presenter;

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
}
