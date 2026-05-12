import { useState } from "react";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { useNavigate } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { UserIcon } from "lucide-react";
import { toast } from "sonner";

export default function CreateGroupPage() {
  const navigate = useNavigate();
  const allUsers = useQuery(api.admin.listUsers, {});
  const createGroupChat = useMutation(api.chats.createGroupChat);

  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Id<"users">[]>([]);

  const toggleUserSelection = (userId: Id<"users">) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      toast.error("Моля попълнете името и изберете поне един участник");
      return;
    }

    try {
      await createGroupChat({
        name: groupName,
        participantIds: selectedUsers,
      });
      toast.success("Групата е създадена успешно");
      navigate("/bg/messages");
    } catch (error) {
      toast.error("Грешка при създаване на групата");
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Създай група</h1>
            <p className="text-sm text-muted-foreground">
              Създай групов чат с избрани потребители
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/bg/messages")}>
            Отказ
          </Button>
        </div>

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
                        <p className="font-medium text-sm">{user.name}</p>
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

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/bg/messages")}>
            Отказ
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!groupName.trim() || selectedUsers.length === 0}
          >
            Създай група
          </Button>
        </div>
      </div>
    </Layout>
  );
}
