using System.Collections.Generic;
using System.Windows.Media.Media3D;
using _3DInteriorEditor.App.Models;

namespace _3DInteriorEditor.App.Scene;

/// <summary>
/// World-space bounds for placed instances (axis-aligned box around rotated local AABB).
/// </summary>
public static class PlacedAssetBounds
{
    /// <summary>
    /// Builds the same world transform as <see cref="PlacedAssetScenePresenter"/> (Euler XYZ then translate).
    /// </summary>
    public static Transform3D BuildWorldTransform(PlacedAsset asset)
    {
        var rot = asset.RotationDegrees;
        var pos = asset.PositionMeters;

        var group = new Transform3DGroup();
        group.Children.Add(new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(1, 0, 0), rot.X)));
        group.Children.Add(new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(0, 1, 0), rot.Y)));
        group.Children.Add(new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(0, 0, 1), rot.Z)));
        group.Children.Add(new TranslateTransform3D(pos.X, pos.Y, pos.Z));
        return group;
    }

    /// <summary>
    /// Computes an axis-aligned world bounds box for one placed asset.
    /// </summary>
    public static Rect3D GetAxisAlignedBounds(PlacedAsset asset)
    {
        var hx = asset.DimensionsMeters.X * 0.5;
        var hy = asset.DimensionsMeters.Y * 0.5;
        var hz = asset.DimensionsMeters.Z * 0.5;

        var xf = BuildWorldTransform(asset);

        var min = new Point3D(double.PositiveInfinity, double.PositiveInfinity, double.PositiveInfinity);
        var max = new Point3D(double.NegativeInfinity, double.NegativeInfinity, double.NegativeInfinity);

        foreach (var corner in CornersLocal(hx, hy, hz))
        {
            var w = xf.Transform(corner);
            min = new Point3D(
                Math.Min(min.X, w.X),
                Math.Min(min.Y, w.Y),
                Math.Min(min.Z, w.Z));
            max = new Point3D(
                Math.Max(max.X, w.X),
                Math.Max(max.Y, w.Y),
                Math.Max(max.Z, w.Z));
        }

        return new Rect3D(
            min.X,
            min.Y,
            min.Z,
            max.X - min.X,
            max.Y - min.Y,
            max.Z - min.Z);
    }

    /// <summary>
    /// Union of bounds for the given assets (empty assets → centered 2 m cube at origin).
    /// </summary>
    public static Rect3D UnionBounds(IEnumerable<PlacedAsset> assets)
    {
        Rect3D? acc = null;
        foreach (var a in assets)
        {
            var r = GetAxisAlignedBounds(a);
            acc = acc is null ? r : Union(acc.Value, r);
        }

        return acc ?? new Rect3D(-1, -1, -1, 2, 2, 2);
    }

    private static Rect3D Union(Rect3D a, Rect3D b)
    {
        var x2 = Math.Max(a.X + a.SizeX, b.X + b.SizeX);
        var y2 = Math.Max(a.Y + a.SizeY, b.Y + b.SizeY);
        var z2 = Math.Max(a.Z + a.SizeZ, b.Z + b.SizeZ);
        var x1 = Math.Min(a.X, b.X);
        var y1 = Math.Min(a.Y, b.Y);
        var z1 = Math.Min(a.Z, b.Z);
        return new Rect3D(x1, y1, z1, x2 - x1, y2 - y1, z2 - z1);
    }

    private static IEnumerable<Point3D> CornersLocal(double hx, double hy, double hz)
    {
        yield return new Point3D(-hx, -hy, -hz);
        yield return new Point3D(hx, -hy, -hz);
        yield return new Point3D(-hx, hy, -hz);
        yield return new Point3D(hx, hy, -hz);
        yield return new Point3D(-hx, -hy, hz);
        yield return new Point3D(hx, -hy, hz);
        yield return new Point3D(-hx, hy, hz);
        yield return new Point3D(hx, hy, hz);
    }
}
