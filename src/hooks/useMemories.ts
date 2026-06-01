import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type MemoryCategory = "pattern" | "cue" | "success" | "breakdown";

export interface Memory {
  id: string;
  user_id: string;
  category: MemoryCategory;
  content: string;
  confidence: number;
  created_at: string;
}

export interface CreateMemoryInput {
  category: MemoryCategory;
  content: string;
  confidence?: number;
}

export function useMemories() {
  const { user } = useAuth();

  const createMemory = async (input: CreateMemoryInput): Promise<Memory | null> => {
    if (!user?.id) {
      console.warn("Cannot create memory: no authenticated user");
      return null;
    }

    const { data, error } = await supabase
      .from("memories")
      .insert({
        user_id: user.id,
        category: input.category,
        content: input.content,
        confidence: input.confidence ?? 0.5,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create memory:", error);
      return null;
    }

    return data as Memory;
  };

  const createMemories = async (inputs: CreateMemoryInput[]): Promise<Memory[]> => {
    if (!user?.id) {
      console.warn("Cannot create memories: no authenticated user");
      return [];
    }

    const records = inputs.map((input) => ({
      user_id: user.id,
      category: input.category,
      content: input.content,
      confidence: input.confidence ?? 0.5,
    }));

    const { data, error } = await supabase
      .from("memories")
      .insert(records)
      .select();

    if (error) {
      console.error("Failed to create memories:", error);
      return [];
    }

    return (data as Memory[]) ?? [];
  };

  const getMemories = async (category?: MemoryCategory): Promise<Memory[]> => {
    if (!user?.id) {
      return [];
    }

    let query = supabase
      .from("memories")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch memories:", error);
      return [];
    }

    return (data as Memory[]) ?? [];
  };

  const deleteMemory = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("memories").delete().eq("id", id);

    if (error) {
      console.error("Failed to delete memory:", error);
      return false;
    }

    return true;
  };

  return {
    createMemory,
    createMemories,
    getMemories,
    deleteMemory,
  };
}
