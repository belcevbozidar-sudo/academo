import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import { 
  UserIcon, 
  SendIcon, 
  PlusIcon, 
  SearchIcon, 
  UsersIcon, 
  MessageCircleIcon, 
  MenuIcon, 
  XIcon, 
  BoldIcon, 
  ItalicIcon, 
  ImageIcon, 
  ArrowLeftIcon,
  PaperclipIcon,
  FileIcon,
  FileTextIcon,
  FileImageIcon,
  FileVideoIcon,
  FileAudioIcon,
  DownloadIcon,
  Loader2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";
import { format } from "date-fns";
import { bg } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { useNavigate, useParams } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { formatFullName } from "@/lib/utils.ts";
import DOMPurify from "dompurify";

// Configure DOMPurify for safe HTML rendering
const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'],
    ALLOWED_ATTR: [],
  });
};

// Helper function to strip HTML tags from text
function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

// Helper function to get file icon based on type
function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return FileImageIcon;
  if (fileType.startsWith("video/")) return FileVideoIcon;
  if (fileType.startsWith("audio/")) return FileAudioIcon;
  if (fileType.includes("pdf")) return FileTextIcon;
  return FileIcon;
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Type for pending attachments
type PendingAttachment = {
  file: File;
  storageId?: Id<"_storage">;
  uploading: boolean;
  error?: string;
};

function MessagesInner() {
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const directChatUserId = searchParams.get("userId");
  
  const chats = useQuery(api.chats.listChats, {});
  const allUsers = useQuery(api.admin.listUsers, {});
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const [selectedChatId, setSelectedChatId] = useState<Id<"chats"> | null>(null);
  const [searchText, setSearchText] = useState("");
  const isMobile = useIsMobile();
  const [showChatsList, setShowChatsList] = useState(isMobile);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Track if we've already handled the direct chat URL parameter
  const [directChatHandled, setDirectChatHandled] = useState(false);
  
  // File attachment state
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Dialog states
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [showImageUploadDialog, setShowImageUploadDialog] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Id<"users">[]>([]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[60px] p-3 border rounded-lg",
      },
    },
  });

  const messages = useQuery(
    api.chats.getChatMessages,
    selectedChatId ? { chatId: selectedChatId } : "skip",
  );
  const sendMessage = useMutation(api.chats.sendMessage);
  const markAsRead = useMutation(api.chats.markAsRead);
  const getOrCreateDirectChat = useMutation(api.chats.getOrCreateDirectChat);
  const createGroupChat = useMutation(api.chats.createGroupChat);
  const generateGroupImageUploadUrl = useMutation(api.chats.generateGroupImageUploadUrl);
  const generateFileUploadUrl = useMutation(api.chats.generateFileUploadUrl);
  const updateGroupImage = useMutation(api.chats.updateGroupImage);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark messages as read when opening a chat
  useEffect(() => {
    if (selectedChatId) {
      markAsRead({ chatId: selectedChatId });
    }
  }, [selectedChatId, markAsRead]);

  // Handle direct chat from URL parameter (e.g., /messages?userId=xxx)
  useEffect(() => {
    const handleDirectChat = async () => {
      if (directChatUserId && !directChatHandled && chats !== undefined) {
        setDirectChatHandled(true);
        try {
          const chatId = await getOrCreateDirectChat({ otherUserId: directChatUserId as Id<"users"> });
          setSelectedChatId(chatId);
          if (isMobile) {
            setShowChatsList(false);
          }
          // Clear the URL parameter after handling
          window.history.replaceState({}, "", `/${lng}/messages`);
        } catch (error) {
          console.error("Error opening direct chat:", error);
          toast.error("Грешка при отваряне на чат");
        }
      }
    };
    handleDirectChat();
  }, [directChatUserId, directChatHandled, chats, getOrCreateDirectChat, isMobile, lng]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: PendingAttachment[] = Array.from(files).map(file => ({
      file,
      uploading: true,
    }));
    
    setPendingAttachments(prev => [...prev, ...newAttachments]);
    setIsUploading(true);

    // Upload each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const uploadUrl = await generateFileUploadUrl({});
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await result.json();
        
        setPendingAttachments(prev => prev.map(att => 
          att.file === file 
            ? { ...att, storageId, uploading: false }
            : att
        ));
      } catch (error) {
        setPendingAttachments(prev => prev.map(att => 
          att.file === file 
            ? { ...att, uploading: false, error: "Грешка при качване" }
            : att
        ));
        toast.error(`Грешка при качване на ${file.name}`);
      }
    }
    
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor || !selectedChatId) return;
    
    const content = editor.getHTML();
    const hasContent = content && content !== "<p></p>";
    const hasAttachments = pendingAttachments.some(att => att.storageId);
    
    if (!hasContent && !hasAttachments) return;
    
    // Check if any attachments are still uploading
    if (pendingAttachments.some(att => att.uploading)) {
      toast.error("Моля, изчакайте качването на файловете да завърши");
      return;
    }

    // Prepare attachments
    const attachments = pendingAttachments
      .filter(att => att.storageId)
      .map(att => ({
        storageId: att.storageId!,
        fileName: att.file.name,
        fileType: att.file.type || "application/octet-stream",
        fileSize: att.file.size,
      }));

    try {
      await sendMessage({
        chatId: selectedChatId,
        content: hasContent ? content : "",
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      editor.commands.clearContent();
      setPendingAttachments([]);
    } catch (error) {
      toast.error("Грешка при изпращане на съобщението");
    }
  };

  const handleStartDirectChat = async (userId: Id<"users">) => {
    try {
      const chatId = await getOrCreateDirectChat({ otherUserId: userId });
      setSelectedChatId(chatId);
      setShowNewChatDialog(false);
      if (isMobile) {
        setShowChatsList(false);
      }
    } catch (error) {
      toast.error("Грешка при създаване на чат");
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    try {
      const chatId = await createGroupChat({
        name: groupName,
        participantIds: selectedUsers,
      });
      setSelectedChatId(chatId);
      setShowGroupDialog(false);
      setGroupName("");
      setSelectedUsers([]);
      if (isMobile) {
        setShowChatsList(false);
      }
    } catch (error) {
      toast.error("Грешка при създаване на група");
    }
  };

  const toggleUserSelection = (userId: Id<"users">) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChatId) return;
    
    try {
      const uploadUrl = await generateGroupImageUploadUrl({});
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await result.json();
      await updateGroupImage({ chatId: selectedChatId, imageStorageId: storageId });
      setShowImageUploadDialog(false);
      toast.success("Снимката е качена успешно");
    } catch (error) {
      toast.error("Грешка при качване на снимка");
    }
  };

  const selectedChat = chats?.find((chat) => chat._id === selectedChatId);

  const filteredChats = chats?.filter((chat) =>
    chat.chatName?.toLowerCase().includes(searchText.toLowerCase()),
  );

  if (chats === undefined || allUsers === undefined || currentUser === undefined) {
    return (
      <Layout>
        <Skeleton className="h-[600px] w-full" />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex h-[calc(100vh-8rem)] gap-4">
        {/* Chats List - hidden on mobile unless showChatsList is true */}
        <div className={`
          ${isMobile 
            ? showChatsList 
              ? "fixed inset-0 z-50 bg-background" 
              : "hidden"
            : "w-80"
          } 
          border-r border-border flex flex-col
        `}>
          <div className="p-4 border-b border-border space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Съобщения</h2>
              <div className="flex gap-2">
                {isMobile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowChatsList(false)}
                  >
                    <XIcon className="h-5 w-5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(`/${lng}/messages/create-group`)}
                >
                  <UsersIcon className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(`/${lng}/messages/new-chat`)}
                >
                  <PlusIcon className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Търси..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-1 p-2">
              {filteredChats && filteredChats.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Няма съобщения
                </div>
              )}
              {filteredChats?.map((chat) => (
                <button
                  key={chat._id}
                  onClick={() => {
                    setSelectedChatId(chat._id);
                    setShowChatsList(false);
                  }}
                  className={`w-full p-3 rounded-lg text-left hover:bg-accent transition-colors ${
                    selectedChatId === chat._id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={chat.chatAvatar || undefined} />
                      <AvatarFallback>
                        {chat.type === "group" ? (
                          <UsersIcon className="h-6 w-6" />
                        ) : (
                          <UserIcon className="h-6 w-6" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold truncate">
                          {chat.chatName || "Без име"}
                        </h3>
                        {chat.lastMessage && (
                          <span className="text-xs text-muted-foreground">
                            {format(
                              new Date(chat.lastMessage._creationTime),
                              "HH:mm",
                            )}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground truncate">
                          {chat.lastMessage?.content ? stripHtml(chat.lastMessage.content) : "Няма съобщения"}
                        </p>
                        {chat.unreadCount > 0 && (
                          <Badge
                            variant="destructive"
                            className="ml-2 h-5 min-w-5 flex items-center justify-center"
                          >
                            {chat.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border flex items-center gap-3">
                {isMobile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowChatsList(true)}
                  >
                    <MenuIcon className="h-5 w-5" />
                  </Button>
                )}
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedChat.chatAvatar || undefined} />
                  <AvatarFallback>
                    {selectedChat.type === "group" ? (
                      <UsersIcon className="h-5 w-5" />
                    ) : (
                      <UserIcon className="h-5 w-5" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="font-semibold">
                    {selectedChat.chatName || "Без име"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedChat.type === "group"
                      ? `${selectedChat.participants.length} участници`
                      : "Директен чат"}
                  </p>
                </div>
                {/* Image upload button for group chats (non-students only) */}
                {selectedChat.type === "group" && 
                  currentUser && 
                  !currentUser.roles?.includes("student") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowImageUploadDialog(true)}
                      title="Качи групова снимка"
                    >
                      <ImageIcon className="h-5 w-5" />
                    </Button>
                  )}
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages?.map((message) => {
                    const isOwnMessage = message.sender._id === currentUser?._id;
                    return (
                      <div
                        key={message._id}
                        className={`flex gap-3 ${isOwnMessage ? "flex-row-reverse" : ""}`}
                      >
                        <Avatar 
                          className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => navigate(`/bg/profile/${message.sender._id}`)}
                        >
                          <AvatarImage
                            src={message.sender.avatarUrl || undefined}
                          />
                          <AvatarFallback>
                            <UserIcon className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={`flex flex-col ${isOwnMessage ? "items-end" : ""}`}
                        >
                          <div
                            className={`rounded-lg p-3 max-w-md ${
                              isOwnMessage
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            {!isOwnMessage && (
                              <p className="text-xs font-semibold mb-1">
                                {formatFullName(message.sender.name)}
                              </p>
                            )}
                            {message.content && message.content !== "<p></p>" && (
                              <div 
                                className="text-sm prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.content) }}
                              />
                            )}
                            {/* Attachments */}
                            {message.attachmentsWithUrls && message.attachmentsWithUrls.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {message.attachmentsWithUrls.map((att, idx) => {
                                  const FileIconComponent = getFileIcon(att.fileType);
                                  const isImage = att.fileType.startsWith("image/");
                                  
                                  return (
                                    <div key={idx}>
                                      {isImage && att.url ? (
                                        <a 
                                          href={att.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="block"
                                        >
                                          <img 
                                            src={att.url} 
                                            alt={att.fileName}
                                            className="max-w-full rounded-md max-h-60 object-cover"
                                          />
                                        </a>
                                      ) : (
                                        <a
                                          href={att.url || "#"}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={`flex items-center gap-2 p-2 rounded-md ${
                                            isOwnMessage 
                                              ? "bg-primary-foreground/10 hover:bg-primary-foreground/20" 
                                              : "bg-background hover:bg-muted"
                                          } transition-colors`}
                                        >
                                          <FileIconComponent className="h-5 w-5 flex-shrink-0" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{att.fileName}</p>
                                            <p className="text-xs opacity-70">{formatFileSize(att.fileSize)}</p>
                                          </div>
                                          <DownloadIcon className="h-4 w-4 flex-shrink-0" />
                                        </a>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground mt-1">
                            {format(
                              new Date(message._creationTime),
                              "HH:mm",
                              { locale: bg },
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Pending Attachments Preview */}
              {pendingAttachments.length > 0 && (
                <div className="px-4 py-2 border-t border-border">
                  <div className="flex flex-wrap gap-2">
                    {pendingAttachments.map((att, idx) => {
                      const FileIconComponent = getFileIcon(att.file.type);
                      return (
                        <div 
                          key={idx}
                          className="flex items-center gap-2 bg-muted p-2 rounded-md"
                        >
                          {att.uploading ? (
                            <Loader2Icon className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileIconComponent className="h-4 w-4" />
                          )}
                          <span className="text-sm truncate max-w-[150px]">{att.file.name}</span>
                          <button 
                            onClick={() => removeAttachment(idx)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <XIcon className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Message Input */}
              <form
                onSubmit={handleSendMessage}
                className="p-4 border-t border-border"
              >
                <div className="space-y-2">
                  {/* Formatting Toolbar */}
                  {editor && (
                    <div className="flex gap-1 pb-2 border-b">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={editor.isActive("bold") ? "bg-accent" : ""}
                      >
                        <BoldIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={editor.isActive("italic") ? "bg-accent" : ""}
                      >
                        <ItalicIcon className="h-4 w-4" />
                      </Button>
                      <div className="flex-1" />
                      {/* File attachment button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        title="Прикачи файл"
                      >
                        <PaperclipIcon className="h-4 w-4" />
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </div>
                  )}
                  
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <EditorContent editor={editor} />
                    </div>
                    {/* Back to chats list button */}
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        setSelectedChatId(null);
                        setShowChatsList(true);
                      }}
                      title="Назад към чатовете"
                    >
                      <ArrowLeftIcon className="h-5 w-5" />
                    </Button>
                    <Button 
                      type="submit" 
                      size="icon"
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <Loader2Icon className="h-5 w-5 animate-spin" />
                      ) : (
                        <SendIcon className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircleIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p>Избери чат за да започнеш разговор</p>
                {isMobile && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setShowChatsList(true)}
                  >
                    <MenuIcon className="h-4 w-4 mr-2" />
                    Покажи чатове
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Direct Chat Dialog */}
      <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Нов чат</DialogTitle>
            <DialogDescription>
              Избери потребител за да започнеш директен чат
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {allUsers
                ?.filter((u) => !u.isDeleted)
                .map((user) => (
                  <button
                    key={user._id}
                    onClick={() => handleStartDirectChat(user._id)}
                    className="w-full p-3 rounded-lg hover:bg-accent flex items-center gap-3"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatarUrl || undefined} />
                      <AvatarFallback>
                        <UserIcon className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="font-semibold">{formatFullName(user.name)}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Create Group Dialog */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Създай група</DialogTitle>
            <DialogDescription>
              Създай групов чат с избрани потребители
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Име на групата</Label>
              <Input
                id="groupName"
                placeholder="Например: Учители 8 клас"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Избери участници</Label>
              <ScrollArea className="h-64 border rounded-lg p-2">
                <div className="space-y-2">
                  {allUsers
                    ?.filter((u) => !u.isDeleted)
                    .map((user) => (
                      <div
                        key={user._id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent"
                      >
                        <Checkbox
                          checked={selectedUsers.includes(user._id)}
                          onCheckedChange={() => toggleUserSelection(user._id)}
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatarUrl || undefined} />
                          <AvatarFallback>
                            <UserIcon className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{formatFullName(user.name)}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
              <p className="text-sm text-muted-foreground">
                Избрани: {selectedUsers.length}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowGroupDialog(false);
                setGroupName("");
                setSelectedUsers([]);
              }}
            >
              Отказ
            </Button>
            <Button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || selectedUsers.length === 0}
            >
              Създай група
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Upload Dialog */}
      <Dialog open={showImageUploadDialog} onOpenChange={setShowImageUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Качи групова снимка</DialogTitle>
            <DialogDescription>
              Изберете снимка за групата
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImageUploadDialog(false);
                if (imageInputRef.current) {
                  imageInputRef.current.value = "";
                }
              }}
            >
              Откажи
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

export default function Messages() {
  return (
    <>
      <AuthLoading>
        <Layout>
          <Skeleton className="h-[600px] w-full" />
        </Layout>
      </AuthLoading>
      <Authenticated>
        <MessagesInner />
      </Authenticated>
    </>
  );
}
