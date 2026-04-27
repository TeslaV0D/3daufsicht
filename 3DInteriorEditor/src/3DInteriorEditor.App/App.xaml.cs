using System.Windows;
using _3DInteriorEditor.App.Services;
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

        var settings = new AppSettingsStore().Load();
        var mainVm = new MainViewModel(settings);

        var window = new MainWindow
        {
            DataContext = mainVm,
        };

        MainWindow = window;
        window.Show();
    }
}

