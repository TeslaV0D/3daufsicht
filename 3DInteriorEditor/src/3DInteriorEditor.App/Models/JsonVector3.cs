namespace _3DInteriorEditor.App.Models;

/// <summary>
/// Serializable 3-component vector used by persisted layout JSON.
/// </summary>
public sealed class JsonVector3
{
    /// <summary>X component.</summary>
    public double X { get; init; }

    /// <summary>Y component.</summary>
    public double Y { get; init; }

    /// <summary>Z component.</summary>
    public double Z { get; init; }
}
