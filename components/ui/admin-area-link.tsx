import Link from "next/link";

type AdminAreaLinkProps = {
  className?: string;
};

export function AdminAreaLink({ className = "" }: AdminAreaLinkProps) {
  return (
    <Link
      className={`inline-flex rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 ${className}`}
      href="/admin"
    >
      Khu vực Admin
    </Link>
  );
}
