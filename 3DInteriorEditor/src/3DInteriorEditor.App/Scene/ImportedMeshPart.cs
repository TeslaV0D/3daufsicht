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
    /// </summary>
    public Color? BaseColorRgb { get; init; }
}
