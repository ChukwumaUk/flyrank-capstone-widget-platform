import { Widget } from "./widgets.types";

// The PUBLIC shape of a widget — only what the script needs to render.
// Deliberately excludes owner_id, allowed_origins, timestamps.
export interface PublicWidgetConfig {
  id: string;
  type: string;
  title: string;
  description: string | null;
  config: Record<string, unknown>;
}

export function toPublicConfig(widget: Widget): PublicWidgetConfig {
  return {
    id: widget.id,
    type: widget.type,
    title: widget.title,
    description: widget.description,
    config: widget.config,
  };
}