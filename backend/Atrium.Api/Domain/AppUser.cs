namespace Atrium.Api.Domain;

/// <summary>Local user record. Authentication is federated (Keycloak) later;
/// ExternalSubject links this row to the IdP subject.</summary>
public class AppUser
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? ExternalSubject { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
