import * as React from "react";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = "", ...props }, ref) => {
    return <textarea className={`textarea ${className}`.trim()} ref={ref} {...props} />;
  }
);

Textarea.displayName = "Textarea";

export { Textarea };
