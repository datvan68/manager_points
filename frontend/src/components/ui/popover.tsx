import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverClose = PopoverPrimitive.Close

interface PopoverContentProps
  extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> {
  overlay?: boolean;
  showCloseButton?: boolean;
  centered?: boolean;
}

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(({ className, align = "center", sideOffset = 6, avoidCollisions = true, collisionPadding = 16, overlay = false, showCloseButton = false, centered = false, children, ...props }, ref) => (
  <>
    {overlay && (
      <PopoverPrimitive.Portal>
        <div
          aria-hidden="true"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[4px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 pointer-events-auto"
        />
      </PopoverPrimitive.Portal>
    )}
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        avoidCollisions={avoidCollisions}
        collisionPadding={collisionPadding}
        data-centered={centered ? "" : undefined}
        className={cn(
          "z-50 w-72 rounded-xl border border-slate-200/80 bg-white p-4 text-slate-900 shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-popover-content-transform-origin]",
          className?.includes('max-h-') ? '' : 'max-h-[var(--radix-popover-content-available-height)]',
          className?.includes('overflow-') ? '' : 'overflow-y-auto scrollbar-hover',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <PopoverPrimitive.Close
            aria-label="Đóng"
            className="absolute right-3.5 top-3.5 rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A73E8] cursor-pointer"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Đóng</span>
          </PopoverPrimitive.Close>
        )}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  </>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverClose }
