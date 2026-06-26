using Google.Apis.Auth.OAuth2;
using Google.Cloud.Storage.V1;

namespace Atrium.Api.Storage;

/// <summary>
/// Google Cloud Storage adapter.
///
/// STATUS: interface-complete with the real GCS SDK surface, but NOT yet
/// round-tripped against a live GCP project in this build. Verify via the
/// self-test before relying on it.
///
/// Signed URLs use a service-account key (UrlSigner). GcsCredentialsPath must
/// point at that key's JSON.
/// </summary>
public sealed class GcsStorageProvider : IStorageProvider
{
    private readonly StorageClient _client;
    private readonly UrlSigner _signer;
    private readonly string _bucket;

    public string Name => "gcs";

    public GcsStorageProvider(StorageOptions o)
    {
        _bucket = o.Bucket;
        var credential = GoogleCredential.FromFile(o.GcsCredentialsPath);
        _client = StorageClient.Create(credential);
        _signer = UrlSigner.FromCredential((ServiceAccountCredential)credential.UnderlyingCredential!);
    }

    public async Task PutAsync(string key, Stream content, string contentType, CancellationToken ct = default)
        => await _client.UploadObjectAsync(_bucket, key, contentType, content, cancellationToken: ct);

    public async Task<Stream> GetAsync(string key, CancellationToken ct = default)
    {
        var ms = new MemoryStream();
        await _client.DownloadObjectAsync(_bucket, key, ms, cancellationToken: ct);
        ms.Position = 0;
        return ms;
    }

    public Task DeleteAsync(string key, CancellationToken ct = default)
        => _client.DeleteObjectAsync(_bucket, key, cancellationToken: ct);

    public async Task<bool> ExistsAsync(string key, CancellationToken ct = default)
    {
        try
        {
            await _client.GetObjectAsync(_bucket, key, cancellationToken: ct);
            return true;
        }
        catch (Google.GoogleApiException e) when (e.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return false;
        }
    }

    public async Task<SignedUrl> CreateUploadUrlAsync(string key, string contentType, TimeSpan ttl, CancellationToken ct = default)
    {
        // NOTE (unverified draft): signs a plain PUT URL. Content-Type isn't bound into
        // the signature here (the SignAsync content-headers overload varies by SDK version);
        // the client is still told to send Content-Type via the returned header. Verify
        // against a real GCS bucket and tighten if you enable per-object content-type policy.
        var url = await _signer.SignAsync(_bucket, key, ttl, HttpMethod.Put, cancellationToken: ct);
        var headers = new Dictionary<string, string> { ["Content-Type"] = contentType };
        return new SignedUrl(url, "PUT", headers, DateTimeOffset.UtcNow.Add(ttl));
    }

    public async Task<SignedUrl> CreateDownloadUrlAsync(string key, TimeSpan ttl, string? downloadFileName = null, CancellationToken ct = default)
    {
        var url = await _signer.SignAsync(_bucket, key, ttl, HttpMethod.Get, cancellationToken: ct);
        return new SignedUrl(url, "GET", new Dictionary<string, string>(), DateTimeOffset.UtcNow.Add(ttl));
    }
}
