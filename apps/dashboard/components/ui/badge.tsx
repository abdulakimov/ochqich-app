import * as React from "react";

type Variant = "default" | "success" | "warning" | "danger";

const variantClasses: Record<Variant, string> = {
  default: "badge-default",
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger"
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

export function Badge({ className = "", variant = "default", ...props }: BadgeProps) {
  return <div className={`badge ${variantClasses[variant]} ${className}`.trim()} {...props} />;
}
