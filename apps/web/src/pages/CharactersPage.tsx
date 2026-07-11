import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Character {
  key: string;
  label: string;
  hasImage: boolean;
  url: string | null;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CharactersPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["characters"],
    queryFn: () => api.get<{ characters: Character[] }>("/api/characters"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">캐릭터</h1>
        <p className="text-sm text-muted-foreground">
          6종 캐릭터 레퍼런스를 업로드하면, 글 이미지에 사람이 등장할 때 이 캐릭터를 일관되게
          사용합니다. (정면·측면이 함께 있는 캐릭터 시트 이미지를 권장)
        </p>
      </div>

      {query.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="text-sm text-destructive">캐릭터를 불러오지 못했습니다.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.characters.map((character) => (
            <CharacterSlot
              key={character.key}
              character={character}
              onChanged={() => queryClient.invalidateQueries({ queryKey: ["characters"] })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CharacterSlot({
  character,
  onChanged,
}: {
  character: Character;
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/characters/${character.key}`),
    onSuccess: () => {
      toast.success(`${character.label} 삭제`);
      onChanged();
    },
  });

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      await api.put(`/api/characters/${character.key}`, { dataUrl });
      toast.success(`${character.label} 업로드 완료`);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{character.label}</span>
          <span className="text-xs text-muted-foreground">{character.key}</span>
        </div>
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
          {character.url ? (
            <img src={character.url} alt={character.label} className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-muted-foreground">미등록</span>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFile(file);
            event.target.value = "";
          }}
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {character.hasImage ? "교체" : "업로드"}
          </Button>
          {character.hasImage && (
            <Button
              variant="ghost"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
