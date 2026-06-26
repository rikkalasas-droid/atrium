namespace Atrium.Api.Domain;

/// <summary>The kind of content an Item represents. Everything is an Item.</summary>
public enum ItemType { Page, Document, ListView, ListRow, Tile, File, Folder }

/// <summary>The kind of composable Block inside a page/document (tiles are blocks too).</summary>
public enum BlockType { Paragraph, Heading, Image, Embed, Tile, Divider, Checklist, File, Callout, Board }

/// <summary>Role granted on a Space (or, as an exception, a single Item).</summary>
public enum MemberRole { Owner, Editor, Commenter, Viewer }

/// <summary>Who a permission grant targets.</summary>
public enum PrincipalType { User, Group }
