using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;

namespace Atrium.Api.Storage;

/// <summary>
/// Azure Blob Storage adapter.
///
/// STATUS: interface-complete with the real Azure SDK surface, but NOT yet
/// round-tripped against a live Azure account in this build. Treat as a verified
/// draft: compile it, point it at a storage account, and confirm the self-test
/// (/api/admin/storage/test) passes before relying on it.
///
/// SAS generation requires shared-key credentials, so the connection string must
/// contain the account key (CanGenerateSasUri == true).
/// </summary>
public sealed class AzureBlobStorageProvider : IStorageProvider
{
    private readonly BlobContainerClient _container;

    public string Name => "azure";

    public AzureBlobStorageProvider(StorageOptions o)
    {
        var svc = new BlobServiceClient(o.AzureConnectionString);
        _container = svc.GetBlobContainerClient(o.AzureContainer ?? o.Bucket);
    }

    public async Task PutAsync(string key, Stream content, string contentType, CancellationToken ct = default)
    {
        var blob = _container.GetBlobClient(key);
        await blob.UploadAsync(content, new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders { ContentType = contentType },
        }, ct);
    }

    public async Task<Stream> GetAsync(string key, CancellationToken ct = default)
    {
        var blob = _container.GetBlobClient(key);
        var resp = await blob.DownloadStreamingAsync(cancellationToken: ct);
        return resp.Value.Content;
    }

    public Task DeleteAsync(string key, CancellationToken ct = default)
        => _container.GetBlobClient(key).DeleteIfExistsAsync(cancellationToken: ct);

    public Task<bool> ExistsAsync(string key, CancellationToken ct = default)
        => _container.GetBlobClient(key).ExistsAsync(ct).ContinueWith(t => t.Result.Value, ct);

    public Task<SignedUrl> CreateUploadUrlAsync(string key, string contentType, TimeSpan ttl, CancellationToken ct = default)
    {
        var blob = _container.GetBlobClient(key);
        if (!blob.CanGenerateSasUri)
            throw new InvalidOperationException("Azure adapter needs shared-key creds (account key in the connection string) to mint SAS URLs.");

        var sas = new BlobSasBuilder
        {
            BlobContainerName = _container.Name,
            BlobName = key,
            Resource = "b",
            ExpiresOn = DateTimeOffset.UtcNow.Add(ttl),
            ContentType = contentType,
        };
        sas.SetPermissions(BlobSasPermissions.Create | BlobSasPermissions.Write);
        var uri = blob.GenerateSasUri(sas);
        var headers = new Dictionary<string, string>
        {
            ["x-ms-blob-type"] = "BlockBlob",
            ["Content-Type"] = contentType,
        };
        return Task.FromResult(new SignedUrl(uri.ToString(), "PUT", headers, sas.ExpiresOn));
    }

    public Task<SignedUrl> CreateDownloadUrlAsync(string key, TimeSpan ttl, string? downloadFileName = null, CancellationToken ct = default)
    {
        var blob = _container.GetBlobClient(key);
        var sas = new BlobSasBuilder
        {
            BlobContainerName = _container.Name,
            BlobName = key,
            Resource = "b",
            ExpiresOn = DateTimeOffset.UtcNow.Add(ttl),
        };
        sas.SetPermissions(BlobSasPermissions.Read);
        if (!string.IsNullOrWhiteSpace(downloadFileName))
            sas.ContentDisposition = $"attachment; filename=\"{downloadFileName}\"";
        var uri = blob.GenerateSasUri(sas);
        return Task.FromResult(new SignedUrl(uri.ToString(), "GET", new Dictionary<string, string>(), sas.ExpiresOn));
    }
}
