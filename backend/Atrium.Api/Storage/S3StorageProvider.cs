using Amazon.S3;
using Amazon.S3.Model;

namespace Atrium.Api.Storage;

/// <summary>
/// S3 adapter. Serves BOTH AWS S3 and any S3-compatible store (MinIO, Wasabi,
/// Backblaze B2, Cloudflare R2) — the only difference is Endpoint + ForcePathStyle.
/// This is the lingua-franca adapter; it's why one integration covers many backends.
/// </summary>
public sealed class S3StorageProvider : IStorageProvider
{
    private readonly IAmazonS3 _s3;
    private readonly string _bucket;

    public string Name => "s3";

    public S3StorageProvider(StorageOptions o)
    {
        _bucket = o.Bucket;

        var cfg = new AmazonS3Config { ForcePathStyle = o.ForcePathStyle };
        if (!string.IsNullOrWhiteSpace(o.Endpoint))
            cfg.ServiceURL = o.Endpoint;                 // MinIO / R2 / custom
        else if (!string.IsNullOrWhiteSpace(o.Region))
            cfg.RegionEndpoint = Amazon.RegionEndpoint.GetBySystemName(o.Region);

        // Explicit keys if provided; otherwise fall back to the ambient credential
        // chain (IAM role / env / profile) — the AWS best practice in production.
        _s3 = !string.IsNullOrWhiteSpace(o.AccessKey)
            ? new AmazonS3Client(o.AccessKey, o.SecretKey, cfg)
            : new AmazonS3Client(cfg);
    }

    public Task PutAsync(string key, Stream content, string contentType, CancellationToken ct = default)
        => _s3.PutObjectAsync(new PutObjectRequest
        {
            BucketName = _bucket,
            Key = key,
            InputStream = content,
            ContentType = contentType,
            AutoCloseStream = false,
        }, ct);

    public async Task<Stream> GetAsync(string key, CancellationToken ct = default)
    {
        var r = await _s3.GetObjectAsync(_bucket, key, ct);
        return r.ResponseStream;
    }

    public Task DeleteAsync(string key, CancellationToken ct = default)
        => _s3.DeleteObjectAsync(_bucket, key, ct);

    public async Task<bool> ExistsAsync(string key, CancellationToken ct = default)
    {
        try
        {
            await _s3.GetObjectMetadataAsync(_bucket, key, ct);
            return true;
        }
        catch (AmazonS3Exception e) when (e.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return false;
        }
    }

    public Task<SignedUrl> CreateUploadUrlAsync(string key, string contentType, TimeSpan ttl, CancellationToken ct = default)
    {
        var url = _s3.GetPreSignedURL(new GetPreSignedUrlRequest
        {
            BucketName = _bucket,
            Key = key,
            Verb = HttpVerb.PUT,
            Expires = DateTime.UtcNow.Add(ttl),
            ContentType = contentType,
        });
        var headers = new Dictionary<string, string> { ["Content-Type"] = contentType };
        return Task.FromResult(new SignedUrl(url, "PUT", headers, DateTimeOffset.UtcNow.Add(ttl)));
    }

    public Task<SignedUrl> CreateDownloadUrlAsync(string key, TimeSpan ttl, string? downloadFileName = null, CancellationToken ct = default)
    {
        var req = new GetPreSignedUrlRequest
        {
            BucketName = _bucket,
            Key = key,
            Verb = HttpVerb.GET,
            Expires = DateTime.UtcNow.Add(ttl),
        };
        if (!string.IsNullOrWhiteSpace(downloadFileName))
            req.ResponseHeaderOverrides.ContentDisposition = $"attachment; filename=\"{downloadFileName}\"";

        var url = _s3.GetPreSignedURL(req);
        return Task.FromResult(new SignedUrl(url, "GET", new Dictionary<string, string>(), DateTimeOffset.UtcNow.Add(ttl)));
    }
}
