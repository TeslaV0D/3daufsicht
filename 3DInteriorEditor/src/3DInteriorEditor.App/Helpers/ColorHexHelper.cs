using System.Globalization;
using System.Windows.Media;

namespace _3DInteriorEditor.App.Helpers;

/// <summary>
/// Parses layout-file hex colors (<c>#RRGGBB</c> / <c>#AARRGGBB</c>) into WPF brushes/materials.
/// </summary>
public static class ColorHexHelper
{
    /// <summary>
    /// Fallback when parsing fails or input is empty.
    /// </summary>
    public static Color FallbackColor { get; } = Color.FromRgb(0x5C, 0x6B, 0xC0);

    public static bool TryParseColor(string? hex, out Color color)
    {
        color = FallbackColor;
        if (string.IsNullOrWhiteSpace(hex))
        {
            return false;
        }

        var s = hex.Trim();
        if (s.StartsWith("#", StringComparison.Ordinal))
        {
            s = s[1..];
        }

        try
        {
            if (s.Length == 6)
            {
                var r = byte.Parse(s[..2], NumberStyles.HexNumber, CultureInfo.InvariantCulture);
                var g = byte.Parse(s[2..4], NumberStyles.HexNumber, CultureInfo.InvariantCulture);
                var b = byte.Parse(s[4..6], NumberStyles.HexNumber, CultureInfo.InvariantCulture);
                color = Color.FromRgb(r, g, b);
                return true;
            }

            if (s.Length == 8)
            {
                var a = byte.Parse(s[..2], NumberStyles.HexNumber, CultureInfo.InvariantCulture);
                var r = byte.Parse(s[2..4], NumberStyles.HexNumber, CultureInfo.InvariantCulture);
                var g = byte.Parse(s[4..6], NumberStyles.HexNumber, CultureInfo.InvariantCulture);
                var b = byte.Parse(s[6..8], NumberStyles.HexNumber, CultureInfo.InvariantCulture);
                color = Color.FromArgb(a, r, g, b);
                return true;
            }
        }
        catch
        {
            color = FallbackColor;
            return false;
        }

        return false;
    }

    public static SolidColorBrush ToDiffuseBrush(string? hex)
    {
        TryParseColor(hex, out var c);
        return ToDiffuseBrush(c);
    }

    public static SolidColorBrush ToDiffuseBrush(Color color)
    {
        var brush = new SolidColorBrush(color);
        brush.Freeze();
        return brush;
    }

    /// <summary>Returns <c>#RRGGBB</c> for <paramref name="color"/> (alpha ignored).</summary>
    public static string ToRgbHex(Color color) =>
        $"#{color.R:X2}{color.G:X2}{color.B:X2}";
}
