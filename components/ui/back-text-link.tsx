import Link from "next/link";
import type { ReactNode } from "react";

type BackTextLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

export function BackTextLink({ href, children, className = "" }: BackTextLinkProps) {
  return (
    <Link className={`inline-flex text-sm font-medium text-sky-700 hover:text-sky-900 ${className}`} href={href}>
      <span aria-hidden="true" className="mr-1">←</span>
      {children}
    </Link>
  );
}
