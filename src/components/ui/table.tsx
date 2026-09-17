"use client"

import * as React from "react"
import { cn } from "cn"
import { useResizableColumns } from "@/hooks/useResizableColumns"

function Table({ className, children, ...props }: React.ComponentProps<"table">) {
  const tableRef = React.useRef<HTMLTableElement>(null)
  const [columnCount, setColumnCount] = React.useState(0)
  const [largurasIniciais, setLargurasIniciais] = React.useState<number[] | undefined>(undefined)

  // Descobre o número de colunas e mede a largura natural de cada uma (layout ainda "auto" nesse momento,
  // antes de travar em table-layout: fixed) — assim redimensionar não muda nada até o usuário arrastar.
  React.useLayoutEffect(() => {
    const headerRow = tableRef.current?.querySelector("thead tr")
    const n = headerRow?.children.length ?? 0
    setColumnCount(n)
    if (n && !largurasIniciais) setLargurasIniciais(Array.from(headerRow!.children).map((th) => (th as HTMLElement).offsetWidth))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children])

  const { columnWidths, handleMouseDown } = useResizableColumns({ columnCount, defaultWidths: largurasIniciais })

  React.useEffect(() => {
    const table = tableRef.current
    if (!columnCount || !table || !largurasIniciais) return
    const headers = Array.from(table.querySelectorAll("thead tr:first-child > *")) as HTMLElement[]
    const tbody = table.querySelector("tbody")
    let esquerdaAcumulada = 0

    headers.forEach((th, index) => {
      const largura = columnWidths[index]
      if (!largura) return
      th.style.width = `${largura}px`
      th.style.minWidth = `${largura}px`
      th.style.maxWidth = `${largura}px`
      th.style.position = "relative"
      // Colunas "grudadas" (.fix) têm a posição recalculada a partir da largura real das anteriores,
      // em vez de depender de um valor fixo em pixels que quebraria ao redimensionar.
      if (th.classList.contains("fix")) th.style.left = `${esquerdaAcumulada}px`
      esquerdaAcumulada += largura

      th.querySelectorAll(":scope > .resize-handler").forEach((h) => h.remove())
      if (index < columnCount - 1) {
        const handler = document.createElement("div")
        handler.className = "resize-handler absolute top-0 right-0 h-full w-1.5 cursor-col-resize"
        handler.style.zIndex = "10"
        handler.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); handleMouseDown(index, e) })
        th.appendChild(handler)
      }

      if (tbody) {
        let esquerdaCelula = 0
        for (let i = 0; i < index; i++) esquerdaCelula += columnWidths[i] ?? 0
        Array.from(tbody.querySelectorAll("tr")).forEach((row) => {
          const cell = row.children[index] as HTMLElement | undefined
          if (!cell) return
          cell.style.width = `${largura}px`
          cell.style.minWidth = `${largura}px`
          cell.style.maxWidth = `${largura}px`
          if (cell.classList.contains("fix")) cell.style.left = `${esquerdaCelula}px`
        })
      }
    })
  }, [columnWidths, columnCount, largurasIniciais, handleMouseDown])

  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        ref={tableRef}
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        style={largurasIniciais ? { tableLayout: "fixed" } : undefined}
        {...props}
      >
        {children}
      </table>
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("sticky top-0 z-10 bg-background [&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
