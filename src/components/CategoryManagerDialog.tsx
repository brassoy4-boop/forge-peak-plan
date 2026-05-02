import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Category { id: string; nombre: string; }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Nombre de la tabla: 'mark_categories' | 'exercise_categories' */
  tableName: "mark_categories" | "exercise_categories";
  /** Título del modal */
  title: string;
  /** Categorías actuales */
  categories: Category[];
  /** Función para contar elementos por categoría (para impedir borrado si está en uso) */
  usageCount: (categoryId: string) => number;
  /** Refrescar tras cambios */
  onChanged: () => void;
}

export function CategoryManagerDialog({ open, onOpenChange, tableName, title, categories, usageCount, onChanged }: Props) {
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNombre, setEditingNombre] = useState("");

  const create = async () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    const { error } = await (supabase.from(tableName) as any).insert({ nombre });
    if (error) return toast.error(error.message);
    toast.success("Categoría creada");
    setNuevoNombre("");
    onChanged();
  };

  const startEdit = (c: Category) => { setEditingId(c.id); setEditingNombre(c.nombre); };
  const cancelEdit = () => { setEditingId(null); setEditingNombre(""); };
  const saveEdit = async () => {
    if (!editingId || !editingNombre.trim()) return;
    const { error } = await (supabase.from(tableName) as any).update({ nombre: editingNombre.trim() }).eq("id", editingId);
    if (error) return toast.error(error.message);
    toast.success("Categoría actualizada");
    cancelEdit();
    onChanged();
  };

  const remove = async (c: Category) => {
    if (usageCount(c.id) > 0) {
      return toast.error("No se puede eliminar: tiene elementos asociados.");
    }
    const { error } = await (supabase.from(tableName) as any).delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Categoría eliminada");
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nueva categoría</Label>
            <div className="flex gap-2">
              <Input
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Nombre"
                onKeyDown={(e) => e.key === "Enter" && create()}
              />
              <Button onClick={create}><Plus className="h-4 w-4 mr-1" /> Añadir</Button>
            </div>
          </div>

          <div className="border-t pt-3">
            <Label className="mb-2 block">Categorías existentes ({categories.length})</Label>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay categorías.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {categories.map((c) => {
                  const count = usageCount(c.id);
                  const isEditing = editingId === c.id;
                  return (
                    <div key={c.id} className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/30">
                      {isEditing ? (
                        <>
                          <Input
                            value={editingNombre}
                            onChange={(e) => setEditingNombre(e.target.value)}
                            className="h-8"
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit}><Check className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm font-medium">{c.nombre}</span>
                          <Badge variant="outline" className="text-xs">{count}</Badge>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(c)} title="Editar">
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8" title="Eliminar">
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar categoría "{c.nombre}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {count > 0
                                    ? `No se puede eliminar: tiene ${count} elemento(s) asociado(s). Reasígnalos primero.`
                                    : "Esta acción no se puede deshacer."}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove(c)} disabled={count > 0}>Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
