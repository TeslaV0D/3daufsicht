using System.Windows.Media;
using System.Windows.Media.Media3D;

namespace _3DInteriorEditor.App.Scene;

/// <summary>
/// One drawable sub-mesh from an imported glTF, optionally tinted by material factor data.
/// </summary>
public sealed class ImportedMeshPart
{
    public required MeshGeometry3D Geometry { get; init; }

    /// <summary>
    /// RGB from glTF baseColorFactor / diffuse factor when available; otherwise null (use placement color).
    /// When <see cref="BaseColorTexture"/> is set, still multiplies the sampled texture (approximation of glTF multiply).
    /// </summary>
    public Color? BaseColorRgb { get; init; }

    /// <summary>
    /// Base color / diffuse texture when decoded (PNG/JPEG/WebP via WPF); otherwise null.
    /// </summary>
    public ImageSource? BaseColorTexture { get; init; }
}
