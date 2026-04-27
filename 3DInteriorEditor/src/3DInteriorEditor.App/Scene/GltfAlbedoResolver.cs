using System.IO;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using SharpGLTF.Memory;
using SharpGLTF.Schema2;
using GltfMaterial = SharpGLTF.Schema2.Material;
using GltfTexture = SharpGLTF.Schema2.Texture;

namespace _3DInteriorEditor.App.Scene;

/// <summary>
/// Resolves metallic-roughness base color and spec-gloss diffuse (factor + optional image).
/// </summary>
internal static class GltfAlbedoResolver
{
    internal readonly struct AlbedoResolve
    {
        public AlbedoResolve(Color? factorRgb, ImageSource? texture, int uvSetIndex)
        {
            FactorRgb = factorRgb;
            Texture = texture;
            UvSetIndex = uvSetIndex;
        }

        public Color? FactorRgb { get; }
        public ImageSource? Texture { get; }
        public int UvSetIndex { get; }
    }

    internal static AlbedoResolve TryResolve(GltfMaterial? material)
    {
        if (material is null)
        {
            return new AlbedoResolve(null, null, 0);
        }

        foreach (var key in new[] { "BaseColor", "Diffuse" })
        {
            var channel = material.FindChannel(key);
            if (!channel.HasValue)
            {
                continue;
            }

            var ch = channel.Value;

            Color? factorRgb = TryChannelFactorRgb(ch);

            ImageSource? texSource = null;
            var gt = ch.Texture;
            if (gt is not null)
            {
                texSource = TryDecodeTexture(gt);
            }

            var uvSet = ch.TextureCoordinate;
            if (texSource is not null || factorRgb.HasValue)
            {
                return new AlbedoResolve(factorRgb, texSource, uvSet);
            }
        }

        return new AlbedoResolve(null, null, 0);
    }

    private static Color? TryChannelFactorRgb(MaterialChannel channel)
    {
        try
        {
            var v = channel.Color;
            static byte ToByte(float f) => (byte)Math.Clamp((int)MathF.Round(f * 255f), 0, 255);
            return Color.FromRgb(ToByte(v.X), ToByte(v.Y), ToByte(v.Z));
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }

    private static ImageSource? TryDecodeTexture(GltfTexture texture)
    {
        var image = texture.PrimaryImage;
        if (image is null)
        {
            return null;
        }

        return TryDecodeMemoryImage(image.Content);
    }

    internal static ImageSource? TryDecodeMemoryImage(MemoryImage content)
    {
        if (!content.IsValid)
        {
            return null;
        }

        try
        {
            using var stream = content.Open();
            if (stream is null || !stream.CanRead)
            {
                return null;
            }

            byte[] buffer;
            if (stream is MemoryStream ms && ms.TryGetBuffer(out var seg))
            {
                buffer = seg.AsSpan().ToArray();
            }
            else
            {
                using var copy = new MemoryStream();
                stream.CopyTo(copy);
                buffer = copy.ToArray();
            }

            var bmp = new BitmapImage();
            bmp.BeginInit();
            bmp.StreamSource = new MemoryStream(buffer);
            bmp.CacheOption = BitmapCacheOption.OnLoad;
            bmp.CreateOptions = BitmapCreateOptions.IgnoreColorProfile;
            bmp.EndInit();
            bmp.Freeze();
            return bmp;
        }
        catch
        {
            return null;
        }
    }
}
