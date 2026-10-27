import type { ComponentProps, ReactNode } from "react";

// Piezas mínimas de formulario; se reemplazan por shadcn/ui cuando la interfaz crezca.

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && !error && <span className="text-muted">{hint}</span>}
      {error && <span className="text-danger">{error}</span>}
    </label>
  );
}

const control =
  "rounded-md border border-border bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-accent";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={control} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={2} {...props} className={control} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={control} />;
}

export function Button({ variant = "primary", ...props }: ComponentProps<"button"> & { variant?: "primary" | "ghost" }) {
  const styles =
    variant === "primary"
      ? "bg-accent text-white dark:text-black"
      : "border border-border";
  return (
    <button
      {...props}
      className={`rounded-md px-4 py-2 font-medium disabled:opacity-50 ${styles}`}
    />
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  );
}
