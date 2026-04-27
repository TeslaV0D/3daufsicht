using System.Windows.Media.Media3D;
using HelixToolkit.Wpf;
using _3DInteriorEditor.App.Helpers;
using _3DInteriorEditor.App.Models;
using _3DInteriorEditor.App.Models.Enums;

namespace _3DInteriorEditor.App.Scene;

/// <summary>
/// Builds Helix <see cref="ModelVisual3D"/> instances for <see cref="PlacedAsset"/> instances.
/// </summary>
public static class PlacedAssetVisualFactory
{
    /// <summary>
    /// Creates a visual centered at the origin with local dimensions; caller applies world transform.
    /// </summary>
    public static ModelVisual3D CreateVisual(
        PlacedAsset asset,
        AssetDefinition? definition)
    {
        var shape = definition?.Shape ?? AssetShapeKind.Box;

        var fill = ColorHexHelper.ToDiffuseBrush(asset.ColorHex);
        var material = MaterialHelper.CreateMaterial(fill);
        var dim = asset.DimensionsMeters;

        return shape switch
        {
            AssetShapeKind.Sphere => CreateSphere(dim, material),
            AssetShapeKind.Cylinder => CreateCylinder(dim, material),
            AssetShapeKind.Cone => CreateCone(dim, material),
            AssetShapeKind.Box or AssetShapeKind.Hexagon or AssetShapeKind.Rhombus or AssetShapeKind.Circle =>
                CreateBox(dim, material),
            _ => CreateBox(dim, material),
        };
    }

    private static ModelVisual3D CreateBox(JsonVector3 dim, Material material)
    {
        // Helix: Length=X, Width=Y, Height=Z
        return new BoxVisual3D
        {
            Center = new Point3D(0, 0, 0),
            Length = dim.X,
            Width = dim.Y,
            Height = dim.Z,
            Material = material,
        };
    }

    private static ModelVisual3D CreateSphere(JsonVector3 dim, Material material)
    {
        var r = 0.5 * System.Math.Max(System.Math.Max(dim.X, dim.Y), dim.Z);
        if (r < 1e-6)
        {
            r = 0.05;
        }

        return new SphereVisual3D
        {
            Center = new Point3D(0, 0, 0),
            Radius = r,
            Material = material,
        };
    }

    private static ModelVisual3D CreateCylinder(JsonVector3 dim, Material material)
    {
        var radius = 0.5 * System.Math.Max(dim.X, dim.Z);
        if (radius < 1e-6)
        {
            radius = 0.05;
        }

        var h = dim.Y > 1e-6 ? dim.Y : 0.1;

        return new TruncatedConeVisual3D
        {
            BaseRadius = radius,
            TopRadius = radius,
            Height = h,
            Origin = new Point3D(0, -h * 0.5, 0),
            Normal = new Vector3D(0, 1, 0),
            Material = material,
        };
    }

    private static ModelVisual3D CreateCone(JsonVector3 dim, Material material)
    {
        var radius = 0.5 * System.Math.Max(dim.X, dim.Z);
        if (radius < 1e-6)
        {
            radius = 0.05;
        }

        var h = dim.Y > 1e-6 ? dim.Y : 0.1;

        return new TruncatedConeVisual3D
        {
            BaseRadius = radius,
            TopRadius = 0,
            Height = h,
            Origin = new Point3D(0, -h * 0.5, 0),
            Normal = new Vector3D(0, 1, 0),
            Material = material,
        };
    }
}
