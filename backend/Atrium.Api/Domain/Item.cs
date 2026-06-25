namespace Atrium.Api.Domain;

/// <summary>The universal content node. A page, document, list, list-row, tile,
/// or file — distinguished by Type. FieldsJson holds flexible typed metadata
/// (jsonb) so new fields need no schema migration.</summary>
public class Item
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid SpaceId { get; set; }
    public Guid? ParentItemId { get; set; }      // e.g. a ListRow under a ListView
    public ItemType Type { get; set; }
    public string Title { get; set; } = "";
    public string? FieldsJson { get; set; }       // jsonb: schema-light metadata
    public Guid? CreatedById { get; set; }
    public int CurrentVersion { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DeletedAt { get; set; }      // soft delete

    public ICollection<Block> Blocks { get; set; } = new List<Block>();
}
