using System.Net;
using System.Net.Sockets;

namespace Atrium.Api.Endpoints;

/// <summary>
/// Migration helper: fetch a public page server-side so the browser can import
/// it without hitting CORS. Authenticated SharePoint pages won't be reachable
/// anonymously — for those, the client offers a "paste HTML / CSV" path instead.
/// </summary>
public static class ImportEndpoints
{
    private static readonly HttpClient Http = new(new SocketsHttpHandler
    {
        AllowAutoRedirect = true,
        MaxAutomaticRedirections = 5,
        ConnectTimeout = TimeSpan.FromSeconds(8),
    })
    { Timeout = TimeSpan.FromSeconds(15) };

    public record FetchUrlRequest(string Url);

    public static void MapImportEndpoints(this WebApplication app)
    {
        app.MapPost("/api/import/url", async (FetchUrlRequest req) =>
        {
            if (string.IsNullOrWhiteSpace(req.Url) ||
                !Uri.TryCreate(req.Url, UriKind.Absolute, out var uri))
                return Results.BadRequest(new { error = "Provide an absolute http(s) URL." });

            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
                return Results.BadRequest(new { error = "Only http and https URLs are allowed." });

            if (!await IsPublicHostAsync(uri.Host))
                return Results.BadRequest(new { error = "That host resolves to a private/loopback address and can't be fetched." });

            try
            {
                using var msg = new HttpRequestMessage(HttpMethod.Get, uri);
                msg.Headers.TryAddWithoutValidation("User-Agent", "AtriumImporter/1.0 (+migration)");
                using var resp = await Http.SendAsync(msg, HttpCompletionOption.ResponseHeadersRead);

                var ctype = resp.Content.Headers.ContentType?.MediaType ?? "";
                if (!ctype.Contains("html") && !ctype.Contains("text") && !ctype.Contains("xml") && ctype != "")
                    return Results.BadRequest(new { error = $"Unsupported content type '{ctype}'. Import expects an HTML/text page." });

                // cap the body so a giant page can't exhaust memory
                var bytes = await resp.Content.ReadAsByteArrayAsync();
                const int cap = 4 * 1024 * 1024;
                var html = System.Text.Encoding.UTF8.GetString(bytes, 0, Math.Min(bytes.Length, cap));

                return Results.Ok(new { finalUrl = resp.RequestMessage?.RequestUri?.ToString() ?? uri.ToString(),
                    status = (int)resp.StatusCode, html });
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = $"Couldn't fetch the page: {ex.Message}" });
            }
        });
    }

    // Block SSRF to loopback / private / link-local / unique-local ranges.
    private static async Task<bool> IsPublicHostAsync(string host)
    {
        try
        {
            IPAddress[] addrs = IPAddress.TryParse(host, out var ip)
                ? new[] { ip }
                : await Dns.GetHostAddressesAsync(host);
            if (addrs.Length == 0) return false;
            foreach (var a in addrs) if (!IsPublic(a)) return false;
            return true;
        }
        catch { return false; }
    }

    private static bool IsPublic(IPAddress a)
    {
        if (IPAddress.IsLoopback(a)) return false;
        if (a.AddressFamily == AddressFamily.InterNetwork)
        {
            var b = a.GetAddressBytes();
            if (b[0] == 10) return false;                                  // 10.0.0.0/8
            if (b[0] == 172 && b[1] >= 16 && b[1] <= 31) return false;     // 172.16.0.0/12
            if (b[0] == 192 && b[1] == 168) return false;                  // 192.168.0.0/16
            if (b[0] == 169 && b[1] == 254) return false;                  // 169.254.0.0/16 link-local
            if (b[0] == 127) return false;
            if (b[0] == 0) return false;
            return true;
        }
        if (a.AddressFamily == AddressFamily.InterNetworkV6)
        {
            if (a.IsIPv6LinkLocal || a.IsIPv6SiteLocal) return false;
            var b = a.GetAddressBytes();
            if ((b[0] & 0xfe) == 0xfc) return false;                       // fc00::/7 unique-local
            return true;
        }
        return false;
    }
}
