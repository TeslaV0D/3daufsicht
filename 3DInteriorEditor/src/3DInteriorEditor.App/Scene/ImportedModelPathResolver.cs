using System.IO;

namespace _3DInteriorEditor.App.Scene;

/// <summary>
/// Resolves <see cref="Models.AssetDefinition.ImportedModelPath"/> to an absolute file path.
/// </summary>
public static class ImportedModelPathResolver
{
    /// <summary>
    /// Returns an absolute path if the model file exists; otherwise null.
    /// Relative paths resolve against <paramref name="layoutDirectory"/> when provided.
    /// </summary>
    public static string? Resolve(string? importedModelPath, string? layoutDirectory)
    {
        if (string.IsNullOrWhiteSpace(importedModelPath))
        {
            return null;
        }

        importedModelPath = importedModelPath.Trim();

        if (Path.IsPathFullyQualified(importedModelPath))
        {
            return File.Exists(importedModelPath) ? importedModelPath : null;
        }

        if (!string.IsNullOrEmpty(layoutDirectory))
        {
            var candidate = Path.GetFullPath(Path.Combine(layoutDirectory, importedModelPath));
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        var baseCandidate = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, importedModelPath));
        return File.Exists(baseCandidate) ? baseCandidate : null;
    }
}
