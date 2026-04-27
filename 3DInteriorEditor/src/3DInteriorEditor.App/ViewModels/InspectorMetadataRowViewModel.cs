using CommunityToolkit.Mvvm.ComponentModel;

namespace _3DInteriorEditor.App.ViewModels;

/// <summary>
/// Single editable metadata row (key fixed, value text bound to a TextBox).
/// </summary>
public sealed partial class InspectorMetadataRowViewModel : ObservableObject
{
    /// <summary>
    /// Metadata key (from definition template and/or instance).
    /// </summary>
    public string Key { get; }

    /// <summary>
    /// Editable value text.
    /// </summary>
    [ObservableProperty]
    private string _valueText;

    public InspectorMetadataRowViewModel(string key, string valueText)
    {
        Key = key;
        ValueText = valueText;
    }
}
