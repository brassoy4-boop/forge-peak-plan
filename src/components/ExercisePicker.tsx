import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Dumbbell, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExercisePickerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (params: {
    exercise_id: string;
    series: number;
    repeticiones: string;
    descanso: string;
    tiempo: string;
    carga: string;
  }) => void;
  title?: string;
}

export function ExercisePicker({ open, onOpenChange, onAdd, title = "Añadir ejercicio" }: ExercisePickerProps) {
  const [exercises, setExercises] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("__all__");
  const [selectedId, setSelectedId] = useState<string>("");
  const [params, setParams] = useState({ series: 3, repeticiones: "10", descanso: "60s", tiempo: "", carga: "" });

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [e, c] = await Promise.all([
        supabase.from("exercises").select("*").eq("status", "activo").order("nombre"),
        supabase.from("exercise_categories").select("*").eq("status", "activo").order("orden"),
      ]);
      setExercises(e.data ?? []);
      setCategories(c.data ?? []);
    })();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSelectedId("");
      setSearch("");
      setCatFilter("__all__");
      setParams({ series: 3, repeticiones: "10", descanso: "60s", tiempo: "", carga: "" });
    }
  }, [open]);

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      if (catFilter !== "__all__" && ex.category_id !== catFilter) return false;
      if (search.trim() && !ex.nombre.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [exercises, search, catFilter]);

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.nombre ?? "Sin categoría";

  const handleAdd = () => {
    if (!selectedId) return;
    onAdd({ exercise_id: selectedId, ...params });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] min-h-0 flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="shrink-0 grid grid-cols-1 md:grid-cols-[1fr,220px] gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por nombre..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas las categorías</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="h-[40vh] min-h-0 border rounded-md">
          <div className="p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Sin ejercicios.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {filtered.map((ex) => {
                const isSel = selectedId === ex.id;
                return (
                  <button
                    type="button"
                    key={ex.id}
                    onClick={() => setSelectedId(ex.id)}
                    className={cn(
                      "relative text-left border rounded-md overflow-hidden bg-card hover:border-primary transition",
                      isSel && "border-primary ring-2 ring-primary"
                    )}
                  >
                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                      {ex.imagen_url ? (
                        <img src={ex.imagen_url} alt={ex.nombre} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <Dumbbell className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="p-2">
                      <div className="text-xs font-medium line-clamp-2">{ex.nombre}</div>
                      <div className="text-[10px] text-muted-foreground">{catName(ex.category_id)}</div>
                    </div>
                    {isSel && (
                      <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          </div>
        </ScrollArea>

        <div className="shrink-0 grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="space-y-1"><Label className="text-xs">Series</Label><Input type="number" value={params.series} onChange={(e) => setParams({ ...params, series: Number(e.target.value) })} /></div>
          <div className="space-y-1"><Label className="text-xs">Reps</Label><Input value={params.repeticiones} onChange={(e) => setParams({ ...params, repeticiones: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Tiempo</Label><Input value={params.tiempo} onChange={(e) => setParams({ ...params, tiempo: e.target.value })} placeholder="—" /></div>
          <div className="space-y-1"><Label className="text-xs">Carga</Label><Input value={params.carga} onChange={(e) => setParams({ ...params, carga: e.target.value })} placeholder="—" /></div>
          <div className="space-y-1"><Label className="text-xs">Descanso</Label><Input value={params.descanso} onChange={(e) => setParams({ ...params, descanso: e.target.value })} /></div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleAdd} disabled={!selectedId}>Añadir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
