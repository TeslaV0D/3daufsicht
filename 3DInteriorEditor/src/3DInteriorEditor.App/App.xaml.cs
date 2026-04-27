using System.Windows;
using _3DInteriorEditor.App.ViewModels;
using _3DInteriorEditor.App.Views;

namespace _3DInteriorEditor.App;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : Application
{
    /// <inheritdoc />
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        var mainVm = new MainViewModel();

        var window = new MainWindow
        {
            DataContext = mainVm,
        };

        MainWindow = window;
        window.Show();
    }
}

