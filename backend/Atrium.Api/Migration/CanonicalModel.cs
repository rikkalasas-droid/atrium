using System.Text.Json;

namespace Atrium.Api.MigrationEngine;

// The provider-neutral shape a reader (Graph for SP Online, CSOM/REST for on-prem)
// produces. The mapper consumes only this — neither reader leaks its origin.
// Mirrors fixtures/contoso-hr.json and §4 of the migration design.

public sealed class SourceDump
{
    public SiteInfo Site { get; set; } = new();
    public List<SourcePrincipal> Principals { get; set; } = new();
    public List<Library> Libraries { get; set; } = new();
}

public sealed class SiteInfo
{
    public string Id { get; set; } = "";
    public string Url { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public string? SourceSystem { get; set; }
}

public sealed class SourcePrincipal
{
    public string Login { get; set; } = "";
    public string? DisplayName { get; set; }
    public string? Email { get; set; }
    public string Type { get; set; } = "User";   // User | SharePointGroup | SecurityGroup
}

public sealed class Library
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string ServerRelativeUrl { get; set; } = "";
    public bool RootHasUniquePermissions { get; set; }
    public List<RoleAssignment> RoleAssignments { get; set; } = new();
    public List<Column> Columns { get; set; } = new();
    public List<SourceDocument> Documents { get; set; } = new();
}

public sealed class Column
{
    public string InternalName { get; set; } = "";
    public string? DisplayName { get; set; }
    public string Type { get; set; } = "Text";
    public string? TermSetId { get; set; }
    public string? LookupList { get; set; }
    public bool ReadOnly { get; set; }
    public bool Required { get; set; }
}

public sealed class SourceDocument
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string ServerRelativeUrl { get; set; } = "";
    public string? FolderPath { get; set; }
    public long Size { get; set; }
    public string? ContentHash { get; set; }
    public string? Created { get; set; }
    public string? Modified { get; set; }
    public string? CreatedBy { get; set; }
    public string? ModifiedBy { get; set; }
    public string? CheckedOutBy { get; set; }
    public string? ContentType { get; set; }
    public bool HasUniquePermissions { get; set; }
    public List<RoleAssignment> RoleAssignments { get; set; } = new();
    public Dictionary<string, JsonElement> Fields { get; set; } = new();
    public List<FileVersion> Versions { get; set; } = new();
}

public sealed class FileVersion
{
    public string? Label { get; set; }
    public string? Modified { get; set; }
    public string? ModifiedBy { get; set; }
    public long Size { get; set; }
    public bool IsCurrent { get; set; }
    public string? Comment { get; set; }
}

public sealed class RoleAssignment
{
    public PrincipalRef Principal { get; set; } = new();
    public List<string> Roles { get; set; } = new();
}

public sealed class PrincipalRef
{
    public string Login { get; set; } = "";
    public string? DisplayName { get; set; }
    public string Type { get; set; } = "User";
}
