using System.Text.Json;
using _3DInteriorEditor.App.Services.Serialization;

namespace _3DInteriorEditor.App.Services;

/// <summary>
/// Deep copy helpers based on JSON roundtrip (consistent with persisted layout JSON).
/// </summary>
internal static class DeepCopy
{
    /// <summary>
    /// Creates a deep clone of <paramref name="value"/>.
    /// </summary>
    public static T Clone<T>(T value)
    {
        return JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value, AppJson.Options), AppJson.Options)
               ?? throw new InvalidOperationException($"Failed to deep-clone {typeof(T).FullName}.");
    }

    /// <summary>
    /// Creates deep clones for each element.
    /// </summary>
    public static List<T> CloneList<T>(IEnumerable<T> items)
    {
        return items.Select(Clone).ToList();
    }
}
