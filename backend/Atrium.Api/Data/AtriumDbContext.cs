using Atrium.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Atrium.Api.Data;

public class AtriumDbContext : DbContext
{
    public AtriumDbContext(DbContextOptions<AtriumDbContext> options) : base(options) { }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Space> Spaces => Set<Space>();
    public DbSet<SpaceMembership> SpaceMemberships => Set<SpaceMembership>();
    public DbSet<Item> Items => Set<Item>();
    public DbSet<Block> Blocks => Set<Block>();
    public DbSet<ItemVersion> ItemVersions => Set<ItemVersion>();
    public DbSet<StoredFile> StoredFiles => Set<StoredFile>();
    public DbSet<ResourceGrant> ResourceGrants => Set<ResourceGrant>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        // ---- Tenant ----
        b.Entity<Tenant>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique();
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Slug).HasMaxLength(80);
        });

        // ---- AppUser ----
        b.Entity<AppUser>(e =>
        {
            e.HasIndex(x => new { x.TenantId, x.Email }).IsUnique();
            e.HasIndex(x => x.ExternalSubject);
            e.Property(x => x.Email).HasMaxLength(320);
            e.Property(x => x.DisplayName).HasMaxLength(200);
        });

        // ---- Space ----
        b.Entity<Space>(e =>
        {
            e.HasIndex(x => new { x.TenantId, x.Slug }).IsUnique();
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Slug).HasMaxLength(80);
            e.HasMany(x => x.Items).WithOne().HasForeignKey(i => i.SpaceId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Memberships).WithOne().HasForeignKey(m => m.SpaceId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ---- SpaceMembership ----
        b.Entity<SpaceMembership>(e =>
        {
            e.HasIndex(x => new { x.SpaceId, x.UserId }).IsUnique();
            e.Property(x => x.Role).HasConversion<string>().HasMaxLength(20);
        });

        // ---- Item ----
        b.Entity<Item>(e =>
        {
            e.HasIndex(x => new { x.TenantId, x.SpaceId });
            e.HasIndex(x => x.ParentItemId);
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Title).HasMaxLength(500);
            e.Property(x => x.FieldsJson).HasColumnType("jsonb");
            e.HasMany(x => x.Blocks).WithOne().HasForeignKey(bl => bl.ItemId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne<Item>().WithMany().HasForeignKey(x => x.ParentItemId)
                .OnDelete(DeleteBehavior.Restrict);
            // soft delete: hide deleted items by default
            e.HasQueryFilter(x => x.DeletedAt == null);
        });

        // ---- Block ----
        b.Entity<Block>(e =>
        {
            e.HasIndex(x => new { x.ItemId, x.Position });
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.ContentJson).HasColumnType("jsonb");
            e.HasOne<Block>().WithMany().HasForeignKey(x => x.ParentBlockId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ---- ItemVersion ----
        b.Entity<ItemVersion>(e =>
        {
            e.HasIndex(x => new { x.ItemId, x.VersionNumber }).IsUnique();
            e.Property(x => x.Title).HasMaxLength(500);
            e.Property(x => x.SnapshotJson).HasColumnType("jsonb");
        });

        // ---- StoredFile ----
        b.Entity<StoredFile>(e =>
        {
            e.HasIndex(x => x.ItemId);
            e.HasIndex(x => x.BlockId);
            e.Property(x => x.FileName).HasMaxLength(400);
            e.Property(x => x.StorageProvider).HasMaxLength(20);
            e.Property(x => x.StorageKey).HasMaxLength(1024);
            e.Property(x => x.ContentType).HasMaxLength(200);
            e.Property(x => x.Status).HasMaxLength(20);
        });

        // ---- ResourceGrant ----
        b.Entity<ResourceGrant>(e =>
        {
            e.HasIndex(x => x.ItemId);
            e.Property(x => x.PrincipalType).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Role).HasConversion<string>().HasMaxLength(20);
        });
    }
}
