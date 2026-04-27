using System.Collections.Concurrent;
using System.IO;
using System.Numerics;
using System.Windows.Media;
using System.Windows.Media.Media3D;
using SharpGLTF.Runtime;
using SharpGLTF.Schema2;
using SharpGLTF.Transforms;
using GltfMaterial = SharpGLTF.Schema2.Material;
using _3DInteriorEditor.App.Models;

namespace _3DInteriorEditor.App.Scene;

/// <summary>
/// Loads glTF/glB geometry via SharpGLTF and builds WPF meshes scaled to placement dimensions.
/// </summary>
public static class GltfModelLoader
{
    private static readonly ConcurrentDictionary<string, IReadOnlyList<ImportedMeshPart>> Cache = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Loads triangle meshes from a glTF 2.0 file, scaled uniformly to fit inside <paramref name="targetDimensionsMeters"/>.
    /// Geometry is centered at the origin before scaling. Parts may carry optional diffuse RGB from material factor channels.
    /// Returns null when the file is missing, unsupported, or contains no drawable triangles.
    /// </summary>
    public static IReadOnlyList<ImportedMeshPart>? TryLoadMeshParts(string absolutePath, JsonVector3 targetDimensionsMeters)
    {
        try
        {
            if (!File.Exists(absolutePath))
            {
                return null;
            }

            var ext = Path.GetExtension(absolutePath);
            if (!string.Equals(ext, ".gltf", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(ext, ".glb", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            var ticks = File.GetLastWriteTimeUtc(absolutePath).Ticks;
            var cacheKey =
                $"{absolutePath}|{ticks}|{targetDimensionsMeters.X:R}|{targetDimensionsMeters.Y:R}|{targetDimensionsMeters.Z:R}";

            if (Cache.TryGetValue(cacheKey, out var existing) && existing.Count > 0)
            {
                return existing;
            }

            var parts = LoadMeshPartsCore(absolutePath, targetDimensionsMeters);
            if (parts.Count == 0)
            {
                return null;
            }

            return Cache.GetOrAdd(cacheKey, _ => parts);
        }
        catch
        {
            return null;
        }
    }

    private static IReadOnlyList<ImportedMeshPart> LoadMeshPartsCore(string absolutePath, JsonVector3 targetDimensionsMeters)
    {
        var options = new RuntimeOptions { IsolateMemory = true };

        var model = ModelRoot.Load(absolutePath);

        var scene = model.DefaultScene ?? model.LogicalScenes.FirstOrDefault();
        if (scene is null)
        {
            return Array.Empty<ImportedMeshPart>();
        }

        IMeshDecoder<GltfMaterial>[] decodedMeshes = MeshDecoder.Decode(model.LogicalMeshes, options);
        var sceneTemplate = SceneTemplate.Create(scene, options);
        var instance = sceneTemplate.CreateInstance();

        instance.Armature.SetPoseTransforms();

        var bbox = instance.EvaluateBoundingBox(decodedMeshes);

        var size = bbox.Max - bbox.Min;
        var sx = Math.Max((float)size.X, 1e-6f);
        var sy = Math.Max((float)size.Y, 1e-6f);
        var sz = Math.Max((float)size.Z, 1e-6f);

        var tx = (float)targetDimensionsMeters.X;
        var ty = (float)targetDimensionsMeters.Y;
        var tz = (float)targetDimensionsMeters.Z;

        var uniform = Math.Min(Math.Min(tx / sx, ty / sy), tz / sz);

        var center = (bbox.Min + bbox.Max) * 0.5f;

        var parts = new List<ImportedMeshPart>();

        foreach (DrawableInstance drawable in instance)
        {
            var meshIdx = drawable.Template.LogicalMeshIndex;
            if (meshIdx < 0 || meshIdx >= decodedMeshes.Length)
            {
                continue;
            }

            var meshDecoder = decodedMeshes[meshIdx];
            foreach (var prim in meshDecoder.Primitives)
            {
                var part = BuildPrimitiveMesh(prim, drawable.Transform, center, uniform);
                if (part is not null)
                {
                    parts.Add(part);
                }
            }
        }

        return parts;
    }

    private static ImportedMeshPart? BuildPrimitiveMesh(
        IMeshPrimitiveDecoder<GltfMaterial> primitive,
        IGeometryTransform drawableTransform,
        Vector3 center,
        float uniformScale)
    {
        var diffuseRgb = TryResolveDiffuseFactorRgb(primitive.Material);

        var mesh = new MeshGeometry3D();
        var positions = mesh.Positions;
        var normals = mesh.Normals;
        var indices = mesh.TriangleIndices;

        foreach (var (a, b, c) in primitive.TriangleIndices)
        {
            void AddVertex(int idx)
            {
                var p = MeshDecoder.GetPosition(primitive, idx, drawableTransform);
                var n = MeshDecoder.GetNormal(primitive, idx, drawableTransform);

                p -= center;
                p *= uniformScale;

                positions.Add(new Point3D(p.X, p.Y, p.Z));

                var len = n.Length();
                if (len > 1e-12f)
                {
                    n /= len;
                }

                normals.Add(new Vector3D(n.X, n.Y, n.Z));
            }

            var baseIdx = positions.Count;
            AddVertex(a);
            AddVertex(b);
            AddVertex(c);
            indices.Add(baseIdx);
            indices.Add(baseIdx + 1);
            indices.Add(baseIdx + 2);
        }

        if (positions.Count == 0)
        {
            return null;
        }

        mesh.Freeze();
        return new ImportedMeshPart
        {
            Geometry = mesh,
            BaseColorRgb = diffuseRgb,
        };
    }

    /// <summary>
    /// Reads metallic-roughness <c>baseColorFactor</c> or spec-gloss <c>diffuseFactor</c> (factor only; textures ignored).
    /// </summary>
    private static Color? TryResolveDiffuseFactorRgb(GltfMaterial? material)
    {
        if (material is null)
        {
            return null;
        }

        foreach (var key in new[] { "BaseColor", "Diffuse" })
        {
            var channel = material.FindChannel(key);
            if (!channel.HasValue)
            {
                continue;
            }

            try
            {
                var v = channel.Value.Color;
                static byte ToByte(float f) => (byte)Math.Clamp((int)MathF.Round(f * 255f), 0, 255);
                return Color.FromRgb(ToByte(v.X), ToByte(v.Y), ToByte(v.Z));
            }
            catch (InvalidOperationException)
            {
                // Channel exists but RGB/RGBA layout is unexpected — try next channel name.
            }
        }

        return null;
    }
}
