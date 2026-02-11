import * as React from "react";

type Variant = "default" | "outline" | "secondary" | "destructive";
type Size = "default" | "sm" | "lg";

const variantClasses: Record<Variant, string> = {
  default: "btn btn-default",
  outline: "btn btn-outline",
  secondary: "btn btn-secondary",
  destructive: "btn btn-destructive"
};

const sizeClasses: Record<Size, string> = {
  default: "btn-md",
  sm: "btn-sm",
  lg: "btn-lg"
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ className = "", variant = "default", size = "default", ...props }: ButtonProps) {
  return <button className={`${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim()} {...props} />;
}
