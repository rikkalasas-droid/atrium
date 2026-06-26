namespace Atrium.Api.Domain;

/// <summary>The pointer/stub model: file METADATA lives here in Postgres, the
/// BYTES live in the customer's object store. StorageKey is the pointer.</summary>
public class StoredFile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? ItemId { get; set; }                          // the Item (Type=File) this backs, if any
    public Guid? BlockId { get; set; }                         // or the Block (e.g. an image element) it belongs to
    public string FileName { get; set; } = "";                 // original name, for friendly downloads
    public string StorageProvider { get; set; } = "";          // s3 | azure | gcs | minio | fs
    public string StorageKey { get; set; } = "";               // pointer to the bytes
    public string ContentType { get; set; } = "application/octet-stream";
    public long SizeBytes { get; set; }
    public string? Checksum { get; set; }
    public string? VersionLabel { get; set; }
    public string Status { get; set; } = "Pending";            // Pending | Available
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
