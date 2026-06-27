"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function useRefreshOnSuccess(input: { status: string; nonce?: number }): void {
  const router = useRouter();
  const previousNonceRef = useRef(input.nonce);
  const previousStatusRef = useRef(input.status);

  useEffect(() => {
    const transitionedToSuccess = previousStatusRef.current !== "success" && input.status === "success";
    const isNewNonce = typeof input.nonce === "number" && input.nonce !== previousNonceRef.current;

    if (transitionedToSuccess || (input.status === "success" && isNewNonce)) {
      router.refresh();
    }

    previousStatusRef.current = input.status;
    previousNonceRef.current = input.nonce;
  }, [input.nonce, input.status, router]);
}

