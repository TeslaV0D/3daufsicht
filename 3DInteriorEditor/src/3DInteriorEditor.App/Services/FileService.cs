using System.IO;
using System.Text.Json;
using _3DInteriorEditor.App.Models;
using _3DInteriorEditor.App.Services.Serialization;

namespace _3DInteriorEditor.App.Services;

/// <summary>
/// Loads and saves <see cref="LayoutFile"/> documents as JSON (<c>.3dei</c>) on disk.
/// </summary>
public sealed class FileService
{
    /// <summary>
    /// Loads a layout file from disk.
    /// </summary>
    /// <param name="path">Absolute path to a <c>.3dei</c> file.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The deserialized layout.</returns>
    /// <exception cref="ArgumentException">Thrown when the extension is not <see cref="Constants.LayoutFileExtension"/>.</exception>
    public async Task<LayoutFile> LoadAsync(string path, CancellationToken cancellationToken = default)
    {
        ValidateExtension(path);

        await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        var layout = await JsonSerializer.DeserializeAsync<LayoutFile>(stream, AppJson.Options, cancellationToken).ConfigureAwait(false);
        return layout ?? throw new InvalidOperationException($"Failed to deserialize layout file: '{path}'.");
    }

    /// <summary>
    /// Saves a layout file to disk (overwrites if it exists).
    /// </summary>
    /// <param name="path">Absolute path to a <c>.3dei</c> file.</param>
    /// <param name="layout">Layout document to persist.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    public async Task SaveAsync(string path, LayoutFile layout, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(layout);
        ValidateExtension(path);

        var directory = Path.GetDirectoryName(path);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        await using var stream = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.Read);
        await JsonSerializer.SerializeAsync(stream, layout, AppJson.Options, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Writes a JSON export (same schema as <see cref="LayoutFile"/>) to disk.
    /// </summary>
    /// <param name="path">Destination path (typically ends with <c>.json</c>).</param>
    /// <param name="layout">Layout document to export.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    public async Task ExportJsonAsync(string path, LayoutFile layout, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(layout);

        var directory = Path.GetDirectoryName(path);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        await using var stream = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.Read);
        await JsonSerializer.SerializeAsync(stream, layout, AppJson.Options, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Writes raw JSON bytes to disk (utility for importing foreign JSON payloads during migration).
    /// </summary>
    /// <param name="path">Destination path.</param>
    /// <param name="utf8Json">Raw JSON payload.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    public async Task WriteRawJsonAsync(string path, ReadOnlyMemory<byte> utf8Json, CancellationToken cancellationToken = default)
    {
        var directory = Path.GetDirectoryName(path);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        await File.WriteAllBytesAsync(path, utf8Json.ToArray(), cancellationToken).ConfigureAwait(false);
    }

    private static void ValidateExtension(string path)
    {
        var ext = Path.GetExtension(path);
        if (!string.Equals(ext, Constants.LayoutFileExtension, StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException($"Expected extension '{Constants.LayoutFileExtension}', got '{ext}'.", nameof(path));
        }
    }
}
