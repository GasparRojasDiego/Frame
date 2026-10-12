import * as React from "react";

import { cn } from "@/lib/utils";
import EchoWord from "@/components/shared/EchoWord";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

/** La palabra del eco: la primera del título del recuadro, si es texto. */
function echoWordFrom(children: React.ReactNode): string | null {
  let word: string | null = null
  React.Children.forEach(children, (child) => {
    if (word || !React.isValidElement(child) || child.type !== CardTitle) return
    const inner = (child.props as { children?: React.ReactNode }).children
    const text = typeof inner === "string" ? inner : Array.isArray(inner) ? inner.filter((p) => typeof p === "string").join(" ") : ""
    const first = text.replace(/[¿?¡!«»"·]/g, " ").trim().split(/\s+/)[0]
    if (first) word = first
  })
  return word
}

/**
 * Encabezado de un recuadro (1.6.6, Diego): el título con su eco detrás —la
 * primera palabra del título, o `echo`— y una línea fina debajo, con aire a
 * ambos lados, que lo separa del contenido. El eco no sale del encabezado.
 * `echo={false}` lo quita (y `divider={false}`, la línea).
 */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { echo?: string | false; divider?: boolean }
>(({ className, children, echo, divider = true, ...props }, ref) => {
  const word = echo === false ? null : echo ?? echoWordFrom(children)
  return (
    <div
      ref={ref}
      className={cn(
        "relative isolate flex flex-col space-y-1.5 overflow-hidden p-6",
        divider && "after:pointer-events-none after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-border",
        className
      )}
      {...props}
    >
      {children}
      {/* Detrás del texto (z negativo dentro del encabezado aislado). */}
      {word && <EchoWord word={word} className="-z-10" />}
    </div>
  )
})
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
