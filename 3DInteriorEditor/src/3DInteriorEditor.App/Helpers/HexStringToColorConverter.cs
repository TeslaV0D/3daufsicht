using System.Globalization;
using System.Windows.Data;
using System.Windows.Media;

namespace _3DInteriorEditor.App.Helpers;

/// <summary>
/// Converts a layout hex color string to <see cref="Color"/> for XAML swatches.
/// </summary>
public sealed class HexStringToColorConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is string s && ColorHexHelper.TryParseColor(s, out var c))
        {
            return c;
        }

        return Color.FromRgb(0x80, 0x80, 0x80);
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}
