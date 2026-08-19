"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"
import { controlBase } from "./controlStyles"

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
  onSearchQueryChange?: (query: string) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  selectId: string;
  highlightedIndex: number;
  setHighlightedIndex: React.Dispatch<React.SetStateAction<number>>;
  registeredItems: Array<{ value: string; label: string }>;
  registerItem: (value: string, label: string) => () => void;
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
  onSearchQueryChange,
  label,
  required,
  error,
  containerClassName,
}: any) => {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedLabel, setSelectedLabel] = React.useState("");
  const [openUp, setOpenUp] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const [registeredItems, setRegisteredItems] = React.useState<Array<{ value: string; label: string }>>([]);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const generatedId = React.useId();
  const selectId = `select-${generatedId.replace(/:/g, "")}`;

  const registerItem = React.useCallback((itemValue: string, itemLabel: string) => {
    setRegisteredItems((prev) => {
      const idx = prev.findIndex((i) => i.value === itemValue);
      if (idx >= 0) {
        if (prev[idx].label === itemLabel) return prev;
        const next = [...prev];
        next[idx] = { value: itemValue, label: itemLabel };
        return next;
      }
      return [...prev, { value: itemValue, label: itemLabel }];
    });
    return () => {
      setRegisteredItems((prev) => prev.filter((i) => i.value !== itemValue));
    };
  }, []);

  // Close dropdown on click outside
  React.useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && 
        !containerRef.current.contains(target) &&
        (!contentRef.current || !contentRef.current.contains(target))
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Reset display label when the selection is cleared or value changes
  React.useEffect(() => {
    if (value === undefined || value === null || value === "") {
      setSelectedLabel("");
    } else {
      const found = registeredItems.find((i) => i.value === String(value));
      if (found) {
        setSelectedLabel(found.label);
      }
    }
  }, [value, registeredItems]);

  // When opening/closing
  React.useEffect(() => {
    if (open) {
      if (value !== undefined && value !== null && value !== "") {
        const idx = registeredItems.findIndex((i) => i.value === String(value));
        setHighlightedIndex(idx >= 0 ? idx : 0);
      } else {
        setHighlightedIndex(0);
      }
    } else {
      setSearchQuery("");
      setHighlightedIndex(-1);
    }
  }, [open, value, registeredItems]);

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
        onSearchQueryChange,
        triggerRef,
        contentRef,
        inputRef,
        selectId,
        highlightedIndex,
        setHighlightedIndex,
        registeredItems,
        registerItem,
      }}
    >
      <div ref={containerRef} className={cn("flex flex-col gap-1.5 w-full", containerClassName)}>
        {label && (
          <label
            htmlFor={`${selectId}-input`}
            className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]"
          >
            {label}
            {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <div className={cn("relative w-full", open && "z-50")} ref={triggerRef}>
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
  ({ className, children, disabled, id, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error("SelectTrigger must be used inside Select");

    const {
      open,
      setOpen,
      searchQuery,
      setSearchQuery,
      selectedLabel,
      error,
      inputRef,
      selectId,
      highlightedIndex,
      setHighlightedIndex,
      registeredItems,
      onValueChange,
      value,
    } = context;

    // Extract placeholder text and value fallback
    let placeholder = "Chọn...";
    let valueFallback: string | undefined;
    React.Children.forEach(children, (child: any) => {
      if (child && (child.type === SelectValue || child.props?.placeholder)) {
        placeholder = child.props.placeholder || placeholder;
        if (child.props?.children && typeof child.props.children === 'string') {
          valueFallback = child.props.children;
        }
      }
    });

    const displayValue = open
      ? searchQuery
      : selectedLabel || valueFallback || (value !== undefined && value !== null ? String(value) : "");

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (props.onKeyDown) {
        props.onKeyDown(e);
      }
      if (e.defaultPrevented || disabled) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!open) {
          setOpen(true);
        } else {
          setHighlightedIndex((prev) => Math.min(prev + 1, Math.max(0, registeredItems.length - 1)));
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!open) {
          setOpen(true);
        } else {
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        }
      } else if (e.key === "Enter") {
        if (open) {
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < registeredItems.length) {
            const item = registeredItems[highlightedIndex];
            if (item) {
              onValueChange?.(item.value);
              context.setSelectedLabel(item.label);
              setSearchQuery("");
              setOpen(false);
            }
          }
        } else {
          e.preventDefault();
          setOpen(true);
        }
      } else if (e.key === "Escape") {
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
          setSearchQuery("");
        }
      } else if (e.key === "Tab") {
        if (open) {
          setOpen(false);
        }
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          `relative flex h-10 w-full items-center justify-between px-3 py-2 text-sm cursor-text outline-none focus:outline-none focus-visible:ring-0 ${controlBase}`,
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          error && "border-red-500 focus-within:ring-red-500/20 focus-within:border-red-500",
          className
        )}
        onClick={() => {
          if (!disabled) {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
        data-state={open ? "open" : "closed"}
        {...props}
      >
        <input
          ref={inputRef}
          id={id || `${selectId}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={`${selectId}-content`}
          aria-label={props["aria-label"]}
          aria-labelledby={props["aria-labelledby"]}
          aria-describedby={props["aria-describedby"]}
          aria-invalid={Boolean(error)}
          disabled={disabled}
          className="w-full bg-transparent border-none outline-none text-xs font-semibold text-[#1E293B] placeholder-slate-400 focus:ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
          placeholder={placeholder}
          value={displayValue}
          onChange={(e) => {
            if (disabled) return;
            setOpen(true);
            setSearchQuery(e.target.value);
            if (context.onSearchQueryChange) {
              context.onSearchQueryChange(e.target.value);
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2 pointer-events-none text-[#64748B]" />
      </div>
    );
  }
);
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = React.forwardRef<any, any>(
  ({ className, children, position = "popper", lazyLoad = false, onLoadMore, disablePortal = false, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error("SelectContent must be used inside Select");

    const { open, searchQuery, openUp, triggerRef, contentRef, selectId } = context;

    // Filter children SelectItem components based on searchQuery
    const filteredChildren = React.useMemo(() => {
      const childrenArray = React.Children.toArray(children);
      if (!searchQuery) return childrenArray;

      return childrenArray.filter((child: any) => {
        if (child && child.props && child.props.value !== undefined) {
          const text = (child.props.label || getChildText(child)).toLowerCase();
          return text.includes(searchQuery.toLowerCase());
        }
        return true; // Keep labels, groups, separators
      });
    }, [children, searchQuery]);

    const hasItems = React.useMemo(() => {
      return filteredChildren.some((child: any) => child && child.props && child.props.value !== undefined);
    }, [filteredChildren]);

    const [visibleCount, setVisibleCount] = React.useState(lazyLoad ? 5 : filteredChildren.length);
    const [rect, setRect] = React.useState<DOMRect | null>(null);

    // Reset visible items count when dropdown opens or search query changes
    React.useEffect(() => {
      if (open) {
        setVisibleCount(lazyLoad ? 5 : filteredChildren.length);
      }
    }, [open, searchQuery, lazyLoad, filteredChildren.length]);

    React.useLayoutEffect(() => {
      const updateRect = () => {
        if (triggerRef && triggerRef.current) {
          setRect(triggerRef.current.getBoundingClientRect());
        }
      };

      if (open) {
        updateRect();
        window.addEventListener("scroll", updateRect, true);
        window.addEventListener("resize", updateRect);
      }

      return () => {
        window.removeEventListener("scroll", updateRect, true);
        window.removeEventListener("resize", updateRect);
      };
    }, [open, triggerRef]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      if (target.scrollHeight - target.scrollTop <= target.clientHeight + 15) {
        if (lazyLoad) {
          setVisibleCount((prev) => Math.min(prev + 5, filteredChildren.length));
        }
        if (onLoadMore) {
          onLoadMore();
        }
      }
    };

    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => {
      setMounted(true);
    }, []);

    const content = (
      <div
        ref={contentRef}
        id={`${selectId}-content`}
        role="listbox"
        aria-label={props["aria-label"] || "Options"}
        data-select-content="true"
        className={cn(
          disablePortal ? "absolute" : "fixed",
          "z-[9999] w-max max-w-[280px] bg-white/80 backdrop-blur-md rounded-xl shadow-md border border-white/70 p-1 overflow-hidden transition duration-200 ease-out",
          open
            ? "opacity-100 visible scale-100 translate-y-0 pointer-events-auto"
            : "opacity-0 invisible scale-95 pointer-events-none",
          className
        )}
        style={
          disablePortal
            ? {
                minWidth: rect ? rect.width : 'auto',
                left: 0,
                top: !openUp ? 'calc(100% + 6px)' : 'auto',
                bottom: openUp ? 'calc(100% + 6px)' : 'auto',
              }
            : {
                minWidth: rect ? rect.width : 'auto',
                left: rect ? rect.left : 0,
                top: rect && !openUp ? rect.bottom + 6 : 'auto',
                bottom: rect && openUp ? window.innerHeight - rect.top + 6 : 'auto',
              }
        }
        {...props}
      >
        <div 
          className={cn(
            "p-1 overflow-y-auto overscroll-contain touch-pan-y",
            lazyLoad ? "max-h-[160px]" : "max-h-[220px]"
          )}
          onScroll={handleScroll}
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
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

    if (!mounted) return null;
    return disablePortal ? content : createPortal(content, document.body);
  }
);
SelectContent.displayName = "SelectContent";

export const SelectLabel = React.forwardRef<any, any>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-3 py-1.5 text-xs font-semibold text-[#64748B]", className)}
      {...props}
    />
  )
);
SelectLabel.displayName = "SelectLabel";

export const SelectItem = React.forwardRef<any, any>(
  ({ className, children, value: itemValue, label: customLabel, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error("SelectItem must be used inside Select");

    const {
      value,
      onValueChange,
      setOpen,
      setSearchQuery,
      setSelectedLabel,
      registerItem,
      highlightedIndex,
      setHighlightedIndex,
      registeredItems,
      selectId,
    } = context;

    const isSelected = value !== undefined && value !== null && value !== "" && String(value) === String(itemValue);
    const label = React.useMemo(() => customLabel || getChildText(children), [customLabel, children]);

    // Register item in SelectContext
    React.useEffect(() => {
      return registerItem(String(itemValue), label);
    }, [itemValue, label, registerItem]);

    // Track active value and update the trigger input display label
    React.useEffect(() => {
      if (isSelected) {
        setSelectedLabel(label);
      }
    }, [isSelected, label, setSelectedLabel]);

    const itemIndex = registeredItems.findIndex((i) => i.value === String(itemValue));
    const isHighlighted = highlightedIndex === itemIndex;

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
        ref={ref}
        role="option"
        aria-selected={isSelected}
        id={`${selectId}-option-${itemValue}`}
        data-highlighted={isHighlighted ? "true" : undefined}
        onClick={handleSelect}
        onMouseEnter={() => {
          if (itemIndex >= 0) setHighlightedIndex(itemIndex);
        }}
        className={cn(
          "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-8 text-xs font-medium outline-none text-[#1E293B] hover:bg-white/60 transition-all whitespace-nowrap",
          isHighlighted && !isSelected && "bg-slate-100/80",
          isSelected && "bg-blue-50/80 text-[#1A73E8] font-bold",
          className
        )}
        {...props}
      >
        {children}
        {isSelected && (
          <span className="absolute right-3 flex h-3.5 w-3.5 items-center justify-center">
            <Check className="h-4 w-4 text-[#1A73E8]" />
          </span>
        )}
      </div>
    );
  }
);
SelectItem.displayName = "SelectItem";

export const SelectSeparator = React.forwardRef<any, any>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("-mx-1 my-1 h-px bg-slate-100", className)} {...props} />
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
