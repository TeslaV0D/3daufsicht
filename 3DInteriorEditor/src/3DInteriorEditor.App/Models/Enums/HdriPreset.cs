using System.Text.Json.Serialization;

namespace _3DInteriorEditor.App.Models.Enums;

/// <summary>
/// Built-in HDRI lighting presets (conceptual; rendering implementation comes later).
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum HdriPreset
{
    Warehouse,
    Studio,
    Outdoor,
    Neutral,
}
