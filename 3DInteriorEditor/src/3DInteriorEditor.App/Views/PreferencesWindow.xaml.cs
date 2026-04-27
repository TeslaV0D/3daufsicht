using System.Windows;
using System.Windows.Controls.Primitives;
using _3DInteriorEditor.App.Models;

namespace _3DInteriorEditor.App.Views;

public partial class PreferencesWindow
{
    private readonly AppSettings _initial;

    public AppSettings? ResultSettings { get; private set; }

    public PreferencesWindow(AppSettings current)
    {
        InitializeComponent();
        _initial = Clone(current);
        ZoomAroundMouseCheck.IsChecked = _initial.ZoomAroundMouseCursor;
        UiScaleSlider.Value = _initial.UiScale;
        RefreshLabel();
        UiScaleSlider.ValueChanged += UiScaleSliderOnValueChanged;
        Closed += (_, _) => UiScaleSlider.ValueChanged -= UiScaleSliderOnValueChanged;
    }

    private static AppSettings Clone(AppSettings s)
    {
        return new AppSettings
        {
            Version = s.Version,
            UiScale = s.UiScale,
            ZoomAroundMouseCursor = s.ZoomAroundMouseCursor,
            LastImportDirectory = s.LastImportDirectory,
            LastExportDirectory = s.LastExportDirectory,
        };
    }

    private void UiScaleSliderOnValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e) => RefreshLabel();

    private void RefreshLabel() =>
        UiScaleLabel.Text = $"Aktuell: {UiScaleSlider.Value * 100:0}% ({UiScaleSlider.Value:0.00})";

    private void Ok_OnClick(object sender, RoutedEventArgs e)
    {
        ResultSettings = Clone(_initial);
        ResultSettings.UiScale = UiScaleSlider.Value;
        ResultSettings.ZoomAroundMouseCursor = ZoomAroundMouseCheck.IsChecked == true;
        DialogResult = true;
    }

}
