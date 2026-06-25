using Atrium.Api.Data;
using Atrium.Api.Domain;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

// Register the data layer against PostgreSQL (connection string from env).
builder.Services.AddDbContext<AtriumDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));

var app = builder.Build();
app.UseCors();

// Apply migrations on startup (dev convenience). Restart policy retries if the
// DB isn't up yet on first boot.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AtriumDbContext>();
    db.Database.Migrate();
}

// ---- health & info ----
app.MapGet("/", () => Results.Ok(new { service = "atrium-api", status = "ok" }));
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.MapGet("/ready", async (AtriumDbContext db) =>
    await db.Database.CanConnectAsync()
        ? Results.Ok(new { status = "ready", db = "reachable" })
        : Results.Json(new { status = "degraded", reason = "db unreachable" }, statusCode: 503));

app.MapGet("/api/info", () => Results.Ok(new
{
    name = "Atrium",
    tagline = "Everything, under one roof.",
    version = Environment.GetEnvironmentVariable("ATRIUM_VERSION") ?? "0.1.0-dev"
}));

// ---- DEV: seed a demo workspace so you can see the data layer working ----
app.MapPost("/api/dev/seed", async (AtriumDbContext db) =>
{
    var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Slug == "demo");
    if (tenant is null)
    {
        tenant = new Tenant { Name = "Demo Co", Slug = "demo" };
        db.Tenants.Add(tenant);
    }

    var space = await db.Spaces.FirstOrDefaultAsync(s => s.TenantId == tenant.Id && s.Slug == "home");
    if (space is null)
    {
        space = new Space { TenantId = tenant.Id, Name = "Company Home", Slug = "home", Icon = "home" };
        db.Spaces.Add(space);

        var page = new Item
        {
            TenantId = tenant.Id, SpaceId = space.Id, Type = ItemType.Page,
            Title = "Welcome to Atrium"
        };
        page.Blocks.Add(new Block { TenantId = tenant.Id, Type = BlockType.Heading,
            Position = 0, ContentJson = "{\"text\":\"Welcome\"}" });
        page.Blocks.Add(new Block { TenantId = tenant.Id, Type = BlockType.Paragraph,
            Position = 1, ContentJson = "{\"text\":\"Everything, under one roof.\"}" });
        db.Items.Add(page);
    }

    await db.SaveChangesAsync();
    return Results.Ok(new { tenant = tenant.Slug, spaceId = space.Id });
});

// ---- read endpoints: prove persistence round-trips ----
app.MapGet("/api/spaces", async (AtriumDbContext db) =>
    await db.Spaces.OrderBy(s => s.Name)
        .Select(s => new { s.Id, s.Name, s.Slug, s.Icon })
        .ToListAsync());

app.MapGet("/api/spaces/{spaceId:guid}/items", async (Guid spaceId, AtriumDbContext db) =>
    await db.Items.Where(i => i.SpaceId == spaceId)
        .OrderByDescending(i => i.UpdatedAt)
        .Select(i => new { i.Id, type = i.Type.ToString(), i.Title, i.CurrentVersion, i.UpdatedAt })
        .ToListAsync());

app.MapGet("/api/items/{itemId:guid}", async (Guid itemId, AtriumDbContext db) =>
{
    var item = await db.Items
        .Include(i => i.Blocks.OrderBy(bl => bl.Position))
        .FirstOrDefaultAsync(i => i.Id == itemId);

    return item is null
        ? Results.NotFound()
        : Results.Ok(new
        {
            item.Id, type = item.Type.ToString(), item.Title, item.CurrentVersion,
            blocks = item.Blocks.OrderBy(bl => bl.Position)
                .Select(bl => new { bl.Id, type = bl.Type.ToString(), bl.Position, bl.ContentJson })
        });
});

app.Run();
