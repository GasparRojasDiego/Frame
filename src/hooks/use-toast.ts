// Inspired by react-hot-toast library
import * as React from "react";

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast";

const TOAST_LIMIT = 1

/** Tiempo que el aviso sigue en memoria DESPUÉS de cerrarse: lo justo para
 *  que termine su animación de salida. Antes eran ~17 minutos. */
const TOAST_REMOVE_DELAY = 1000

// ------------------------------------------------------------
// Cuánto dura un aviso en pantalla
//
// Radix cierra todos a los 5 s por igual, y eso trata igual a "Guardado" que
// a un aviso de tres renglones que hay que leer entero. Aquí la duración sale
// de lo que hay que leer: un poco de base para que el ojo llegue, más el
// tiempo de lectura del texto, con suelo y techo para que ni parpadee ni se
// quede estorbando. Los errores empiezan más arriba: hay que entenderlos.
// ------------------------------------------------------------

/** Milisegundos por carácter (≈220 palabras por minuto). */
const MS_PER_CHAR = 55
const BASE_MS = 1600
const MIN_MS = 4000
const MIN_MS_DESTRUCTIVE = 7000
const MAX_MS = 12000

const textLength = (value: React.ReactNode): number =>
  typeof value === 'string' || typeof value === 'number' ? String(value).length : 0

function readingDuration(toast: Toast): number {
  const chars = textLength(toast.title) + textLength(toast.description)
  const floor = toast.variant === 'destructive' ? MIN_MS_DESTRUCTIVE : MIN_MS
  return Math.min(MAX_MS, Math.max(floor, BASE_MS + chars * MS_PER_CHAR))
}

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

// ------------------------------------------------------------
// Cierre propio, que no depende del foco de la ventana
//
// Radix DETIENE la cuenta atrás de sus avisos mientras la ventana no tiene el
// foco. Un aviso nacido con Frame en segundo plano (fin de una sesión, algo que
// publicó un profesor…) se quedaba clavado en la esquina hasta pulsar su X.
// Este temporizador lo cierra igualmente: si Frame no estaba a la vista, la
// cuenta empieza cuando el usuario vuelve, para que llegue a leerlo.
// ------------------------------------------------------------
const AUTO_DISMISS_MARGIN_MS = 1200
const PRESENCE_EVENTS = ['focus', 'pointermove', 'pointerdown', 'keydown'] as const
/** Pase lo que pase, un aviso no sigue en pantalla más de esto. */
const HARD_CAP_MS = 60_000

// «Con el ratón encima» se mide por movimiento reciente, no con `:hover`: al
// minimizar, el puntero baja hacia la barra de tareas cruzando el aviso de la
// esquina, el motor web no recibe la salida y `:hover` queda pegado para
// siempre (1.6.3 y antes: el aviso no se cerraba nunca al volver).
let lastPointerOnToast = 0
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointermove',
    (event) => {
      const target = event.target as Element | null
      if (target?.closest?.('[data-toast-viewport]')) lastPointerOnToast = Date.now()
    },
    true
  )
}
const readingNow = () =>
  document.hasFocus() && !document.hidden && Date.now() - lastPointerOnToast < 2500

function armAutoDismiss(duration: number, dismiss: () => void) {
  if (typeof window === 'undefined' || !Number.isFinite(duration) || duration <= 0) return

  const born = Date.now()
  let done = false
  const finish = () => {
    if (done) return
    done = true
    dismiss()
  }
  const close = () => {
    // Con el ratón encima se está leyendo: se espera a que lo aparte.
    if (readingNow() && Date.now() - born < HARD_CAP_MS) {
      window.setTimeout(close, 1500)
      return
    }
    finish()
  }
  window.setTimeout(finish, HARD_CAP_MS)
  const start = () => window.setTimeout(close, duration + AUTO_DISMISS_MARGIN_MS)

  if (document.hasFocus() && !document.hidden) {
    start()
    return
  }
  const onBack = () => {
    PRESENCE_EVENTS.forEach((name) => window.removeEventListener(name, onBack, true))
    document.removeEventListener('visibilitychange', onVisible)
    start()
  }
  const onVisible = () => {
    if (!document.hidden) onBack()
  }
  PRESENCE_EVENTS.forEach((name) => window.addEventListener(name, onBack, true))
  document.addEventListener('visibilitychange', onVisible)
}

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })
  const duration = props.duration ?? readingDuration(props)

  dispatch({
    type: "ADD_TOAST",
    toast: {
      // Quien llama puede fijar su propia duración; si no, se calcula.
      ...props,
      duration,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })
  armAutoDismiss(duration, () => {
    // Solo si sigue en pantalla: cerrar uno ya retirado lo reencolaría en vano.
    if (memoryState.toasts.some((t) => t.id === id && t.open !== false)) dismiss()
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

const dismissToast = (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId })
const actions = { toast, dismiss: dismissToast }

/**
 * Para lanzar avisos. Sin estado (1.7.0): antes cada uno de los ~25
 * componentes que lo usan se suscribía a la lista y se repintaba con cada
 * aviso (tres veces: al salir, al cerrarse y al retirarse), barra lateral y
 * reproductor incluidos. Solo el que los pinta necesita la lista.
 */
function useToast() {
  return actions
}

/** La lista de avisos en pantalla: solo para quien los pinta (toaster.tsx). */
function useToastList() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    // Lo que se lanzó entre el primer pintado y la suscripción.
    setState(memoryState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])

  return state
}

export { useToast, useToastList, toast }
