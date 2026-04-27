using System.Windows.Media;
using System.Windows.Media.Media3D;
using HelixToolkit.Wpf;
using TextureWrapMode = SharpGLTF.Schema2.TextureWrapMode;
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
    /// When <paramref name="resolvedImportedModelPath"/> points to a loadable glTF/glB file, triangle geometry is used;
    /// otherwise primitives from <see cref="AssetDefinition.Shape"/> apply.
    /// </summary>
    public static ModelVisual3D CreateVisual(
        PlacedAsset asset,
        AssetDefinition? definition,
        bool isSelected,
        string? resolvedImportedModelPath = null)
    {
        var shape = definition?.Shape ?? AssetShapeKind.Box;

        // Selection highlight: keep it simple (bright accent tint).
        var colorHex = isSelected ? "#7986CB" : asset.ColorHex;
        var fill = ColorHexHelper.ToDiffuseBrush(colorHex);
        var material = MaterialHelper.CreateMaterial(fill);
        var dim = asset.DimensionsMeters;

        if (!string.IsNullOrEmpty(resolvedImportedModelPath))
        {
            var imported = GltfModelLoader.TryLoadMeshParts(resolvedImportedModelPath, dim);
            if (imported is not null && imported.Count > 0)
            {
                return CreateFromImportedParts(imported, asset.ColorHex, isSelected);
            }
        }

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

    private static ModelVisual3D CreateFromImportedParts(
        IReadOnlyList<ImportedMeshPart> parts,
        string placementColorHex,
        bool isSelected)
    {
        const string selectionHex = "#7986CB";
        var group = new Model3DGroup();
        foreach (var part in parts)
        {
            var material = CreateImportedPartMaterial(part, placementColorHex, selectionHex, isSelected);
            group.Children.Add(new GeometryModel3D
            {
                Geometry = part.Geometry,
                Material = material,
                BackMaterial = material,
            });
        }

        return new ModelVisual3D { Content = group };
    }

    private static Material CreateImportedPartMaterial(
        ImportedMeshPart part,
        string placementColorHex,
        string selectionHex,
        bool isSelected)
    {
        if (isSelected)
        {
            return MaterialHelper.CreateMaterial(ColorHexHelper.ToDiffuseBrush(selectionHex));
        }

        if (part.BaseColorTexture is { } texSrc)
        {
            var ws = part.BaseColorWrapS ?? TextureWrapMode.REPEAT;
            var wt = part.BaseColorWrapT ?? TextureWrapMode.REPEAT;
            var ib = new ImageBrush(texSrc)
            {
                TileMode = GltfSamplerImageBrushMapping.ToTileMode(ws, wt),
                Stretch = Stretch.Fill,
            };
            ib.Freeze();
            var mat = MaterialHelper.CreateMaterial(ib, 100.0, (byte)255, true);
            ApplyBaseColorFactorTint(mat, part.BaseColorRgb ?? Colors.White);
            return mat;
        }

        string hex = part.BaseColorRgb is { } rgb
            ? ColorHexHelper.ToRgbHex(rgb)
            : placementColorHex;

        return MaterialHelper.CreateMaterial(ColorHexHelper.ToDiffuseBrush(hex));
    }

    /// <summary>
    /// Approximates glTF baseColorFactor × texture by tinting WPF diffuse materials.
    /// </summary>
    private static void ApplyBaseColorFactorTint(Material material, Color factor)
    {
        switch (material)
        {
            case DiffuseMaterial dm:
                dm.Color = factor;
                return;
            case MaterialGroup mg:
                foreach (var child in mg.Children)
                {
                    ApplyBaseColorFactorTint(child, factor);
                }

                break;
        }
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
