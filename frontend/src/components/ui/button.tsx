import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-[#1A73E8] text-white shadow-sm shadow-blue-500/10 hover:bg-blue-600 hover:scale-[1.01]",
        cancel: "bg-rose-500/10 text-rose-700 border border-rose-500/20 hover:bg-rose-600 hover:text-white hover:border-transparent hover:scale-[1.01]",
        destructive:
          "bg-rose-500/10 text-rose-700 border border-rose-500/20 hover:bg-rose-600 hover:text-white hover:border-transparent hover:scale-[1.01]",
        outline:
          "border border-white/80 bg-white/50 backdrop-blur-sm text-[#64748B] hover:text-[#1E293B] hover:bg-white/70 hover:scale-[1.01]",
        secondary:
          "bg-white/50 backdrop-blur-sm border border-white/80 text-[#64748B] hover:text-[#1E293B] hover:bg-white/70 hover:scale-[1.01]",
        ghost: "hover:bg-white/60 hover:text-[#1E293B] hover:scale-[1.01] rounded-xl",
        link: "text-[#1A73E8] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-[20px] py-[10px]",
        sm: "h-9 rounded-xl px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
