using System.Numerics;
using SharpGLTF.Schema2;

namespace _3DInteriorEditor.App.Scene;

/// <summary>
/// Applies <c>KHR_texture_transform</c> in glTF UV space (before WPF V-flip).
/// Order matches the extension: scale → rotate (CCW around origin) → translate.
/// </summary>
internal static class GltfTextureUvTransform
{
    internal static Vector2 Apply(Vector2 uv, TextureTransform? transform)
    {
        if (transform is null)
        {
            return uv;
        }

        var scale = transform.Scale;
        var scaled = new Vector2(uv.X * scale.X, uv.Y * scale.Y);

        var rot = transform.Rotation;
        var c = MathF.Cos(rot);
        var s = MathF.Sin(rot);
        var rotated = new Vector2(
            c * scaled.X - s * scaled.Y,
            s * scaled.X + c * scaled.Y);

        var offset = transform.Offset;
        return rotated + offset;
    }
}
