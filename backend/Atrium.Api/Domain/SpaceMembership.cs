namespace Atrium.Api.Domain;

/// <summary>RBAC at the Space level — membership here is the natural security
/// boundary (the SharePoint lesson: manage at the space, not per-item).</summary>
public class SpaceMembership
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid SpaceId { get; set; }
    public Guid UserId { get; set; }
    public MemberRole Role { get; set; } = MemberRole.Viewer;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
