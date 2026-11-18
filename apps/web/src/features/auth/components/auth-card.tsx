"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { Input } from "@gleans/ui/input";
import { Label } from "@gleans/ui/label";
import { cn } from "@/lib/utils";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex w-full max-w-[440px] flex-col gap-8 rounded-[24px] border bg-white p-4">
      <div className="flex flex-col gap-4">
        <Image
          src="/images/gleans-mark.webp"
          alt=""
          width={60}
          height={60}
          priority
          className="size-[60px] rounded-[16px]"
        />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      {children}
      <p className="text-center text-sm">{footer}</p>
    </div>
  );
}

export function AuthField({
  label,
  htmlFor,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

const authIcons = { mail: Mail, lock: LockKeyhole, user: UserRound };

export function AuthInput({
  icon,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { icon: keyof typeof authIcons }) {
  const Icon = authIcons[icon];
  return (
    <div className="relative">
      <Icon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input className={cn("h-12 rounded-full py-3 pr-3 pl-11 md:text-base", className)} {...props} />
    </div>
  );
}

export function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  const VisibilityIcon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <LockKeyhole aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type={visible ? "text" : "password"}
        className="h-12 rounded-full py-3 pr-11 pl-11 md:text-base"
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
        aria-pressed={visible}
        className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <VisibilityIcon aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
