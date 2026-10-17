import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium tracking-wide transition-[background-color,border-color,color,transform,box-shadow] duration-200 select-none disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-ivory text-ink hover:bg-white shadow-[0_8px_24px_-12px_rgb(242_239_230/0.45)]",
        felt: "bg-felt text-ivory hover:bg-felt-bright border border-felt-bright/40",
        outline: "border border-line-strong text-ivory hover:border-ivory/60 hover:bg-white/[0.03]",
        ghost: "text-ivory-dim hover:text-ivory hover:bg-white/[0.04]",
        gold: "border border-gold/60 text-gold hover:bg-gold/10",
        danger: "border border-loss/50 text-loss hover:bg-loss/10",
      },
      size: {
        sm: "h-9 px-4 text-[13px]",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-7 text-[15px]",
        icon: "size-11",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  block,
  type = "button",
  ...props
}: ComponentProps<"button"> & ButtonVariantProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}

export function ButtonLink({
  className,
  variant,
  size,
  block,
  ...props
}: ComponentProps<typeof Link> & ButtonVariantProps) {
  return <Link className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}
