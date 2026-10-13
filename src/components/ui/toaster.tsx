import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { tr } from '@/lib/i18n';

export function Toaster() {
  const { toasts } = useToast()

  return (
    // Lo que anuncia el lector de pantalla: Radix lo trae en inglés fijo.
    <ToastProvider label={tr('Notificación')}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose aria-label={tr('Cerrar')} />
          </Toast>
        )
      })}
      <ToastViewport label={tr('Notificaciones ({hotkey})')} />
    </ToastProvider>
  )
}
