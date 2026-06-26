namespace Atrium.Api.Contracts;

public record CreateSpaceRequest(string Name, string? Slug, string? Description, string? Icon);
public record UpdateSpaceRequest(string? Name, string? Description, string? Icon);

public record BlockInput(string Type, int Position, string? ContentJson, Guid? ParentBlockId);

public record CreateItemRequest(string Title, string? Type, string? FieldsJson, List<BlockInput>? Blocks);
public record UpdateItemRequest(string? Title, string? FieldsJson);

public record CreateBlockRequest(string Type, int? Position, string? ContentJson, Guid? ParentBlockId);
public record UpdateBlockRequest(string? Type, int? Position, string? ContentJson);
public record ReplaceBlocksRequest(List<BlockInput> Blocks);
