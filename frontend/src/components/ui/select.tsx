"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"

// Context to bridge elements together
interface SelectContextProps {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedLabel: string;
  setSelectedLabel: (label: string) => void;
  openUp: boolean;
  error?: string;
}

const SelectContext = React.createContext<SelectContextProps | undefined>(undefined);

const getChildText = (node: any): string => {
  if (!node) return "";
  if (Array.isArray(node)) {
    return node.map(getChildText).join("");
  }
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (node.props && node.props.children) {
    return getChildText(node.props.children);
  }
  return "";
};

export const Select = ({
  children,
  value,
  onValueChange,
  label,
  required,
  error,
  containerClassName,
}: any) => {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedLabel, setSelectedLabel] = React.useState("");
  const [openUp, setOpenUp] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  React.useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Reset display label when the selection is cleared
  React.useEffect(() => {
    if (!value) {
      setSelectedLabel("");
    }
  }, [value]);

  // Dynamically calculate opening direction (upwards or downwards) based on viewport space
  React.useEffect(() => {
    const checkDirection = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropdownHeight = 230; // height of dropdown viewport (~220px) + padding/border
        if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
          setOpenUp(true);
        } else {
          setOpenUp(false);
        }
      }
    };

    if (open) {
      checkDirection();
      window.addEventListener("scroll", checkDirection, true);
      window.addEventListener("resize", checkDirection);
    }

    return () => {
      window.removeEventListener("scroll", checkDirection, true);
      window.removeEventListener("resize", checkDirection);
    };
  }, [open]);

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange,
        open,
        setOpen,
        searchQuery,
        setSearchQuery,
        selectedLabel,
        setSelectedLabel,
        openUp,
        error,
      }}
    >
      <div ref={containerRef} className={cn("flex flex-col gap-1.5 w-full", containerClassName)}>
        {label && (
          <label className="flex items-center gap-1 px-1 text-sm font-medium text-slate-700">
            {label}
            {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <div className="relative w-full">
          {children}
        </div>
        {error && (
          <p className="px-1 text-[12px] font-medium text-red-500 mt-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
            {error}
          </p>
        )}
      </div>
    </SelectContext.Provider>
  );
};

export const SelectGroup = ({ children }: any) => (
  <div className="space-y-1">{children}</div>
);

export const SelectValue = ({ placeholder, children }: any) => {
  return <>{children || placeholder}</>;
};

export const SelectTrigger = React.forwardRef<any, any>(
  ({ className, children, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error("SelectTrigger must be used inside Select");

    const { open, setOpen, searchQuery, setSearchQuery, selectedLabel, error } = context;

    // Extract placeholder text
    let placeholder = "Chọn...";
    React.Children.forEach(children, (child: any) => {
      if (child && (child.type === SelectValue || child.props?.placeholder)) {
        placeholder = child.props.placeholder || placeholder;
      }
    });

    return (
      <div
        className={cn(
          "relative flex h-10 w-full items-center justify-between rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all cursor-text",
          error && "border-red-500 focus-within:ring-red-500/20 focus-within:border-red-500",
          className
        )}
        onClick={() => setOpen(true)}
      >
        <input
          type="text"
          className="w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400"
          placeholder={placeholder}
          value={open ? searchQuery : (selectedLabel || "")}
          onChange={(e) => {
            setOpen(true);
            setSearchQuery(e.target.value);
          }}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        />
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2 pointer-events-none" />
      </div>
    );
  }
);
SelectTrigger.displayName = "SelectTrigger";



export const SelectContent = React.forwardRef<any, any>(
  ({ className, children, position = "popper", lazyLoad = false, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error("SelectContent must be used inside Select");

    const { open, searchQuery, openUp } = context;

    // Filter children SelectItem components based on searchQuery
    const filteredChildren = React.useMemo(() => {
      const childrenArray = React.Children.toArray(children);
      if (!searchQuery) return childrenArray;

      return childrenArray.filter((child: any) => {
        if (child && child.props && child.props.value) {
          const text = getChildText(child).toLowerCase();
          return text.includes(searchQuery.toLowerCase());
        }
        return true; // Keep labels, groups, separators
      });
    }, [children, searchQuery]);

    const hasItems = React.useMemo(() => {
      return filteredChildren.some((child: any) => child && child.props && child.props.value);
    }, [filteredChildren]);

    const [visibleCount, setVisibleCount] = React.useState(lazyLoad ? 5 : filteredChildren.length);

    // Reset visible items count when dropdown opens or search query changes
    React.useEffect(() => {
      if (open) {
        setVisibleCount(lazyLoad ? 5 : filteredChildren.length);
      }
    }, [open, searchQuery, lazyLoad, filteredChildren.length]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      if (!lazyLoad) return;
      const target = e.currentTarget;
      if (target.scrollHeight - target.scrollTop <= target.clientHeight + 15) {
        setVisibleCount((prev) => Math.min(prev + 5, filteredChildren.length));
      }
    };

    return (
      <div
        className={cn(
          "absolute left-0 right-0 z-[100] min-w-[var(--radix-select-trigger-width)] bg-white rounded-xl shadow-xl border border-slate-100/60 p-1 overflow-hidden transition-all duration-200",
          openUp ? "bottom-full mb-1.5" : "top-full mt-1.5",
          open
            ? "opacity-100 visible scale-100 translate-y-0"
            : "opacity-0 invisible scale-95 pointer-events-none",
          className
        )}
      >
        <div 
          className={cn(
            "p-1 overflow-y-auto",
            lazyLoad ? "max-h-[160px]" : "max-h-[220px]"
          )}
          onScroll={handleScroll}
        >
          {hasItems || !searchQuery ? (
            lazyLoad ? filteredChildren.slice(0, visibleCount) : filteredChildren
          ) : (
            <div className="py-6 text-center text-xs text-slate-400 font-medium">
              Không tìm thấy kết quả
            </div>
          )}
        </div>
      </div>
    );
  }
);
SelectContent.displayName = "SelectContent";

export const SelectLabel = React.forwardRef<any, any>(
  ({ className, ...props }, ref) => (
    <div
      className={cn("px-3 py-1.5 text-xs font-semibold text-slate-400", className)}
      {...props}
    />
  )
);
SelectLabel.displayName = "SelectLabel";

export const SelectItem = React.forwardRef<any, any>(
  ({ className, children, value: itemValue, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error("SelectItem must be used inside Select");

    const { value, onValueChange, setOpen, setSearchQuery, setSelectedLabel } = context;

    const isSelected = value === itemValue;
    const label = React.useMemo(() => getChildText(children), [children]);

    // Track active value and update the trigger input display label
    React.useEffect(() => {
      if (isSelected) {
        setSelectedLabel(label);
      }
    }, [isSelected, label, setSelectedLabel]);

    const handleSelect = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onValueChange) {
        onValueChange(itemValue);
      }
      setSelectedLabel(label);
      setSearchQuery("");
      setOpen(false);
    };

    return (
      <div
        onClick={handleSelect}
        className={cn(
          "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-8 text-sm outline-none text-slate-700 hover:bg-slate-50 transition-all",
          isSelected && "bg-blue-50 text-blue-700 font-bold",
          className
        )}
        {...props}
      >
        {children}
        {isSelected && (
          <span className="absolute right-3 flex h-3.5 w-3.5 items-center justify-center">
            <Check className="h-4 w-4 text-blue-600" />
          </span>
        )}
      </div>
    );
  }
);
SelectItem.displayName = "SelectItem";

export const SelectSeparator = React.forwardRef<any, any>(
  ({ className, ...props }, ref) => (
    <div className={cn("-mx-1 my-1 h-px bg-slate-100", className)} {...props} />
  )
);
SelectSeparator.displayName = "SelectSeparator";

// Dummies for compatibility
export const SelectScrollUpButton = () => null;
export const SelectScrollDownButton = () => null;

interface SelectFieldProps {
  label: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
  children: React.ReactNode;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  required,
  placeholder,
  error,
  children,
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-slate-700">
      {label}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
    <Select>
      <SelectTrigger className="h-10">
        {placeholder && <SelectValue placeholder={placeholder} />}
        {children}
      </SelectTrigger>
      <SelectContent />
    </Select>
    {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
  </div>
);
