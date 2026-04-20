import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { Plus, MessageSquarePlus, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileLite { user_id: string; nombre: string; apellidos: string; }

export default function Diario() {
  const { user, primaryRole } = useAuth();
  const isCoach = primaryRole === "entrenador" || primaryRole === "superadmin";
  const isSuperadmin = primaryRole === "superadmin";

  const [fields, setFields] = useState<any[]>([]);
  const [sessionTypes, setSessionTypes] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ session_type_id: "", descripcion: "", molestias: "", completado: "si", marca_clave: "", observaciones: "" });
  const [creating, setCreating] = useState(false);

  // Filtros (rol coach)
  const [coachUsers, setCoachUsers] = useState<ProfileLite[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileLite>>({});
  const [filterUser, setFilterUser] = useState<string>("__all__");
  const [filterType, setFilterType] = useState<string>("__all__");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [userPickerOpen, setUserPickerOpen] = useState(false);

  const load = async () => {
    const [f, st] = await Promise.all([
      supabase.from("diary_field_configs").select("*").eq("status", "activo").order("orden"),
      supabase.from("session_types").select("*").eq("status", "activo").order("orden"),
    ]);
    setFields(f.data ?? []); setSessionTypes(st.data ?? []);
    const init: Record<string, number> = {}; (f.data ?? []).forEach((x: any) => init[x.id] = 5);
    setValues(init);

    if (isCoach && user) {
      let profs: ProfileLite[] = [];
      if (isSuperadmin) {
        const { data } = await supabase.from("profiles").select("user_id, nombre, apellidos").order("nombre");
        profs = data ?? [];
      } else {
        const { data: ca } = await supabase.from("coach_assignments").select("user_id").eq("coach_id", user.id);
        const ids = (ca ?? []).map((c) => c.user_id);
        if (ids.length) {
          const { data } = await supabase.from("profiles").select("user_id, nombre, apellidos").in("user_id", ids).order("nombre");
          profs = data ?? [];
        }
      }
      setCoachUsers(profs);
      const m: Record<string, ProfileLite> = {};
      profs.forEach((p) => { m[p.user_id] = p; });
      setProfilesMap(m);
    }
    await loadEntries();
  };

  const loadEntries = async () => {
    if (!user) return;
    let q = supabase.from("diary_entries").select("*, session_types(nombre)").order("fecha", { ascending: false }).limit(50);
    if (!isCoach) {
      q = q.eq("user_id", user.id);
    } else if (filterUser !== "__all__") {
      q = q.eq("user_id", filterUser);
    }
    if (filterType !== "__all__") q = q.eq("session_type_id", filterType);
    if (filterFrom) q = q.gte("fecha", filterFrom);
    const { data } = await q;
    const list = data ?? [];
    setEntries(list);

    // Asegurarse de tener los perfiles de los autores que aparecen
    if (isCoach) {
      const missing = Array.from(new Set(list.map((e) => e.user_id))).filter((uid) => !profilesMap[uid]);
      if (missing.length) {
        const { data: extra } = await supabase.from("profiles").select("user_id, nombre, apellidos").in("user_id", missing);
        if (extra) {
          setProfilesMap((prev) => {
            const m = { ...prev };
            extra.forEach((p) => { m[p.user_id] = p; });
            return m;
          });
        }
      }
    }
  };

  useEffect(() => { load(); }, [user, primaryRole]);
  useEffect(() => { loadEntries(); }, [filterUser, filterType, filterFrom]);

  const save = async () => {
    if (!user) return;
    const payload: any = { ...form, user_id: user.id, session_type_id: form.session_type_id || null };
    const { data, error } = await supabase.from("diary_entries").insert(payload).select().single();
    if (error) return toast.error(error.message);
    const valueRows = Object.entries(values).map(([field_id, v]) => ({ entry_id: data.id, field_id, valor: String(v) }));
    if (valueRows.length) await supabase.from("diary_entry_values").insert(valueRows);
    toast.success("Entrada guardada"); setCreating(false);
    setForm({ session_type_id: "", descripcion: "", molestias: "", completado: "si", marca_clave: "", observaciones: "" });
    loadEntries();
  };

  const saveComment = async (entryId: string) => {
    const txt = commentDraft[entryId] ?? "";
    if (!txt.trim()) return;
    const entry = entries.find((x) => x.id === entryId);
    const { error } = await supabase.from("diary_entries").update({ comentario_entrenador: txt }).eq("id", entryId);
    if (error) return toast.error(error.message);
    if (entry && entry.user_id !== user?.id) {
      await supabase.from("notifications").insert({
        user_id: entry.user_id, tipo: "diario",
        titulo: "Tu entrenador comentó tu diario",
        contenido: txt.slice(0, 80),
        link: "/app/diario",
      });
    }
    toast.success("Comentario guardado");
    setCommentDraft((p) => ({ ...p, [entryId]: "" }));
    loadEntries();
  };

  const visibleEntries = useMemo(() => entries, [entries]);

  const filterUserLabel = filterUser === "__all__"
    ? (isSuperadmin ? "Todos los deportistas" : "Todos mis deportistas")
    : (() => {
        const p = coachUsers.find((u) => u.user_id === filterUser) ?? profilesMap[filterUser];
        return p ? `${p.nombre} ${p.apellidos}` : "Deportista";
      })();

  return (
    <div>
      <PageHeader title="Diario de entrenamiento" description="Registra cada sesión, sensaciones y resultados."
        actions={!isCoach && <Button onClick={() => setCreating(!creating)}><Plus className="mr-2 h-4 w-4" /> Nueva entrada</Button>}
      />

      {isCoach && (
        <Card className="mb-6">
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Deportista</Label>
              <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    <span className="truncate">{filterUserLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar deportista..." />
                    <CommandList>
                      <CommandEmpty>Sin resultados.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__all__ todos"
                          onSelect={() => { setFilterUser("__all__"); setUserPickerOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", filterUser === "__all__" ? "opacity-100" : "opacity-0")} />
                          {isSuperadmin ? "Todos los deportistas" : "Todos mis deportistas"}
                        </CommandItem>
                        {coachUsers.map((u) => (
                          <CommandItem
                            key={u.user_id}
                            value={`${u.nombre} ${u.apellidos}`}
                            onSelect={() => { setFilterUser(u.user_id); setUserPickerOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", filterUser === u.user_id ? "opacity-100" : "opacity-0")} />
                            {u.nombre} {u.apellidos}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2"><Label>Tipo de sesión</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {sessionTypes.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Desde fecha</Label>
              <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      )}

      {creating && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Nueva entrada</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Tipo de sesión</Label>
                <Select value={form.session_type_id} onValueChange={(v) => setForm({ ...form, session_type_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                  <SelectContent>{sessionTypes.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>¿Completaste las series?</Label>
                <Select value={form.completado} onValueChange={(v) => setForm({ ...form, completado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="si">Sí</SelectItem><SelectItem value="parcial">Parcial</SelectItem><SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Descripción del entrenamiento</Label><Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
            {fields.map((f) => (
              <div key={f.id} className="space-y-2">
                <div className="flex justify-between"><Label>{f.label}</Label><span className="text-sm font-medium text-primary">{values[f.id] ?? 5}</span></div>
                <Slider min={f.config?.min ?? 1} max={f.config?.max ?? 10} step={1} value={[values[f.id] ?? 5]} onValueChange={(v) => setValues({ ...values, [f.id]: v[0] })} />
              </div>
            ))}
            <div className="space-y-2"><Label>Molestias / lesiones</Label><Textarea value={form.molestias} onChange={(e) => setForm({ ...form, molestias: e.target.value })} /></div>
            <div className="space-y-2"><Label>Marca / resultado clave</Label><Input value={form.marca_clave} onChange={(e) => setForm({ ...form, marca_clave: e.target.value })} /></div>
            <div className="space-y-2"><Label>Observaciones</Label><Textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>
            <div className="flex gap-2"><Button onClick={save}>Guardar</Button><Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button></div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {visibleEntries.map((e) => {
          const author = profilesMap[e.user_id];
          return (
            <Card key={e.id}>
              <CardHeader>
                <div className="flex justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">
                    {new Date(e.fecha).toLocaleDateString("es-ES")} · {e.session_types?.nombre ?? "Sin tipo"}
                    {isCoach && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({author ? `${author.nombre} ${author.apellidos}` : "—"})
                      </span>
                    )}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">{e.completado}</span>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {e.descripcion && <p>{e.descripcion}</p>}
                {e.marca_clave && <p><strong>Marca clave:</strong> {e.marca_clave}</p>}
                {e.molestias && <p className="text-destructive"><strong>Molestias:</strong> {e.molestias}</p>}
                {e.observaciones && <p className="text-muted-foreground"><strong>Obs:</strong> {e.observaciones}</p>}
                {e.comentario_entrenador && (
                  <div className="mt-2 p-2 bg-secondary text-secondary-foreground rounded text-xs">
                    <strong>Comentario entrenador:</strong> {e.comentario_entrenador}
                  </div>
                )}
                {isCoach && (
                  <div className="pt-2 flex gap-2 items-start">
                    <Textarea
                      rows={2}
                      placeholder="Añadir/actualizar comentario..."
                      value={commentDraft[e.id] ?? ""}
                      onChange={(ev) => setCommentDraft((p) => ({ ...p, [e.id]: ev.target.value }))}
                    />
                    <Button size="sm" variant="outline" onClick={() => saveComment(e.id)}>
                      <MessageSquarePlus className="h-3 w-3 mr-1" /> Guardar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {visibleEntries.length === 0 && !creating && <p className="text-center text-muted-foreground py-8">Sin entradas todavía.</p>}
      </div>
    </div>
  );
}
