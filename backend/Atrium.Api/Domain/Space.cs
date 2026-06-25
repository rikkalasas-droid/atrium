namespace Atrium.Api.Domain;

/// <summary>A flat, peer-level area (team / project / department).
/// No deep nesting — spaces connect via tags/links, not parent-child trees.</summary>
public class Space
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Item> Items { get; set; } = new List<Item>();
    public ICollection<SpaceMembership> Memberships { get; set; } = new List<SpaceMembership>();
}
