namespace Atrium.Api.Domain;

/// <summary>A composable unit inside a page/document. A page is an ordered tree
/// of blocks; tiles on a dashboard are blocks too. ContentJson (jsonb) holds the
/// block-specific data (text, tile config, etc.).</summary>
public class Block
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ItemId { get; set; }
    public Guid? ParentBlockId { get; set; }      // block tree (nesting)
    public BlockType Type { get; set; }
    public int Position { get; set; }
    public string? ContentJson { get; set; }      // jsonb
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
