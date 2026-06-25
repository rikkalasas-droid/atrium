namespace Atrium.Api.Domain;

/// <summary>An explicit, visible exception to inheritance on a single Item.
/// Every grant here is enumerable — the opposite of SharePoint's invisible
/// "Limited Access". Enforcement is added with the permission engine.</summary>
public class ResourceGrant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ItemId { get; set; }
    public PrincipalType PrincipalType { get; set; }
    public Guid PrincipalId { get; set; }
    public MemberRole Role { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
