namespace Atrium.Api.Storage;

/// <summary>
/// Instance-level storage configuration, bound from the "Storage" config section
/// (i.e. Storage__Provider, Storage__Bucket, ... environment variables on Spark).
/// One backend serves the whole Atrium instance; the admin sets it once.
///
/// Credentials come from the environment — never stored in the DB or entered in a
/// web form — which is the correct posture for instance-level. (Per-tenant storage,
/// a future feature, is what would need an encrypted credential vault + connect UI.)
/// </summary>
public sealed class StorageOptions
{
    public const string SectionName = "Storage";

    /// <summary>"s3" | "minio" | "azure" | "gcs"</summary>
    public string Provider { get; set; } = "minio";

    /// <summary>Bucket / container name.</summary>
    public string Bucket { get; set; } = "";

    /// <summary>Signed-URL lifetime in seconds (default 15 min).</summary>
    public int SignedUrlTtlSeconds { get; set; } = 900;

    // --- S3 / MinIO ---
    public string? Endpoint { get; set; }        // null for AWS; e.g. http://minio:9000 for MinIO
    public bool ForcePathStyle { get; set; }     // true for MinIO and most S3-compatible stores
    public string? Region { get; set; }          // e.g. us-east-1 (AWS)
    public string? AccessKey { get; set; }        // omit on AWS to use the instance IAM role
    public string? SecretKey { get; set; }

    // --- Azure Blob ---
    public string? AzureConnectionString { get; set; }
    public string? AzureContainer { get; set; }

    // --- Google Cloud Storage ---
    public string? GcsProjectId { get; set; }
    public string? GcsCredentialsPath { get; set; }   // path to a service-account JSON key

    public TimeSpan SignedUrlTtl => TimeSpan.FromSeconds(SignedUrlTtlSeconds);
}
