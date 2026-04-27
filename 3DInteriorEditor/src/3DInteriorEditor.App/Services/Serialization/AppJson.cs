using System.Text.Json;
using System.Text.Json.Serialization;

namespace _3DInteriorEditor.App.Services.Serialization;

/// <summary>
/// Shared JSON serialization settings for persisted documents.
/// </summary>
public static class AppJson
{
    /// <summary>
    /// Serializer options used for layout files (<c>.3dei</c>) and deep-copy cloning via JSON roundtrip.
    /// </summary>
    public static JsonSerializerOptions Options { get; } = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters =
        {
            new JsonStringEnumConverter(),
        },
    };
}
