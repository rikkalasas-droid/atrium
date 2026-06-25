namespace Atrium.Api.Domain;

/// <summary>First-class version history. Every edit snapshots the item + blocks
/// with author + timestamp — the migration story and SharePoint parity depend on
/// preserving full history.</summary>
public class ItemVersion
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ItemId { get; set; }
    public int VersionNumber { get; set; }
    public string Title { get; set; } = "";
    public string? SnapshotJson { get; set; }     // jsonb: full item+blocks snapshot
    public Guid? AuthorId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
