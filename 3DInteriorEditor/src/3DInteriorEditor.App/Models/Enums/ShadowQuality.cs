using System.Text.Json.Serialization;

namespace _3DInteriorEditor.App.Models.Enums;

/// <summary>
/// Shadow mapping quality preset.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ShadowQuality
{
    Off,
    Low,
    Medium,
    High,
}
