namespace Atrium.Api.Storage;

/// <summary>
/// The single contract the entire app talks to. Each cloud (S3, Azure Blob,
/// GCS, MinIO) is one adapter implementing this. Adding a backend = implementing
/// this interface and registering it — nothing else in Atrium changes.
///
/// Bytes flow browser <-> cloud directly via signed URLs; they never pass
/// through the Atrium server. The server only mints short-lived URLs and tracks
/// metadata.
/// </summary>
public interface IStorageProvider
{
    /// <summary>Adapter id: "s3" | "minio" | "azure" | "gcs".</summary>
    string Name { get; }

    // --- direct server-side operations (used for the connection self-test and internal cases) ---
    Task PutAsync(string key, Stream content, string contentType, CancellationToken ct = default);
    Task<Stream> GetAsync(string key, CancellationToken ct = default);
    Task DeleteAsync(string key, CancellationToken ct = default);
    Task<bool> ExistsAsync(string key, CancellationToken ct = default);

    // --- signed URLs: the browser uploads/downloads straight to the customer's cloud ---
    Task<SignedUrl> CreateUploadUrlAsync(string key, string contentType, TimeSpan ttl, CancellationToken ct = default);
    Task<SignedUrl> CreateDownloadUrlAsync(string key, TimeSpan ttl, string? downloadFileName = null, CancellationToken ct = default);
}

/// <summary>A presigned URL plus the method/headers the client must use with it.</summary>
public record SignedUrl(
    string Url,
    string Method,
    IReadOnlyDictionary<string, string> Headers,
    DateTimeOffset ExpiresAt);
