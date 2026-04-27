using System.Windows.Media;
using SharpGLTF.Schema2;

namespace _3DInteriorEditor.App.Scene;

/// <summary>
/// Maps glTF <see cref="TextureSampler"/> wrap modes to WPF <see cref="TileMode"/> for <see cref="ImageBrush"/>.
/// One <see cref="TileMode"/> controls both axes.
/// </summary>
/// <remarks>
/// Combined clamp+repeat on different axes falls back to <see cref="TileMode.Tile"/> (approximation).
/// </remarks>
internal static class GltfSamplerImageBrushMapping
{
    internal static TileMode ToTileMode(TextureWrapMode wrapS, TextureWrapMode wrapT)
    {
        wrapS = NormalizeWrap(wrapS);
        wrapT = NormalizeWrap(wrapT);

        var clampS = wrapS == TextureWrapMode.CLAMP_TO_EDGE;
        var clampT = wrapT == TextureWrapMode.CLAMP_TO_EDGE;
        var mirS = wrapS == TextureWrapMode.MIRRORED_REPEAT;
        var mirT = wrapT == TextureWrapMode.MIRRORED_REPEAT;

        if (clampS && clampT)
        {
            return TileMode.None;
        }

        if (mirS && mirT)
        {
            return TileMode.FlipXY;
        }

        if (mirS && !mirT)
        {
            return TileMode.FlipX;
        }

        if (!mirS && mirT)
        {
            return TileMode.FlipY;
        }

        // Repeat / repeat or repeat + clamp (approximate repeat tiling).
        return TileMode.Tile;
    }

    private static TextureWrapMode NormalizeWrap(TextureWrapMode mode)
    {
        // GlTF default wrap is REPEAT when unspecified; SharpGLTF may surface a sentinel (value 0).
        return (int)mode == 0 ? TextureWrapMode.REPEAT : mode;
    }
}
