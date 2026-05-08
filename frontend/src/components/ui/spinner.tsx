import React from "react";
import { Loader2 } from "lucide-react";

interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  className?: string;
}

export function Spinner({ className, ...props }: SpinnerProps) {
  return (
    <Loader2 
      className={`h-4 w-4 animate-spin ${className || ""}`} 
      {...props} 
    />
  );
}
