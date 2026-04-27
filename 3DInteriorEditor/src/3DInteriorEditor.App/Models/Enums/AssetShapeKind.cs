using System.Text.Json.Serialization;

namespace _3DInteriorEditor.App.Models.Enums;

/// <summary>
/// Primitive shape used by built-in asset templates (non-imported geometry).
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum AssetShapeKind
{
    Box,
    Cylinder,
    Sphere,
    Cone,
    Hexagon,
    Rhombus,
    Circle,
}
