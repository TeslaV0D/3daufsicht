using System.Windows.Media;
using SharpGLTF.Schema2;

namespace _3DInteriorEditor.App.Scene;

/// <summary>
/// Approximates glTF sampler minification / magnification filters using WPF
/// <see cref="RenderOptions.BitmapScalingModeProperty"/> (<see cref="BitmapScalingMode"/>).
/// True mip-mapping is not available on <see cref="System.Windows.Media.ImageBrush"/>; min filter is interpreted coarsely.
/// </summary>
internal static class GltfSamplerBitmapScalingMapping
{
    internal static BitmapScalingMode ToBitmapScalingMode(
        TextureInterpolationFilter magFilter,
        TextureMipMapFilter minFilter)
    {
        magFilter = NormalizeMag(magFilter);
        minFilter = NormalizeMin(minFilter);

        if (MagIsNearest(magFilter) || MinPrefersNearest(minFilter))
        {
            return BitmapScalingMode.NearestNeighbor;
        }

        return BitmapScalingMode.HighQuality;
    }

    private static TextureInterpolationFilter NormalizeMag(TextureInterpolationFilter f)
    {
        return (int)f == 0 ? TextureInterpolationFilter.LINEAR : f;
    }

    private static TextureMipMapFilter NormalizeMin(TextureMipMapFilter f)
    {
        return (int)f == 0 ? TextureMipMapFilter.DEFAULT : f;
    }

    private static bool MagIsNearest(TextureInterpolationFilter magFilter)
    {
        return magFilter == TextureInterpolationFilter.NEAREST;
    }

    private static bool MinPrefersNearest(TextureMipMapFilter minFilter)
    {
        return minFilter switch
        {
            TextureMipMapFilter.NEAREST => true,
            TextureMipMapFilter.NEAREST_MIPMAP_NEAREST => true,
            _ => false,
        };
    }
}
