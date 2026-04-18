import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { ReactNode } from "react";

interface SortableItemProps {
  id: string;
  children: ReactNode;
  disabled?: boolean;
}

export function SortableItem({ id, children, disabled }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      {!disabled && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-1 text-muted-foreground hover:text-foreground"
          aria-label="Reordenar"
          type="button"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <div className="flex-1">{children}</div>
    </div>
  );
}
