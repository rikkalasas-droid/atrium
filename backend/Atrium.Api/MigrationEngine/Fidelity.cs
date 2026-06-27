namespace Atrium.Api.MigrationEngine;

/// <summary>How well a SharePoint construct survives translation into Atrium.</summary>
public enum Severity { OK = 0, INFO = 1, LOSSY = 2, BLOCKED = 3 }

public sealed class Finding
{
    public Severity Severity { get; init; }
    public string Category { get; init; } = "";   // e.g. "managed-metadata", "permissions", "versions"
    public string SourceRef { get; init; } = "";   // what in SharePoint this is about
    public string Message { get; init; } = "";
}

/// <summary>The fidelity ledger: an honest, itemised account of every degradation.</summary>
public sealed class FidelityReport
{
    public List<Finding> Findings { get; } = new();

    public void Add(Severity severity, string category, string sourceRef, string message)
        => Findings.Add(new Finding { Severity = severity, Category = category, SourceRef = sourceRef, Message = message });

    public Dictionary<Severity, int> Counts()
    {
        var c = new Dictionary<Severity, int>
        {
            [Severity.OK] = 0, [Severity.INFO] = 0, [Severity.LOSSY] = 0, [Severity.BLOCKED] = 0,
        };
        foreach (var f in Findings) c[f.Severity]++;
        return c;
    }

    public Severity Worst()
        => Findings.Count == 0 ? Severity.OK : Findings.Max(f => f.Severity);
}
