namespace Atrium.Api.Domain;

/// <summary>The top isolation boundary. One company = one workspace.</summary>
public class Tenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Space> Spaces { get; set; } = new List<Space>();
}
