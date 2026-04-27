using System.IO;
using System.Text.Json;
using _3DInteriorEditor.App.Models;

namespace _3DInteriorEditor.App.Services;

/// <summary>
/// Loads and saves <see cref="AppSettings"/> to <see cref="Constants.SettingsPath"/>.
/// </summary>
public sealed class AppSettingsStore
{
    private static readonly JsonSerializerOptions Options = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public AppSettings Load()
    {
        try
        {
            var path = Constants.SettingsPath;
            if (!File.Exists(path))
            {
                return new AppSettings();
            }

            var json = File.ReadAllText(path);
            var s = JsonSerializer.Deserialize<AppSettings>(json, Options);
            return s ?? new AppSettings();
        }
        catch
        {
            return new AppSettings();
        }
    }

    public void Save(AppSettings settings)
    {
        ArgumentNullException.ThrowIfNull(settings);

        var path = Constants.SettingsPath;
        var dir = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(dir))
        {
            Directory.CreateDirectory(dir);
        }

        var json = JsonSerializer.Serialize(settings, Options);
        File.WriteAllText(path, json);
    }
}
