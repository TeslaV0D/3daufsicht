using System.IO;
using _3DInteriorEditor.App.Models;

namespace _3DInteriorEditor.App.Services;

/// <summary>
/// Timer-based auto-save writer. All public methods are safe to call from any thread.
/// </summary>
public sealed class AutoSaveService : IDisposable
{
    private readonly FileService _fileService = new();

    private readonly object _gate = new();
    private CancellationTokenSource? _loopCts;
    private Task? _loopTask;
    private SynchronizationContext? _marshalContext;

    /// <summary>
    /// Creates a new auto-save service.
    /// </summary>
    public AutoSaveService()
    {
    }

    /// <summary>
    /// Starts the auto-save loop. Callbacks are invoked on the captured <see cref="SynchronizationContext"/> (typically UI thread).
    /// </summary>
    /// <param name="marshalContext">Optional synchronization context to marshal callbacks (defaults to current).</param>
    /// <param name="shouldSaveAsync">Returns whether a save should run now.</param>
    /// <param name="buildLayoutAsync">Builds the layout snapshot to persist.</param>
    /// <param name="autoSaveFilePath">Destination auto-save file path.</param>
    public void Start(
        SynchronizationContext? marshalContext,
        Func<CancellationToken, Task<bool>> shouldSaveAsync,
        Func<CancellationToken, Task<LayoutFile>> buildLayoutAsync,
        string autoSaveFilePath)
    {
        ArgumentNullException.ThrowIfNull(shouldSaveAsync);
        ArgumentNullException.ThrowIfNull(buildLayoutAsync);
        ArgumentException.ThrowIfNullOrWhiteSpace(autoSaveFilePath);

        lock (_gate)
        {
            StopCore();

            _marshalContext = marshalContext ?? SynchronizationContext.Current;
            _loopCts = new CancellationTokenSource();
            var token = _loopCts.Token;

            _loopTask = Task.Run(() => RunLoopAsync(token, shouldSaveAsync, buildLayoutAsync, autoSaveFilePath), CancellationToken.None);
        }
    }

    /// <summary>
    /// Stops the auto-save loop.
    /// </summary>
    public void Stop()
    {
        lock (_gate)
        {
            StopCore();
        }
    }

    /// <inheritdoc />
    public void Dispose()
    {
        Stop();
    }

    private void StopCore()
    {
        try
        {
            _loopCts?.Cancel();
        }
        catch
        {
            // ignored
        }

        try
        {
            _loopTask?.GetAwaiter().GetResult();
        }
        catch
        {
            // ignored
        }

        _loopTask = null;
        _loopCts?.Dispose();
        _loopCts = null;
    }

    private async Task RunLoopAsync(
        CancellationToken token,
        Func<CancellationToken, Task<bool>> shouldSaveAsync,
        Func<CancellationToken, Task<LayoutFile>> buildLayoutAsync,
        string autoSaveFilePath)
    {
        Directory.CreateDirectory(Constants.AutoSavePath);

        try
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(Constants.AutoSaveIntervalSeconds), token).ConfigureAwait(false);
                }
                catch (OperationCanceledException)
                {
                    break;
                }

                bool ok;
                try
                {
                    ok = await InvokeShouldSaveAsync(shouldSaveAsync, token).ConfigureAwait(false);
                }
                catch
                {
                    ok = false;
                }

                if (!ok)
                {
                    continue;
                }

                LayoutFile layout;
                try
                {
                    layout = await InvokeBuildLayoutAsync(buildLayoutAsync, token).ConfigureAwait(false);
                }
                catch
                {
                    continue;
                }

                try
                {
                    await _fileService.SaveAsync(autoSaveFilePath, layout, token).ConfigureAwait(false);
                }
                catch
                {
                    // ignored (autosave must never crash the app)
                }
            }
        }
        catch (OperationCanceledException)
        {
            // loop stopped
        }
    }

    private Task<bool> InvokeShouldSaveAsync(Func<CancellationToken, Task<bool>> shouldSaveAsync, CancellationToken token)
    {
        var ctx = _marshalContext;
        if (ctx is null)
        {
            return shouldSaveAsync(token);
        }

        var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        ctx.Post(_ =>
        {
            try
            {
                var task = shouldSaveAsync(token);
                task.ContinueWith(
                    tt =>
                    {
                        if (tt.IsCanceled)
                        {
                            tcs.TrySetCanceled(token);
                        }
                        else if (tt.IsFaulted && tt.Exception is not null)
                        {
                            tcs.TrySetException(tt.Exception.InnerException ?? tt.Exception);
                        }
                        else
                        {
                            tcs.TrySetResult(tt.Result);
                        }
                    },
                    CancellationToken.None,
                    TaskContinuationOptions.ExecuteSynchronously,
                    TaskScheduler.Default);
            }
            catch (Exception ex)
            {
                tcs.TrySetException(ex);
            }
        }, null);

        return tcs.Task;
    }

    private Task<LayoutFile> InvokeBuildLayoutAsync(Func<CancellationToken, Task<LayoutFile>> buildLayoutAsync, CancellationToken token)
    {
        var ctx = _marshalContext;
        if (ctx is null)
        {
            return buildLayoutAsync(token);
        }

        var tcs = new TaskCompletionSource<LayoutFile>(TaskCreationOptions.RunContinuationsAsynchronously);
        ctx.Post(_ =>
        {
            try
            {
                var task = buildLayoutAsync(token);
                task.ContinueWith(
                    tt =>
                    {
                        if (tt.IsCanceled)
                        {
                            tcs.TrySetCanceled(token);
                        }
                        else if (tt.IsFaulted && tt.Exception is not null)
                        {
                            tcs.TrySetException(tt.Exception.InnerException ?? tt.Exception);
                        }
                        else if (tt.Result is null)
                        {
                            tcs.TrySetException(new InvalidOperationException("buildLayoutAsync returned null."));
                        }
                        else
                        {
                            tcs.TrySetResult(tt.Result);
                        }
                    },
                    CancellationToken.None,
                    TaskContinuationOptions.ExecuteSynchronously,
                    TaskScheduler.Default);
            }
            catch (Exception ex)
            {
                tcs.TrySetException(ex);
            }
        }, null);

        return tcs.Task;
    }
}
