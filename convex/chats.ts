import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import { buildUserName } from "./users.js";
import { internal } from "./_generated/api.js";

// Get all chats for current user
export const listChats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Get all chats where user is a participant
    const allChats = await ctx.db.query("chats").collect();
    const userChats = allChats.filter((chat) =>
      chat.participantIds.includes(currentUser._id),
    );

    // Enrich chats with last message and participant info
    const enrichedChats = await Promise.all(
      userChats.map(async (chat) => {
        // Get last message
        const lastMessage = await ctx.db
          .query("chatMessages")
          .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
          .order("desc")
          .first();

        // Get participants info
        const participants = await Promise.all(
          chat.participantIds.map(async (userId) => {
            const user = await ctx.db.get(userId);
            let avatarUrl = null;
            if (user?.avatarStorageId) {
              avatarUrl = await ctx.storage.getUrl(user.avatarStorageId);
            }
            return {
              _id: user?._id,
              name: buildUserName(user),
              email: user?.email,
              avatarUrl,
            };
          }),
        );

        // For direct chats, get the other participant
        let chatName = chat.name;
        let chatAvatar = null;
        
        // Get group chat image if available
        if (chat.imageStorageId) {
          chatAvatar = await ctx.storage.getUrl(chat.imageStorageId);
        }
        
        if (chat.type === "direct") {
          const otherParticipant = participants.find(
            (p) => p._id !== currentUser._id,
          );
          chatName = otherParticipant?.name || "-";
          chatAvatar = otherParticipant?.avatarUrl;
        }

        // Count unread messages
        const unreadCount = (
          await ctx.db
            .query("chatMessages")
            .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
            .collect()
        ).filter((msg) => !msg.readBy.includes(currentUser._id)).length;

        return {
          ...chat,
          chatName,
          chatAvatar,
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                _creationTime: lastMessage._creationTime,
                senderId: lastMessage.senderId,
              }
            : null,
          participants,
          unreadCount,
        };
      }),
    );

    // Sort by last message time
    return enrichedChats.sort((a, b) => {
      const aTime = a.lastMessage?._creationTime || a._creationTime;
      const bTime = b.lastMessage?._creationTime || b._creationTime;
      return bTime - aTime;
    });
  },
});

// Get messages for a specific chat
export const getChatMessages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Check if user is a participant
    const chat = await ctx.db.get(args.chatId);
    if (!chat || !chat.participantIds.includes(currentUser._id)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Not a participant in this chat",
      });
    }

    // Get all messages
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();

    // Enrich with sender info and attachment URLs
    const enrichedMessages = await Promise.all(
      messages.map(async (msg) => {
        const sender = await ctx.db.get(msg.senderId);
        let avatarUrl = null;
        if (sender?.avatarStorageId) {
          avatarUrl = await ctx.storage.getUrl(sender.avatarStorageId);
        }
        
        // Get attachment URLs
        let attachmentsWithUrls: Array<{
          storageId: string;
          fileName: string;
          fileType: string;
          fileSize: number;
          url: string | null;
        }> | undefined = undefined;
        
        if (msg.attachments && msg.attachments.length > 0) {
          attachmentsWithUrls = await Promise.all(
            msg.attachments.map(async (att) => ({
              storageId: att.storageId,
              fileName: att.fileName,
              fileType: att.fileType,
              fileSize: att.fileSize,
              url: await ctx.storage.getUrl(att.storageId),
            }))
          );
        }
        
        return {
          ...msg,
          attachmentsWithUrls,
          sender: {
            _id: sender?._id,
            name: sender?.name,
            email: sender?.email,
            avatarUrl,
          },
        };
      }),
    );

    return enrichedMessages;
  },
});

// Send a message
export const sendMessage = mutation({
  args: {
    chatId: v.id("chats"),
    content: v.string(),
    attachments: v.optional(v.array(v.object({
      storageId: v.id("_storage"),
      fileName: v.string(),
      fileType: v.string(),
      fileSize: v.number(),
    }))),
  },
  handler: async (ctx, args): Promise<Id<"chatMessages">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Check if user is a participant
    const chat = await ctx.db.get(args.chatId);
    if (!chat || !chat.participantIds.includes(currentUser._id)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Not a participant in this chat",
      });
    }

    // ✅ PLATFORM SETTINGS: Check if user can send messages
    if (currentUser.schoolId) {
      const canSendCheck = await ctx.runQuery(internal.platformSettings.checkCanSendMessages, {
        schoolId: currentUser.schoolId,
        userId: currentUser._id,
      });
      if (!canSendCheck.canSend) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: canSendCheck.message || "Нямате право да изпращате съобщения.",
        });
      }
    }

    // Create message
    const messageId = await ctx.db.insert("chatMessages", {
      chatId: args.chatId,
      senderId: currentUser._id,
      content: args.content,
      readBy: [currentUser._id], // Mark as read by sender
      attachments: args.attachments,
    });

    // Update chat's lastMessageAt
    await ctx.db.patch(args.chatId, {
      lastMessageAt: Date.now(),
    });

    return messageId;
  },
});

// Mark messages as read
export const markAsRead = mutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Get all unread messages in this chat
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();

    const unreadMessages = messages.filter(
      (msg) => !msg.readBy.includes(currentUser._id),
    );

    // Mark as read
    for (const msg of unreadMessages) {
      await ctx.db.patch(msg._id, {
        readBy: [...msg.readBy, currentUser._id],
      });
    }
  },
});

// Create or get direct chat
export const getOrCreateDirectChat = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args): Promise<Id<"chats">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Check if direct chat already exists
    const allChats = await ctx.db.query("chats").collect();
    const existingChat = allChats.find(
      (chat) =>
        chat.type === "direct" &&
        chat.participantIds.length === 2 &&
        chat.participantIds.includes(currentUser._id) &&
        chat.participantIds.includes(args.otherUserId),
    );

    if (existingChat) {
      return existingChat._id;
    }

    // Create new direct chat
    const chatId = await ctx.db.insert("chats", {
      type: "direct",
      participantIds: [currentUser._id, args.otherUserId],
      createdBy: currentUser._id,
      schoolId: currentUser.schoolId,
    });

    return chatId;
  },
});

// Create group chat
export const createGroupChat = mutation({
  args: {
    name: v.string(),
    participantIds: v.array(v.id("users")),
  },
  handler: async (ctx, args): Promise<Id<"chats">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // ✅ SECURITY FIX: Validate all participants are from the same school
    if (currentUser.schoolId) {
      const participants = await Promise.all(
        args.participantIds.map(id => ctx.db.get(id))
      );
      
      for (const participant of participants) {
        if (!participant) {
          throw new ConvexError({
            code: "NOT_FOUND",
            message: "Един или повече потребители не са намерени",
          });
        }
        
        if (participant.schoolId !== currentUser.schoolId) {
          throw new ConvexError({
            code: "FORBIDDEN",
            message: "Можете да добавяте само потребители от вашето училище",
          });
        }
      }
    }

    // Ensure creator is in participants
    const participants = args.participantIds.includes(currentUser._id)
      ? args.participantIds
      : [currentUser._id, ...args.participantIds];

    // Create group chat
    const chatId = await ctx.db.insert("chats", {
      type: "group",
      name: args.name,
      participantIds: participants,
      createdBy: currentUser._id,
      schoolId: currentUser.schoolId,
    });

    return chatId;
  },
});

// Get unread count for all chats
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return 0;
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!currentUser) {
      return 0;
    }

    // Get all chats where user is a participant
    const allChats = await ctx.db.query("chats").collect();
    const userChats = allChats.filter((chat) =>
      chat.participantIds.includes(currentUser._id),
    );

    let totalUnread = 0;
    for (const chat of userChats) {
      const messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
        .collect();
      const unreadCount = messages.filter(
        (msg) => !msg.readBy.includes(currentUser._id),
      ).length;
      totalUnread += unreadCount;
    }

    return totalUnread;
  },
});

// Generate upload URL for group image
export const generateGroupImageUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    return await ctx.storage.generateUploadUrl();
  },
});

// Generate upload URL for chat file attachments
export const generateFileUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    return await ctx.storage.generateUploadUrl();
  },
});

// Update group image
export const updateGroupImage = mutation({
  args: {
    chatId: v.id("chats"),
    imageStorageId: v.id("_storage"),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Check if user is a participant and not a student
    const chat = await ctx.db.get(args.chatId);
    if (!chat || !chat.participantIds.includes(currentUser._id)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Not a participant in this chat",
      });
    }

    // Check if user is a student
    if (currentUser.roles?.includes("student")) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Students cannot upload group images",
      });
    }

    // Check if it's a group chat
    if (chat.type !== "group") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Can only update image for group chats",
      });
    }

    // Update the chat image
    await ctx.db.patch(args.chatId, {
      imageStorageId: args.imageStorageId,
    });
  },
});
