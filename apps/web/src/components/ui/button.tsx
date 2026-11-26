import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-w-0 max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-br from-primary to-[#5b3fd6] text-primary-foreground shadow-cta hover:brightness-105 active:brightness-95",
        brand: "bg-gradient-to-r from-[#6f52ed] to-guava text-white shadow-cta hover:brightness-105 active:brightness-95",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-card hover:bg-secondary hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-secondary hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-full px-3.5",
        lg: "h-12 rounded-full px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    if (asChild) return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
    // Long (AZ/RU) labels never push the layout: text nodes shrink and truncate with an ellipsis,
    // and a lone text label keeps the full text in a native tooltip.
    const { children, title, ...rest } = props;
    const fullText = typeof children === "string" ? children : undefined;
    const content = React.Children.map(children, (child) =>
      typeof child === "string" && child.trim() ? <span className="min-w-0 truncate">{child}</span> : child,
    );
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} title={title ?? fullText} {...rest}>
        {content}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
