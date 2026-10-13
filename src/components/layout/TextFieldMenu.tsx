import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardPaste, Copy, Scissors, TextSelect, type LucideIcon } from 'lucide-react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getLang, tr } from '@/lib/i18n';

// ============================================================
// Menú del clic derecho en los campos de texto (1.6.7).
//
// El que trae el motor web (WebView2) habla en el idioma de WINDOWS, no en
// el de Frame: con Frame en inglés sobre un Windows en español diría
// «Cortar, Copiar, Pegar». Cuando los dos idiomas no coinciden, Frame pone
// el suyo, con las mismas acciones; si coinciden, se deja el del sistema,
// que además sugiere correcciones ortográficas.
// ============================================================

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

interface MenuState {
  x: number;
  y: number;
  field: Field;
}

const TEXT_INPUTS = new Set(['text', 'search', 'email', 'password', 'url', 'tel', 'number']);

let current: MenuState | null = null;
const listeners = new Set<() => void>();
const setMenu = (next: MenuState | null) => {
  current = next;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Campo de texto bajo el clic; null si es otra cosa (casillas, botones…). */
export function textFieldAt(target: EventTarget | null): Field | null {
  const field = (target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable]') as Field | null;
  if (!field) return null;
  if (field instanceof HTMLInputElement) return TEXT_INPUTS.has(field.type) ? field : null;
  if (field instanceof HTMLTextAreaElement) return field;
  return field.isContentEditable ? field : null;
}

/**
 * Lo llama el `contextmenu` global (main.tsx). true: Frame pone su menú y el
 * del sistema no debe salir; false: se deja el del sistema.
 */
export function openTextFieldMenu(event: MouseEvent, field: Field): boolean {
  const systemLanguage = (navigator.language || '').toLowerCase();
  if (systemLanguage.startsWith(getLang())) return false;
  if (!window.matchMedia('(pointer: fine)').matches) return false;
  setMenu({ x: event.clientX, y: event.clientY, field });
  return true;
}

const isTextControl = (field: Field): field is HTMLInputElement | HTMLTextAreaElement =>
  field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement;

const isEditable = (field: Field) => (isTextControl(field) ? !field.readOnly && !field.disabled : field.isContentEditable);

/** ¿Hay texto marcado? Los campos de correo y número no dejan saberlo: se da por sí. */
function hasSelection(field: Field): boolean {
  if (isTextControl(field)) {
    const { selectionStart: start, selectionEnd: end } = field;
    return start === null || end === null ? true : start !== end;
  }
  return !(window.getSelection()?.isCollapsed ?? true);
}

async function paste(field: Field) {
  let text = '';
  try {
    text = isTauri() ? await invoke<string>('read_clipboard_text') : await navigator.clipboard.readText();
  } catch {
    return;
  }
  if (!text) return;
  // Una sola línea, como al pegar con Ctrl+V.
  if (field instanceof HTMLInputElement) text = text.replace(/\r?\n/g, ' ');
  field.focus();
  document.execCommand('insertText', false, text);
}

function selectAll(field: Field) {
  field.focus();
  if (isTextControl(field)) field.select();
  else document.execCommand('selectAll');
}

function Item({
  icon: Icon,
  label,
  keys,
  disabled = false,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  keys: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className="flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-left">{label}</span>
      <span className="pl-4 text-xs tabular-nums text-muted-foreground">{keys}</span>
    </button>
  );
}

export default function TextFieldMenu() {
  const menu = useSyncExternalStore(subscribe, () => current, () => null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  // Junto al puntero, sin salirse de la ventana.
  useLayoutEffect(() => {
    if (!menu || !boxRef.current) {
      setPosition(null);
      return;
    }
    const { width, height } = boxRef.current.getBoundingClientRect();
    setPosition({
      left: Math.max(4, Math.min(menu.x, window.innerWidth - width - 4)),
      top: menu.y + height > window.innerHeight - 4 ? Math.max(4, menu.y - height) : menu.y,
    });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onPointerDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, [menu]);

  if (!menu) return null;
  const { field } = menu;
  const editable = isEditable(field);
  const secret = field instanceof HTMLInputElement && field.type === 'password';
  const selected = hasSelection(field);
  const run = (action: () => void) => () => {
    action();
    setMenu(null);
  };

  return createPortal(
    <div
      ref={boxRef}
      role="menu"
      // Pulsar el menú no debe quitarle el foco (ni lo marcado) al campo.
      onMouseDown={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
      style={position ?? { left: menu.x, top: menu.y, visibility: 'hidden' }}
      className="fixed z-[400] min-w-[12rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
    >
      <Item icon={Scissors} label={tr('Cortar')} keys="Ctrl+X" disabled={!editable || !selected || secret} onSelect={run(() => document.execCommand('cut'))} />
      <Item icon={Copy} label={tr('Copiar')} keys="Ctrl+C" disabled={!selected || secret} onSelect={run(() => document.execCommand('copy'))} />
      <Item icon={ClipboardPaste} label={tr('Pegar')} keys="Ctrl+V" disabled={!editable} onSelect={run(() => void paste(field))} />
      <div className="-mx-1 my-1 h-px bg-muted" />
      <Item icon={TextSelect} label={tr('Seleccionar todo')} keys="Ctrl+A" onSelect={run(() => selectAll(field))} />
    </div>,
    document.body
  );
}
