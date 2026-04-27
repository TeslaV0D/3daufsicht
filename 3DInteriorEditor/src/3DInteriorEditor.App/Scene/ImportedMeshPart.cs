using System.Windows.Media;
using System.Windows.Media.Media3D;
using GltfAlphaMode = SharpGLTF.Schema2.AlphaMode;
using TextureWrapMode = SharpGLTF.Schema2.TextureWrapMode;

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

    /// <summary>
    /// glTF sampler wrap S/T for <see cref="BaseColorTexture"/> (viewport maps to WPF <see cref="System.Windows.Media.TileMode"/>).
    /// Null when no sampled texture is used.
    /// </summary>
    public TextureWrapMode? BaseColorWrapS { get; init; }

    /// <inheritdoc cref="BaseColorWrapS"/>
    public TextureWrapMode? BaseColorWrapT { get; init; }

    /// <summary>
    /// Maps glTF sampler min/mag hint to WPF scaling (see Phase 25); null when no textured import path.
    /// </summary>
    public BitmapScalingMode? BaseColorBitmapScalingMode { get; init; }

    /// <summary>
    /// glTF <c>material.doubleSided</c> (default <c>false</c> in the spec). When <c>false</c>, the viewport uses
    /// <see cref="GeometryModel3D.Material"/> only so back faces are not lit (WPF back-face culling style).
    /// </summary>
    public bool DoubleSided { get; init; }

    /// <summary>
    /// glTF <see cref="GltfAlphaMode"/> (opaque / mask / blend). Blend uses base-color factor alpha in materials.
    /// </summary>
    public GltfAlphaMode AlphaMode { get; init; }

    /// <summary>
    /// glTF <c>material.alphaCutoff</c>; used when <see cref="AlphaMode"/> is MASK (viewport does not evaluate cutout pixels yet).
    /// </summary>
    public float AlphaCutoff { get; init; }
}
